import type { Locale } from "@/i18n/config";
import { cardLabels, renderCard } from "./card";
import type { StoredCard } from "./store";

/**
 * Drawn cards, kept a short while in memory: a card posted, then posted
 * again by the same player or a curious friend, is drawn once. The key holds
 * everything the picture depends on (the figures' date, the options, the
 * language), so an update or a changed option draws a new one at once.
 * Nothing is written to disk.
 *
 * Drawing costs a few hundred milliseconds of CPU: two at a time at most,
 * the others wait their turn, and a draw that takes too long is given up.
 */

export const CARD_TTL_MS = 10 * 60_000;
/** A card weighs 300 to 500 kB: forty is about 20 MB. */
const MAX_CARDS = 40;
const MAX_PARALLEL = 2;
const RENDER_TIMEOUT_MS = 20_000;

const drawn = new Map<string, { until: number; png: Promise<Buffer> }>();

let running = 0;
const waiting: (() => void)[] = [];

async function inTurn<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("card drawing timed out")), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

export const cardKey = (card: Pick<StoredCard, "discordKey" | "snapshotAt" | "showId">, locale: Locale) =>
  `${card.discordKey}:${card.snapshotAt.getTime()}:${card.showId ? 1 : 0}:${locale}`;

/** The card's PNG, drawn or from memory. Throws when there is no snapshot or the draw fails. */
export function cardPng(card: StoredCard, locale: Locale, now = Date.now()): Promise<Buffer> {
  const key = cardKey(card, locale);
  const known = drawn.get(key);
  if (known && known.until > now) return known.png;

  const snapshot = card.snapshot;
  if (!snapshot) return Promise.reject(new Error("no readable snapshot"));
  const png = inTurn(() => withTimeout(renderCard(snapshot, cardLabels(locale), { showId: card.showId, updatedAt: card.snapshotAt }), RENDER_TIMEOUT_MS));
  drawn.delete(key);
  drawn.set(key, { until: now + CARD_TTL_MS, png });
  png.catch(() => {
    if (drawn.get(key)?.png === png) drawn.delete(key);
  });
  for (const [k, v] of drawn) {
    if (drawn.size <= MAX_CARDS && v.until > now) break;
    drawn.delete(k);
  }
  return png;
}

/** Forgets every drawn picture of a Discord account (unlinked, or new figures). */
export function forgetCard(discordKey: string): void {
  for (const key of drawn.keys()) if (key.startsWith(`${discordKey}:`)) drawn.delete(key);
}

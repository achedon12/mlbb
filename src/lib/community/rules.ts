import { z } from "zod";
import { cleanText, hasLink, textLength } from "@/lib/community-builds";
import { LANES } from "@/lib/draft";
import {
  CARD_HEROES_MAX,
  CARD_NOTE_MAX,
  CATEGORIES,
  HERO_TAGS_MAX,
  LANGUAGES,
  PLAY_TIMES,
  RANKS,
  REGIONS,
  REPLY_BODY_MAX,
  REPLY_BODY_MIN,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  TARGET_KINDS,
  THREAD_BODY_MAX,
  THREAD_BODY_MIN,
  TITLE_MAX,
  TITLE_MIN,
} from "./constants";

export * from "./constants";

/**
 * Community area: the request schemas (zod) of the API routes, kept apart
 * from `constants.ts` so the browser forms do not ship zod. Pure, no I/O.
 */

/** A search query as stored in the address: one line, at most 100 characters. */
export function readQuery(value: string | undefined): string {
  if (!value) return "";
  return [...cleanText(value, false)].slice(0, 100).join("");
}

// -- Text ------------------------------------------------------------------

const text = (min: number, max: number, multiline: boolean) =>
  z
    .string()
    .max(max * 4)
    .transform((s) => cleanText(s, multiline))
    .refine((s) => textLength(s) >= min && textLength(s) <= max);

const heroList = z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(HERO_TAGS_MAX);

export const threadInput = z
  .object({
    category: z.enum(CATEGORIES),
    title: text(TITLE_MIN, TITLE_MAX, false),
    body: text(THREAD_BODY_MIN, THREAD_BODY_MAX, true),
    heroes: heroList.default([]),
  })
  .strict();
export type ThreadInput = z.infer<typeof threadInput>;

export const threadEdit = threadInput.omit({ category: true });
export type ThreadEdit = z.infer<typeof threadEdit>;

export const replyInput = z.object({ body: text(REPLY_BODY_MIN, REPLY_BODY_MAX, true) }).strict();


export const voteInput = z.object({ kind: z.enum(["thread", "post"]), id: z.number().int().positive().max(999_999_999) }).strict();


export const reportInput = z
  .object({
    kind: z.enum(TARGET_KINDS),
    id: z.number().int().positive().max(999_999_999),
    reason: z.enum(REPORT_REASONS),
    note: z
      .string()
      .max(REPORT_NOTE_MAX * 4)
      .transform((s) => cleanText(s, false))
      .refine((s) => textLength(s) <= REPORT_NOTE_MAX)
      .optional(),
  })
  .strict();

/** Heroes kept from a tag list: known slugs only, each once, in order. */
export function knownHeroes(slugs: readonly string[], known: { has(slug: string): boolean }): string[] {
  return [...new Set(slugs)].filter((s) => known.has(s)).slice(0, HERO_TAGS_MAX);
}

/** In-game id, with the server in brackets or after a space: `12345678 (1234)`. */
const GAME_ID = /^(\d{5,12})(?:\s*\(?\s*(\d{3,6})\s*\)?)?$/;
/** Discord username (2 to 32 of a-z 0-9 _ .), or a legacy `name#1234`. */
const DISCORD = /^(?:[a-z0-9_.]{2,32}|[^@#:`\s][^@#:`]{0,30}[^@#:`\s]#\d{4})$/i;

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((s) => cleanText(s, false))
    .refine((s) => textLength(s) <= max)
    .optional()
    .transform((s) => (s ? s : null));

export const cardInput = z
  .object({
    region: z.enum(REGIONS),
    rank: z.enum(RANKS),
    lanes: z.array(z.enum(LANES as unknown as [string, ...string[]])).min(1).max(LANES.length),
    heroes: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(CARD_HEROES_MAX).default([]),
    languages: z.array(z.enum(LANGUAGES)).min(1).max(4),
    playTimes: z.array(z.enum(PLAY_TIMES)).max(PLAY_TIMES.length).default([]),
    note: optionalText(CARD_NOTE_MAX),
    gameId: optionalText(24).refine((s) => s === null || GAME_ID.test(s)),
    discord: optionalText(40).refine((s) => s === null || DISCORD.test(s)),
  })
  .strict()
  .refine((card) => !card.note || !hasLink(card.note), { path: ["note"] })
  .transform((card) => ({
    ...card,
    lanes: [...new Set(card.lanes)],
    languages: [...new Set(card.languages)],
    playTimes: [...new Set(card.playTimes)],
    gameId: card.gameId ? card.gameId.replace(GAME_ID, (_, id: string, zone?: string) => (zone ? `${id} (${zone})` : id)) : null,
  }));
export type CardInput = z.infer<typeof cardInput>;

/** Name of the first field a zod error points at, for the form to show. */
export function firstField(error: z.ZodError): string {
  const head = error.issues[0]?.path[0];
  return typeof head === "string" ? head : "invalid";
}

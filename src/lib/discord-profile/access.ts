import { createHash } from "node:crypto";
import { SNAPSHOT_MAX_MS } from "./snapshot";

/**
 * Who may post whose card, decided without a database: the route reads the
 * row, this says what to answer.
 *
 * - Your own card: as soon as you linked it on the site (signed in with the
 *   game account and with this Discord account at once, which proves both).
 *   Posting it is your choice; the bot then shows it to the channel.
 * - Someone else's card: only when they made it public on the site. Off by
 *   default: linking is for yourself, showing your rank and heroes to
 *   anyone who types your name is a separate choice.
 * - A card whose figures are older than 30 days is not shown, even to its
 *   owner: the site cannot read them again on its own (see `snapshot.ts`).
 *
 * For someone else's card, "not linked", "private" and "too old" answer the
 * same thing: the bot must not tell who linked an account and keeps it hidden.
 */

/** Hash of a Discord id for the card table, in its own namespace: the id itself is never stored. */
export const profileDiscordKey = (discordId: string) =>
  createHash("sha256").update(`mlbbdex-profile-card:${discordId}`).digest("hex").slice(0, 24);

/** A Discord user id: a snowflake. */
export const isDiscordId = (v: string | null | undefined): v is string => typeof v === "string" && /^\d{17,20}$/.test(v);

export interface CardRow {
  public: boolean;
  snapshotAt: Date;
}

export type CardAccess =
  | { ok: true; own: boolean }
  | { ok: false; reason: "notLinked" | "stale" | "unavailable" };

export function cardAccess(o: { viewer: string; target: string; row: CardRow | null; now: number }): CardAccess {
  const own = o.viewer === o.target;
  const fresh = o.row !== null && o.now - o.row.snapshotAt.getTime() <= SNAPSHOT_MAX_MS;
  if (own) {
    if (!o.row) return { ok: false, reason: "notLinked" };
    return fresh ? { ok: true, own } : { ok: false, reason: "stale" };
  }
  return o.row?.public && fresh ? { ok: true, own } : { ok: false, reason: "unavailable" };
}

/** Oldest `snapshotAt` still kept; older rows are deleted by the site's chores. */
export const keptSince = (now: number) => new Date(now - SNAPSHOT_MAX_MS);

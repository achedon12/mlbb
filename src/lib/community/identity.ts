import { createHash } from "node:crypto";
import { isBanned } from "./constants";
import { screenText } from "./filter";

/**
 * Who a community request comes from: a game account (the game's login) or a
 * Discord account (the site's Discord login, shared with the bot dashboard).
 * Pure, so the tests need neither cookies nor a database; the request side
 * is `currentMember` in `server.ts`. See docs/community.md.
 *
 * Both kinds end up as one opaque `accountId` of 24 hex characters, which is
 * what threads, replies, votes, reports, cards and bans are keyed on: the
 * storage does not care how the member signed in.
 */

const DAY_MS = 24 * 3600 * 1000;

/** Discord ids are snowflakes: milliseconds since this epoch, shifted left by 22 bits. */
export const DISCORD_EPOCH_MS = 1_420_070_400_000;
/** A Discord account must be this old to take part: throwaway accounts made for a raid wait a week. */
export const DISCORD_MIN_AGE_MS = 7 * DAY_MS;

/** When the Discord account was created, from its id; null for anything that is not a snowflake. */
export function discordCreatedAt(id: string): number | null {
  if (!/^\d{17,20}$/.test(id)) return null;
  const value = BigInt(id);
  if (value >= BigInt("18446744073709551616")) return null; // 2^64
  return Number(value >> BigInt(22)) + DISCORD_EPOCH_MS;
}

/** Old enough to post, vote, report or list a card. An unreadable id or a date in the future is not. */
export function discordOldEnough(id: string, now: number): boolean {
  const created = discordCreatedAt(id);
  return created !== null && created <= now && now - created >= DISCORD_MIN_AGE_MS;
}

/**
 * Member id of a Discord account: a hash of its id, never the id itself, in
 * a namespace of its own (no game account can share it).
 */
export const discordAccountId = (discordId: string) =>
  createHash("sha256").update(`mlbb-community-discord:${discordId}`).digest("hex").slice(0, 24);

/** Stored names are at most 40 characters (`CommunityMember.name`, `authorName`). */
export const NAME_MAX = 40;

/**
 * Display name of a Discord member: the Discord display name, with control,
 * format (bidirectional overrides, zero-width) and line characters removed,
 * blank fillers treated as spaces, spaces collapsed, stacked combining marks
 * capped, cut to 40 characters. A name the word filter refuses, or one with
 * no letter nor digit left, becomes a neutral "Member" plus a few characters of the
 * member's hash: never the Discord id. It is rendered as text like any other
 * user text (React escapes it).
 */
export function discordDisplayName(raw: string, accountId: string): string {
  const cleaned = [
    ...raw
      .normalize("NFC")
      .replace(BLANK_FILLERS, " ")
      .replace(/\s+/gu, " ")
      .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
      // Stacked combining marks ("zalgo") spill over the lines around: two at most per character.
      .replace(/(\p{M}{2})\p{M}+/gu, "$1")
      .trim(),
  ]
    .slice(0, NAME_MAX)
    .join("")
    .trim();
  const visible = /[\p{L}\p{N}]/u.test(cleaned);
  if (!visible || screenText(cleaned, { newAccount: true }) !== "ok") return `Member ${accountId.slice(0, 6)}`;
  return cleaned;
}

/**
 * Characters that draw nothing but are letters or symbols to Unicode, used
 * for "invisible" names: Hangul fillers, the blank Braille pattern, the
 * Mongolian vowel separator, the combining grapheme joiner, the Khmer
 * inherent vowels, and the like. Treated as spaces.
 */
const BLANK_FILLERS = /[\u115F\u1160\u17B4\u17B5\u180E\u2800\u3164\uFFA0\u034F]/gu;

// -- Resolution ------------------------------------------------------------

export type GameLogin = { status: "ok"; id: string; name: string } | { status: "none" } | { status: "unavailable" };
export type DiscordLogin = { id: string; name: string } | null;

/** The Discord member's row, as far as resolution needs it (its link, its own ban): null when it has none yet. */
export type DiscordLink = {
  linkedTo: string | null;
  primaryName: string | null;
  bannedAt: Date | null;
  banUntil: Date | null;
} | null;

export type Member =
  | {
      status: "ok";
      /** Posts, votes, reports and cards are made as this. */
      author: { id: string; name: string; provider: "game" | "discord" };
      /** The login it came through: a linked Discord account acts as its game account. */
      via: "game" | "discord";
      /** Both logins present and not linked yet: the page offers to link them. */
      linkable: boolean;
      /** Both logins present and linked to each other: the page offers to unlink them. */
      unlinkable: boolean;
    }
  | { status: "discordTooNew" }
  /** The Discord login's own row is banned: refused even when it is linked. */
  | { status: "banned" }
  | { status: "none" }
  | { status: "unavailable" };

/**
 * One identity per request:
 * - a game login wins (it is what the forum always used); when a Discord
 *   login sits next to it, unlinked, the page offers to link the two, and
 *   linked to it, to unlink them;
 * - otherwise a Discord login whose own row is banned is refused, linked or
 *   not (the game account's ban is checked by the storage, on its row);
 * - otherwise a Discord login linked to a game account acts as that game
 *   account (its name, its row, its ban), whatever the Discord account's age;
 * - otherwise the Discord account on its own, if it is at least a week old;
 * - otherwise the game login's own status (none, or the login service down).
 */
export function resolveMember(o: { game: GameLogin; discord: DiscordLogin; link: DiscordLink; now: number }): Member {
  const { game, discord, link, now } = o;
  if (game.status === "ok") {
    return {
      status: "ok",
      author: { id: game.id, name: game.name, provider: "game" },
      via: "game",
      // A banned Discord row is never offered to merge (linking refuses it too).
      linkable: Boolean(discord) && !link?.linkedTo && !isBanned(link, now),
      unlinkable: Boolean(discord) && link?.linkedTo === game.id,
    };
  }
  if (discord) {
    if (isBanned(link, now)) return { status: "banned" };
    if (link?.linkedTo) {
      return { status: "ok", author: { id: link.linkedTo, name: link.primaryName ?? "?", provider: "game" }, via: "discord", linkable: false, unlinkable: false };
    }
    if (!discordOldEnough(discord.id, now)) return { status: "discordTooNew" };
    const id = discordAccountId(discord.id);
    return { status: "ok", author: { id, name: discordDisplayName(discord.name, id), provider: "discord" }, via: "discord", linkable: false, unlinkable: false };
  }
  return game;
}

// -- Linking ---------------------------------------------------------------

/**
 * Reports when a Discord member is merged into a game account: the ids to
 * delete. One report per account and target (the game account's copy
 * stays), and none on one's own post: the Discord member's reports of the
 * game account's posts, and the game account's reports of the Discord
 * member's, would otherwise count towards hiding them.
 */
export function planReportMerge(o: {
  reports: { id: number; kind: string; targetId: number; reporterId: string; authorId: string }[];
  gameId: string;
  discordId: string;
}): number[] {
  const self = new Set([o.gameId, o.discordId]);
  const byGame = new Set(o.reports.filter((r) => r.reporterId === o.gameId).map((r) => `${r.kind}:${r.targetId}`));
  return o.reports
    .filter((r) => self.has(r.reporterId))
    .filter((r) => self.has(r.authorId) || (r.reporterId === o.discordId && byGame.has(`${r.kind}:${r.targetId}`)))
    .map((r) => r.id);
}

/**
 * The member a moderation decision lands on: a Discord row linked to a game
 * account acts as that account, so a ban or a card hide aimed at it goes to
 * the game account. Any other row (or none) is its own.
 */
export function actingAccount(row: { accountId: string; linkedTo: string | null } | null, accountId: string): string {
  return row?.linkedTo ?? accountId;
}

export type VoteRef = { kind: string; targetId: number };

/**
 * Votes when a Discord member is merged into a game account: one vote per
 * account and target, and never on one's own post. The Discord member's
 * votes move to the game account, except where the game account voted too,
 * or on the game account's own posts; the game account's votes on the
 * Discord member's posts (its own, once merged) go. Every dropped vote takes
 * one point off its target.
 */
export function planVoteMerge(o: {
  gameVotes: VoteRef[];
  discordVotes: VoteRef[];
  /** Author of each voted target, keyed `kind:targetId`. */
  authors: Map<string, string>;
  gameId: string;
  discordId: string;
}): { move: VoteRef[]; drop: { vote: VoteRef; voter: "game" | "discord" }[] } {
  const key = (v: VoteRef) => `${v.kind}:${v.targetId}`;
  const byGame = new Set(o.gameVotes.map(key));
  const move: VoteRef[] = [];
  const drop: { vote: VoteRef; voter: "game" | "discord" }[] = [];
  for (const v of o.discordVotes) {
    if (byGame.has(key(v)) || o.authors.get(key(v)) === o.gameId) drop.push({ vote: v, voter: "discord" });
    else move.push(v);
  }
  for (const v of o.gameVotes) if (o.authors.get(key(v)) === o.discordId) drop.push({ vote: v, voter: "game" });
  return { move, drop };
}

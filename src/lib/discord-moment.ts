/**
 * When a "moment" invitation to the community Discord may show: right after
 * the visitor got what they came for (a nickname copied, today's MLBBdle
 * solved, the quiz finished, their account valued, a draft played out).
 *
 * One invitation per session, all kinds together: a moment that shows uses
 * up the session, so the corner card stays away too, and the other way
 * round. Never to someone who followed an invitation, nor for the month
 * after they closed one; never when storage refuses (nothing would remember).
 */
import { communityInvite } from "./bot/public";
import { readDiscordPopupMemory, readDiscordPopupSession, writeDiscordPopupSession } from "./discord-popup";

export const DISCORD_MOMENTS = ["nickname", "mlbbdle", "quiz", "value", "draft"] as const;
export type DiscordMoment = (typeof DISCORD_MOMENTS)[number];

/** Pure rule, testable: may a moment show given what the browser remembers? */
export function momentAllowed(c: {
  invite: string | null;
  memory: { joined?: boolean; dismissedUntil?: number } | null;
  session: { shown: boolean } | null;
  now: number;
}): boolean {
  if (!c.invite || !c.memory || !c.session) return false;
  if (c.memory.joined || c.session.shown) return false;
  if (c.memory.dismissedUntil !== undefined && c.now < c.memory.dismissedUntil) return false;
  return true;
}

/** Claims the session's invitation for a moment; false when it may not show. */
export function claimDiscordMoment(now = Date.now()): boolean {
  const session = readDiscordPopupSession();
  const allowed = momentAllowed({ invite: communityInvite(), memory: readDiscordPopupMemory(), session, now });
  if (allowed && session) writeDiscordPopupSession({ ...session, shown: true });
  return allowed;
}

/**
 * Which invitation to the community Discord fits a page. A visitor on a hero
 * page cares about that hero's next buff or nerf, one on the tier list about
 * the meta, one on MLBBdle about the daily games: the server has a channel
 * for each, and the invitation says which. Pure, so it can be tested.
 */

export const DISCORD_CONTEXTS = ["hero", "tier", "teammates", "patch", "daily", "esports", "default"] as const;
export type DiscordContext = (typeof DISCORD_CONTEXTS)[number];

/** Where a tracked invitation link sits, for the event name in the analytics. */
export type DiscordPlacement = "Header" | "Menu" | "Footer" | "Inline" | "Popup";

/** The invitation for a locale-prefixed path (or a bare one). */
export function discordContext(pathname: string): DiscordContext {
  const path = pathname.replace(/^\/[a-z]{2,3}(?=\/|$)/, "") || "/";
  if (/^\/heroes\/[^/]+/.test(path) || /^\/builds(\/|$)/.test(path)) return "hero";
  if (/^\/(tier-list|meta|statistics)(\/|$)/.test(path)) return "tier";
  if (/^\/community(\/|$)/.test(path)) return "teammates";
  if (/^\/(patch-notes|news|events|skins)(\/|$)/.test(path)) return "patch";
  if (/^\/(mlbbdle|quiz)(\/|$)/.test(path)) return "daily";
  if (/^\/esports(\/|$)/.test(path)) return "esports";
  return "default";
}

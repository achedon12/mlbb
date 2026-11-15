/**
 * Which invitation to the community Discord fits a page. A visitor on a hero
 * page cares about that hero's next buff or nerf, one on the tier list about
 * the meta, one on MLBBdle about the daily games: the server has a channel
 * for each, and the invitation says which. Pure, so it can be tested.
 */

export const DISCORD_CONTEXTS = [
  "hero",
  "tier",
  "teammates",
  "patch",
  "daily",
  "esports",
  "nickname",
  "skins",
  "tools",
  "value",
  "default",
] as const;
export type DiscordContext = (typeof DISCORD_CONTEXTS)[number];

/** Where a tracked invitation link sits, for the event name in the analytics. */
export type DiscordPlacement = "Header" | "Menu" | "Footer" | "Inline" | "Band" | "Moment" | "Popup";

const bare = (pathname: string) => pathname.replace(/^\/[a-z]{2,3}(?=\/|$)/, "") || "/";

/** The invitation for a locale-prefixed path (or a bare one). */
export function discordContext(pathname: string): DiscordContext {
  const path = bare(pathname);
  if (/^\/tools\/nickname(\/|$)/.test(path)) return "nickname";
  if (/^\/tools\/(account-value|collection)(\/|$)/.test(path)) return "value";
  if (/^\/(draft|compare)(\/|$)/.test(path) || /^\/tools(\/|$)/.test(path)) return "tools";
  if (/^\/skins(\/|$)/.test(path) || /^\/heroes\/[^/]+\/skins(\/|$)/.test(path)) return "skins";
  if (/^\/heroes\/[^/]+/.test(path) || /^\/builds(\/|$)/.test(path)) return "hero";
  if (/^\/(tier-list|meta|statistics)(\/|$)/.test(path)) return "tier";
  if (/^\/community(\/|$)/.test(path)) return "teammates";
  if (/^\/(patch-notes|news|events)(\/|$)/.test(path)) return "patch";
  if (/^\/(mlbbdle|quiz)(\/|$)/.test(path)) return "daily";
  if (/^\/esports(\/|$)/.test(path)) return "esports";
  return "default";
}

/**
 * The strategic pages (the most visited ones, Matomo, November 2026) that get
 * the invitation band above the footer, and its wording; null elsewhere and
 * on the pages that already hold an invitation of their own (a hero's main
 * page, the tier list, MLBBdle, a patch note, the community, the home page).
 */
export function bandContext(pathname: string): DiscordContext | null {
  const path = bare(pathname);
  const own =
    /^\/$/.test(path) ||
    /^\/heroes\/[^/]+$/.test(path) ||
    /^\/tier-list(\/|$)/.test(path) ||
    /^\/mlbbdle(\/|$)/.test(path) ||
    /^\/patch-notes\/[^/]+/.test(path) ||
    /^\/community(\/|$)/.test(path) ||
    /^\/bot(\/|$)/.test(path);
  if (own) return null;
  const strategic =
    /^\/tools\/[^/]+/.test(path) ||
    /^\/(skins|events|quiz|compare|draft|statistics|meta|esports|lore|patch-notes|heroes)(\/|$)/.test(path);
  return strategic ? discordContext(pathname) : null;
}

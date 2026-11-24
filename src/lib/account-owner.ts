import { isBanned } from "./community/constants";
import { discordAccountId, discordDisplayName, type DiscordLink, type GameLogin } from "./community/identity";

/**
 * Whose progress a request reads and writes: the account the request itself
 * proves, never an id it sends. Pure, so the tests need neither cookies nor
 * a database; the request side is `currentOwner` in `community/server.ts`.
 *
 * - a game login wins (the community's account id for it);
 * - otherwise a Discord login linked to a game account is that game account,
 *   so both logins reach the same progress;
 * - otherwise the Discord account on its own (the community's Discord id). A
 *   Discord account of any age may keep its own progress: unlike the forum,
 *   nothing here is shown to anyone unless its owner turns the page on;
 * - a Discord login whose own community row is banned is refused, as on the
 *   forum.
 */
export type DiscordLoginWithAvatar = { id: string; name: string; avatar: string | null } | null;

export type Owner =
  | { status: "ok"; id: string; name: string; via: "game" | "discord"; discord: DiscordLoginWithAvatar }
  | { status: "none" }
  | { status: "banned" }
  | { status: "unavailable" };

export function resolveOwner(o: { game: GameLogin; discord: DiscordLoginWithAvatar; link: DiscordLink; now: number }): Owner {
  const { game, discord, link, now } = o;
  if (game.status === "ok") return { status: "ok", id: game.id, name: game.name, via: "game", discord };
  if (!discord) return game;
  if (isBanned(link, now)) return { status: "banned" };
  const ownId = discordAccountId(discord.id);
  const name = discordDisplayName(discord.name, ownId);
  if (link?.linkedTo) return { status: "ok", id: link.linkedTo, name: link.primaryName ?? name, via: "discord", discord };
  return { status: "ok", id: ownId, name, via: "discord", discord };
}

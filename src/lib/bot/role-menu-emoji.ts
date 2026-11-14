/**
 * Emojis of role menu options, without zod so the dashboard's client
 * component can use them: a unicode emoji, or a custom emoji of the server
 * written as Discord does (`<:name:id>`, `<a:name:id>` animated). The bot
 * reads them with the same rules (`bot/src/discord/role-menus.ts`).
 */

export type ParsedEmoji = { kind: "custom"; id: string; name: string; animated: boolean } | { kind: "unicode"; value: string };

/** A custom emoji of the server, as the bot lists them. */
export type ServerEmoji = { id: string; name: string; animated: boolean };

const CUSTOM = /^<(a?):([A-Za-z0-9_]{2,32}):(\d{17,20})>$/;
const UNICODE = /^[\p{Extended_Pictographic}\p{Emoji_Component}]{1,16}$/u;
const PICTOGRAPH = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Me}]/u;

export function parseEmoji(text: string): ParsedEmoji | null {
  const custom = CUSTOM.exec(text);
  if (custom) return { kind: "custom", id: custom[3]!, name: custom[2]!, animated: custom[1] === "a" };
  return UNICODE.test(text) && PICTOGRAPH.test(text) ? { kind: "unicode", value: text } : null;
}

export const customEmojiText = (emoji: ServerEmoji) => `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;

/** The emoji's image on Discord's CDN (ids only, never a URL from the outside). */
export const emojiImage = (id: string, animated: boolean, size = 48) =>
  /^\d{17,20}$/.test(id) ? `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=${size}` : null;

const normalize = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/^rank[\s_-]*/, "")
    .replace(/[^a-z0-9]/g, "");

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const kept = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = kept;
    }
  }
  return row[b.length]!;
}

/**
 * The server's emoji named like a role, to fill an option in one go:
 * "Mythical Glory" finds `rank_mythical_glory`, or `rank_mythic_glory`
 * (a couple of letters apart). A tie or nothing close: none.
 */
export function suggestEmoji(roleName: string, emojis: readonly ServerEmoji[]): ServerEmoji | null {
  const role = normalize(roleName);
  if (role.length < 3) return null;
  let best: ServerEmoji | null = null;
  let bestScore = Infinity;
  let tie = false;
  for (const emoji of emojis) {
    const score = distance(role, normalize(emoji.name));
    if (score < bestScore) {
      best = emoji;
      bestScore = score;
      tie = false;
    } else if (score === bestScore) tie = true;
  }
  const allowed = role.length >= 8 ? 2 : role.length >= 5 ? 1 : 0;
  return best && !tie && bestScore <= allowed ? best : null;
}

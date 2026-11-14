import { MAX_LINKS } from "./constants";

/**
 * Word and link filter of the community posts, applied before anything is
 * stored. It catches the obvious only - slurs, scam bait, link shorteners,
 * chat invites, link floods - and leaves the rest to the reports and the
 * moderators: a filter that tries harder mostly refuses honest posts.
 *
 * Matching runs on a folded copy of the text: lower case, accents off, the
 * usual digit-for-letter swaps undone ("n1gg3r"), and letters spaced out or
 * dotted ("f.a.g") joined back. Terms are matched as whole words, so "skill"
 * never trips "kill" and "raccoon" trips nothing.
 *
 * `COMMUNITY_BLOCKED_WORDS` (comma-separated) adds terms without a release.
 */

/**
 * Slurs in the site's languages and English, folded (see `fold`). Kept short
 * on purpose: only words with no innocent reading in a game forum.
 */
const SLURS = [
  // English
  "nigger", "niggers", "nigga", "niggas", "faggot", "faggots", "fag", "fags", "retard", "retards", "tranny", "trannies",
  "chink", "chinks", "spic", "spics", "kike", "kikes", "wetback", "wetbacks", "coon", "coons", "gook", "gooks",
  // French
  "negre", "negres", "bougnoule", "bougnoules", "tafiole", "tarlouze", "youpin", "youpins",
  // Spanish
  "maricon", "maricones", "sudaca", "sudacas", "negrata",
  // Italian
  "frocio", "froci", "ricchione",
  // Indonesian, Malay
  "cina babi",
];

/** Scam bait seen on every MLBB community: free diamonds, generators, account trades. */
const SCAMS = [
  "free diamonds", "free diamond", "diamond generator", "diamonds generator", "diamond hack", "hack diamond",
  "diamantes gratis", "diamante gratis", "diamants gratuits", "diamant gratuit", "diamanti gratis",
  "diamond gratis", "diamond gratisan", "cheat diamond", "generator diamond",
  "jual akun", "beli akun", "sell my account", "selling account", "buy account",
];

/** Link shorteners, chat invites and IP loggers: where the scams and the spam go. */
const BLOCKED_HOSTS = [
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "cutt.ly", "is.gd", "shorturl.at", "rb.gy", "s.id", "ow.ly", "tiny.cc",
  "t.me", "telegram.me", "wa.me", "chat.whatsapp.com", "discord.gg", "discord.com", "discordapp.com",
  "grabify.link", "iplogger.org",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

/** Lower case, accents off, digit-for-letter swaps undone, single letters spaced out joined back. */
export function fold(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
      // "f a g", "f.a.g", "f-a-g": three or more single letters in a row,
      // the same separator between each ("a f.a.g" joins as "a fag").
      .replace(/\b[a-z]([\s.\-_*])(?:[a-z]\1)+[a-z]\b/g, (m) => m.replace(/[\s.\-_*]/g, ""))
      .replace(/[^a-z\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

const extraWords = () =>
  (process.env.COMMUNITY_BLOCKED_WORDS ?? "")
    .split(",")
    .map((w) => fold(w))
    .filter((w) => w.length >= 3);

const containsTerm = (folded: string, term: string) => ` ${folded} `.includes(` ${term} `);

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()\]]+/gi;

/** The links of a text (`https://…` or `www.…`), parsed; null for one that does not parse. */
export function links(text: string): (URL | null)[] {
  return [...text.matchAll(URL_PATTERN)].map((m) => {
    const raw = m[0].replace(/[.,;:!?]+$/, "");
    try {
      return new URL(raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw);
    } catch {
      return null;
    }
  });
}

const hostOf = (url: URL) => url.hostname.toLowerCase().replace(/\.+$/, "").replace(/^www\./, "");
const pathOf = (url: URL) => url.pathname.replace(/\/+$/, "");

/** The site's own Discord invite, the one invite allowed, as `host/path`; or null. */
function ownInvite(): string | null {
  const raw = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${hostOf(url)}${pathOf(url)}`;
  } catch {
    return null;
  }
}

export type FilterVerdict = "ok" | "blocked" | "spam" | "links" | "newAccountLinks";

/**
 * Verdict on a text about to be posted. `newAccount`: the author was first
 * seen in the community a few days ago at most, and may post no link yet.
 */
export function screenText(text: string, options: { newAccount: boolean }): FilterVerdict {
  const folded = fold(text);
  if ([...SLURS, ...extraWords()].some((w) => containsTerm(folded, w))) return "blocked";
  if (SCAMS.some((s) => containsTerm(folded, s))) return "spam";

  const found = links(text);
  if (found.length > 0 && options.newAccount) return "newAccountLinks";
  if (found.length > MAX_LINKS) return "links";
  const invite = ownInvite();
  for (const url of found) {
    if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) return "spam";
    const host = hostOf(url);
    const discordSite = host === "discord.com" || host === "discordapp.com";
    if (discordSite && !/^\/invite\//i.test(url.pathname)) continue;
    if (!BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) continue;
    if (invite && `${host}${pathOf(url)}` === invite) continue;
    return "spam";
  }
  return "ok";
}

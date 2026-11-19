/**
 * What the Discord profile card shows, saved once from the game's services.
 *
 * The player statistics service only answers with the player's own token,
 * which the site never keeps (it lives in the session cookie): there is no
 * way to read a player's figures later, from the bot, without them. So when
 * the player links their Discord account, or refreshes the card, the site
 * reads their profile and their season's heroes with the token of that
 * request and keeps this snapshot, and nothing else. The bot's /profile
 * draws the card from it.
 *
 * Pure: the account page and the route build it from responses already read
 * by `mlbb-auth`; the tests build it from samples.
 */
import { z } from "zod";
import type { Profile } from "@/lib/mlbb-auth";
import type { FrequentHero, StatsPlayer } from "@/lib/player-api";
import { shownHero } from "@/lib/player-profile";

/** The drawn card's size, in pixels (`card.tsx`). */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 600;

/** Most played heroes kept on the card. */
export const CARD_HEROES = 3;

/** A snapshot older than this is no longer shown, then deleted: the figures would mislead. */
export const SNAPSHOT_MAX_DAYS = 30;
export const SNAPSHOT_MAX_MS = SNAPSHOT_MAX_DAYS * 86_400_000;

/** Avatars and hero images: only from Moonton's CDN, as `next/image` allows. */
const CDN = /^https:\/\/(akmweb|akmpicture)\.youngjoygame\.com\/[^\s"'<>]+$/;

const count = z.number().int().min(0).max(10_000_000);

const cardHero = z.object({
  /** Site sheet, for the artwork; null for a hero the site does not know yet. */
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/).nullable(),
  name: z.string().min(1).max(40),
  image: z.string().regex(CDN).max(400).nullable(),
  matches: count,
  wins: count,
});

/** Stored as JSON (`ProfileCard.snapshot`): read back through this schema, never trusted as is. */
export const snapshotSchema = z.object({
  v: z.literal(1),
  name: z.string().max(40),
  avatar: z.string().regex(CDN).max(400).nullable(),
  roleId: z.number().int().positive(),
  zoneId: z.number().int().min(0),
  /** ISO 3166-1 code of the account's registration country, upper case, or "". */
  country: z.string().regex(/^([A-Z]{2})?$/),
  level: count,
  rankLevel: count,
  rankMaxLevel: count,
  /** Season the figures are from; null when only the all-seasons ones were readable. */
  season: z.number().int().positive().max(999).nullable(),
  matches: count,
  wins: count,
  /** False when some pages of heroes were missing: the totals are a minimum. */
  full: z.boolean(),
  mvp: count.nullable(),
  heroes: z.array(cardHero).max(CARD_HEROES),
});

export type ProfileSnapshot = z.infer<typeof snapshotSchema>;
export type CardHero = z.infer<typeof cardHero>;

/** The snapshot as stored, or null when it is not one this version can draw. */
export function readSnapshot(raw: unknown): ProfileSnapshot | null {
  const parsed = snapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const cdnOrNull = (url: string | null | undefined): string | null => (url && CDN.test(url) && url.length <= 400 ? url : null);
const capped = (n: number | null | undefined): number => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(10_000_000, Math.floor(n))) : 0);

/**
 * Builds the snapshot from what the services returned. Season figures come
 * from the season's heroes, summed (the service gives no season total); when
 * those are not readable, the all-seasons statistics stand in, with no
 * season. Null without a usable profile: there is nothing to put on a card.
 */
export function buildSnapshot(o: {
  profile: Profile;
  season: number | null;
  heroes: { heroes: FrequentHero[]; full: boolean } | null;
  stats: StatsPlayer | null;
}): ProfileSnapshot | null {
  const { profile } = o;
  if (!Number.isInteger(profile.roleId) || profile.roleId <= 0) return null;
  const played = (o.heroes?.heroes ?? []).filter((h) => h.matches > 0);
  const fromSeason = o.heroes !== null && o.season !== null;
  const matches = fromSeason ? played.reduce((n, h) => n + h.matches, 0) : capped(o.stats?.matches);
  const wins = fromSeason ? played.reduce((n, h) => n + Math.min(h.wins, h.matches), 0) : capped(o.stats?.wins);

  const heroes = [...played]
    .sort((a, b) => b.matches - a.matches || b.wins - a.wins)
    .slice(0, CARD_HEROES)
    .map((h): CardHero => {
      const shown = shownHero(h.hero);
      return {
        slug: shown.slug,
        name: shown.name.slice(0, 40) || `#${h.hero.hid}`,
        image: cdnOrNull(h.hero.image),
        matches: capped(h.matches),
        wins: capped(Math.min(h.wins, h.matches)),
      };
    });

  const country = profile.country.trim().toUpperCase();
  const snapshot: ProfileSnapshot = {
    v: 1,
    name: [...profile.name.trim()].slice(0, 40).join("") || "?",
    avatar: cdnOrNull(profile.avatar),
    roleId: profile.roleId,
    zoneId: Number.isInteger(profile.zoneId) && profile.zoneId >= 0 ? profile.zoneId : 0,
    country: /^[A-Z]{2}$/.test(country) && country !== "ZZ" ? country : "",
    level: capped(profile.level),
    rankLevel: capped(profile.rankCurrent),
    rankMaxLevel: capped(profile.rankMax),
    season: fromSeason && o.season !== null && o.season > 0 && o.season < 1000 ? o.season : null,
    matches: capped(matches),
    wins: Math.min(capped(wins), capped(matches)),
    full: fromSeason ? Boolean(o.heroes?.full) : true,
    mvp: o.stats?.mvp ?? null,
    heroes,
  };
  return readSnapshot(snapshot);
}

/**
 * The game's server region, from the account's registration country. The
 * service gives no region; Mobile Legends groups its players by country,
 * and these are its main groups. An unknown country gives no region.
 */
const REGIONS: Record<string, string[]> = {
  SEA: ["BN", "ID", "KH", "LA", "MM", "MY", "PH", "SG", "TH", "TL", "VN"],
  SA: ["BD", "BT", "IN", "LK", "MV", "NP", "PK"],
  EA: ["CN", "HK", "JP", "KR", "MN", "MO", "TW"],
  ME: ["AE", "BH", "DZ", "EG", "IQ", "IR", "JO", "KW", "LB", "LY", "MA", "OM", "PS", "QA", "SA", "SY", "TN", "TR", "YE"],
  CIS: ["AM", "AZ", "BY", "GE", "KG", "KZ", "MD", "RU", "TJ", "TM", "UA", "UZ"],
  NA: ["CA", "US"],
  LATAM: ["AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO", "EC", "GT", "HN", "MX", "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE"],
  EU: [
    "AD", "AL", "AT", "BA", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT",
    "LI", "LT", "LU", "LV", "MC", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "SE", "SI", "SK", "SM", "XK",
  ],
  OCE: ["AU", "FJ", "NZ", "PG"],
  AF: ["AO", "CI", "CM", "ET", "GH", "KE", "NG", "SN", "TZ", "UG", "ZA", "ZM", "ZW"],
};
const REGION_OF = new Map(Object.entries(REGIONS).flatMap(([region, codes]) => codes.map((c) => [c, region] as const)));

export function regionOf(country: string): string | null {
  return REGION_OF.get(country.trim().toUpperCase()) ?? null;
}

/** Win rate in points (0 to 100), or null without matches. */
export const winRate = (wins: number, matches: number): number | null => (matches > 0 ? (Math.min(wins, matches) / matches) * 100 : null);

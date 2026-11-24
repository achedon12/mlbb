import { isLocale, type Locale } from "@/i18n/config";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";

/**
 * Address of a social kit visual (the brand page's "Kit réseaux sociaux"):
 * a ready-made announcement in the site's style, for Discord, Instagram,
 * TikTok or X, drawn by `/api/kit/<template>`
 * (`src/app/api/kit/[template]/route.ts`).
 *
 * Same rules as the share images (`share-card.ts`): everything comes from
 * the query string, checked here against the catalog the caller passes.
 * Heroes, skins and patches must be known, an announcement's title is one
 * of a fixed list of messages, and nothing else is accepted: no free text,
 * no URL, no picture. One canonical query per visual (`kitQuery`), so the
 * route sends any other spelling to it and the cache keeps one copy.
 *
 * Pure module: the brand page's client builds the address with it, the
 * server reads it.
 */

export const KIT_TEMPLATES = ["patch", "tier-list", "hero", "skin", "announce"] as const;
export type KitTemplate = (typeof KIT_TEMPLATES)[number];
export const isKitTemplate = (v: string): v is KitTemplate => (KIT_TEMPLATES as readonly string[]).includes(v);

/** Square for feeds, portrait (4:5) for Instagram and X, story (9:16) for stories, Reels and TikTok. */
export const KIT_FORMATS = ["square", "portrait", "story"] as const;
export type KitFormat = (typeof KIT_FORMATS)[number];
export const KIT_SIZES: Record<KitFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

/**
 * Bands a story keeps clear of words and data: the apps lay their own
 * interface there (profile and progress at the top, caption, reply field
 * and buttons at the foot). Only the artwork and the ground run under them.
 */
export const STORY_SAFE = { top: 250, bottom: 340 } as const;

/** A hero shown as new to the game, or as the hero of the moment. */
export const KIT_HERO_MODES = ["spotlight", "new"] as const;
export type KitHeroMode = (typeof KIT_HERO_MODES)[number];

/** The announcements' titles: messages of the catalogue (`socialKit.announce.<key>`), never a text of the request. */
export const ANNOUNCE_TITLES = ["discord", "event", "tournament", "live", "update"] as const;
export type AnnounceTitle = (typeof ANNOUNCE_TITLES)[number];

const MAX_QUERY = 200;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d{1,2}\.\d{1,2}\.\d{1,3}[a-z]?$/;
const SKIN_ID = /^\d{1,6}$/;

export interface KitCatalog {
  /** Listed heroes with an official artwork. */
  heroes: ReadonlySet<string>;
  /** Patch versions with notes. */
  versions: ReadonlySet<string>;
  /** Released skins with an official artwork and a release month. */
  skins: ReadonlySet<string>;
}

export type KitCard =
  | { template: "patch"; version: string }
  | { template: "tier-list"; rank: MeasuredRank }
  | { template: "hero"; hero: string; mode: KitHeroMode }
  | { template: "skin"; skin: string }
  | { template: "announce"; title: AnnounceTitle };

export interface KitRequest {
  locale: Locale;
  format: KitFormat;
  card: KitCard;
}

const oneOf = <T extends string>(list: readonly T[], v: string | null): v is T => v !== null && (list as readonly string[]).includes(v);

/** Keys each template reads, besides `lang` and `format`: anything else rejects the request. */
const KEYS: Record<KitTemplate, readonly string[]> = {
  patch: ["v"],
  "tier-list": ["rank"],
  hero: ["h", "m"],
  skin: ["s"],
  announce: ["t"],
};

function parseCard(template: KitTemplate, p: URLSearchParams, catalog: KitCatalog): KitCard | null {
  switch (template) {
    case "patch": {
      const v = p.get("v");
      return v && VERSION.test(v) && catalog.versions.has(v) ? { template, version: v } : null;
    }
    case "tier-list": {
      const rank = p.get("rank") ?? "all";
      return oneOf(MEASURED_RANKS, rank) ? { template, rank } : null;
    }
    case "hero": {
      const h = p.get("h");
      const mode = p.get("m") ?? "spotlight";
      if (!h || !SLUG.test(h) || !catalog.heroes.has(h) || !oneOf(KIT_HERO_MODES, mode)) return null;
      return { template, hero: h, mode };
    }
    case "skin": {
      const s = p.get("s");
      return s && SKIN_ID.test(s) && catalog.skins.has(s) ? { template, skin: s } : null;
    }
    case "announce": {
      const title = p.get("t");
      return oneOf(ANNOUNCE_TITLES, title) ? { template, title } : null;
    }
  }
}

/**
 * Reads a kit visual request; null when anything in it is unknown, out of
 * range or extra. `lang` defaults to English, `format` to portrait.
 */
export function parseKitRequest(template: string, search: URLSearchParams | string, catalog: KitCatalog): KitRequest | null {
  if (!isKitTemplate(template)) return null;
  const raw = typeof search === "string" ? search.replace(/^\?/, "") : search.toString();
  if (raw.length > MAX_QUERY) return null;
  const p = new URLSearchParams(raw);
  const allowed = new Set(["lang", "format", ...KEYS[template]]);
  const keys = [...p.keys()];
  if (keys.some((k) => !allowed.has(k)) || new Set(keys).size !== keys.length) return null;
  const lang = p.get("lang") ?? "en";
  const format = p.get("format") ?? "portrait";
  if (!isLocale(lang) || !oneOf(KIT_FORMATS, format)) return null;
  const card = parseCard(template, p, catalog);
  return card ? { locale: lang, format, card } : null;
}

/** The one query string of a visual, in a fixed order, without `?`. */
export function kitQuery({ locale, format, card }: KitRequest): string {
  const p = new URLSearchParams();
  p.set("lang", locale);
  p.set("format", format);
  switch (card.template) {
    case "patch":
      p.set("v", card.version);
      break;
    case "tier-list":
      if (card.rank !== "all") p.set("rank", card.rank);
      break;
    case "hero":
      p.set("h", card.hero);
      if (card.mode !== "spotlight") p.set("m", card.mode);
      break;
    case "skin":
      p.set("s", card.skin);
      break;
    case "announce":
      p.set("t", card.title);
      break;
  }
  return p.toString();
}

/** Path of a kit visual, on the site's own domain. */
export const kitPath = (request: KitRequest) => `/api/kit/${request.card.template}?${kitQuery(request)}`;

/** Same query, other spelling? Compared once both are normalised by `URLSearchParams`. */
export const isKitCanonical = (search: string, request: KitRequest) =>
  new URLSearchParams(search.replace(/^\?/, "")).toString() === kitQuery(request);

/** File name of a downloaded visual: `mlbbdex-patch-2-2-23-story.png`. */
export function kitFileName({ format, card }: KitRequest): string {
  const subject =
    card.template === "patch"
      ? card.version
      : card.template === "tier-list"
        ? card.rank
        : card.template === "hero"
          ? `${card.mode}-${card.hero}`
          : card.template === "skin"
            ? card.skin
            : card.title;
  return `mlbbdex-${card.template}-${subject.replace(/[^a-z0-9]+/gi, "-")}-${format}.png`;
}

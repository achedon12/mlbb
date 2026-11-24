import { isLocale, type Locale } from "@/i18n/config";
import { decodeBuild, encodeBuild, PARAMS, type BuildCode, type CodeCatalog } from "./build-code";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";

/**
 * Address of a share image ("Partager en image"): what a build, a draft, the
 * tier list, a MLBBdle result, a quiz result (or the challenge to beat it)
 * or a patch recap looks like as a branded PNG, drawn by `/api/share/<kind>`
 * (`src/app/api/share/[kind]/route.ts`).
 *
 * Everything the image shows comes from its query string, checked here
 * against the catalog the caller passes: hero, item and patch slugs must be
 * known, numbers stay in their range, nothing else is accepted. The image
 * never reads a URL, a free text or a picture from the request; it only
 * draws the site's own data and artwork. One canonical query per image
 * (`shareQuery`), so the route can send any other spelling to it and the
 * cache holds one copy of each.
 *
 * Pure module: the browser builds the address with it, the server reads it.
 */

export const SHARE_KINDS = ["build", "draft", "tier-list", "mlbbdle", "recap", "quiz"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];
export const isShareKind = (v: string): v is ShareKind => (SHARE_KINDS as readonly string[]).includes(v);

/** Portrait for stories and feeds (4:5), landscape for links (1.91:1). */
export const SHARE_FORMATS = ["portrait", "landscape"] as const;
export type ShareFormat = (typeof SHARE_FORMATS)[number];
export const SHARE_SIZES: Record<ShareFormat, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1200, height: 630 },
};

/** Heroes on a side of a draft. */
export const DRAFT_SIDE = 5;
/** The draft's estimate is clamped to these bounds (`BOUNDS` in `win-estimate.ts`). */
export const DRAFT_WIN = { min: 25, max: 75 } as const;

/** MLBBdle: cells per classic row (`COLUMNS`), rows kept on the image (`SHARE_ROWS`). */
export const MLBBDLE_COLUMNS = 9;
export const MLBBDLE_ROWS = 8;
export const MLBBDLE_MODES = ["classic", "skill"] as const;
export type MlbbdleShareMode = (typeof MLBBDLE_MODES)[number];
/** One letter per verdict: match, partial, miss, unknown. */
export type Cell = "m" | "p" | "x" | "u";
const ROW = new RegExp(`^[mpxu]{${MLBBDLE_COLUMNS}}$`);

/** Quiz: rounds a grid may hold, squares a round may hold, points a challenge may hold (`POINTS_LIMIT`). */
export const QUIZ_ROUNDS = 8;
export const QUIZ_CELLS = 8;
export const QUIZ_POINTS = 30;
const QUIZ_ROW = new RegExp(`^[mxu]{1,${QUIZ_CELLS}}$`);

const MAX_QUERY = 600;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d{1,2}\.\d{1,2}\.\d{1,3}[a-z]?$/;

export interface ShareCatalog {
  /** Listed heroes (`listedHeroes`). */
  heroes: ReadonlySet<string>;
  /** Build catalog (`codeCatalog`). */
  build: CodeCatalog;
  /** Patch versions with notes (`patchDetails`). */
  versions: ReadonlySet<string>;
}

export type ShareCard =
  | { kind: "build"; build: BuildCode & { hero: string } }
  | { kind: "draft"; blue: string[]; red: string[]; win: number | null; rank: MeasuredRank }
  | { kind: "tier-list"; rank: MeasuredRank }
  | { kind: "mlbbdle"; mode: MlbbdleShareMode; number: number; guesses: number; rows: Cell[][]; streak: number }
  | { kind: "recap"; version: string }
  /**
   * A daily quiz result, or with `duel` the "challenge a friend" invitation
   * to beat it. Rows: one per round, found / missed / not played.
   */
  | { kind: "quiz"; number: number; points: number; max: number; rows: ("m" | "x" | "u")[][]; streak: number; duel: boolean };

export interface ShareRequest {
  locale: Locale;
  format: ShareFormat;
  card: ShareCard;
}

const int = (v: string | null, min: number, max: number): number | null => {
  if (v === null || !/^\d{1,6}$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

const isRank = (v: string | null): v is MeasuredRank => v !== null && (MEASURED_RANKS as readonly string[]).includes(v);

/** A side of a draft: 1 to 5 distinct known heroes. */
function side(v: string | null, heroes: ReadonlySet<string>): string[] | null {
  if (!v) return null;
  const list = v.split(",");
  if (list.length > DRAFT_SIDE || new Set(list).size !== list.length) return null;
  return list.every((s) => SLUG.test(s) && heroes.has(s)) ? list : null;
}

/** Keys each kind reads, besides `lang` and `format`: anything else rejects the request. */
const KEYS: Record<ShareKind, readonly string[]> = {
  build: Object.values(PARAMS),
  draft: ["b", "r", "w", "rank"],
  "tier-list": ["rank"],
  mlbbdle: ["mode", "n", "g", "grid", "streak"],
  recap: ["v"],
  quiz: ["n", "p", "m", "grid", "streak", "vs"],
};

function parseCard(kind: ShareKind, p: URLSearchParams, catalog: ShareCatalog): ShareCard | null {
  switch (kind) {
    case "build": {
      const { build, ignored } = decodeBuild(p, catalog.build);
      if (ignored.length || !build.hero || build.items.length === 0) return null;
      return { kind, build: { ...build, hero: build.hero } };
    }
    case "draft": {
      const blue = side(p.get("b"), catalog.heroes);
      const red = side(p.get("r"), catalog.heroes);
      if (!blue || !red || blue.some((s) => red.includes(s))) return null;
      const rawWin = p.get("w");
      const win = rawWin === null ? null : int(rawWin, DRAFT_WIN.min, DRAFT_WIN.max);
      if (rawWin !== null && win === null) return null;
      const rank = p.get("rank") ?? "all";
      if (!isRank(rank)) return null;
      return { kind, blue, red, win, rank };
    }
    case "tier-list": {
      const rank = p.get("rank") ?? "all";
      return isRank(rank) ? { kind, rank } : null;
    }
    case "mlbbdle": {
      const mode = p.get("mode");
      if (mode !== "classic" && mode !== "skill") return null;
      const number = int(p.get("n"), 1, 99_999);
      const guesses = int(p.get("g"), 1, 999);
      const streak = p.get("streak") === null ? 0 : int(p.get("streak"), 0, 99_999);
      if (number === null || guesses === null || streak === null) return null;
      if (mode === "skill") {
        if (p.get("grid") !== null) return null;
        return { kind, mode, number, guesses, rows: [], streak };
      }
      const grid = p.get("grid");
      if (!grid) return null;
      const rows = grid.split(".");
      // The first rows, then the winning one: the image shows at most MLBBDLE_ROWS of them.
      if (rows.length > Math.min(guesses, MLBBDLE_ROWS) || !rows.every((r) => ROW.test(r))) return null;
      if (!/^m+$/.test(rows.at(-1)!)) return null;
      return { kind, mode, number, guesses, rows: rows.map((r) => [...r] as Cell[]), streak };
    }
    case "recap": {
      const v = p.get("v");
      return v && VERSION.test(v) && catalog.versions.has(v) ? { kind, version: v } : null;
    }
    case "quiz": {
      const number = int(p.get("n"), 1, 99_999);
      const max = int(p.get("m"), 1, QUIZ_POINTS);
      const points = int(p.get("p"), 0, QUIZ_POINTS);
      const streak = p.get("streak") === null ? 0 : int(p.get("streak"), 0, 99_999);
      if (number === null || max === null || points === null || points > max || streak === null) return null;
      const vs = p.get("vs");
      if (vs !== null && vs !== "1") return null;
      const grid = p.get("grid");
      let rows: ("m" | "x" | "u")[][] = [];
      if (grid !== null) {
        const list = grid.split(".");
        if (list.length > QUIZ_ROUNDS || !list.every((r) => QUIZ_ROW.test(r))) return null;
        rows = list.map((r) => [...r] as ("m" | "x" | "u")[]);
      }
      return { kind, number, points, max, rows, streak, duel: vs === "1" };
    }
  }
}

/**
 * Reads a share image request; null when anything in it is unknown,
 * out of range or extra. `lang` defaults to English, `format` to portrait.
 */
export function parseShareRequest(kind: string, search: URLSearchParams | string, catalog: ShareCatalog): ShareRequest | null {
  if (!isShareKind(kind)) return null;
  const raw = typeof search === "string" ? search.replace(/^\?/, "") : search.toString();
  if (raw.length > MAX_QUERY) return null;
  const p = new URLSearchParams(raw);
  const allowed = new Set(["lang", "format", ...KEYS[kind]]);
  const keys = [...p.keys()];
  if (keys.some((k) => !allowed.has(k)) || new Set(keys).size !== keys.length) return null;
  const lang = p.get("lang") ?? "en";
  const format = p.get("format") ?? "portrait";
  if (!isLocale(lang) || !(SHARE_FORMATS as readonly string[]).includes(format)) return null;
  const card = parseCard(kind, p, catalog);
  return card ? { locale: lang, format: format as ShareFormat, card } : null;
}

/** The one query string of an image, in a fixed order, without `?`. */
export function shareQuery({ locale, format, card }: ShareRequest): string {
  const p = new URLSearchParams();
  p.set("lang", locale);
  p.set("format", format);
  switch (card.kind) {
    case "build":
      for (const [k, v] of new URLSearchParams(encodeBuild(card.build))) p.set(k, v);
      break;
    case "draft":
      p.set("b", card.blue.join(","));
      p.set("r", card.red.join(","));
      if (card.win !== null) p.set("w", String(card.win));
      if (card.rank !== "all") p.set("rank", card.rank);
      break;
    case "tier-list":
      if (card.rank !== "all") p.set("rank", card.rank);
      break;
    case "mlbbdle":
      p.set("mode", card.mode);
      p.set("n", String(card.number));
      p.set("g", String(card.guesses));
      if (card.mode === "classic") p.set("grid", card.rows.map((r) => r.join("")).join("."));
      if (card.streak > 0) p.set("streak", String(card.streak));
      break;
    case "recap":
      p.set("v", card.version);
      break;
    case "quiz":
      p.set("n", String(card.number));
      p.set("p", String(card.points));
      p.set("m", String(card.max));
      if (card.rows.length) p.set("grid", card.rows.map((r) => r.join("")).join("."));
      if (card.streak > 0) p.set("streak", String(card.streak));
      if (card.duel) p.set("vs", "1");
      break;
  }
  return p.toString();
}

/** Path of a share image, on the site's own domain. */
export const sharePath = (request: ShareRequest) => `/api/share/${request.card.kind}?${shareQuery(request)}`;

/** Same query, other spelling? Compared once both are normalised by `URLSearchParams`. */
export const isCanonical = (search: string, request: ShareRequest) =>
  new URLSearchParams(search.replace(/^\?/, "")).toString() === shareQuery(request);

const EMOJI_CELL: Record<string, Cell> = { "🟩": "m", "🟧": "p", "🟥": "x", "⬛": "u" };

/**
 * The MLBBdle share grid (`classicGrid`, one emoji per cell) as cells, the
 * rows the image keeps: the first ones and the winning one, without the
 * "⋯ +n" line that stands for the rows left out.
 */
export function cellsFromEmoji(rows: string[]): Cell[][] {
  return rows
    .map((row) => [...row].map((ch) => EMOJI_CELL[ch]).filter((c): c is Cell => c !== undefined))
    .filter((cells) => cells.length === MLBBDLE_COLUMNS);
}

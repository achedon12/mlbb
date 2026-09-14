/**
 * Lecture des reponses de l'API de statistiques joueur.
 *
 * Le service relaie le « battle report » de Moonton. Son schema OpenAPI rend
 * presque tout facultatif : un champ peut manquer, valoir null ou changer de
 * type. Rien n'est donc pris tel quel. Une entree illisible est ecartee plutot
 * que de faire tomber la page, et un nombre absent reste absent (null) au lieu
 * de devenir un zero trompeur.
 *
 * Module sans dependance serveur ni donnees du site : les tests le chargent
 * directement, avec des reponses d'exemple.
 */
import { z } from "zod";

/** Heros tel que le decrit le service : identifiant du jeu, nom anglais, image. */
export interface GameHero {
  hid: number;
  name: string;
  /** Image du CDN de Moonton, seulement si son hote est autorise par le site. */
  image: string | null;
}

export interface StatsPlayer {
  matches: number;
  wins: number;
  /** Note moyenne sur 10 : le service la renvoie multipliee par cent. */
  noteAverage: number | null;
  hoursGame: number | null;
  mvp: number | null;
  bestStreak: number | null;
  /** Saisons couvertes, de la plus recente a la plus ancienne. */
  seasons: number[];
}

export interface FrequentHero {
  hero: GameHero;
  matches: number;
  wins: number;
  note: number | null;
}

export interface MatchSummary {
  /** Identifiant de partie, en chaine : il depasse la precision des nombres. */
  id: string;
  season: number | null;
  hero: GameHero;
  eliminations: number;
  deaths: number;
  assists: number;
  /** Position annoncee par le service : 1 Experience, 2 Milieu, 3 Roam, 4 Jungle, 5 Or. */
  lane: number | null;
  note: number | null;
  mvp: boolean;
  /** null quand le service ne dit pas l'issue. */
  win: boolean | null;
  /** Horodatage, en secondes. */
  date: number | null;
}

/** Un des dix joueurs d'une partie, dans son detail. */
export interface Participant {
  team: number | null;
  roleId: number | null;
  zoneId: number | null;
  hero: GameHero;
  eliminations: number;
  deaths: number;
  assists: number;
  win: boolean | null;
}

export interface Page<T> {
  entries: T[];
  /** Curseur de la page suivante, ou null quand il n'y en a plus. */
  next: string | null;
}

/** Identifiant de partie ou curseur de pagination : des chiffres, rien d'autre. */
export const ID = /^\d{1,25}$/;

/**
 * JSON.parse, grands entiers proteges.
 *
 * Identifiants de partie et curseurs depassent 2^53 : lus comme nombres, ils
 * perdent leurs derniers chiffres — 4132717739868068534 devient
 * 4132717739868068400 — et le curseur renvoye au service ne pointe plus sur
 * rien. On les passe en chaines avant l'analyse.
 */
export function readJson(text: string): unknown {
  return JSON.parse(text.replace(/("(?:nextCursor|bid|last_cursor)"\s*:\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"'));
}

const item = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Object schema whose missing keys still reach their field schema, as null.
 * zod 3 ran a field's transform on an absent key; zod 4 skips it and leaves the
 * key undefined, which slips past the `!== null` checks below (an absent `ts`
 * came out of `horodatage` as an undefined date instead of null). Filling
 * absent keys keeps both versions alike.
 */
function itemLenient<T extends z.ZodRawShape>(shape: T) {
  const keys = Object.keys(shape);
  return z.preprocess((v) => {
    const o = item(v);
    return Object.fromEntries(keys.map((c) => [c, o[c] ?? null]));
  }, z.object(shape));
}

/** Nombre tolerant : une chaine numerique est acceptee, tout le reste devient null. */
const numberOrNull = z.unknown().transform((v): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
});

/** Compteur : entier positif ou nul, sinon null. */
const nonNegativeInt = numberOrNull.transform((n) => (n !== null && Number.isInteger(n) && n >= 0 ? n : null));

const text = z.unknown().transform((v): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
});

/**
 * Fiche de heros jointe par le service (`hid_e`) ; illisible, elle compte pour absente.
 * Anything but an object counts as absent; an object gets its missing keys
 * filled like the entries above, so a missing `ix` stays a null image.
 */
const entity = z
  .preprocess(
    (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? v : null),
    itemLenient({ id: numberOrNull, n: text, ix: text }).nullable(),
  )
  .catch(null);

/** Hotes d'images acceptes par la configuration de `next/image`. */
const SAFE_IMAGE = /^https:\/\/(akmweb|akmpicture)\.youngjoygame\.com\/\S+$/;

function heroOf(hid: number | null, e: z.output<typeof entity>): GameHero | null {
  const id = hid ?? e?.id ?? null;
  if (id === null || !Number.isInteger(id) || id <= 0) return null;
  return { hid: id, name: e?.n ?? `#${id}`, image: e?.ix && SAFE_IMAGE.test(e.ix) ? e.ix : null };
}

/** Issue d'une partie : 1 victoire, 0 defaite, rien d'autre n'est interprete. */
const issue = (v: number | null): boolean | null => (v === 1 ? true : v === 0 ? false : null);

/** Note du service, multipliee par cent : 1180 vaut 11,8. */
const note = (v: number | null): number | null => (v !== null && v > 0 ? v / 100 : null);

/** Horodatage en secondes ; un horodatage en millisecondes est ramene aux secondes. */
const timestamp = (v: number | null): number | null =>
  v === null || v <= 0 ? null : v > 1e12 ? Math.floor(v / 1000) : v;

/** Lit un tableau entree par entree : une entree illisible est ecartee, pas la liste. */
function readList<S extends z.ZodTypeAny, R>(raw: unknown, schema: S, to: (e: z.output<S>) => R | null): R[] {
  if (!Array.isArray(raw)) return [];
  const output: R[] = [];
  for (const entry of raw) {
    const lu = schema.safeParse(entry);
    const value = lu.success ? to(lu.data) : null;
    if (value !== null) output.push(value);
  }
  return output;
}

/**
 * Curseur de la page suivante. Le service s'arrete quand `hasNext` est faux
 * ou que le curseur est vide — les deux arrivent, parfois ensemble, parfois
 * seuls : un `hasNext` vrai avec un curseur vide ne mene nulle part.
 */
export function cursorNext(pageInfo: unknown): string | null {
  const p = item(pageInfo);
  if (p.hasNext === false) return null;
  const raw =
    typeof p.nextCursor === "number" && Number.isSafeInteger(p.nextCursor)
      ? String(p.nextCursor)
      : typeof p.nextCursor === "string"
        ? p.nextCursor.trim()
        : "";
  return ID.test(raw) ? raw : null;
}

/** Saisons, dedoublonnees, de la plus recente a la plus ancienne. */
export function readSeasons(v: unknown): number[] {
  const list = Array.isArray(v) ? v : [];
  const valid = list.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 1000);
  return [...new Set(valid)].sort((a, b) => b - a);
}

/** Reponse de `/season`. */
export function seasonsOf(data: unknown): number[] {
  return readSeasons(item(data).sids);
}

const schemaStats = itemLenient({ wc: nonNegativeInt, tc: nonNegativeInt, as: numberOrNull, gt: numberOrNull, mvpc: nonNegativeInt, wsc: nonNegativeInt, sids: z.unknown() });

/** Reponse de `/stats`. */
export function readStats(data: unknown): StatsPlayer {
  const d = schemaStats.parse(item(data));
  const matches = d.tc ?? 0;
  return {
    matches,
    wins: Math.min(d.wc ?? 0, matches),
    noteAverage: note(d.as),
    hoursGame: d.gt !== null && d.gt >= 0 ? d.gt : null,
    mvp: d.mvpc,
    bestStreak: d.wsc,
    seasons: readSeasons(d.sids),
  };
}

const schemaFrequent = itemLenient({ hid: numberOrNull, tc: nonNegativeInt, wc: nonNegativeInt, bs: numberOrNull, hid_e: entity });

/** Reponse de `/heroes/frequent` : heros de la saison, avec leurs parties et victoires. */
export function readFrequentHeroes(data: unknown): Page<FrequentHero> {
  const d = item(data);
  const entries = readList(d.result, schemaFrequent, (e) => {
    const hero = heroOf(e.hid, e.hid_e);
    if (!hero || !e.tc) return null;
    return { hero, matches: e.tc, wins: Math.min(e.wc ?? 0, e.tc), note: note(e.bs) };
  });
  return { entries, next: cursorNext(d.pageInfo) };
}

const schemaMatch = itemLenient({
  sid: nonNegativeInt,
  bid: text,
  bid_s: text,
  hid: numberOrNull,
  k: nonNegativeInt,
  d: nonNegativeInt,
  a: nonNegativeInt,
  lid: nonNegativeInt,
  s: numberOrNull,
  mvp: numberOrNull,
  res: numberOrNull,
  ts: numberOrNull,
  hid_e: entity,
});

/** Reponse de `/matches` : une page de parties, des plus recentes aux plus anciennes. */
export function readMatches(data: unknown): Page<MatchSummary> {
  const d = item(data);
  const entries = readList(d.result, schemaMatch, (e): MatchSummary | null => {
    // La version texte d'abord : la version numerique a pu perdre des chiffres.
    const id = [e.bid_s, e.bid].find((v): v is string => v !== null && ID.test(v));
    const hero = heroOf(e.hid, e.hid_e);
    if (!id || !hero) return null;
    return {
      id,
      season: e.sid || null,
      hero,
      eliminations: e.k ?? 0,
      deaths: e.d ?? 0,
      assists: e.a ?? 0,
      lane: e.lid !== null && e.lid >= 1 && e.lid <= 5 ? e.lid : null,
      note: note(e.s),
      mvp: e.mvp === 1,
      win: issue(e.res),
      date: timestamp(e.ts),
    };
  });
  return { entries, next: cursorNext(d.pageInfo) };
}

const schemaParticipant = itemLenient({
  f: nonNegativeInt,
  hid: numberOrNull,
  rid: nonNegativeInt,
  zid: nonNegativeInt,
  k: nonNegativeInt,
  d: nonNegativeInt,
  a: nonNegativeInt,
  fw: numberOrNull,
  hid_e: entity,
});

/** Reponse de `/matches/{id}` : les participants de la partie. */
export function readDetailMatch(data: unknown): Participant[] {
  return readList(item(data).result, schemaParticipant, (e) => {
    const hero = heroOf(e.hid, e.hid_e);
    if (!hero) return null;
    return {
      team: e.f,
      roleId: e.rid,
      zoneId: e.zid,
      hero,
      eliminations: e.k ?? 0,
      deaths: e.d ?? 0,
      assists: e.a ?? 0,
      win: issue(e.fw),
    };
  });
}

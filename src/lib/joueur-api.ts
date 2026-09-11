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
export interface HerosJeu {
  hid: number;
  nom: string;
  /** Image du CDN de Moonton, seulement si son hote est autorise par le site. */
  image: string | null;
}

export interface StatsJoueur {
  parties: number;
  victoires: number;
  /** Note moyenne sur 10 : le service la renvoie multipliee par cent. */
  noteMoyenne: number | null;
  heuresJeu: number | null;
  mvp: number | null;
  meilleureSerie: number | null;
  /** Saisons couvertes, de la plus recente a la plus ancienne. */
  saisons: number[];
}

export interface HerosFrequent {
  heros: HerosJeu;
  parties: number;
  victoires: number;
  note: number | null;
}

export interface PartieResume {
  /** Identifiant de partie, en chaine : il depasse la precision des nombres. */
  id: string;
  saison: number | null;
  heros: HerosJeu;
  eliminations: number;
  morts: number;
  assistances: number;
  /** Position annoncee par le service : 1 Experience, 2 Milieu, 3 Roam, 4 Jungle, 5 Or. */
  lane: number | null;
  note: number | null;
  mvp: boolean;
  /** null quand le service ne dit pas l'issue. */
  victoire: boolean | null;
  /** Horodatage, en secondes. */
  date: number | null;
}

/** Un des dix joueurs d'une partie, dans son detail. */
export interface Participant {
  equipe: number | null;
  roleId: number | null;
  zoneId: number | null;
  heros: HerosJeu;
  eliminations: number;
  morts: number;
  assistances: number;
  victoire: boolean | null;
}

export interface Page<T> {
  entrees: T[];
  /** Curseur de la page suivante, ou null quand il n'y en a plus. */
  suivant: string | null;
}

/** Identifiant de partie ou curseur de pagination : des chiffres, rien d'autre. */
export const IDENTIFIANT = /^\d{1,25}$/;

/**
 * JSON.parse, grands entiers proteges.
 *
 * Identifiants de partie et curseurs depassent 2^53 : lus comme nombres, ils
 * perdent leurs derniers chiffres — 4132717739868068534 devient
 * 4132717739868068400 — et le curseur renvoye au service ne pointe plus sur
 * rien. On les passe en chaines avant l'analyse.
 */
export function lireJson(texte: string): unknown {
  return JSON.parse(texte.replace(/("(?:nextCursor|bid|last_cursor)"\s*:\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"'));
}

const objet = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Object schema whose missing keys still reach their field schema, as null.
 * zod 3 ran a field's transform on an absent key; zod 4 skips it and leaves the
 * key undefined, which slips past the `!== null` checks below (an absent `ts`
 * came out of `horodatage` as an undefined date instead of null). Filling
 * absent keys keeps both versions alike.
 */
function objetTolerant<T extends z.ZodRawShape>(forme: T) {
  const cles = Object.keys(forme);
  return z.preprocess((v) => {
    const o = objet(v);
    return Object.fromEntries(cles.map((c) => [c, o[c] ?? null]));
  }, z.object(forme));
}

/** Nombre tolerant : une chaine numerique est acceptee, tout le reste devient null. */
const nombre = z.unknown().transform((v): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
});

/** Compteur : entier positif ou nul, sinon null. */
const compte = nombre.transform((n) => (n !== null && Number.isInteger(n) && n >= 0 ? n : null));

const texte = z.unknown().transform((v): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
});

/**
 * Fiche de heros jointe par le service (`hid_e`) ; illisible, elle compte pour absente.
 * Anything but an object counts as absent; an object gets its missing keys
 * filled like the entries above, so a missing `ix` stays a null image.
 */
const entite = z
  .preprocess(
    (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? v : null),
    objetTolerant({ id: nombre, n: texte, ix: texte }).nullable(),
  )
  .catch(null);

/** Hotes d'images acceptes par la configuration de `next/image`. */
const IMAGE_SURE = /^https:\/\/(akmweb|akmpicture)\.youngjoygame\.com\/\S+$/;

function herosDe(hid: number | null, e: z.output<typeof entite>): HerosJeu | null {
  const id = hid ?? e?.id ?? null;
  if (id === null || !Number.isInteger(id) || id <= 0) return null;
  return { hid: id, nom: e?.n ?? `#${id}`, image: e?.ix && IMAGE_SURE.test(e.ix) ? e.ix : null };
}

/** Issue d'une partie : 1 victoire, 0 defaite, rien d'autre n'est interprete. */
const issue = (v: number | null): boolean | null => (v === 1 ? true : v === 0 ? false : null);

/** Note du service, multipliee par cent : 1180 vaut 11,8. */
const note = (v: number | null): number | null => (v !== null && v > 0 ? v / 100 : null);

/** Horodatage en secondes ; un horodatage en millisecondes est ramene aux secondes. */
const horodatage = (v: number | null): number | null =>
  v === null || v <= 0 ? null : v > 1e12 ? Math.floor(v / 1000) : v;

/** Lit un tableau entree par entree : une entree illisible est ecartee, pas la liste. */
function lireListe<S extends z.ZodTypeAny, R>(brut: unknown, schema: S, vers: (e: z.output<S>) => R | null): R[] {
  if (!Array.isArray(brut)) return [];
  const sortie: R[] = [];
  for (const entree of brut) {
    const lu = schema.safeParse(entree);
    const valeur = lu.success ? vers(lu.data) : null;
    if (valeur !== null) sortie.push(valeur);
  }
  return sortie;
}

/**
 * Curseur de la page suivante. Le service s'arrete quand `hasNext` est faux
 * ou que le curseur est vide — les deux arrivent, parfois ensemble, parfois
 * seuls : un `hasNext` vrai avec un curseur vide ne mene nulle part.
 */
export function curseurSuivant(pageInfo: unknown): string | null {
  const p = objet(pageInfo);
  if (p.hasNext === false) return null;
  const brut =
    typeof p.nextCursor === "number" && Number.isSafeInteger(p.nextCursor)
      ? String(p.nextCursor)
      : typeof p.nextCursor === "string"
        ? p.nextCursor.trim()
        : "";
  return IDENTIFIANT.test(brut) ? brut : null;
}

/** Saisons, dedoublonnees, de la plus recente a la plus ancienne. */
export function lireSaisons(v: unknown): number[] {
  const liste = Array.isArray(v) ? v : [];
  const valides = liste.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 1000);
  return [...new Set(valides)].sort((a, b) => b - a);
}

/** Reponse de `/season`. */
export function saisonsDe(data: unknown): number[] {
  return lireSaisons(objet(data).sids);
}

const schemaStats = objetTolerant({ wc: compte, tc: compte, as: nombre, gt: nombre, mvpc: compte, wsc: compte, sids: z.unknown() });

/** Reponse de `/stats`. */
export function lireStats(data: unknown): StatsJoueur {
  const d = schemaStats.parse(objet(data));
  const parties = d.tc ?? 0;
  return {
    parties,
    victoires: Math.min(d.wc ?? 0, parties),
    noteMoyenne: note(d.as),
    heuresJeu: d.gt !== null && d.gt >= 0 ? d.gt : null,
    mvp: d.mvpc,
    meilleureSerie: d.wsc,
    saisons: lireSaisons(d.sids),
  };
}

const schemaFrequent = objetTolerant({ hid: nombre, tc: compte, wc: compte, bs: nombre, hid_e: entite });

/** Reponse de `/heroes/frequent` : heros de la saison, avec leurs parties et victoires. */
export function lireHerosFrequents(data: unknown): Page<HerosFrequent> {
  const d = objet(data);
  const entrees = lireListe(d.result, schemaFrequent, (e) => {
    const heros = herosDe(e.hid, e.hid_e);
    if (!heros || !e.tc) return null;
    return { heros, parties: e.tc, victoires: Math.min(e.wc ?? 0, e.tc), note: note(e.bs) };
  });
  return { entrees, suivant: curseurSuivant(d.pageInfo) };
}

const schemaPartie = objetTolerant({
  sid: compte,
  bid: texte,
  bid_s: texte,
  hid: nombre,
  k: compte,
  d: compte,
  a: compte,
  lid: compte,
  s: nombre,
  mvp: nombre,
  res: nombre,
  ts: nombre,
  hid_e: entite,
});

/** Reponse de `/matches` : une page de parties, des plus recentes aux plus anciennes. */
export function lireParties(data: unknown): Page<PartieResume> {
  const d = objet(data);
  const entrees = lireListe(d.result, schemaPartie, (e): PartieResume | null => {
    // La version texte d'abord : la version numerique a pu perdre des chiffres.
    const id = [e.bid_s, e.bid].find((v): v is string => v !== null && IDENTIFIANT.test(v));
    const heros = herosDe(e.hid, e.hid_e);
    if (!id || !heros) return null;
    return {
      id,
      saison: e.sid || null,
      heros,
      eliminations: e.k ?? 0,
      morts: e.d ?? 0,
      assistances: e.a ?? 0,
      lane: e.lid !== null && e.lid >= 1 && e.lid <= 5 ? e.lid : null,
      note: note(e.s),
      mvp: e.mvp === 1,
      victoire: issue(e.res),
      date: horodatage(e.ts),
    };
  });
  return { entrees, suivant: curseurSuivant(d.pageInfo) };
}

const schemaParticipant = objetTolerant({
  f: compte,
  hid: nombre,
  rid: compte,
  zid: compte,
  k: compte,
  d: compte,
  a: compte,
  fw: nombre,
  hid_e: entite,
});

/** Reponse de `/matches/{id}` : les participants de la partie. */
export function lireDetailPartie(data: unknown): Participant[] {
  return lireListe(objet(data).result, schemaParticipant, (e) => {
    const heros = herosDe(e.hid, e.hid_e);
    if (!heros) return null;
    return {
      equipe: e.f,
      roleId: e.rid,
      zoneId: e.zid,
      heros,
      eliminations: e.k ?? 0,
      morts: e.d ?? 0,
      assistances: e.a ?? 0,
      victoire: issue(e.fw),
    };
  });
}

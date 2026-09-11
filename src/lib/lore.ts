import type { Langue } from "@/i18n/config";
import { cleValeur } from "@/i18n/donnees-heros";
import { heros, histoires } from "./donnees";
import type { Heros, Role } from "./types";
import { cleRecherche } from "./utils";

/**
 * Lore : regions, factions et liens entre heros.
 *
 * Tout vient des donnees : la region de chaque heros (`heros.json`) et sa
 * fiche narrative du wiki (`histoires`), en quatre langues. Aucun texte n'est
 * ecrit ici : un lien n'existe que si la fiche d'un heros en nomme un autre,
 * et sa nature est celle que la fiche lui donne.
 *
 * Les noms se cherchent dans la fiche anglaise : les autres langues traduisent
 * parfois un nom de heros (« Minotaure », « Sabre »). Les listes des quatre
 * langues etant alignees, la nature du lien se lit ensuite a la meme position
 * dans la langue de la page.
 */

// ── Relations ──────────────────────────────────────────────────────

/** « Gusion, Eren (younger brothers) » : les noms, puis la nature du lien, entre les parentheses finales. */
export function decouperRelation(texte: string): { noms: string; nature: string | null } {
  const t = texte.trim();
  if (!t.endsWith(")")) return { noms: t, nature: null };
  let profondeur = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ")") profondeur += 1;
    else if (t[i] === "(" && --profondeur === 0) {
      return { noms: t.slice(0, i).trim(), nature: t.slice(i + 1, -1).trim() || null };
    }
  }
  return { noms: t, nature: null };
}

export interface MotifHeros {
  slug: string;
  motif: RegExp;
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nom de chaque heros en mot entier : « Yin » ne se trouve pas dans « Yinyang ». */
export function motifsHeros(liste: readonly { slug: string; nom: string }[]): MotifHeros[] {
  return liste.map((h) => ({
    slug: h.slug,
    motif: new RegExp(`(?<![\\p{L}\\p{N}])${echapper(h.nom)}(?![\\p{L}\\p{N}])`, "iu"),
  }));
}

/**
 * Heros nommes dans une liste de noms, dans l'ordre de lecture. Un nom inclus
 * dans un nom plus long ne compte pas : « Sun » dans « Yi Sun-shin ».
 */
export function herosCites(noms: string, motifs: readonly MotifHeros[], soi?: string): string[] {
  const trouves = motifs.flatMap((m) => {
    const r = m.motif.exec(noms);
    return r ? [{ slug: m.slug, debut: r.index, fin: r.index + r[0].length }] : [];
  });
  trouves.sort((a, b) => b.fin - b.debut - (a.fin - a.debut));
  const gardes: typeof trouves = [];
  for (const x of trouves) if (!gardes.some((g) => x.debut < g.fin && g.debut < x.fin)) gardes.push(x);
  return gardes
    .filter((g) => g.slug !== soi)
    .sort((a, b) => a.debut - b.debut)
    .map((g) => g.slug);
}

export interface LienLore {
  /** Heros dont la fiche nomme l'autre. */
  de: string;
  vers: string;
  /** Nature du lien selon la fiche de `de`, dans la langue de la page. */
  nature: string | null;
  natureEn: string | null;
  /** Nombre de heros nommes sur la meme ligne : « ennemis » a quinze pese moins que « frere ». */
  groupe: number;
}

type FicheRelations = { fiche: { relations: string[]; affiliations: string[]; espece: string | null } | null };

/** Liens d'une liste de heros, a partir de leurs fiches anglaises et de celles de la langue de la page. */
export function construireLiens(
  liste: readonly { slug: string; nom: string }[],
  en: Record<string, FicheRelations>,
  langue: Record<string, FicheRelations>,
): LienLore[] {
  const motifs = motifsHeros(liste);
  const vus = new Set<string>();
  const liens: LienLore[] = [];
  for (const h of liste) {
    const relations = en[h.slug]?.fiche?.relations ?? [];
    const traduites = langue[h.slug]?.fiche?.relations ?? [];
    relations.forEach((ligne, i) => {
      const { noms, nature } = decouperRelation(ligne);
      const cites = herosCites(noms, motifs, h.slug);
      const natureLangue = traduites.length === relations.length ? decouperRelation(traduites[i]).nature : null;
      for (const vers of cites) {
        const cle = `${h.slug}>${vers}`;
        if (vus.has(cle)) continue;
        vus.add(cle);
        liens.push({ de: h.slug, vers, nature: natureLangue ?? nature, natureEn: nature, groupe: cites.length });
      }
    });
  }
  return liens;
}

export interface PaireLore {
  a: string;
  b: string;
  /** Ce que la fiche de `a` dit de `b`, et l'inverse ; null quand la fiche ne le nomme pas. */
  deA: LienLore | null;
  deB: LienLore | null;
  score: number;
}

/** Liens de parente, d'amour, d'amitie, de rivalite ou d'apprentissage, lus dans la nature anglaise. */
const PROCHES =
  /\b(brother|sister|sibling|father|mother|parent|son|daughter|twin|wife|husband|lover|love|crush|fianc|rival|mentor|master|student|disciple|apprentice|teacher|cousin|uncle|aunt|nephew|niece|grand|friend|adopt|guardian|partner)/i;

function poids(l: LienLore | null): number {
  if (!l) return 0;
  return 1 + (l.groupe === 1 ? 2 : l.groupe === 2 ? 1 : 0) + (l.natureEn && PROCHES.test(l.natureEn) ? 2 : 0);
}

/**
 * Paires de heros liees, de la plus marquante a la plus diffuse : un lien
 * nomme des deux cotes, personnel et singulier, passe devant une liste
 * d'ennemis.
 */
export function pairesLore(liens: readonly LienLore[], noms: ReadonlyMap<string, string>): PaireLore[] {
  const paires = new Map<string, PaireLore>();
  for (const l of liens) {
    const [a, b] = [l.de, l.vers].sort();
    const cle = `${a}|${b}`;
    const p = paires.get(cle) ?? { a, b, deA: null, deB: null, score: 0 };
    if (l.de === a) p.deA ??= l;
    else p.deB ??= l;
    paires.set(cle, p);
  }
  const nom = (s: string) => noms.get(s) ?? s;
  return [...paires.values()]
    .map((p) => ({ ...p, score: poids(p.deA) + poids(p.deB) + (p.deA && p.deB ? 2 : 0) }))
    .sort((x, y) => y.score - x.score || nom(x.a).localeCompare(nom(y.a), "en") || nom(x.b).localeCompare(nom(y.b), "en"));
}

/** Les paires les plus marquantes, chaque heros n'apparaissant qu'une fois. */
export function pairesVedettes(paires: readonly PaireLore[], nombre: number): PaireLore[] {
  const pris = new Set<string>();
  const choisies: PaireLore[] = [];
  for (const p of paires) {
    if (choisies.length >= nombre) break;
    if (pris.has(p.a) || pris.has(p.b)) continue;
    pris.add(p.a).add(p.b);
    choisies.push(p);
  }
  return choisies;
}

// ── Regions et factions ────────────────────────────────────────────

export interface RegionLore {
  /** Slug de la region, cle de son libelle (`donneesHeros.region.<cle>`) et de son adresse. */
  cle: string;
  /** Nom anglais du wiki. */
  nom: string;
  heros: Heros[];
}

/** Regions, de la plus peuplee a la moins peuplee ; heros par ordre alphabetique. */
export function grouperParRegion(liste: readonly Heros[]): RegionLore[] {
  const regions = new Map<string, RegionLore>();
  for (const h of liste) {
    if (!h.region) continue;
    const cle = cleValeur(h.region);
    const r = regions.get(cle) ?? { cle, nom: h.region, heros: [] };
    r.heros.push(h);
    regions.set(cle, r);
  }
  return [...regions.values()]
    .map((r) => ({ ...r, heros: [...r.heros].sort((a, b) => a.nom.localeCompare(b.nom, "en")) }))
    .sort((a, b) => b.heros.length - a.heros.length || a.nom.localeCompare(b.nom, "en"));
}

export const regionsLore = grouperParRegion(heros);
export const regionParCle = new Map(regionsLore.map((r) => [r.cle, r]));
export const nomsHeros = new Map(heros.map((h) => [h.slug, h.nom]));
const regionDuHeros = new Map(regionsLore.flatMap((r) => r.heros.map((h) => [h.slug, r.cle] as const)));
export const regionDe = (slug: string) => regionDuHeros.get(slug) ?? null;

const cacheLiens = new Map<Langue, LienLore[]>();
export function liensLore(locale: Langue): LienLore[] {
  let liens = cacheLiens.get(locale);
  if (!liens) {
    const en = histoires("en") as unknown as Record<string, FicheRelations>;
    const langue = histoires(locale) as unknown as Record<string, FicheRelations>;
    liens = construireLiens(heros, en, langue);
    cacheLiens.set(locale, liens);
  }
  return liens;
}

export const pairesDe = (locale: Langue) => pairesLore(liensLore(locale), nomsHeros);

/** Affiliation « contre » ou passee (« The Abyss (hostile) ») : un camp adverse, pas une faction. */
const HOSTILE = /hostile|enem|former/i;

export interface FactionLore {
  cle: string;
  nom: string;
  heros: string[];
}

/**
 * Factions citees par au moins deux fiches, de la plus nombreuse a la plus
 * petite. Regroupees par leur nom anglais ; le libelle est celui que la
 * langue de la page donne le plus souvent.
 */
export function factionsLore(locale: Langue, minimum = 2): FactionLore[] {
  const en = histoires("en");
  const langue = histoires(locale);
  const groupes = new Map<string, { heros: string[]; libelles: Map<string, number> }>();
  for (const h of heros) {
    const affiliations = en[h.slug]?.fiche?.affiliations ?? [];
    const traduites = langue[h.slug]?.fiche?.affiliations ?? [];
    affiliations.forEach((a, i) => {
      if (HOSTILE.test(a)) return;
      const cle = cleValeur(a);
      if (!cle) return;
      const g = groupes.get(cle) ?? { heros: [], libelles: new Map<string, number>() };
      if (!g.heros.includes(h.slug)) g.heros.push(h.slug);
      const libelle = traduites.length === affiliations.length ? traduites[i] : a;
      g.libelles.set(libelle, (g.libelles.get(libelle) ?? 0) + 1);
      groupes.set(cle, g);
    });
  }
  return [...groupes]
    .filter(([, g]) => g.heros.length >= minimum)
    .map(([cle, g]) => ({
      cle,
      nom: [...g.libelles].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      heros: g.heros.sort((a, b) => (nomsHeros.get(a) ?? a).localeCompare(nomsHeros.get(b) ?? b, "en")),
    }))
    .sort((a, b) => b.heros.length - a.heros.length || a.nom.localeCompare(b.nom));
}

const MOIS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** « 26 October 2021 » → « 2021-10-26 », « January 2017 » → « 2017-01 », « 2016 » ; null pour « TBA ». */
export function cleSortieHeros(sortie: string | null): string | null {
  const m = sortie?.trim().match(/^(?:(\d{1,2}) )?(?:([A-Za-z]+) )?(\d{4})$/);
  if (!m) return null;
  const mois = m[2] ? MOIS.indexOf(m[2].toLowerCase()) + 1 : 0;
  if (m[2] && mois === 0) return m[3];
  if (!mois) return m[3];
  const mm = String(mois).padStart(2, "0");
  return m[1] ? `${m[3]}-${mm}-${m[1].padStart(2, "0")}` : `${m[3]}-${mm}`;
}

export interface ResumeRegion {
  roles: { role: Role; n: number }[];
  /** Premier et dernier heros de la region arrives dans le jeu. */
  premier: Heros | null;
  dernier: Heros | null;
  factions: { nom: string; n: number }[];
  especes: { nom: string; n: number }[];
  /** Paires de heros de la region liees entre elles. */
  internes: PaireLore[];
  /** Paires qui relient la region aux autres. */
  externes: PaireLore[];
  voisines: { cle: string; n: number }[];
}

function compter<T>(valeurs: T[]): [T, number][] {
  const m = new Map<T, number>();
  for (const v of valeurs) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

/** Portrait d'une region, en chiffres tires des fiches : de quoi ecrire son resume sans rien inventer. */
export function resumeRegion(region: RegionLore, locale: Langue): ResumeRegion {
  const membres = new Set(region.heros.map((h) => h.slug));
  const en = histoires("en");
  const langue = histoires(locale);

  const roles = compter(region.heros.flatMap((h) => h.roles)).map(([role, n]) => ({ role, n }));
  const dates = region.heros
    .map((h) => ({ h, cle: cleSortieHeros(h.sortie) }))
    .filter((x): x is { h: Heros; cle: string } => x.cle !== null)
    .sort((a, b) => a.cle.localeCompare(b.cle) || a.h.nom.localeCompare(b.h.nom, "en"));

  const factions = factionsLore(locale)
    .map((f) => ({ nom: f.nom, n: f.heros.filter((s) => membres.has(s)).length }))
    .filter((f) => f.n >= 2)
    .sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom))
    .slice(0, 4);

  // Especes regroupees par leur nom anglais, affichees dans la langue de la page.
  const especes = new Map<string, { nom: string; n: number }>();
  for (const h of region.heros) {
    const cle = en[h.slug]?.fiche?.espece?.trim().toLowerCase();
    if (!cle) continue;
    const e = especes.get(cle) ?? { nom: langue[h.slug]?.fiche?.espece ?? en[h.slug]!.fiche!.espece!, n: 0 };
    e.n += 1;
    especes.set(cle, e);
  }

  const paires = pairesDe(locale);
  const internes = paires.filter((p) => membres.has(p.a) && membres.has(p.b));
  const externes = paires.filter((p) => membres.has(p.a) !== membres.has(p.b));
  const voisines = compter(externes.map((p) => regionDe(membres.has(p.a) ? p.b : p.a)).filter((c): c is string => !!c)).map(
    ([cle, n]) => ({ cle, n }),
  );

  return {
    roles,
    premier: dates[0]?.h ?? null,
    dernier: dates.length > 1 ? dates[dates.length - 1].h : null,
    factions,
    especes: [...especes.values()].sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom)).slice(0, 3),
    internes,
    externes,
    voisines,
  };
}

/** Termes de recherche d'un heros sur le hub : nom, nom complet, titre et affiliations, sans casse ni accents. */
export function termesLore(h: Heros, locale: Langue, region: string): string {
  const fiche = histoires(locale)[h.slug]?.fiche;
  return cleRecherche([h.nom, fiche?.nomComplet, fiche?.titre, h.titre, region, ...(fiche?.affiliations ?? [])].filter(Boolean).join(" "))
    .replace(/["\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

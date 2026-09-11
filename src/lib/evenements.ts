import { lireSortie, type SkinCatalogue } from "./catalogue-skins";

/**
 * Calendrier des evenements : ce qui sort chaque mois (skin StarLight, skins
 * Collector, skins d'evenement, de tirage ou de boutique), assemble a partir
 * du catalogue des skins et des listes mensuelles du wiki.
 *
 * Module sans donnees : les calculs se testent seuls, la jointure avec les
 * fichiers du wiki est dans `evenements-serveur`.
 */

/**
 * Facon d'obtenir un skin, lue dans les seuls champs du module de skins :
 * etiquette (serie), prix chiffres et texte d'obtention. Ordre d'affichage.
 */
export const MODES = ["starlight", "collector", "evenement", "boutique", "passe"] as const;
export type ModeObtention = (typeof MODES)[number];
export type ModeAutre = Exclude<ModeObtention, "starlight" | "collector">;
export const MODES_AUTRES: readonly ModeAutre[] = ["evenement", "boutique", "passe"];

/** Recompense de passe, de saison classee ou de premiere recharge (« M5 Pass », « Season 36 », « S36 First Recharge »). */
const PASSE = /\b(?:pass|season|recharge)\b/i;

export function modeObtention(s: Pick<SkinCatalogue, "serie" | "obtention" | "prix">): ModeObtention {
  const serie = s.serie?.toLowerCase() ?? "";
  const obtention = s.obtention ?? "";
  // L'etiquette manque parfois, pas le texte « 2025/05 StarLight Member ».
  if (serie === "starlight" || /starlight member/i.test(obtention)) return "starlight";
  if (serie === "collector") return "collector";
  if (PASSE.test(obtention) || /^s\d+$/.test(serie)) return "passe";
  // Diamants, points de bataille, tickets ou fragments : un prix fixe, en boutique.
  if (s.prix.dm || s.prix.bp || s.prix.ticket || s.prix.hf) return "boutique";
  // Reste : noyaux magiques (roue), gemmes, pieces mythiques, ou aucun prix fixe (tirages, collaborations).
  return "evenement";
}

// ── Mois ───────────────────────────────────────────────────────────

const FORMAT_MOIS = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** « 2026-09 » : un mois valide, tel qu'il figure dans l'adresse d'une page. */
export const estMois = (m: string) => FORMAT_MOIS.test(m);

/** Mois decale de `n` mois, a travers les annees. */
export function decalerMois(mois: string, n: number): string {
  const [a, m] = mois.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Mois d'une date du wiki ; null quand elle ne donne que l'annee, ou rien de lisible. */
export function moisDeSortie(sortie: string | null | undefined): string | null {
  const d = lireSortie(sortie);
  return d?.mois ? `${d.annee}-${String(d.mois).padStart(2, "0")}` : null;
}

/** Passe, en cours, ou annonce par une source a la date des donnees. */
export type StatutMois = "passe" | "courant" | "annonce";
export function statutMois(mois: string, reference: string): StatutMois {
  const courant = reference.slice(0, 7);
  return mois === courant ? "courant" : mois > courant ? "annonce" : "passe";
}

// ── Assemblage ─────────────────────────────────────────────────────

/** Skin du calendrier ; `horsCatalogue` : connu des seules listes du wiki, sans rarete ni prix. */
export interface SkinEvenement extends SkinCatalogue {
  horsCatalogue?: boolean;
}

/** Entree d'une liste mensuelle du wiki, deja rattachee a son skin. */
export interface EntreeListe {
  mode: "starlight" | "collector";
  mois: string;
  skin: SkinEvenement;
}

export interface MoisEvenements {
  mois: string;
  starlight: SkinEvenement[];
  collector: SkinEvenement[];
  /** La liste du wiki dit expressement qu'aucun Collector n'est sorti ce mois-la. */
  sansCollector: boolean;
  autres: Record<ModeAutre, SkinEvenement[]>;
  total: number;
}

const cleSkin = (s: Pick<SkinCatalogue, "heros" | "id" | "nom">) => `${s.heros}|${s.id || s.nom}`;
const parDate = (a: SkinCatalogue, b: SkinCatalogue) =>
  (a.sortie ?? "").localeCompare(b.sortie ?? "") || a.nom.localeCompare(b.nom, "en");

/**
 * Mois qui ont au moins un skin, du plus recent au plus ancien.
 *
 * Un skin cite par une liste mensuelle prend le mois de la liste, meme si le
 * module le date autrement : ces listes suivent les sorties de pres, le
 * module non. Les autres skins prennent leur mois de sortie ; un skin date a
 * l'annee seule n'entre dans aucun mois.
 */
export function assemblerMois(o: {
  sortis: readonly SkinCatalogue[];
  listes: readonly EntreeListe[];
  sansCollector: readonly string[];
}): MoisEvenements[] {
  const parMois = new Map<string, MoisEvenements>();
  const bloc = (mois: string) => {
    let m = parMois.get(mois);
    if (!m) {
      m = { mois, starlight: [], collector: [], sansCollector: false, autres: { evenement: [], boutique: [], passe: [] }, total: 0 };
      parMois.set(mois, m);
    }
    return m;
  };

  const listes = new Set<string>();
  for (const e of o.listes) {
    const cle = cleSkin(e.skin);
    // Une meme liste peut citer un skin deux fois (reprise d'un mois a l'autre) : la premiere occurrence compte.
    if (listes.has(cle)) continue;
    listes.add(cle);
    bloc(e.mois)[e.mode].push(e.skin);
  }
  for (const s of o.sortis) {
    const mois = moisDeSortie(s.sortie);
    if (!mois || listes.has(cleSkin(s))) continue;
    const mode = modeObtention(s);
    const m = bloc(mois);
    if (mode === "starlight" || mode === "collector") m[mode].push(s);
    else m.autres[mode].push(s);
  }
  for (const mois of o.sansCollector) {
    const m = parMois.get(mois);
    if (m && m.collector.length === 0) m.sansCollector = true;
  }

  return [...parMois.values()]
    .map((m) => {
      m.starlight.sort(parDate);
      m.collector.sort(parDate);
      for (const mode of MODES_AUTRES) m.autres[mode].sort(parDate);
      m.total = m.starlight.length + m.collector.length + MODES_AUTRES.reduce((n, k) => n + m.autres[k].length, 0);
      return m;
    })
    .sort((a, b) => b.mois.localeCompare(a.mois));
}

/** Mois voisins dans une liste du plus recent au plus ancien : `precedent` est plus ancien. */
export function voisins(mois: readonly string[], courant: string): { precedent: string | null; suivant: string | null } {
  const i = mois.indexOf(courant);
  if (i < 0) return { precedent: null, suivant: null };
  return { precedent: mois[i + 1] ?? null, suivant: mois[i - 1] ?? null };
}

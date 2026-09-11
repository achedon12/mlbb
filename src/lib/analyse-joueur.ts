/**
 * Analyses du profil de joueur : roles et positions, evolution au fil des
 * parties, et ce que joue le rang du joueur sur ses heros.
 *
 * Calculs purs, sans appel reseau, comme `profil-joueur` : pages et tests leur
 * passent des reponses deja lues par `joueur-api`.
 */
import type { BuildResolu } from "@/components/builds-par-rang";
import { buildsJoues, contres, herosParSlug, type BuildJoue } from "./donnees";
import { LANE_JEU } from "./format-joueur";
import type { HerosFrequent, PartieResume } from "./joueur-api";
import { herosAffiche, type HerosAffiche, type LigneHeros } from "./profil-joueur";
import type { RangMesure } from "./rangs-mesure";
import type { Lane, Role } from "./types";
import { resoudreBuild } from "./visuels-build";

// ─────────────────────────────────────────────────────────────
// Roles et positions
// ─────────────────────────────────────────────────────────────

/** En dessous, un role ou une position n'est ni point fort ni point faible : trop peu de parties. */
export const PARTIES_MIN_POSTE = 10;

export interface LignePoste<C extends string> {
  cle: C;
  parties: number;
  victoires: number;
  /** Taux de victoire, en points. */
  taux: number;
  /** Part des parties comptees, en points. */
  part: number;
}

export interface BilanPostes<C extends string> {
  /** Du plus au moins joue. */
  lignes: LignePoste<C>[];
  /** Base de la part des parties. */
  total: number;
  /** Parties qui n'ont pu etre rattachees a rien : heros inconnu du site, position absente. */
  ecartees: number;
  /** Meilleur et plus faible taux parmi ceux joues au moins `PARTIES_MIN_POSTE` fois. */
  fort: C | null;
  faible: C | null;
}

type Compteurs<C extends string> = Map<C, { parties: number; victoires: number }>;

function ajouter<C extends string>(compteurs: Compteurs<C>, cle: C, parties: number, victoires: number) {
  const c = compteurs.get(cle) ?? { parties: 0, victoires: 0 };
  c.parties += parties;
  c.victoires += victoires;
  compteurs.set(cle, c);
}

function bilanPostes<C extends string>(compteurs: Compteurs<C>, total: number, ecartees: number): BilanPostes<C> {
  const lignes = [...compteurs]
    .filter(([, c]) => c.parties > 0)
    .map(([cle, c]) => ({
      cle,
      parties: c.parties,
      victoires: c.victoires,
      taux: (c.victoires / c.parties) * 100,
      part: total > 0 ? (c.parties / total) * 100 : 0,
    }))
    .sort((a, b) => b.parties - a.parties || b.taux - a.taux);

  // A taux egal, le plus joue l'emporte : son taux est le plus sur.
  const retenues = lignes.filter((l) => l.parties >= PARTIES_MIN_POSTE);
  const fort = [...retenues].sort((a, b) => b.taux - a.taux || b.parties - a.parties)[0];
  const faible = [...retenues].sort((a, b) => a.taux - b.taux || b.parties - a.parties)[0];
  const contraste = retenues.length >= 2 && fort.taux > faible.taux;
  return { lignes, total, ecartees, fort: contraste ? fort.cle : null, faible: contraste ? faible.cle : null };
}

const ficheDe = (h: PartieResume["heros"]) => {
  const slug = herosAffiche(h).slug;
  return slug ? herosParSlug.get(slug) : undefined;
};

/**
 * Parties de la saison par role du heros, d'apres le catalogue du site. Un
 * heros a deux roles compte dans chacun : la somme des parts peut depasser
 * cent. Un heros inconnu du site est ecarte plutot que devine.
 */
export function statsParRole(frequents: HerosFrequent[]): BilanPostes<Role> {
  const compteurs: Compteurs<Role> = new Map();
  let total = 0;
  let ecartees = 0;
  for (const f of frequents) {
    if (f.parties <= 0) continue;
    total += f.parties;
    const roles = ficheDe(f.heros)?.roles ?? [];
    if (roles.length === 0) ecartees += f.parties;
    for (const role of new Set(roles)) ajouter(compteurs, role, f.parties, f.victoires);
  }
  return bilanPostes(compteurs, total, ecartees);
}

/**
 * Position occupee partie par partie. Le service la donne (`lid`) ; a defaut,
 * un heros qui n'a qu'une position au catalogue la prete. Une partie a l'issue
 * inconnue ne compte pas : elle ne dirait rien du taux.
 */
export function positionDe(p: PartieResume): Lane | null {
  if (p.lane !== null && LANE_JEU[p.lane]) return LANE_JEU[p.lane];
  const lanes = ficheDe(p.heros)?.lanes ?? [];
  return lanes.length === 1 ? lanes[0] : null;
}

export function statsParPosition(parties: PartieResume[]): BilanPostes<Lane> {
  const compteurs: Compteurs<Lane> = new Map();
  let comptees = 0;
  let ecartees = 0;
  for (const p of parties) {
    if (p.victoire === null) continue;
    const lane = positionDe(p);
    if (!lane) {
      ecartees++;
      continue;
    }
    comptees++;
    ajouter(compteurs, lane, 1, p.victoire ? 1 : 0);
  }
  return bilanPostes(compteurs, comptees, ecartees);
}

// ─────────────────────────────────────────────────────────────
// Evolution au fil des parties
// ─────────────────────────────────────────────────────────────

/** Parties de la moyenne glissante, et de la « forme » recente. */
export const FENETRE_FORME = 10;

export interface Serie {
  victoire: boolean;
  longueur: number;
}

export interface Evolution {
  /** Parties dont l'issue est connue. */
  parties: number;
  victoires: number;
  /** Serie en cours, a partir de la partie la plus recente. */
  serieEnCours: Serie | null;
  /** Plus longues series de victoires et de defaites. */
  meilleureSerie: number;
  pireSerie: number;
  /** Taux sur les `FENETRE_FORME` dernieres parties ; null s'il y en a moins. */
  forme: number | null;
  /**
   * Courbe, de la plus ancienne partie a la plus recente, a partir de la
   * premiere fenetre complete : une date (jour UTC) par partie, le taux
   * glissant et le taux cumule. null faute de deux points, ou de dates.
   */
  courbe: { dates: string[]; glissante: number[]; cumulee: number[] } | null;
}

const jourUtc = (secondes: number) => new Date(secondes * 1000).toISOString().slice(0, 10);

/**
 * Jour de chaque partie. Une partie sans date prend celle de sa voisine plus
 * ancienne, ou a defaut plus recente : la courbe exige une date par point, et
 * l'ordre du service fait foi. null si aucune partie n'est datee.
 */
function datesDe(chrono: PartieResume[]): string[] | null {
  const connues = chrono.map((p) => (p.date !== null && Number.isFinite(p.date) ? jourUtc(p.date) : null));
  const premiere = connues.find((d) => d !== null);
  if (!premiere) return null;
  let precedente = premiere;
  return connues.map((d) => (precedente = d ?? precedente));
}

/**
 * Evolution sur l'historique lu, des plus recentes aux plus anciennes comme
 * les rend le service. Les parties a l'issue inconnue sont laissees de cote :
 * elles ne cassent pas une serie.
 */
export function evolution(parties: PartieResume[], fenetre = FENETRE_FORME): Evolution {
  const chrono = parties.filter((p) => p.victoire !== null).reverse();
  const issues = chrono.map((p) => p.victoire === true);
  const n = issues.length;

  let meilleureSerie = 0;
  let pireSerie = 0;
  let courante = null as Serie | null;
  for (const v of issues) {
    courante = { victoire: v, longueur: courante?.victoire === v ? courante.longueur + 1 : 1 };
    if (v) meilleureSerie = Math.max(meilleureSerie, courante.longueur);
    else pireSerie = Math.max(pireSerie, courante.longueur);
  }

  const glissante: number[] = [];
  const cumulee: number[] = [];
  let gagnees = 0;
  let dansFenetre = 0;
  issues.forEach((v, i) => {
    gagnees += v ? 1 : 0;
    dansFenetre += v ? 1 : 0;
    if (i >= fenetre) dansFenetre -= issues[i - fenetre] ? 1 : 0;
    if (i >= fenetre - 1) {
      glissante.push((dansFenetre / fenetre) * 100);
      cumulee.push((gagnees / (i + 1)) * 100);
    }
  });

  const dates = datesDe(chrono);
  return {
    parties: n,
    victoires: gagnees,
    serieEnCours: courante,
    meilleureSerie,
    pireSerie,
    forme: n >= fenetre ? glissante.at(-1)! : null,
    courbe: dates && glissante.length >= 2 ? { dates: dates.slice(fenetre - 1), glissante, cumulee } : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Ce que joue le rang
// ─────────────────────────────────────────────────────────────

export interface ContreDifficile {
  heros: HerosAffiche;
  /** Ecart de taux de victoire du heros du joueur face a lui, en points (negatif). */
  avantage: number;
}

export interface FicheHerosRang {
  ligne: LigneHeros & { heros: { slug: string } };
  /** Position du build retenu. */
  lane: Lane | null;
  build: BuildResolu | null;
  /** Rang dont vient le build : celui du joueur, ou tous rangs a defaut. */
  rangBuild: RangMesure | null;
  faibles: ContreDifficile[];
  rangContres: RangMesure | null;
}

/** Heros de la fiche du site, pret a afficher. */
function afficheDuSite(slug: string): HerosAffiche | null {
  const h = herosParSlug.get(slug);
  return h ? { slug: h.slug, nom: h.nom, portrait: h.visuels.portrait } : null;
}

/**
 * Position a retenir pour les builds d'un heros : celle ou le joueur l'a le
 * plus joue recemment, si le rang y a des builds ; sinon la premiere position
 * du catalogue qui en a, puis la premiere mesuree.
 */
function laneDuJoueur(slug: string, disponibles: string[], recentes: PartieResume[]): string | null {
  const jouees = new Map<string, number>();
  for (const p of recentes) {
    const lane = p.lane !== null ? LANE_JEU[p.lane] : undefined;
    if (lane && herosAffiche(p.heros).slug === slug) jouees.set(lane, (jouees.get(lane) ?? 0) + 1);
  }
  const preferee = [...jouees].sort((a, b) => b[1] - a[1]).find(([l]) => disponibles.includes(l));
  if (preferee) return preferee[0];
  const catalogue = herosParSlug.get(slug)?.lanes.find((l) => disponibles.includes(l));
  return catalogue ?? disponibles[0] ?? null;
}

/** Le plus joue d'abord : la plus forte part des parties. */
const parSelection = (a: BuildJoue, b: BuildJoue) => (b.selection ?? -1) - (a.selection ?? -1);

/** Le rang demande, ou tous rangs confondus a defaut. */
function auRang<V>(parRang: Partial<Record<RangMesure, V>> | undefined, tranche: RangMesure) {
  if (parRang?.[tranche] !== undefined) return { valeur: parRang[tranche]!, rang: tranche };
  if (parRang?.all !== undefined) return { valeur: parRang.all, rang: "all" as RangMesure };
  return null;
}

/**
 * Pour les heros les plus joues : le build le plus joue a son rang — la plus
 * forte part des parties — et les heros qui le mettent le plus en difficulte a
 * ce rang. Un heros sans aucune de ces mesures est passe.
 */
export function fichesHerosRang(
  lignes: LigneHeros[],
  tranche: RangMesure,
  recentes: PartieResume[],
  combien = 3,
): FicheHerosRang[] {
  const fiches: FicheHerosRang[] = [];
  for (const ligne of lignes) {
    if (fiches.length >= combien) break;
    const slug = ligne.heros.slug;
    if (!slug) continue;

    const parLane = buildsJoues[slug] ?? {};
    const lane = laneDuJoueur(slug, Object.keys(parLane), recentes);
    const builds = lane ? auRang(parLane[lane], tranche) : null;
    const plusJoue = [...(builds?.valeur ?? [])].sort(parSelection)[0];

    const mesure = auRang(contres[slug], tranche);
    const faibles = [...(mesure?.valeur.faible ?? [])]
      .filter((c) => c.avantage < 0)
      .sort((a, b) => a.avantage - b.avantage)
      .flatMap((c) => {
        const heros = afficheDuSite(c.slug);
        return heros ? [{ heros, avantage: c.avantage }] : [];
      })
      .slice(0, 3);

    if (!plusJoue && faibles.length === 0) continue;
    fiches.push({
      ligne: { ...ligne, heros: { ...ligne.heros, slug } },
      lane: plusJoue ? (lane as Lane) : null,
      build: plusJoue ? resoudreBuild(plusJoue) : null,
      rangBuild: plusJoue ? builds!.rang : null,
      faibles,
      rangContres: faibles.length > 0 ? mesure!.rang : null,
    });
  }
  return fiches;
}

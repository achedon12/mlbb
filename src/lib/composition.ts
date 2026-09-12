import { LANES, ROLES, suggerer, type HerosDraft, type Suggestion } from "./draft";
import type { RangMesure } from "./rangs-mesure";
import type { Lane, NotesHeros, Palier, Role } from "./types";

/**
 * Analyse d'une composition d'equipe.
 *
 * Jusqu'a cinq heros choisis sans position imposee : le module leur attribue
 * les lanes, fait le compte des roles et des degats, moyenne leurs notes et
 * leurs taux par duree de partie, puis cherche dans les mesures du jeu ce qui
 * les lie (coequipiers qui se font gagner) et ce qui les menace (adversaires
 * qui en genent plusieurs). Aucune donnee importee : le module tourne dans le
 * navigateur sur ce que la page lui passe, et se teste sans le catalogue.
 */

export const TAILLE_EQUIPE = 5;

/** Type de degats, sous la cle du catalogue (`heroData.damage.*`). */
export type TypeDegats = "physical" | "magic" | "mixed";

/** Ce que l'analyse lit d'un heros, pour tout le roster. */
export interface HerosEquipe {
  slug: string;
  nom: string;
  lanes: Lane[];
  roles: Role[];
  icone: string | null;
  /** Synergies connues : relations du wiki et meilleurs coequipiers tous rangs. */
  synergies: string[];
  degats: TypeDegats | null;
  notes: NotesHeros;
}

/** Heros cite par une mesure, avec l'ecart de victoire en points. */
export type Ecart = [slug: string, points: number];

/** Tranche de duree de partie, en minutes ; `a` nul pour la derniere, ouverte. */
export interface Tranche {
  from: number;
  to: number | null;
}

/**
 * Mesures d'un rang pour tout le roster. Un fichier statique par rang
 * (`/composition/<rang>.json`) : la page n'embarque rien de ce qui depend du
 * rang, et le navigateur ne charge que les rangs consultes.
 */
export interface MesuresRang {
  rang: RangMesure;
  /** Taux de victoire et palier de chaque heros classe au rang. */
  stats: Record<string, [victoire: number, palier: Palier]>;
  /** Tranches communes a tous les heros. */
  tranches: Tranche[];
  /** Taux de victoire de chaque heros par tranche, dans l'ordre de `tranches`. */
  duree: Record<string, number[]>;
  /** Coequipiers qui font le plus gagner chaque heros. */
  coequipiers: Record<string, Ecart[]>;
  /** Adversaires contre qui chaque heros perd le plus (ecart negatif). */
  faible: Record<string, Ecart[]>;
}

const moyenne = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
const arrondir = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// ── Lanes ──────────────────────────────────────────────────────────

export interface Affectation {
  /** Heros place sur chaque lane pourvue. */
  lanes: Partial<Record<Lane, string>>;
  /** Heros sans lane libre : toutes ses positions sont prises par d'autres. */
  enTrop: string[];
  /** Lanes que personne ne tient. */
  manquantes: Lane[];
}

/**
 * Place chaque heros sur une de ses lanes, une lane par heros. On cherche
 * d'abord a en pourvoir le plus possible, puis a garder chacun au plus pres de
 * sa position principale (la premiere de sa liste). Cinq heros, cinq lanes :
 * l'essai exhaustif reste instantane.
 */
export function affecterLanes(equipe: Pick<HerosEquipe, "slug" | "lanes">[]): Affectation {
  const meilleur = { choix: [] as (Lane | null)[], pourvues: -1, cout: Infinity };
  const choix: (Lane | null)[] = [];
  const prises = new Set<Lane>();

  const essayer = (i: number, pourvues: number, cout: number) => {
    if (i === equipe.length) {
      if (pourvues > meilleur.pourvues || (pourvues === meilleur.pourvues && cout < meilleur.cout)) {
        Object.assign(meilleur, { choix: [...choix], pourvues, cout });
      }
      return;
    }
    equipe[i].lanes.forEach((lane, rang) => {
      if (prises.has(lane)) return;
      prises.add(lane);
      choix.push(lane);
      essayer(i + 1, pourvues + 1, cout + rang);
      prises.delete(lane);
      choix.pop();
    });
    choix.push(null);
    essayer(i + 1, pourvues, cout);
    choix.pop();
  };
  essayer(0, 0, 0);

  const lanes: Partial<Record<Lane, string>> = {};
  const enTrop: string[] = [];
  equipe.forEach((h, i) => {
    const lane = meilleur.choix[i];
    if (lane) lanes[lane] = h.slug;
    else enTrop.push(h.slug);
  });
  return { lanes, enTrop, manquantes: LANES.filter((l) => !lanes[l]) };
}

// ── Roles, degats, notes ───────────────────────────────────────────

/** Nombre de heros par role ; un heros a deux roles compte dans les deux. */
export function compterRoles(equipe: Pick<HerosEquipe, "roles">[]): Record<Role, number> {
  const compte = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const h of equipe) for (const r of h.roles) compte[r] += 1;
  return compte;
}

export interface Degats extends Record<TypeDegats, number> {
  /** Part des degats physiques, un heros mixte comptant pour moitie ; null sans heros renseigne. */
  partPhysique: number | null;
}

export function repartitionDegats(equipe: Pick<HerosEquipe, "degats">[]): Degats {
  const d = { physical: 0, magic: 0, mixed: 0 };
  for (const h of equipe) if (h.degats) d[h.degats] += 1;
  const total = d.physical + d.magic + d.mixed;
  return { ...d, partPhysique: total ? (d.physical + d.mixed / 2) / total : null };
}

export type Note = keyof NotesHeros;
export const NOTES: Note[] = ["offense", "durability", "abilityEffects", "difficulty"];

/** Moyenne de chaque note du jeu (sur 10), sur les heros qui l'ont. */
export function profilNotes(equipe: Pick<HerosEquipe, "notes">[]): Record<Note, number | null> {
  return Object.fromEntries(
    NOTES.map((n) => {
      const valeurs = equipe.flatMap((h) => (h.notes[n] === null ? [] : [h.notes[n]]));
      return [n, valeurs.length ? arrondir(moyenne(valeurs), 1) : null];
    }),
  ) as Record<Note, number | null>;
}

// ── Duree de partie ────────────────────────────────────────────────

export type ProfilDuree = "debut" | "fin" | "stable";

/**
 * Ecart, en points, entre les deux dernieres tranches et les deux premieres
 * au-dela duquel on parle d'une equipe (ou d'un heros) de debut ou de fin de
 * partie. La meme regle sert a la fiche heros.
 */
export const SEUIL_PROFIL = 1;

export function profilDuree(taux: number[]): ProfilDuree {
  if (taux.length < 2) return "stable";
  const ecart = moyenne(taux.slice(-2)) - moyenne(taux.slice(0, 2));
  return ecart > SEUIL_PROFIL ? "fin" : ecart < -SEUIL_PROFIL ? "debut" : "stable";
}

export interface CourbeEquipe {
  tranches: Tranche[];
  /** Moyenne des heros mesures, tranche par tranche. */
  victoire: number[];
  profil: ProfilDuree;
  /** Indice de la meilleure tranche. */
  pic: number;
  /** Profil de chaque heros mesure, pour dire qui porte quelle phase. */
  parHeros: { slug: string; profil: ProfilDuree }[];
}

/** Puissance de l'equipe selon la duree de partie : la moyenne des courbes de ses heros. */
export function courbeEquipe(slugs: string[], mesures: MesuresRang): CourbeEquipe | null {
  const n = mesures.tranches.length;
  const mesures_ = slugs.flatMap((s) => (mesures.duree[s]?.length === n ? [[s, mesures.duree[s]] as const] : []));
  if (n < 2 || mesures_.length === 0) return null;
  const victoire = mesures.tranches.map((_, i) => arrondir(moyenne(mesures_.map(([, d]) => d[i]))));
  return {
    tranches: mesures.tranches,
    victoire,
    profil: profilDuree(victoire),
    pic: victoire.indexOf(Math.max(...victoire)),
    parHeros: mesures_.map(([slug, d]) => ({ slug, profil: profilDuree(d) })),
  };
}

// ── Synergies et menaces ───────────────────────────────────────────

export interface Paire {
  a: string;
  b: string;
  /** Gain mesure au rang, en points ; null pour une synergie connue sans mesure a ce rang. */
  points: number | null;
}

/**
 * Paires de l'equipe qui fonctionnent. Une mesure est dirigee (« A gagne plus
 * avec B ») et ne figure que dans le top de l'un des deux : on lit les deux
 * sens et on garde le meilleur gain. A defaut de mesure, une synergie connue
 * (relation du wiki, coequipier tous rangs) compte, sans chiffre.
 */
export function synergiesInternes(
  equipe: Pick<HerosEquipe, "slug" | "synergies">[],
  mesures: MesuresRang,
): Paire[] {
  const gain = (de: string, avec: string) =>
    (mesures.coequipiers[de] ?? []).find(([s, p]) => s === avec && p > 0)?.[1] ?? null;
  const paires: Paire[] = [];
  equipe.forEach((a, i) => {
    for (const b of equipe.slice(i + 1)) {
      const gains = [gain(a.slug, b.slug), gain(b.slug, a.slug)].filter((g): g is number => g !== null);
      if (gains.length) paires.push({ a: a.slug, b: b.slug, points: Math.max(...gains) });
      else if (a.synergies.includes(b.slug) || b.synergies.includes(a.slug)) {
        paires.push({ a: a.slug, b: b.slug, points: null });
      }
    }
  });
  return paires.sort((x, y) => (y.points ?? -Infinity) - (x.points ?? -Infinity));
}

export interface Menace {
  slug: string;
  /** Heros de l'equipe genes, avec l'ecart qu'ils subissent (negatif). */
  cibles: Ecart[];
  /** Somme des ecarts : plus elle est basse, plus la menace pese. */
  total: number;
}

/** Nombre de heros de l'equipe qu'un adversaire doit gener pour etre une menace. */
export const MIN_CIBLES = 2;

/**
 * Adversaires contre qui plusieurs heros de l'equipe perdent le plus : les
 * candidats au ban. Classes par nombre de victimes, puis par ecart cumule.
 */
export function menaces(slugs: string[], mesures: MesuresRang, limite = 6): Menace[] {
  const parAdversaire = new Map<string, Ecart[]>();
  for (const s of slugs) {
    for (const [adversaire, points] of mesures.faible[s] ?? []) {
      if (points >= 0 || slugs.includes(adversaire)) continue;
      parAdversaire.set(adversaire, [...(parAdversaire.get(adversaire) ?? []), [s, points]]);
    }
  }
  return [...parAdversaire]
    .filter(([, cibles]) => cibles.length >= MIN_CIBLES)
    .map(([slug, cibles]) => ({
      slug,
      cibles: cibles.sort((x, y) => x[1] - y[1]),
      total: arrondir(cibles.reduce((t, [, p]) => t + p, 0), 1),
    }))
    .sort((x, y) => y.cibles.length - x.cibles.length || x.total - y.total)
    .slice(0, limite);
}

// ── Points d'attention ─────────────────────────────────────────────

export type Alerte =
  | { type: "lanes"; lanes: Lane[]; enTrop: string[] }
  | { type: "tank" }
  | { type: "degats"; dominant: "physical" | "magic" }
  | { type: "controle" | "fragile" | "difficile"; valeur: number };

/**
 * Seuils des alertes, sur la moyenne des notes (sur 10). Ils se placent vers
 * le dixieme d'equipes tirees au hasard le plus extreme : une alerte signale
 * un vrai desequilibre, pas une composition simplement moyenne.
 */
export const SEUILS = {
  /** En dessous, l'equipe manque de controle. */
  controle: 3.5,
  /** En dessous, elle encaisse mal. */
  resistance: 4,
  /** A partir de la, elle demande de la maitrise. */
  difficulte: 6,
  /** Part d'un seul type de degats a partir de laquelle l'adversaire s'en protege a peu de frais. */
  degats: 0.8,
};

/** Nombre de heros a partir duquel l'equilibre de l'equipe se juge. */
export const MIN_ALERTES = 3;

export function alertes(equipe: HerosEquipe[], affectation: Affectation): Alerte[] {
  const sortie: Alerte[] = [];
  if (equipe.length === TAILLE_EQUIPE && affectation.manquantes.length) {
    sortie.push({ type: "lanes", lanes: affectation.manquantes, enTrop: affectation.enTrop });
  }
  if (equipe.length < MIN_ALERTES) return sortie;

  if (!equipe.some((h) => h.roles.includes("Tank"))) sortie.push({ type: "tank" });
  const degats = repartitionDegats(equipe);
  const renseignes = degats.physical + degats.magic + degats.mixed;
  if (renseignes >= MIN_ALERTES && degats.partPhysique !== null) {
    if (degats.partPhysique >= SEUILS.degats) sortie.push({ type: "degats", dominant: "physical" });
    else if (degats.partPhysique <= 1 - SEUILS.degats) sortie.push({ type: "degats", dominant: "magic" });
  }
  const notes = profilNotes(equipe);
  if (notes.abilityEffects !== null && notes.abilityEffects < SEUILS.controle) {
    sortie.push({ type: "controle", valeur: notes.abilityEffects });
  }
  if (notes.durability !== null && notes.durability < SEUILS.resistance) {
    sortie.push({ type: "fragile", valeur: notes.durability });
  }
  if (notes.difficulty !== null && notes.difficulty >= SEUILS.difficulte) {
    sortie.push({ type: "difficile", valeur: notes.difficulty });
  }
  return sortie;
}

// ── Suggestions ────────────────────────────────────────────────────

/**
 * Picks proposes pour les lanes libres : la suggestion du draft, sans
 * adversaire, sur les synergies avec l'equipe et le taux de victoire au rang.
 * Les coequipiers mesures au rang s'ajoutent aux synergies connues.
 */
export function suggestionsEquipe({
  catalogue,
  slugs,
  lanes,
  mesures,
  limite = 3,
}: {
  catalogue: HerosEquipe[];
  slugs: string[];
  lanes: Lane[];
  mesures: MesuresRang | null;
  limite?: number;
}): { lane: Lane; picks: Suggestion[] }[] {
  if (lanes.length === 0) return [];
  // Sans adversaire, les relations de contre n'entrent pas dans le calcul.
  const candidats: HerosDraft[] = catalogue.map((h) => ({
    ...h,
    victoire: mesures?.stats[h.slug]?.[0] ?? null,
    fortContre: [],
    faibleContre: [],
    synergies: [...new Set([...h.synergies, ...(mesures?.coequipiers[h.slug] ?? []).map(([s]) => s)])],
  }));
  return lanes.map((lane) => ({ lane, picks: suggerer({ candidats, lane, ennemis: [], allies: slugs, limite }) }));
}

// ── Ensemble ───────────────────────────────────────────────────────

export interface Analyse {
  equipe: HerosEquipe[];
  affectation: Affectation;
  roles: Record<Role, number>;
  degats: Degats;
  notes: Record<Note, number | null>;
  alertes: Alerte[];
  /** Tout ce qui suit depend du rang : null ou vide tant que ses mesures manquent. */
  victoire: number | null;
  courbe: CourbeEquipe | null;
  synergies: Paire[];
  menaces: Menace[];
  suggestions: { lane: Lane; picks: Suggestion[] }[];
}

export function analyserEquipe({
  catalogue,
  slugs,
  mesures,
}: {
  catalogue: HerosEquipe[];
  slugs: string[];
  mesures: MesuresRang | null;
}): Analyse {
  const parSlug = new Map(catalogue.map((h) => [h.slug, h]));
  const equipe = slugs.flatMap((s) => (parSlug.has(s) ? [parSlug.get(s)!] : []));
  const presents = equipe.map((h) => h.slug);
  const affectation = affecterLanes(equipe);
  const taux = mesures ? presents.flatMap((s) => (mesures.stats[s] ? [mesures.stats[s][0]] : [])) : [];

  return {
    equipe,
    affectation,
    roles: compterRoles(equipe),
    degats: repartitionDegats(equipe),
    notes: profilNotes(equipe),
    alertes: alertes(equipe, affectation),
    victoire: taux.length ? arrondir(moyenne(taux), 1) : null,
    courbe: mesures ? courbeEquipe(presents, mesures) : null,
    synergies: mesures ? synergiesInternes(equipe, mesures) : [],
    menaces: mesures ? menaces(presents, mesures) : [],
    suggestions:
      equipe.length < TAILLE_EQUIPE
        ? suggestionsEquipe({ catalogue, slugs: presents, lanes: affectation.manquantes, mesures })
        : [],
  };
}

// ── Adresse partageable ────────────────────────────────────────────

/** Lit `?h=slug1,slug2&rang=mythic`, en ecartant ce que la page ne connait pas. */
export function lireParametres(
  recherche: string,
  connus: Set<string>,
  rangs: readonly RangMesure[],
): { slugs: string[]; rang: RangMesure | null } {
  const params = new URLSearchParams(recherche);
  const slugs = [
    ...new Set(
      (params.get("h") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => connus.has(s)),
    ),
  ].slice(0, TAILLE_EQUIPE);
  return { slugs, rang: rangs.find((r) => r === params.get("rang")) ?? null };
}

/**
 * Parametres de l'adresse pour une equipe et un rang, les autres conserves.
 * Les slugs n'ont ni espace ni caractere reserve : la virgule reste lisible
 * plutot que d'etre encodee en %2C. Tous rangs, le rang par defaut, s'omet.
 */
export function ecrireParametres(recherche: string, slugs: string[], rang: RangMesure): string {
  const params = new URLSearchParams(recherche);
  params.delete("h");
  params.delete("rang");
  if (rang !== "all") params.set("rang", rang);
  return [slugs.length ? `h=${slugs.join(",")}` : "", params.toString()].filter(Boolean).join("&");
}

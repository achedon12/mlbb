import type { ContresParRang } from "./donnees";
import type { TrancheDuree } from "./evolution";
import { profilDuree, type ProfilDuree } from "./composition";
import { LANES } from "./draft";
import { RANGS_MESURE, type RangMesure } from "./rangs-mesure";
import type { Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { Lane, Role } from "./types";

/**
 * Logique de la page « counters » d'un heros : tout ce qui se deduit des
 * donnees, sans rien rediger. Module pur — ni catalogue ni fichier importe —
 * pour etre teste sans charger les donnees du jeu.
 */

/**
 * « d'Aamon », « de Gusion » : complement du nom en francais, elide devant une
 * voyelle. Le « h » et le « y » des noms du jeu se prononcent : pas d'elision.
 */
export function deNom(nom: string): string {
  return /^[aeiouàâäéèêëîïôöùûü]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

// ── Contres, tous rangs confondus ──────────────────────────────────

/** Un adversaire cite dans plusieurs rangs, avec l'ecart moyen du heros face a lui. */
export interface ContreAgrege {
  slug: string;
  /** Nombre de rangs ou il figure parmi les ecarts les plus marques. */
  rangs: number;
  /** Ecart moyen, en points, sur ces rangs (du point de vue du heros de la page). */
  moyenne: number;
}

const arrondi = (v: number) => Math.round(v * 10) / 10;

/**
 * Adversaires les plus marques, rangs confondus. Les tranches de rang sont
 * lues une a une — `all` les agrege deja et compterait double — et `all` ne
 * sert qu'a defaut de tranche. Un adversaire present dans plus de rangs passe
 * devant : c'est un contre regulier, pas l'accident d'une tranche. A egalite,
 * l'ecart moyen le plus marque l'emporte.
 */
export function agregerContres(parRang: ContresParRang, sens: "strong" | "weak"): ContreAgrege[] {
  const tranches = RANGS_MESURE.filter((r) => r !== "all" && parRang[r]);
  const lus = tranches.length > 0 ? tranches : parRang.all ? (["all"] as const) : [];
  const cumul = new Map<string, { rangs: number; somme: number }>();
  for (const rang of lus) {
    for (const e of parRang[rang]?.[sens] ?? []) {
      const c = cumul.get(e.slug) ?? { rangs: 0, somme: 0 };
      cumul.set(e.slug, { rangs: c.rangs + 1, somme: c.somme + e.advantage });
    }
  }
  return [...cumul]
    .map(([slug, c]) => ({ slug, rangs: c.rangs, moyenne: arrondi(c.somme / c.rangs) }))
    .sort(
      (a, b) =>
        b.rangs - a.rangs ||
        (sens === "strong" ? b.moyenne - a.moyenne : a.moyenne - b.moyenne) ||
        a.slug.localeCompare(b.slug),
    );
}

/** Rang de la phrase de synthese : Mythique, rang de reference des joueurs classes, sinon tous rangs. */
export function rangDeSynthese(parRang: ContresParRang): RangMesure | null {
  if (parRang.mythic) return "mythic";
  if (parRang.all) return "all";
  return RANGS_MESURE.find((r) => parRang[r]) ?? null;
}

// ── Phrase de synthese ─────────────────────────────────────────────

/** « +3,3 pts », « −4,3 pts » : ecart signe, une decimale, au format de la langue. */
export function formaterEcart(locale: Langue, t: T, valeur: number): string {
  const n = new Intl.NumberFormat(locale, {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valeur);
  return `${n} ${t("counters.pts")}`;
}

/** « A, B et C », « A, B and C ». */
export function listeNoms(locale: Langue, noms: string[]): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(noms);
}

/** « Gloo (−4,3 pts), Hayabusa et Silvanna » : le premier porte son ecart, les suivants leur nom. */
function tete(locale: Langue, t: T, liste: { nom: string; advantage: number }[]): string {
  const [premier, ...suite] = liste;
  return listeNoms(locale, [`${premier.nom} (${formaterEcart(locale, t, premier.advantage)})`, ...suite.map((e) => e.nom)]);
}

/**
 * Phrase de synthese, faite des seules mesures : « En Mythique, Aamon souffre
 * le plus face a Gloo (−4,3 pts), Hayabusa et Silvanna, et prend l'avantage
 * sur Cici (+3,1 pts) et Marcel. » Trois contres, deux victimes au plus.
 */
export function phraseSynthese(
  locale: Langue,
  t: T,
  o: {
    nom: string;
    rang: RangMesure;
    faible: { nom: string; advantage: number }[];
    fort: { nom: string; advantage: number }[];
  },
): string {
  const contexte =
    o.rang === "all"
      ? t("pages.heroCounters.allRanks")
      : t("pages.heroCounters.atRank", { rang: t(`measuredRanks.${o.rang}`) });
  const faibles = [...o.faible].sort((a, b) => a.advantage - b.advantage).slice(0, 3);
  const forts = [...o.fort].sort((a, b) => b.advantage - a.advantage).slice(0, 2);
  if (faibles.length === 0) return t("pages.heroCounters.noMeasure", { nom: o.nom });
  const variables = { contexte, nom: o.nom, faibles: tete(locale, t, faibles) };
  return forts.length > 0
    ? t("pages.heroCounters.overview", { ...variables, forts: tete(locale, t, forts) })
    : t("pages.heroCounters.overviewNoStrong", variables);
}

// ── Objets conseilles, par regle ───────────────────────────────────

/**
 * Pourquoi un objet est propose. Aucune mesure de victoire derriere : une
 * regle lue sur la fiche du heros (type de degats, role, specialites) et sur
 * son build le plus joue (vol de vie).
 */
export type RaisonObjet = "magic" | "physical" | "attacks" | "healing" | "control";

/**
 * Objets de reference de chaque regle, par slug du catalogue. Les soins ont un
 * objet par famille d'equipement — defense, physique, magie — : chacun prend
 * celui qui entre dans son build.
 */
export const OBJETS_PAR_RAISON: Record<RaisonObjet, string[]> = {
  magic: ["athena-s-shield", "radiant-armor", "tough-boots"],
  physical: ["antique-cuirass", "warrior-boots"],
  attacks: ["blade-armor", "chastise-pauldron"],
  healing: ["dominance-ice", "sea-halberd", "necklace-of-durance"],
  control: ["tough-boots"],
};

export interface ProfilMenace {
  /** Type de degats du wiki (« Magic », « Physical », « Mixed » ; la coquille « Phyiscal » existe). */
  typeDegats: string | null;
  roles: Role[];
  /** Specialites du wiki, en anglais (« Regen », « Crowd Control »). */
  specialites: string[];
  /** Vrai quand son build le plus joue porte du vol de vie ou du vol de sort. */
  volDeVie: boolean;
}

/** Bonus d'objets qui soignent leur porteur a chaque coup. */
export function porteVolDeVie(bonus: (string | null)[]): boolean {
  return bonus.some((b) => !!b && /lifesteal|spell vamp/i.test(b));
}

/** Regles qui s'appliquent au heros, dans l'ordre d'affichage. */
export function raisonsContre(p: ProfilMenace): RaisonObjet[] {
  const degats = (p.typeDegats ?? "").toLowerCase().replace("phyiscal", "physical");
  const raisons: RaisonObjet[] = [];
  if (degats === "magic" || degats === "mixed") raisons.push("magic");
  if (degats === "physical" || degats === "mixed") raisons.push("physical");
  if (p.roles.includes("Marksman")) raisons.push("attacks");
  if (p.specialites.includes("Regen") || p.volDeVie) raisons.push("healing");
  if (p.specialites.some((s) => s === "Crowd Control" || s === "Control")) raisons.push("control");
  return raisons;
}

/**
 * Objets a opposer au heros, sans doublon : un objet cite par deux regles garde
 * la premiere. `existe` ecarte un slug disparu du catalogue apres une synchro.
 */
export function objetsContre(p: ProfilMenace, existe: (slug: string) => boolean): { slug: string; raison: RaisonObjet }[] {
  const vus = new Set<string>();
  return raisonsContre(p).flatMap((raison) =>
    OBJETS_PAR_RAISON[raison].flatMap((slug) => {
      if (vus.has(slug) || !existe(slug)) return [];
      vus.add(slug);
      return [{ slug, raison }];
    }),
  );
}

// ── Duree de partie ────────────────────────────────────────────────

export interface MomentsPartie {
  faible: TrancheDuree;
  fort: TrancheDuree;
  profil: ProfilDuree;
}

/** Tranche de duree ou le heros gagne le moins, et celle ou il gagne le plus. */
export function momentsPartie(tranches: TrancheDuree[] | undefined): MomentsPartie | null {
  if (!tranches || tranches.length < 2) return null;
  const faible = tranches.reduce((m, x) => (x.winRate < m.winRate ? x : m));
  const fort = tranches.reduce((m, x) => (x.winRate > m.winRate ? x : m));
  if (faible === fort) return null;
  return { faible, fort, profil: profilDuree(tranches.map((x) => x.winRate)) };
}

// ── Contres par position ───────────────────────────────────────────

/**
 * Contres regroupes par la position qu'ils jouent : le duel direct sur la lane
 * du heros d'abord, puis les autres positions. Un contre joue a plusieurs
 * positions figure sous chacune.
 */
export function contresParLane(
  contres: ContreAgrege[],
  lanesDe: (slug: string) => Lane[],
  lanesDuHeros: Lane[],
  max = 4,
): { lane: Lane; contres: ContreAgrege[] }[] {
  const ordre = [...lanesDuHeros, ...LANES.filter((l) => !lanesDuHeros.includes(l))];
  return ordre
    .map((lane) => ({ lane, contres: contres.filter((c) => lanesDe(c.slug).includes(lane)).slice(0, max) }))
    .filter((g) => g.contres.length > 0);
}

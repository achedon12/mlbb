import { NIVEAU_MAX, NIVEAU_MIN, type BuildCode } from "./build-code";
import type { RangMesure } from "./rangs-mesure";

/**
 * Simulateur de build : statistiques d'un heros equipe.
 *
 * Module pur, sans donnees importees : la page lui passe le catalogue
 * (heros, objets, emblemes, talents) deja prepare, les tests un catalogue
 * fabrique a la main. Il tourne dans le navigateur a chaque clic.
 *
 * Rien n'est invente. Chaque regle vient d'une page du wiki citee dans
 * `SOURCES`, ou du texte meme de l'objet ; ce que nos donnees ne disent pas
 * reste affiche comme tel :
 *
 * - les statistiques de heros n'existent qu'aux niveaux 1 et 15 : les niveaux
 *   intermediaires sont interpoles lineairement (`interpole`) ;
 * - la regeneration de PV n'est connue qu'au niveau 1 ;
 * - la vitesse d'attaque de base n'est pas dans nos donnees : seul le bonus en
 *   pourcentage se calcule, et le plafond du jeu (3 attaques par seconde)
 *   ne peut pas s'appliquer ;
 * - les passifs conditionnels (sous 50 % de PV, apres une competence…) ne
 *   changent aucune statistique : ils sont listes a part (`nonCalcules`).
 */

export const SOURCES = {
  equipement: "https://mobilelegends.fandom.com/wiki/Equipment",
  recharge: "https://mobilelegends.fandom.com/wiki/Cooldown_reduction",
  critique: "https://mobilelegends.fandom.com/wiki/Critical_strike",
  defensePhysique: "https://mobilelegends.fandom.com/wiki/Physical_defense",
  defenseMagique: "https://mobilelegends.fandom.com/wiki/Magic_defense",
  penetration: "https://mobilelegends.fandom.com/wiki/Physical_penetration",
  adaptatif: "https://mobilelegends.fandom.com/wiki/Adaptive_attributes",
  hybride: "https://mobilelegends.fandom.com/wiki/Hybrid_attributes",
  ressource: "https://mobilelegends.fandom.com/wiki/Resource",
  puissanceMagique: "https://mobilelegends.fandom.com/wiki/Magic_power",
  vitesseDeplacement: "https://mobilelegends.fandom.com/wiki/Movement_speed",
} as const;

/** « Cooldown reduction for ability is normally capped at 40% » (page Cooldown reduction). */
export const PLAFOND_RECHARGE = 40;
/** « A [critical damage] is guaranteed when it is over 100% » (page Critical strike). */
export const PLAFOND_CRITIQUE = 100;
/** « The default crit damage is 200% » (page Critical strike). */
export const DEGATS_CRITIQUES_BASE = 200;
/** Multiplicateur de degats : 120 / (120 + defense) (pages Physical defense et Magic defense). */
export const CONSTANTE_DEFENSE = 120;
/** « the minimum physical and magic defense is now negative 60 » (Patch 1.5.88, page Physical defense). */
export const DEFENSE_MIN = -60;

// ── Lecture des textes d'attributs ─────────────────────────────────

export type Attribut =
  | "pv"
  | "mana"
  | "attaquePhysique"
  | "puissanceMagique"
  | "defensePhysique"
  | "defenseMagique"
  | "defenseHybride"
  | "vitesseAttaque"
  | "chanceCritique"
  | "degatsCritiques"
  | "volDeVie"
  | "volSort"
  | "volHybride"
  | "reductionRecharge"
  | "penPhysique"
  | "penMagique"
  | "penAdaptative"
  | "attaqueAdaptative"
  | "vitesseDeplacement"
  | "regenPv"
  | "regenMana"
  | "regenHybride";

export interface Bonus {
  attribut: Attribut;
  valeur: number;
  /** Valeur en pourcentage (« +10% Magic Penetration ») plutot que fixe (« +10 »). */
  pct: boolean;
}

/**
 * Noms d'attributs du jeu, en minuscules, et la forme qu'ils prennent : un
 * attribut « pct » sans signe %, ou « fixe » avec, n'est pas celui qu'on
 * croit — il part dans `autres` plutot que d'etre mal compte.
 */
const ATTRIBUTS: Record<string, [Attribut, "fixe" | "pct" | "mixte"]> = {
  hp: ["pv", "fixe"],
  mana: ["mana", "fixe"],
  "physical attack": ["attaquePhysique", "fixe"],
  "magic power": ["puissanceMagique", "fixe"],
  "physical defense": ["defensePhysique", "fixe"],
  "magic defense": ["defenseMagique", "fixe"],
  "hybrid defense": ["defenseHybride", "fixe"],
  "attack speed": ["vitesseAttaque", "pct"],
  "crit chance": ["chanceCritique", "pct"],
  "crit damage": ["degatsCritiques", "pct"],
  lifesteal: ["volDeVie", "pct"],
  "spell vamp": ["volSort", "pct"],
  "hybrid lifesteal": ["volHybride", "pct"],
  "cooldown reduction": ["reductionRecharge", "pct"],
  "physical penetration": ["penPhysique", "mixte"],
  "magic penetration": ["penMagique", "mixte"],
  "adaptive penetration": ["penAdaptative", "mixte"],
  "adaptive attack": ["attaqueAdaptative", "fixe"],
  "movement speed": ["vitesseDeplacement", "mixte"],
  "hp regen": ["regenPv", "fixe"],
  "mana regen": ["regenMana", "fixe"],
  "hybrid regen": ["regenHybride", "fixe"],
};

const SEGMENT = /^\+\s*(\d+(?:\.\d+)?)\s*(%?)\s*([A-Za-z][A-Za-z ]*?)\s*$/;

/**
 * Lit un texte d'attributs du wiki (« +920 HP, +40 Physical Defense ») en
 * bonus chiffres. Ce qui ne se reconnait pas — attribut inconnu (« Slow
 * Reduction »), forme inattendue — est rendu tel quel dans `autres` : affiche,
 * jamais compte.
 */
export function lireBonus(texte: string | null | undefined): { bonus: Bonus[]; autres: string[] } {
  const bonus: Bonus[] = [];
  const autres: string[] = [];
  if (!texte || texte.trim().toLowerCase() === "none") return { bonus, autres };
  for (const brut of texte.split(",")) {
    const segment = brut.trim();
    // « +30 Adaptive Attack, » : la virgule finale du wiki laisse un segment vide.
    if (!segment) continue;
    const m = SEGMENT.exec(segment);
    const nom = m?.[3]
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/^(?:(?:extra|max|total) )+/, "");
    const def = nom ? ATTRIBUTS[nom] : undefined;
    const pct = m?.[2] === "%";
    if (!m || !def || (def[1] === "fixe" && pct) || (def[1] === "pct" && !pct)) {
      autres.push(segment);
      continue;
    }
    bonus.push({ attribut: def[0], valeur: Number(m[1]), pct });
  }
  return { bonus, autres };
}

export interface Passif {
  /** Nom du passif (« Armor Buster ») ; vide quand le texte n'en porte pas. */
  nom: string;
  texte: string;
}

/** Passifs d'un objet : le wiki les separe par « @ », chacun sous la forme « Nom: texte ». */
export function lirePassifs(texte: string | null | undefined): Passif[] {
  if (!texte) return [];
  return texte
    .split("@")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^([^:]{1,40}):\s*([\s\S]*)$/.exec(s);
      return m ? { nom: m[1].trim(), texte: m[2].trim() } : { nom: "", texte: s };
    });
}

export type EffetPassif =
  | { type: "bonus"; bonus: Bonus }
  | { type: "plafondRecharge"; valeur: number }
  | { type: "critEnVitesse" };

/**
 * Passifs dont l'effet est permanent et chiffre dans leur propre texte. Les
 * motifs sont ancres sur toute la phrase : un passif qui ajoute une condition
 * (« When attacking an enemy, gains… ») ne s'y reconnait pas et reste non
 * calcule.
 */
export function effetPassif(texte: string): EffetPassif | null {
  // Malefic Gun, Malefic Roar : « Armor Buster: Increase Physical Penetration by 30%. »
  const pen = /^Increases? (Physical|Magic) Penetration by (\d+(?:\.\d+)?)%\.?$/i.exec(texte);
  if (pen) {
    const attribut = pen[1].toLowerCase() === "physical" ? "penPhysique" : "penMagique";
    return { type: "bonus", bonus: { attribut, valeur: Number(pen[2]), pct: true } };
  }
  // Enchanted Talisman : « Magic Mastery: Max Cooldown Reduction is increased by 5%. »
  const plafond = /^Max Cooldown Reduction is increased by (\d+(?:\.\d+)?)%\.?$/i.exec(texte);
  if (plafond) return { type: "plafondRecharge", valeur: Number(plafond[1]) };
  // Golden Staff : « Swift: Every 1% extra Crit Chance gained is converted into 1% extra Attack Speed. »
  if (/^Every 1% extra Crit Chance gained is converted into 1% extra Attack Speed\.?$/i.test(texte)) {
    return { type: "critEnVitesse" };
  }
  return null;
}

// ── Catalogue prepare ──────────────────────────────────────────────

export type Paire = [number, number];
export type Ressource = "mana" | "energie" | "aucune";
export type TypeDegats = "physique" | "magique" | "mixte";

export interface HerosSimu {
  slug: string;
  nom: string;
  typeDegats: TypeDegats;
  ressource: Ressource;
  /** Valeurs aux niveaux 1 et 15 ; null quand le wiki ne les donne pas. */
  pv: Paire | null;
  mana: Paire | null;
  attaquePhysique: Paire | null;
  defensePhysique: Paire | null;
  defenseMagique: Paire | null;
  /** Niveau 1 seulement : nos donnees n'ont pas sa progression. */
  regenPv: number | null;
  vitesseDeplacement: number | null;
}

const nombre = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

const paire = (a: unknown, b: unknown): Paire | null => {
  const x = nombre(a);
  const y = nombre(b);
  return x === null || y === null ? null : [x, y];
};

/** Fiche wiki d'un heros (`heros.json`) vers la forme du simulateur. */
export function preparerHeros(h: {
  slug: string;
  nom: string;
  typeDegats: string | null;
  ressource: string | null;
  stats?: Record<string, string> | null;
}): HerosSimu {
  const s = h.stats ?? {};
  const mana = paire(s.mana1, s.mana15);
  const avecMana = h.ressource === "Mana" || (mana !== null && mana[1] > 0 && h.ressource !== "Energy");
  return {
    slug: h.slug,
    nom: h.nom,
    // « Phyiscal » : une coquille du wiki, lue comme physique.
    typeDegats: /^mag/i.test(h.typeDegats ?? "") ? "magique" : /^mix/i.test(h.typeDegats ?? "") ? "mixte" : "physique",
    ressource: avecMana ? "mana" : h.ressource === "Energy" ? "energie" : "aucune",
    pv: paire(s.hp1, s.hp15),
    mana: avecMana ? mana : null,
    attaquePhysique: paire(s.physical_atk1, s.physical_atk15),
    defensePhysique: paire(s.physical_def1, s.physical_def15),
    defenseMagique: paire(s.magic_def1, s.magic_def15),
    regenPv: nombre(s.hp_regen1),
    vitesseDeplacement: nombre(s.movement_spd),
  };
}

export interface ObjetSimu {
  slug: string;
  nom: string;
  categorie: string;
  prix: number | null;
  bonus: Bonus[];
  /** Attributs uniques : comptes une fois par objet, meme achete deux fois. */
  unique: Bonus[];
  /** Attributs lus mais non calcules (« +35% Slow Reduction »). */
  autres: string[];
  passifs: Passif[];
}

export function preparerObjet(o: {
  slug: string;
  nom: string;
  categorie: string;
  prix: number | null;
  bonus: string | null;
  unique: string | null;
  passif: string | null;
}): ObjetSimu {
  const bonus = lireBonus(o.bonus);
  const unique = lireBonus(o.unique);
  return {
    slug: o.slug,
    nom: o.nom,
    categorie: o.categorie,
    prix: o.prix,
    bonus: bonus.bonus,
    unique: unique.bonus,
    autres: [...bonus.autres, ...unique.autres],
    passifs: lirePassifs(o.passif),
  };
}

export interface EmblemeSimu {
  cle: string;
  bonus: Bonus[];
  autres: string[];
}

export function preparerEmbleme(cle: string, attributs: string): EmblemeSimu {
  return { cle, ...lireBonus(attributs) };
}

export type EffetTalentSimu = { type: "maitreArmes"; pct: number } | { type: "remise"; pct: number };

export interface TalentSimu {
  cle: string;
  etage: 0 | 1 | 2;
  bonus: Bonus[];
  effet: EffetTalentSimu | null;
}

export function preparerTalent(t: { cle: string; etage: 0 | 1 | 2; attributs?: string; effet?: EffetTalentSimu }): TalentSimu {
  return { cle: t.cle, etage: t.etage, bonus: lireBonus(t.attributs).bonus, effet: t.effet ?? null };
}

export interface CatalogueSimu {
  heros: ReadonlyMap<string, HerosSimu>;
  objets: ReadonlyMap<string, ObjetSimu>;
  emblemes: ReadonlyMap<string, EmblemeSimu>;
  talents: ReadonlyMap<string, TalentSimu>;
}

// ── Calcul ─────────────────────────────────────────────────────────

export type CleStat =
  | "pv"
  | "mana"
  | "attaquePhysique"
  | "puissanceMagique"
  | "defensePhysique"
  | "defenseMagique"
  | "vitesseAttaque"
  | "chanceCritique"
  | "degatsCritiques"
  | "volDeVie"
  | "volSort"
  | "reductionRecharge"
  | "penPhysiqueFixe"
  | "penPhysiquePct"
  | "penMagiqueFixe"
  | "penMagiquePct"
  | "vitesseDeplacement"
  | "vitesseDeplacementPct"
  | "regenPv"
  | "regenMana";

export const ORDRE_STATS: readonly CleStat[] = [
  "pv",
  "mana",
  "attaquePhysique",
  "puissanceMagique",
  "defensePhysique",
  "defenseMagique",
  "vitesseAttaque",
  "chanceCritique",
  "degatsCritiques",
  "volDeVie",
  "volSort",
  "reductionRecharge",
  "penPhysiqueFixe",
  "penPhysiquePct",
  "penMagiqueFixe",
  "penMagiquePct",
  "vitesseDeplacement",
  "vitesseDeplacementPct",
  "regenPv",
  "regenMana",
];

export const STATS_PCT: ReadonlySet<CleStat> = new Set<CleStat>([
  "vitesseAttaque",
  "chanceCritique",
  "degatsCritiques",
  "volDeVie",
  "volSort",
  "reductionRecharge",
  "penPhysiquePct",
  "penMagiquePct",
  "vitesseDeplacementPct",
]);

/** Statistiques sans valeur de base dans nos donnees : seul le bonus s'affiche. */
export const STATS_BONUS_SEUL: ReadonlySet<CleStat> = new Set<CleStat>(["vitesseAttaque", "regenMana"]);

export type OrigineSource = "objet" | "passif" | "embleme" | "talent" | "conversion";

export interface Source {
  origine: OrigineSource;
  /** Slug d'objet, cle d'ensemble ou de talent. */
  cle: string;
  valeur: number;
  /** Apport d'un attribut adaptatif, resolu en physique ou en magique. */
  adaptatif?: boolean;
}

export interface StatCalculee {
  cle: CleStat;
  /** Valeur affichee, plafond applique ; null quand la base manque. */
  valeur: number | null;
  /** Valeur avant plafond. */
  brut: number | null;
  plafond: number | null;
  /** Valeur du heros seul au niveau choisi ; null quand nos donnees ne l'ont pas. */
  base: number | null;
  sources: Source[];
}

export type Conflit =
  /** Meme passif sur plusieurs objets (ou un objet achete deux fois) : un seul agit. */
  | { type: "passif"; nom: string; objets: string[] }
  /** Objet achete deux fois : ses attributs uniques ne comptent qu'une fois. */
  | { type: "unique"; objet: string }
  /** Deux paires de bottes : « Unique passives cannot stack, along with boots » (page Equipment). */
  | { type: "bottes"; objets: string[] };

export interface ResultatSimu {
  niveau: number;
  /** Niveau hors 1 et 15 : statistiques de base interpolees. */
  interpole: boolean;
  stats: Record<CleStat, StatCalculee>;
  /** Cout total des objets, en or. */
  or: number;
  /** Cout avec la remise d'un talent (Bargain Hunter), arrondi a l'unite ; null sans elle. */
  orRemise: number | null;
  /** PV necessaires pour tuer le heros avec des degats physiques ou magiques bruts. */
  pvEffectifs: { physique: number | null; magique: number | null };
  /** Ou vont les attributs adaptatifs ; null quand le build n'en a pas. */
  adaptatif: "physique" | "magique" | null;
  conflits: Conflit[];
  /** Passifs presents dont l'effet, conditionnel, n'entre pas dans les statistiques. */
  nonCalcules: { objet: string; passif: string }[];
  /** Attributs lus mais non calcules (soins, reduction de ralentissement…). */
  autres: { origine: "objet" | "embleme"; cle: string; texte: string }[];
  /** Mana ou regeneration de mana d'objets ecartes : le heros n'utilise pas de mana. */
  ressourceIgnoree: boolean;
  /** Golden Staff : le taux de critique est converti en vitesse d'attaque. */
  critEnVitesse: boolean;
}

/** Interpolation lineaire entre les niveaux 1 et 15, les deux seuls que le wiki publie. */
export function valeurAuNiveau(p: Paire, niveau: number): number {
  const n = Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, niveau));
  return p[0] + ((p[1] - p[0]) * (n - NIVEAU_MIN)) / (NIVEAU_MAX - NIVEAU_MIN);
}

/**
 * Part des degats qui traverse une defense, apres penetration :
 * defense totale = defense x (1 - penetration %) - penetration fixe, jamais
 * sous -60 (pages Physical penetration et Physical defense), puis
 * multiplicateur 120 / (120 + defense totale).
 */
export function partDegats(defenseCible: number, penPct: number, penFixe: number): number {
  const totale = Math.max(DEFENSE_MIN, defenseCible * (1 - penPct / 100) - penFixe);
  return CONSTANTE_DEFENSE / (CONSTANTE_DEFENSE + totale);
}

/** PV effectifs : les PV divises par le multiplicateur de degats de la defense. */
export function pvEffectifs(pv: number, defense: number): number {
  return (pv * (CONSTANTE_DEFENSE + Math.max(DEFENSE_MIN, defense))) / CONSTANTE_DEFENSE;
}

interface Apport {
  origine: OrigineSource;
  cle: string;
  bonus: Bonus;
}

/** Statistique touchee par un attribut ; les hybrides touchent les deux. */
function cibles(b: Bonus, versPhysique: boolean): CleStat[] {
  switch (b.attribut) {
    case "defenseHybride":
      return ["defensePhysique", "defenseMagique"];
    case "volHybride":
      return ["volDeVie", "volSort"];
    case "regenHybride":
      return ["regenPv", "regenMana"];
    case "attaqueAdaptative":
      return [versPhysique ? "attaquePhysique" : "puissanceMagique"];
    case "penAdaptative":
      return [versPhysique ? (b.pct ? "penPhysiquePct" : "penPhysiqueFixe") : b.pct ? "penMagiquePct" : "penMagiqueFixe"];
    case "penPhysique":
      return [b.pct ? "penPhysiquePct" : "penPhysiqueFixe"];
    case "penMagique":
      return [b.pct ? "penMagiquePct" : "penMagiqueFixe"];
    case "vitesseDeplacement":
      return [b.pct ? "vitesseDeplacementPct" : "vitesseDeplacement"];
    default:
      return [b.attribut];
  }
}

const somme = (sources: Source[]) => sources.reduce((s, x) => s + x.valeur, 0);

/**
 * Statistiques du build au niveau choisi, ou null sans heros connu.
 *
 * Ordre : attributs des objets (uniques une fois par objet, passifs de meme
 * nom une seule fois), de l'ensemble d'emblemes et des talents ; attributs
 * adaptatifs resolus ; bonus de Weapon Master ; conversion de Golden Staff ;
 * plafonds.
 */
export function calculer(build: BuildCode, cat: CatalogueSimu): ResultatSimu | null {
  const h = build.heros ? cat.heros.get(build.heros) : undefined;
  if (!h) return null;
  const niveau = Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, Math.round(build.niveau)));

  const apports: Apport[] = [];
  const conflits: Conflit[] = [];
  const nonCalcules: ResultatSimu["nonCalcules"] = [];
  const autres: ResultatSimu["autres"] = [];
  let plafondRecharge = PLAFOND_RECHARGE;
  let conversion: string | null = null;

  // ── Objets ──
  const objets = build.objets.flatMap((s) => cat.objets.get(s) ?? []);
  const deja = new Set<string>();
  const passifsVus = new Map<string, string[]>();
  for (const o of objets) {
    for (const bonus of o.bonus) apports.push({ origine: "objet", cle: o.slug, bonus });
    if (!deja.has(o.slug)) {
      for (const bonus of o.unique) apports.push({ origine: "objet", cle: o.slug, bonus });
      for (const texte of o.autres) autres.push({ origine: "objet", cle: o.slug, texte });
    } else if (o.unique.length && !conflits.some((c) => c.type === "unique" && c.objet === o.slug)) {
      conflits.push({ type: "unique", objet: o.slug });
    }
    deja.add(o.slug);

    for (const p of o.passifs) {
      if (!p.nom) continue;
      const porteurs = passifsVus.get(p.nom);
      if (porteurs) {
        porteurs.push(o.slug);
        continue;
      }
      passifsVus.set(p.nom, [o.slug]);
      const effet = effetPassif(p.texte);
      if (!effet) nonCalcules.push({ objet: o.slug, passif: p.nom });
      else if (effet.type === "bonus") apports.push({ origine: "passif", cle: o.slug, bonus: effet.bonus });
      else if (effet.type === "plafondRecharge") plafondRecharge = Math.max(plafondRecharge, PLAFOND_RECHARGE + effet.valeur);
      else conversion = o.slug;
    }
  }
  for (const [nom, porteurs] of passifsVus) {
    if (porteurs.length > 1) conflits.push({ type: "passif", nom, objets: porteurs });
  }
  const bottes = objets.filter((o) => o.categorie === "Movement");
  if (bottes.length > 1) conflits.push({ type: "bottes", objets: bottes.map((o) => o.slug) });

  // ── Emblemes et talents ──
  const embleme = build.embleme ? cat.emblemes.get(build.embleme) : undefined;
  if (embleme) {
    for (const bonus of embleme.bonus) apports.push({ origine: "embleme", cle: embleme.cle, bonus });
    for (const texte of embleme.autres) autres.push({ origine: "embleme", cle: embleme.cle, texte });
  }
  let maitreArmes: { cle: string; pct: number } | null = null;
  let remise = 0;
  for (const cle of build.talents) {
    const talent = cle ? cat.talents.get(cle) : undefined;
    if (!talent) continue;
    for (const bonus of talent.bonus) apports.push({ origine: "talent", cle: talent.cle, bonus });
    if (talent.effet?.type === "maitreArmes") maitreArmes = { cle: talent.cle, pct: talent.effet.pct };
    if (talent.effet?.type === "remise") remise = talent.effet.pct;
  }

  // ── Attributs adaptatifs ──
  // « Increases Physical Attack … if the hero has more extra Physical Attack
  // than extra Magic Power … (Determined by a hero's damage type if the 2
  // attributes are equal) » (page Adaptive attributes). Un heros mixte a
  // egalite est compte physique : le wiki ne dit rien de ce cas.
  const extra = (a: Attribut) => apports.filter((x) => x.bonus.attribut === a).reduce((s, x) => s + x.bonus.valeur, 0);
  const extraPhysique = extra("attaquePhysique");
  const extraMagique = extra("puissanceMagique");
  const versPhysique = extraPhysique === extraMagique ? h.typeDegats !== "magique" : extraPhysique > extraMagique;
  const aAdaptatif = apports.some((x) => x.bonus.attribut === "attaqueAdaptative" || x.bonus.attribut === "penAdaptative");

  const sources = Object.fromEntries(ORDRE_STATS.map((c) => [c, [] as Source[]])) as Record<CleStat, Source[]>;
  let ressourceIgnoree = false;
  for (const a of apports) {
    const adaptatif = a.bonus.attribut === "attaqueAdaptative" || a.bonus.attribut === "penAdaptative";
    for (const cle of cibles(a.bonus, versPhysique)) {
      // « A resource-less hero does not gain any mana and mana regen from any
      // source » ; l'energie, elle, ne s'augmente pas (page Resource).
      if ((cle === "mana" || cle === "regenMana") && h.ressource !== "mana") {
        ressourceIgnoree = true;
        continue;
      }
      sources[cle].push({ origine: a.origine, cle: a.cle, valeur: a.bonus.valeur, ...(adaptatif ? { adaptatif } : {}) });
    }
  }

  // Weapon Master : +8 % de l'attaque physique et de la puissance magique
  // gagnees, pas de la base du heros.
  if (maitreArmes) {
    for (const cle of ["attaquePhysique", "puissanceMagique"] as const) {
      const gagne = somme(sources[cle]);
      if (gagne > 0) sources[cle].push({ origine: "talent", cle: maitreArmes.cle, valeur: (gagne * maitreArmes.pct) / 100 });
    }
  }

  // Golden Staff : tout le taux de critique devient de la vitesse d'attaque.
  if (conversion) {
    const critique = somme(sources.chanceCritique);
    if (critique > 0) {
      sources.vitesseAttaque.push({ origine: "conversion", cle: conversion, valeur: critique });
      sources.chanceCritique.push({ origine: "conversion", cle: conversion, valeur: -critique });
    }
  }

  const auNiveau = (p: Paire | null) => (p ? valeurAuNiveau(p, niveau) : null);
  const bases: Record<CleStat, number | null> = {
    pv: auNiveau(h.pv),
    mana: h.ressource === "mana" ? auNiveau(h.mana) : null,
    attaquePhysique: auNiveau(h.attaquePhysique),
    // « All units have no base and extra magic power » (page Magic power).
    puissanceMagique: 0,
    defensePhysique: auNiveau(h.defensePhysique),
    defenseMagique: auNiveau(h.defenseMagique),
    vitesseAttaque: null,
    // « The default critical chance is 0% » (page Critical strike).
    chanceCritique: 0,
    degatsCritiques: DEGATS_CRITIQUES_BASE,
    volDeVie: 0,
    volSort: 0,
    // « All heroes start with a default 0% cooldown reduction » (page Cooldown reduction).
    reductionRecharge: 0,
    penPhysiqueFixe: 0,
    penPhysiquePct: 0,
    penMagiqueFixe: 0,
    penMagiquePct: 0,
    vitesseDeplacement: h.vitesseDeplacement,
    vitesseDeplacementPct: 0,
    regenPv: h.regenPv,
    regenMana: null,
  };
  const plafonds: Partial<Record<CleStat, number>> = {
    reductionRecharge: plafondRecharge,
    chanceCritique: PLAFOND_CRITIQUE,
  };

  const stats = Object.fromEntries(
    ORDRE_STATS.map((cle) => {
      const base = bases[cle];
      const apport = somme(sources[cle]);
      const brut = base !== null ? base + apport : STATS_BONUS_SEUL.has(cle) ? apport : null;
      const plafond = plafonds[cle] ?? null;
      const valeur = brut === null ? null : plafond === null ? brut : Math.min(brut, plafond);
      return [cle, { cle, valeur, brut, plafond, base, sources: sources[cle] } satisfies StatCalculee];
    }),
  ) as Record<CleStat, StatCalculee>;

  const or = objets.reduce((s, o) => s + (o.prix ?? 0), 0);
  const pv = stats.pv.valeur;
  const dp = stats.defensePhysique.valeur;
  const dm = stats.defenseMagique.valeur;

  return {
    niveau,
    interpole: niveau !== NIVEAU_MIN && niveau !== NIVEAU_MAX,
    stats,
    or,
    orRemise: remise > 0 ? Math.round((or * (100 - remise)) / 100) : null,
    pvEffectifs: {
      physique: pv !== null && dp !== null ? pvEffectifs(pv, dp) : null,
      magique: pv !== null && dm !== null ? pvEffectifs(pv, dm) : null,
    },
    adaptatif: aAdaptatif ? (versPhysique ? "physique" : "magique") : null,
    conflits,
    nonCalcules,
    autres,
    ressourceIgnoree,
    critEnVitesse: conversion !== null,
  };
}

// ── Builds mesures ─────────────────────────────────────────────────

/** Trois objets cles d'un build reellement joue, avec ses taux (en %). */
export interface CoreMesure {
  lane: string;
  rang: RangMesure;
  objets: string[];
  victoire: number | null;
  selection: number | null;
}

export interface CoreProche extends CoreMesure {
  /** Objets du core presents dans le build simule. */
  communs: number;
  /** Tout le core est dans le build. */
  complet: boolean;
}

/**
 * Cores mesures au rang choisi qui recoupent le build : tout le core, ou au
 * moins `minimum` de ses objets. Les plus proches d'abord, puis les plus joues.
 */
export function coresProches(
  cores: readonly CoreMesure[],
  objets: readonly string[],
  rang: RangMesure,
  minimum = 2,
): CoreProche[] {
  const choisis = new Set(objets);
  return cores
    .filter((c) => c.rang === rang)
    .flatMap((c) => {
      const distincts = [...new Set(c.objets)];
      if (distincts.length === 0) return [];
      const communs = distincts.filter((o) => choisis.has(o)).length;
      const complet = communs === distincts.length;
      return complet || communs >= minimum ? [{ ...c, communs, complet }] : [];
    })
    .sort(
      (a, b) =>
        Number(b.complet) - Number(a.complet) ||
        b.communs - a.communs ||
        (b.selection ?? 0) - (a.selection ?? 0),
    );
}

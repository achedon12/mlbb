import type { CountersByRank } from "./data";
import type { BucketDuration } from "./evolution";
import { profileDuration, type ProfileDuration } from "./composition";
import { LANES } from "./draft";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";
import type { Locale } from "@/i18n/config";
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
export function frenchOf(name: string): string {
  return /^[aeiouàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`;
}

// ── Contres, tous rangs confondus ──────────────────────────────────

/** Un adversaire cite dans plusieurs rangs, avec l'ecart moyen du heros face a lui. */
export interface AggregatedCounter {
  slug: string;
  /** Nombre de rangs ou il figure parmi les ecarts les plus marques. */
  ranks: number;
  /** Ecart moyen, en points, sur ces rangs (du point de vue du heros de la page). */
  average: number;
}

const rounded = (v: number) => Math.round(v * 10) / 10;

/**
 * Adversaires les plus marques, rangs confondus. Les tranches de rang sont
 * lues une a une — `all` les agrege deja et compterait double — et `all` ne
 * sert qu'a defaut de tranche. Un adversaire present dans plus de rangs passe
 * devant : c'est un contre regulier, pas l'accident d'une tranche. A egalite,
 * l'ecart moyen le plus marque l'emporte.
 */
export function aggregateCounters(byRank: CountersByRank, direction: "strong" | "weak"): AggregatedCounter[] {
  const buckets = MEASURED_RANKS.filter((r) => r !== "all" && byRank[r]);
  const readValues = buckets.length > 0 ? buckets : byRank.all ? (["all"] as const) : [];
  const total = new Map<string, { ranks: number; sum: number }>();
  for (const rank of readValues) {
    for (const e of byRank[rank]?.[direction] ?? []) {
      const c = total.get(e.slug) ?? { ranks: 0, sum: 0 };
      total.set(e.slug, { ranks: c.ranks + 1, sum: c.sum + e.advantage });
    }
  }
  return [...total]
    .map(([slug, c]) => ({ slug, ranks: c.ranks, average: rounded(c.sum / c.ranks) }))
    .sort(
      (a, b) =>
        b.ranks - a.ranks ||
        (direction === "strong" ? b.average - a.average : a.average - b.average) ||
        a.slug.localeCompare(b.slug),
    );
}

/** Rang de la phrase de synthese : Mythique, rang de reference des joueurs classes, sinon tous rangs. */
export function summaryRank(byRank: CountersByRank): MeasuredRank | null {
  if (byRank.mythic) return "mythic";
  if (byRank.all) return "all";
  return MEASURED_RANKS.find((r) => byRank[r]) ?? null;
}

// ── Phrase de synthese ─────────────────────────────────────────────

/** « +3,3 pts », « −4,3 pts » : ecart signe, une decimale, au format de la langue. */
export function formatGap(locale: Locale, t: T, value: number): string {
  const n = new Intl.NumberFormat(locale, {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${n} ${t("counters.pts")}`;
}

/** « A, B et C », « A, B and C ». */
export function listNames(locale: Locale, names: string[]): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
}

/** « Gloo (−4,3 pts), Hayabusa et Silvanna » : le premier porte son ecart, les suivants leur nom. */
function head(locale: Locale, t: T, list: { name: string; advantage: number }[]): string {
  const [first, ...run] = list;
  return listNames(locale, [`${first.name} (${formatGap(locale, t, first.advantage)})`, ...run.map((e) => e.name)]);
}

/**
 * Phrase de synthese, faite des seules mesures : « En Mythique, Aamon souffre
 * le plus face a Gloo (−4,3 pts), Hayabusa et Silvanna, et prend l'avantage
 * sur Cici (+3,1 pts) et Marcel. » Trois contres, deux victimes au plus.
 */
export function summarySentence(
  locale: Locale,
  t: T,
  o: {
    name: string;
    rank: MeasuredRank;
    weak: { name: string; advantage: number }[];
    strong: { name: string; advantage: number }[];
  },
): string {
  const context =
    o.rank === "all"
      ? t("pages.heroCounters.allRanks")
      : t("pages.heroCounters.atRank", { rang: t(`measuredRanks.${o.rank}`) });
  const weak = [...o.weak].sort((a, b) => a.advantage - b.advantage).slice(0, 3);
  const strong = [...o.strong].sort((a, b) => b.advantage - a.advantage).slice(0, 2);
  if (weak.length === 0) return t("pages.heroCounters.noMeasure", { nom: o.name });
  const variables = { contexte: context, nom: o.name, faibles: head(locale, t, weak) };
  return strong.length > 0
    ? t("pages.heroCounters.overview", { ...variables, forts: head(locale, t, strong) })
    : t("pages.heroCounters.overviewNoStrong", variables);
}

// ── Objets conseilles, par regle ───────────────────────────────────

/**
 * Pourquoi un objet est propose. Aucune mesure de victoire derriere : une
 * regle lue sur la fiche du heros (type de degats, role, specialites) et sur
 * son build le plus joue (vol de vie).
 */
export type ReasonItem = "magic" | "physical" | "attacks" | "healing" | "control";

/**
 * Objets de reference de chaque regle, par slug du catalogue. Les soins ont un
 * objet par famille d'equipement — defense, physique, magie — : chacun prend
 * celui qui entre dans son build.
 */
export const ITEMS_BY_REASON: Record<ReasonItem, string[]> = {
  magic: ["athena-s-shield", "radiant-armor", "tough-boots"],
  physical: ["antique-cuirass", "warrior-boots"],
  attacks: ["blade-armor", "chastise-pauldron"],
  healing: ["dominance-ice", "sea-halberd", "necklace-of-durance"],
  control: ["tough-boots"],
};

export interface ProfileThreat {
  /** Type de degats du wiki (« Magic », « Physical », « Mixed » ; la coquille « Phyiscal » existe). */
  typeDamage: string | null;
  roles: Role[];
  /** Specialites du wiki, en anglais (« Regen », « Crowd Control »). */
  specialties: string[];
  /** Vrai quand son build le plus joue porte du vol de vie ou du vol de sort. */
  lifesteal: boolean;
}

/** Bonus d'objets qui soignent leur porteur a chaque coup. */
export function hasLifesteal(bonus: (string | null)[]): boolean {
  return bonus.some((b) => !!b && /lifesteal|spell vamp/i.test(b));
}

/** Regles qui s'appliquent au heros, dans l'ordre d'affichage. */
export function reasonsCounter(p: ProfileThreat): ReasonItem[] {
  const damage = (p.typeDamage ?? "").toLowerCase().replace("phyiscal", "physical");
  const reasons: ReasonItem[] = [];
  if (damage === "magic" || damage === "mixed") reasons.push("magic");
  if (damage === "physical" || damage === "mixed") reasons.push("physical");
  if (p.roles.includes("Marksman")) reasons.push("attacks");
  if (p.specialties.includes("Regen") || p.lifesteal) reasons.push("healing");
  if (p.specialties.some((s) => s === "Crowd Control" || s === "Control")) reasons.push("control");
  return reasons;
}

/**
 * Objets a opposer au heros, sans doublon : un objet cite par deux regles garde
 * la premiere. `existe` ecarte un slug disparu du catalogue apres une synchro.
 */
export function itemsCounter(p: ProfileThreat, exists: (slug: string) => boolean): { slug: string; reason: ReasonItem }[] {
  const seen = new Set<string>();
  return reasonsCounter(p).flatMap((reason) =>
    ITEMS_BY_REASON[reason].flatMap((slug) => {
      if (seen.has(slug) || !exists(slug)) return [];
      seen.add(slug);
      return [{ slug, reason }];
    }),
  );
}

// ── Duree de partie ────────────────────────────────────────────────

export interface MomentsMatch {
  weak: BucketDuration;
  strong: BucketDuration;
  profile: ProfileDuration;
}

/** Tranche de duree ou le heros gagne le moins, et celle ou il gagne le plus. */
export function momentsMatch(buckets: BucketDuration[] | undefined): MomentsMatch | null {
  if (!buckets || buckets.length < 2) return null;
  const weak = buckets.reduce((m, x) => (x.winRate < m.winRate ? x : m));
  const strong = buckets.reduce((m, x) => (x.winRate > m.winRate ? x : m));
  if (weak === strong) return null;
  return { weak, strong, profile: profileDuration(buckets.map((x) => x.winRate)) };
}

// ── Contres par position ───────────────────────────────────────────

/**
 * Contres regroupes par la position qu'ils jouent : le duel direct sur la lane
 * du heros d'abord, puis les autres positions. Un contre joue a plusieurs
 * positions figure sous chacune.
 */
export function countersByLane(
  counters: AggregatedCounter[],
  lanesOf: (slug: string) => Lane[],
  heroLanes: Lane[],
  max = 4,
): { lane: Lane; counters: AggregatedCounter[] }[] {
  const order = [...heroLanes, ...LANES.filter((l) => !heroLanes.includes(l))];
  return order
    .map((lane) => ({ lane, counters: counters.filter((c) => lanesOf(c.slug).includes(lane)).slice(0, max) }))
    .filter((g) => g.counters.length > 0);
}

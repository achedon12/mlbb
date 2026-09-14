import type { Role } from "./types";
import type { Lane } from "./types";

/**
 * Suggestion de picks.
 *
 * Le principe : un heros vaut d'etre pris s'il gene ceux d'en face, s'il ne
 * leur est pas vulnerable, s'il se combine avec ce que son equipe a deja
 * choisi, et s'il tient la route dans l'absolu. Ces quatre signaux n'ont pas
 * le meme poids — contrer un adversaire precis compte plus qu'un demi-point de
 * taux de victoire.
 */

export const LANES: Lane[] = ["Gold", "Jungle", "Mid", "Exp", "Roam"];

/** Lane tokens used before the English ones, still present in shared addresses (`?lane=Or`). */
export const LEGACY_LANES: Record<string, Lane> = { Or: "Gold", Experience: "Exp", Milieu: "Mid" };
/** The lane an address parameter designates, current or former token, or null. */
export const laneFromParam = (value: string | null): Lane | null =>
  value === null ? null : (LANES.find((l) => l === value) ?? LEGACY_LANES[value] ?? null);
export const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];

/** Ce dont l'outil a besoin pour chaque heros ; le reste alourdirait la page. */
export interface DraftHero {
  slug: string;
  name: string;
  lanes: Lane[];
  roles: Role[];
  icon: string | null;
  win: number | null;
  strongAgainst: string[];
  weakAgainst: string[];
  synergies: string[];
}

export interface Reason {
  /** Nature de l'argument ; la phrase se compose dans la langue de la page. */
  type: "counter" | "countered" | "synergy" | "win";
  /** Heros en cause, ou taux de victoire. */
  detail: string;
  /** Positif quand l'argument joue en faveur du heros. */
  favorable: boolean;
}

export interface Suggestion {
  hero: DraftHero;
  score: number;
  reasons: Reason[];
}

/**
 * Poids des signaux.
 *
 * Contrer un adversaire vaut trois points ; en subir un en coute autant. La
 * synergie compte moitie moins : elle aide, mais ne decide pas d'un duel de
 * lane. Le taux de victoire n'intervient qu'en depart d'egalite — d'ou son
 * echelle volontairement reduite.
 */
const WEIGHT = {
  counter: 3,
  counteredBy: -3,
  synergy: 1.5,
  /** Ecart au taux d'equilibre (50 %), divise pour rester un simple arbitre. */
  win: 0.4,
};

export function suggest({
  candidates,
  lane,
  enemies,
  allies,
  limit = 3,
}: {
  candidates: DraftHero[];
  lane: Lane;
  /** Slugs adverses, toutes lanes confondues. */
  enemies: string[];
  /** Slugs deja choisis par l'equipe. */
  allies: string[];
  limit?: number;
}): Suggestion[] {
  const taken = new Set([...enemies, ...allies]);

  return candidates
    .filter((h) => h.lanes.includes(lane) && !taken.has(h.slug))
    .map((h) => {
      const reasons: Reason[] = [];
      let score = 0;

      // Une relation de contre est declaree d'un seul cote : « A est fort
      // contre B » n'implique pas que la fiche de B mentionne A. On lit donc
      // les deux sens, sans quoi la moitie des contres resterait invisible.
      const byEnemy = new Map(
        candidates.filter((c) => enemies.includes(c.slug)).map((c) => [c.slug, c]),
      );

      const counters = enemies.filter(
        (e) => h.strongAgainst.includes(e) || byEnemy.get(e)?.weakAgainst.includes(h.slug),
      );
      if (counters.length > 0) {
        score += counters.length * WEIGHT.counter;
        const names = counters.map((e) => byEnemy.get(e)?.name ?? e).join(", ");
        reasons.push({ type: "counter", detail: names, favorable: true });
      }

      const suffered = enemies.filter(
        (e) => h.weakAgainst.includes(e) || byEnemy.get(e)?.strongAgainst.includes(h.slug),
      );
      if (suffered.length > 0) {
        score += suffered.length * WEIGHT.counteredBy;
        const names = suffered.map((e) => byEnemy.get(e)?.name ?? e).join(", ");
        reasons.push({ type: "countered", detail: names, favorable: false });
      }

      const byAlly = new Map(
        candidates.filter((c) => allies.includes(c.slug)).map((c) => [c.slug, c]),
      );
      const combine = allies.filter(
        (a) => h.synergies.includes(a) || byAlly.get(a)?.synergies.includes(h.slug),
      );
      if (combine.length > 0) {
        score += combine.length * WEIGHT.synergy;
        const names = combine.map((a) => byAlly.get(a)?.name ?? a).join(", ");
        reasons.push({ type: "synergy", detail: names, favorable: true });
      }

      if (h.win !== null) {
        score += (h.win - 50) * WEIGHT.win;
        if (h.win >= 53) {
          reasons.push({ type: "win", detail: h.win.toFixed(1), favorable: true });
        } else if (h.win <= 47) {
          reasons.push({ type: "win", detail: h.win.toFixed(1), favorable: false });
        }
      }

      return { hero: h, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

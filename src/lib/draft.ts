import type { Role } from "./types";
import type { Lane } from "./types";

/**
 * Pick suggestions.
 *
 * The idea: a hero is worth picking if it hinders the opponents, is not
 * vulnerable to them, combines with what its team has already picked, and
 * holds up on its own. These four signals do not weigh the same — countering
 * a specific opponent counts more than half a point of win rate.
 */

export const LANES: Lane[] = ["Gold", "Jungle", "Mid", "Exp", "Roam"];

/** Lane tokens used before the English ones, still present in shared addresses (`?lane=Or`). */
export const LEGACY_LANES: Record<string, Lane> = { Or: "Gold", Experience: "Exp", Milieu: "Mid" };
/** The lane an address parameter designates, current or former token, or null. */
export const laneFromParam = (value: string | null): Lane | null =>
  value === null ? null : (LANES.find((l) => l === value) ?? LEGACY_LANES[value] ?? null);
export const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];

/** What the tool needs for each hero; anything more would weigh the page down. */
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
  /** Kind of argument; the sentence is built in the page's language. */
  type: "counter" | "countered" | "synergy" | "win";
  /** Heroes involved, or win rate. */
  detail: string;
  /** True when the argument works in the hero's favour. */
  favorable: boolean;
}

export interface Suggestion {
  hero: DraftHero;
  score: number;
  reasons: Reason[];
}

/**
 * Signal weights.
 *
 * Countering an opponent is worth three points; being countered costs as
 * much. Synergy counts half as much: it helps, but does not decide a lane
 * duel. Win rate only breaks ties — hence its deliberately small scale.
 */
const WEIGHT = {
  counter: 3,
  counteredBy: -3,
  synergy: 1.5,
  /** Gap from the break-even rate (50 %), scaled down to stay a mere tie-breaker. */
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
  /** Enemy slugs, all lanes combined. */
  enemies: string[];
  /** Slugs already picked by the team. */
  allies: string[];
  limit?: number;
}): Suggestion[] {
  const taken = new Set([...enemies, ...allies]);

  return candidates
    .filter((h) => h.lanes.includes(lane) && !taken.has(h.slug))
    .map((h) => {
      const reasons: Reason[] = [];
      let score = 0;

      // A counter relation is declared on one side only: "A is strong
      // against B" does not imply that B's page mentions A. Both directions
      // are read, otherwise half the counters would stay invisible.
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

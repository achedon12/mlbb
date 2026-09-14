import { keyValue } from "@/i18n/hero-data";
import { draftHeroes } from "./draft-catalog";
import type { Gap, TeamHero, MeasuresRank, Bucket, TypeDamage } from "./composition";
import { teammates, counters, allHeroes, heroesBySlug } from "./data";
import { durationOf } from "./evolution";
import type { MeasuredRank } from "./measured-ranks";
import { rankingOfRank } from "./tier-list";

/**
 * Team analysis data, prepared server-side: the catalogue, which ships with
 * the page, and the measurements of one rank, served separately
 * (`/composition/<rank>.json`).
 */

const TYPES_DAMAGE: TypeDamage[] = ["physical", "magic", "mixed"];

/** Wiki damage type mapped to its key; typos included ("Phyiscal"). */
function damageOf(value: string | null): TypeDamage | null {
  const key = value ? keyValue(value) : null;
  return TYPES_DAMAGE.find((t) => t === key) ?? null;
}

/** The roster, reduced to what the analysis reads. Rates and counter relations depend on the rank: they are not included. */
export function catalogTeam(): TeamHero[] {
  return draftHeroes().map((h) => {
    const sheet = heroesBySlug.get(h.slug);
    return {
      slug: h.slug,
      name: h.name,
      lanes: h.lanes,
      roles: h.roles,
      icon: h.icon,
      synergies: h.synergies,
      damage: damageOf(sheet?.damageType ?? null),
      notes: sheet?.ratings ?? { offense: null, durability: null, abilityEffects: null, difficulty: null },
    };
  });
}

const gaps = (list: { slug: string; advantage: number }[] | undefined): Gap[] =>
  (list ?? []).map((e) => [e.slug, e.advantage]);

export function measuresRank(rank: MeasuredRank): MeasuresRank {
  const stats: MeasuresRank["stats"] = Object.fromEntries(
    rankingOfRank(rank).map((e) => [e.hero.slug, [e.winRate, e.tier]]),
  );

  // Duration buckets are the same for all heroes: they are written once.
  // A hero bucketed differently (older file) is left out rather than
  // skewing the average.
  let buckets: Bucket[] = [];
  const duration: MeasuresRank["duration"] = {};
  for (const h of allHeroes) {
    const list = durationOf(h.slug)[rank];
    if (!list?.length) continue;
    if (buckets.length === 0) buckets = list.map(({ from, to }) => ({ from, to }));
    if (list.length === buckets.length && list.every((x, i) => x.from === buckets[i].from)) {
      duration[h.slug] = list.map((x) => x.winRate);
    }
  }

  const byHero = (read: (slug: string) => Gap[]) =>
    Object.fromEntries(allHeroes.flatMap((h) => (read(h.slug).length ? [[h.slug, read(h.slug)]] : [])));

  return {
    rank: rank,
    stats,
    buckets: buckets,
    duration: duration,
    teammates: byHero((s) => gaps(teammates[s]?.[rank])),
    weak: byHero((s) => gaps(counters[s]?.[rank]?.weak)),
  };
}

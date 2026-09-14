import { keyValue } from "@/i18n/hero-data";
import { draftHeroes } from "./draft-catalog";
import type { Gap, TeamHero, MeasuresRank, Bucket, TypeDamage } from "./composition";
import { teammates, counters, allHeroes, heroesBySlug } from "./data";
import { durationOf } from "./evolution";
import type { MeasuredRank } from "./measured-ranks";
import { rankingOfRank } from "./tier-list";

/**
 * Donnees de l'analyse d'equipe, preparees cote serveur : le catalogue, qui
 * part avec la page, et les mesures d'un rang, servies a part
 * (`/composition/<rang>.json`).
 */

const TYPES_DAMAGE: TypeDamage[] = ["physical", "magic", "mixed"];

/** Type de degats du wiki ramene a sa cle ; coquilles comprises (« Phyiscal »). */
function damageOf(value: string | null): TypeDamage | null {
  const key = value ? keyValue(value) : null;
  return TYPES_DAMAGE.find((t) => t === key) ?? null;
}

/** Le roster, reduit a ce que l'analyse lit. Taux et relations de contre dependent du rang : ils n'y sont pas. */
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

  // Les tranches de duree sont les memes pour tous les heros : on les ecrit
  // une fois. Un heros decoupe autrement (fichier plus ancien) est ecarte
  // plutot que de fausser la moyenne.
  let buckets: Bucket[] = [];
  const duration: MeasuresRank["duree"] = {};
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
    rang: rank,
    stats,
    tranches: buckets,
    duree: duration,
    coequipiers: byHero((s) => gaps(teammates[s]?.[rank])),
    faible: byHero((s) => gaps(counters[s]?.[rank]?.weak)),
  };
}

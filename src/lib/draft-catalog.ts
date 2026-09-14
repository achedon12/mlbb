import statistics from "@/data/game/statistics.json";
import { teammates, allHeroes } from "./data";
import type { DraftHero } from "./draft";
import { rankingFull } from "./tier-list";

/**
 * Fiche reduite de chaque heros, pour l'aide au draft et l'analyse d'equipe.
 * Lue cote serveur seulement : elle tire les relations du wiki et le
 * classement, que le navigateur n'a pas a charger.
 */
interface Relation {
  strongAgainst: string[];
  weakAgainst: string[];
  synergies: string[];
}

const relations = statistics.relations as unknown as Record<string, Relation>;

/**
 * On n'envoie au client que ce dont les outils se servent : la fiche complete
 * d'un heros porte des competences et des skins qui n'entrent pas dans le
 * calcul et pesent lourd multiplies par 133.
 */
export function draftHeroes(): DraftHero[] {
  const rate = new Map(rankingFull.map((e) => [e.hero.slug, e.winRate]));
  return allHeroes.map((h) => ({
    slug: h.slug,
    name: h.name,
    lanes: h.lanes,
    roles: h.roles,
    icon: h.images.icon ?? h.images.portrait,
    win: rate.get(h.slug) ?? null,
    strongAgainst: relations[h.slug]?.strongAgainst ?? [],
    weakAgainst: relations[h.slug]?.weakAgainst ?? [],
    // Synergies ecrites par le wiki, completees des coequipiers qui font le
    // plus gagner le heros en partie classee.
    synergies: [
      ...new Set([...(relations[h.slug]?.synergies ?? []), ...(teammates[h.slug]?.all ?? []).map((c) => c.slug)]),
    ],
  }));
}

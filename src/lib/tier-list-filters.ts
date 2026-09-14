import { LANES, ROLES } from "./draft";
import type { Lane, Role } from "./types";

/**
 * Tier lists par lane et par role, et pages de role du catalogue.
 *
 * Les adresses sont en anglais, comme le reste du site et comme les recherches
 * des joueurs (« jungle tier list », « best marksman mlbb ») ; les valeurs
 * internes, elles, restent celles des donnees (`Or`, `Milieu`…). Module sans
 * donnees : les tests et les composants client l'importent sans rien embarquer.
 */
export const SLUGS_LANE: Record<Lane, string> = {
  Gold: "gold",
  Exp: "exp",
  Mid: "mid",
  Jungle: "jungle",
  Roam: "roam",
};

export const SLUGS_ROLE: Record<Role, string> = {
  Tank: "tank",
  Fighter: "fighter",
  Assassin: "assassin",
  Mage: "mage",
  Marksman: "marksman",
  Support: "support",
};

/** Lane designee par son adresse, ou null. */
export const laneOfSlug = (slug: string): Lane | null => LANES.find((l) => SLUGS_LANE[l] === slug) ?? null;

/** Role designe par son adresse, ou null. */
export const roleOfSlug = (slug: string): Role | null => ROLES.find((r) => SLUGS_ROLE[r] === slug) ?? null;

export type FilterTier = { type: "lane"; value: Lane } | { type: "role"; value: Role };

/** Adresse de la tier list d'une lane ou d'un role, sans langue. */
export function pathFilter(f: FilterTier): string {
  return f.type === "lane" ? `/tier-list/lane/${SLUGS_LANE[f.value]}` : `/tier-list/role/${SLUGS_ROLE[f.value]}`;
}

/** Page d'un role dans le catalogue des heros. */
export const pathRole = (role: Role) => `/heroes/role/${SLUGS_ROLE[role]}`;

/** Filtres de toutes les lanes, puis de tous les roles, dans l'ordre du jeu. */
export const FILTERS_LANE: FilterTier[] = LANES.map((value) => ({ type: "lane", value }));
export const FILTERS_ROLE: FilterTier[] = ROLES.map((value) => ({ type: "role", value }));

/**
 * Emplacement habituel de l'icone d'un heros (`npm run sync -- --images`). Les
 * lignes de la tier list ne transmettent l'icone que lorsqu'elle est ailleurs :
 * inutile de repeter 132 fois le meme chemin dans la page.
 */
export const usualIcon = (slug: string) => `/visuels/heros/${slug}/icone.png`;

/** Vrai quand le heros joue la lane, ou tient le role (principal ou secondaire). */
export function matches(h: { lanes: Lane[]; roles: Role[] }, f: FilterTier | null): boolean {
  if (!f) return true;
  return f.type === "lane" ? h.lanes.includes(f.value) : h.roles.includes(f.value);
}

/** Entrees d'un classement retenues par le filtre, dans leur ordre. */
export function filterRanking<E extends { hero: { lanes: Lane[]; roles: Role[] } }>(
  entries: E[],
  f: FilterTier | null,
): E[] {
  return f ? entries.filter((e) => matches(e.hero, f)) : entries;
}

import { LANES, ROLES } from "./draft";
import type { Lane, Role } from "./types";

/**
 * Tier lists by lane and by role, and role pages of the catalogue.
 *
 * Addresses are in English, like the rest of the site and like players'
 * searches ("jungle tier list", "best marksman mlbb"); internal values
 * stay those of the data (`Gold`, `Mid`…). Module without
 * data: tests and client components import it without bundling anything.
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

/** Lane designated by its address, or null. */
export const laneOfSlug = (slug: string): Lane | null => LANES.find((l) => SLUGS_LANE[l] === slug) ?? null;

/** Role designated by its address, or null. */
export const roleOfSlug = (slug: string): Role | null => ROLES.find((r) => SLUGS_ROLE[r] === slug) ?? null;

export type FilterTier = { type: "lane"; value: Lane } | { type: "role"; value: Role };

/** Address of a lane's or role's tier list, without locale. */
export function pathFilter(f: FilterTier): string {
  return f.type === "lane" ? `/tier-list/lane/${SLUGS_LANE[f.value]}` : `/tier-list/role/${SLUGS_ROLE[f.value]}`;
}

/** Page of a role in the hero catalogue. */
export const pathRole = (role: Role) => `/heroes/role/${SLUGS_ROLE[role]}`;

/** Filters for every lane, then every role, in game order. */
export const FILTERS_LANE: FilterTier[] = LANES.map((value) => ({ type: "lane", value }));
export const FILTERS_ROLE: FilterTier[] = ROLES.map((value) => ({ type: "role", value }));

/**
 * Usual location of a hero's icon (`npm run sync -- --images`). Tier list
 * rows only send the icon when it is elsewhere:
 * no need to repeat the same path 132 times in the page.
 */
export const usualIcon = (slug: string) => `/visuels/heros/${slug}/icone.webp`;

/** True when the hero plays the lane, or holds the role (main or secondary). */
export function matches(h: { lanes: Lane[]; roles: Role[] }, f: FilterTier | null): boolean {
  if (!f) return true;
  return f.type === "lane" ? h.lanes.includes(f.value) : h.roles.includes(f.value);
}

/** Entries of a ranking kept by the filter, in their order. */
export function filterRanking<E extends { hero: { lanes: Lane[]; roles: Role[] } }>(
  entries: E[],
  f: FilterTier | null,
): E[] {
  return f ? entries.filter((e) => matches(e.hero, f)) : entries;
}

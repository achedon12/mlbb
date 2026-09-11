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
  Or: "gold",
  Experience: "exp",
  Milieu: "mid",
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
export const laneDuSlug = (slug: string): Lane | null => LANES.find((l) => SLUGS_LANE[l] === slug) ?? null;

/** Role designe par son adresse, ou null. */
export const roleDuSlug = (slug: string): Role | null => ROLES.find((r) => SLUGS_ROLE[r] === slug) ?? null;

export type FiltreTier = { type: "lane"; valeur: Lane } | { type: "role"; valeur: Role };

/** Adresse de la tier list d'une lane ou d'un role, sans langue. */
export function cheminFiltre(f: FiltreTier): string {
  return f.type === "lane" ? `/tier-list/lane/${SLUGS_LANE[f.valeur]}` : `/tier-list/role/${SLUGS_ROLE[f.valeur]}`;
}

/** Page d'un role dans le catalogue des heros. */
export const cheminRole = (role: Role) => `/heroes/role/${SLUGS_ROLE[role]}`;

/** Filtres de toutes les lanes, puis de tous les roles, dans l'ordre du jeu. */
export const FILTRES_LANE: FiltreTier[] = LANES.map((valeur) => ({ type: "lane", valeur }));
export const FILTRES_ROLE: FiltreTier[] = ROLES.map((valeur) => ({ type: "role", valeur }));

/**
 * Emplacement habituel de l'icone d'un heros (`npm run sync -- --images`). Les
 * lignes de la tier list ne transmettent l'icone que lorsqu'elle est ailleurs :
 * inutile de repeter 132 fois le meme chemin dans la page.
 */
export const iconeHabituelle = (slug: string) => `/visuels/heros/${slug}/icone.png`;

/** Vrai quand le heros joue la lane, ou tient le role (principal ou secondaire). */
export function correspond(h: { lanes: Lane[]; roles: Role[] }, f: FiltreTier | null): boolean {
  if (!f) return true;
  return f.type === "lane" ? h.lanes.includes(f.valeur) : h.roles.includes(f.valeur);
}

/** Entrees d'un classement retenues par le filtre, dans leur ordre. */
export function filtrerClassement<E extends { heros: { lanes: Lane[]; roles: Role[] } }>(
  entrees: E[],
  f: FiltreTier | null,
): E[] {
  return f ? entrees.filter((e) => correspond(e.heros, f)) : entrees;
}

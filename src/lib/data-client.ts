import names from "@/data/game/names.json";

/**
 * Name-by-slug table usable on the client.
 *
 * Client components need a hero's name without shipping the whole catalogue —
 * skills, skins and builds have no place in a browser bundle. This table is
 * only `{ slug: name }`.
 */
export const heroesBySlug = names as Record<string, string>;

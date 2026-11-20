import { heroArt } from "@/components/hero-art";
import type { RegionLore } from "@/lib/lore";
import type { Hero } from "@/lib/types";

/**
 * The faces of a region: its heroes that have an artwork, the most dressed
 * first (the number of skins is a fair stand-in for how iconic a hero is),
 * then by name. The region tile shows the first; its poster, the first few.
 */
export function regionFaces(region: RegionLore): { hero: Hero; art: string }[] {
  return region.heroes
    .map((hero) => ({ hero, art: heroArt(hero.slug) }))
    .filter((x): x is { hero: Hero; art: string } => !!x.art)
    .sort((a, b) => b.hero.skins.length - a.hero.skins.length || a.hero.name.localeCompare(b.hero.name, "en"));
}

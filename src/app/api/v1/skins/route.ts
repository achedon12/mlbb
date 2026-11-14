import { absoluteImage, responseApi } from "@/lib/api";
import { heroesBySlug } from "@/lib/data";
import { heroGallery } from "@/lib/hero-skins";
import { newest, rarityOfRank } from "@/lib/skin-catalog";
import { releasedSkins } from "@/lib/skin-catalog-server";

/**
 * Newest released skins, most recent first: the release calendar's order
 * (original skins and announced ones left out, dated at least to the month).
 * `?limit=` caps the list (20 by default, 100 at most).
 */
// Reads `?limit=`: a static response would ignore it.
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** The full artwork reads better large than the shop portrait; the portrait otherwise. */
function artwork(hero: string, id: string, fallback: string | null): string | null {
  const h = heroesBySlug.get(hero);
  const skin = h ? heroGallery(h).skins.find((s) => s.id === id) : undefined;
  return skin?.illustration ?? fallback;
}

export function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, MAX_LIMIT) : DEFAULT_LIMIT;
  const results = newest(releasedSkins(), limit).map((s) => ({
    hero: s.hero,
    id: s.id,
    name: s.name,
    release: s.release,
    rarity: rarityOfRank(s.rarity).key,
    series: s.series,
    image: absoluteImage(artwork(s.hero, s.id, s.image)),
  }));
  return responseApi(results, { total: results.length });
}

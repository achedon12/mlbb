import { LOCALES } from "@/i18n/config";
import { allHeroes, illustrations, sync } from "@/lib/data";
import { site } from "@/lib/site";
import { heroGallery, heroesWithSkins } from "@/lib/hero-skins";

/**
 * Plan des images : illustrations et portraits de skins, rattaches aux pages
 * qui les affichent, dans chaque langue. Les skins se cherchent dans Google
 * Images, et le plan principal (`sitemap.ts`) ne liste que des pages.
 *
 * Seule l'adresse de chaque image est donnee : Google ne lit plus les titres
 * ni les legendes des plans d'images depuis 2022 ; les textes alternatifs des
 * pages font ce travail.
 */
export const dynamic = "force-static";

/** Plafond de Google par page. */
const MAX_IMAGES = 1000;

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const absolute = (path: string) => escape(new URL(path, site.url).toString());

function entry(page: string, images: (string | null | undefined)[], changed: string): string | null {
  const unique = [...new Set(images.filter((i): i is string => !!i))].slice(0, MAX_IMAGES);
  if (unique.length === 0) return null;
  return [
    "  <url>",
    `    <loc>${absolute(page)}</loc>`,
    `    <lastmod>${changed}</lastmod>`,
    ...unique.map((i) => `    <image:image><image:loc>${absolute(i)}</image:loc></image:image>`),
    "  </url>",
  ].join("\n");
}

export function GET(): Response {
  const changed = sync.date.slice(0, 10);
  const entries = LOCALES.flatMap((l) => [
    // Fiche : le portrait de tete (celui du skin d'origine) et l'illustration de fond.
    ...allHeroes.map((h) =>
      entry(
        `/${l}/heroes/${h.slug}`,
        [heroGallery(h).skins[0]?.portrait ?? h.images.portrait, Object.values(illustrations[h.slug] ?? {})[0]],
        changed,
      ),
    ),
    // Galerie : chaque illustration et chaque portrait de boutique.
    ...heroesWithSkins.map((h) => {
      const g = heroGallery(h);
      return entry(
        `/${l}/heroes/${h.slug}/skins`,
        [...g.skins.flatMap((s) => [s.illustration, s.portrait]), ...g.others.map((a) => a.illustration)],
        changed,
      );
    }),
  ]).filter((e): e is string => e !== null);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

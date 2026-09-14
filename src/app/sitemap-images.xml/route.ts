import { LOCALES } from "@/i18n/config";
import { allHeroes, illustrations, sync } from "@/lib/data";
import { site } from "@/lib/site";
import { heroGallery, heroesWithSkins } from "@/lib/hero-skins";

/**
 * Image sitemap: skin illustrations and portraits, attached to the pages
 * that display them, in every language. Skins are searched for in Google
 * Images, and the main sitemap (`sitemap.ts`) only lists pages.
 *
 * Only each image's address is given: Google no longer reads the titles
 * or captions of image sitemaps since 2022; the pages' alt texts
 * do that job.
 */
export const dynamic = "force-static";

/** Google's cap per sitemap. */
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
    // Hero page: the header portrait (that of the original skin) and the background illustration.
    ...allHeroes.map((h) =>
      entry(
        `/${l}/heroes/${h.slug}`,
        [heroGallery(h).skins[0]?.portrait ?? h.images.portrait, Object.values(illustrations[h.slug] ?? {})[0]],
        changed,
      ),
    ),
    // Gallery: each illustration and each shop portrait.
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

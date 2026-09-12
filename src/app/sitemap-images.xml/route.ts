import { LANGUES } from "@/i18n/config";
import { heros, illustrations, synchro } from "@/lib/donnees";
import { site } from "@/lib/site";
import { galerieHeros, herosAvecSkins } from "@/lib/skins-heros";

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

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const absolue = (chemin: string) => echapper(new URL(chemin, site.url).toString());

function entree(page: string, images: (string | null | undefined)[], modifie: string): string | null {
  const uniques = [...new Set(images.filter((i): i is string => !!i))].slice(0, MAX_IMAGES);
  if (uniques.length === 0) return null;
  return [
    "  <url>",
    `    <loc>${absolue(page)}</loc>`,
    `    <lastmod>${modifie}</lastmod>`,
    ...uniques.map((i) => `    <image:image><image:loc>${absolue(i)}</image:loc></image:image>`),
    "  </url>",
  ].join("\n");
}

export function GET(): Response {
  const modifie = synchro.date.slice(0, 10);
  const entrees = LANGUES.flatMap((l) => [
    // Fiche : le portrait de tete (celui du skin d'origine) et l'illustration de fond.
    ...heros.map((h) =>
      entree(
        `/${l}/heroes/${h.slug}`,
        [galerieHeros(h).skins[0]?.portrait ?? h.images.portrait, Object.values(illustrations[h.slug] ?? {})[0]],
        modifie,
      ),
    ),
    // Galerie : chaque illustration et chaque portrait de boutique.
    ...herosAvecSkins.map((h) => {
      const g = galerieHeros(h);
      return entree(
        `/${l}/heroes/${h.slug}/skins`,
        [...g.skins.flatMap((s) => [s.illustration, s.portrait]), ...g.autres.map((a) => a.illustration)],
        modifie,
      );
    }),
  ]).filter((e): e is string => e !== null);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entrees.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

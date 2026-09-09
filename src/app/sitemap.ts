import type { MetadataRoute } from "next";
import { heros } from "@/lib/donnees";
import { articles } from "@/lib/contenu";
import { site } from "@/lib/site";

/**
 * Plan du site.
 *
 * Construit a partir des memes sources que les pages : ajouter un heros ou un
 * article suffit a l'y faire apparaitre, sans edition manuelle.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const maintenant = new Date();

  const fixes: MetadataRoute.Sitemap = (
    [
      { url: site.url, changeFrequency: "daily", priority: 1 },
      { url: `${site.url}/heros`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${site.url}/tier-list`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${site.url}/draft`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${site.url}/objets`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${site.url}/emblemes`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${site.url}/actualites`, changeFrequency: "daily", priority: 0.8 },
      { url: `${site.url}/veille`, changeFrequency: "hourly", priority: 0.6 },
      { url: `${site.url}/patch-notes`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${site.url}/api-doc`, changeFrequency: "monthly", priority: 0.5 },
      { url: `${site.url}/a-propos`, changeFrequency: "yearly", priority: 0.3 },
    ] as const
  ).map((e) => ({ ...e, lastModified: maintenant }));

  const pagesHeros: MetadataRoute.Sitemap = heros.map((h) => ({
    url: `${site.url}/heros/${h.slug}`,
    lastModified: maintenant,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const publications: MetadataRoute.Sitemap = (
    [
      ["actualites", articles("actualites")],
      ["patch-notes", articles("patch-notes")],
    ] as const
  ).flatMap(([section, liste]) =>
    liste.map((a) => ({
      url: `${site.url}/${section}/${a.slug}`,
      lastModified: new Date(a.date),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  );

  return [...fixes, ...pagesHeros, ...publications];
}

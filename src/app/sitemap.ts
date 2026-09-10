import type { MetadataRoute } from "next";
import { heros, modes, patchsDetail } from "@/lib/donnees";
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
      { url: `${site.url}/heroes`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${site.url}/tier-list`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${site.url}/compare`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${site.url}/draft`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${site.url}/game-modes`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${site.url}/items`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${site.url}/emblems`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${site.url}/news`, changeFrequency: "daily", priority: 0.8 },
      { url: `${site.url}/watch`, changeFrequency: "hourly", priority: 0.6 },
      { url: `${site.url}/patch-notes`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${site.url}/api-doc`, changeFrequency: "monthly", priority: 0.5 },
      { url: `${site.url}/about`, changeFrequency: "yearly", priority: 0.3 },
      { url: `${site.url}/legal`, changeFrequency: "yearly", priority: 0.2 },
      { url: `${site.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ] as const
  ).map((e) => ({ ...e, lastModified: maintenant }));

  const pagesModes: MetadataRoute.Sitemap = modes.map((m) => ({
    url: `${site.url}/game-modes/${m.slug}`,
    lastModified: maintenant,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const pagesHeros: MetadataRoute.Sitemap = heros.map((h) => ({
    url: `${site.url}/heroes/${h.slug}`,
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

  // Notes de patch officielles, designees par leur numero de version : elles
  // ne sont pas des « articles » mais ont chacune leur page a indexer.
  const notesPatch: MetadataRoute.Sitemap = Object.keys(patchsDetail).map((version) => ({
    url: `${site.url}/patch-notes/${version}`,
    lastModified: maintenant,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...fixes, ...pagesModes, ...pagesHeros, ...publications, ...notesPatch];
}

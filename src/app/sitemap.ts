import type { MetadataRoute } from "next";
import { heros, modesSlugs, patchsDetail } from "@/lib/donnees";
import { articles } from "@/lib/contenu";
import { site } from "@/lib/site";
import { RANGS_CLASSES } from "@/lib/tier-list";
import { LANGUES } from "@/i18n/config";

/**
 * Plan du site, multilingue.
 *
 * Chaque page existe dans chaque langue, sous son prefixe (`/fr/heroes`…) : on
 * emet une entree par langue. Les versions d'une meme page sont reliees par les
 * `hreflang` de son en-tete HTML (`metaLangues`), pas ici : Google n'en demande
 * qu'une declaration, et les liens `xhtml:link` faisaient afficher le plan par
 * les navigateurs comme un bloc de texte plutot que comme un arbre XML.
 */
type Chemin = {
  chemin: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  lastModified?: Date;
};

export default function sitemap(): MetadataRoute.Sitemap {
  const maintenant = new Date();

  const chemins: Chemin[] = [
    { chemin: "", changeFrequency: "daily", priority: 1 },
    { chemin: "/heroes", changeFrequency: "weekly", priority: 0.9 },
    { chemin: "/tier-list", changeFrequency: "weekly", priority: 0.9 },
    { chemin: "/compare", changeFrequency: "weekly", priority: 0.7 },
    { chemin: "/draft", changeFrequency: "weekly", priority: 0.8 },
    { chemin: "/tools/win-rate", changeFrequency: "yearly", priority: 0.6 },
    { chemin: "/game-modes", changeFrequency: "monthly", priority: 0.6 },
    { chemin: "/items", changeFrequency: "monthly", priority: 0.7 },
    { chemin: "/emblems", changeFrequency: "monthly", priority: 0.7 },
    { chemin: "/news", changeFrequency: "daily", priority: 0.8 },
    { chemin: "/watch", changeFrequency: "hourly", priority: 0.6 },
    { chemin: "/patch-notes", changeFrequency: "weekly", priority: 0.8 },
    { chemin: "/api-doc", changeFrequency: "monthly", priority: 0.5 },
    { chemin: "/contribute", changeFrequency: "monthly", priority: 0.4 },
    { chemin: "/about", changeFrequency: "yearly", priority: 0.3 },
    { chemin: "/legal", changeFrequency: "yearly", priority: 0.2 },
    { chemin: "/privacy", changeFrequency: "yearly", priority: 0.2 },
    ...RANGS_CLASSES.filter((r) => r !== "all").map((r) => ({
      chemin: `/tier-list/${r}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...modesSlugs.map((slug) => ({ chemin: `/game-modes/${slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...heros.map((h) => ({ chemin: `/heroes/${h.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...Object.keys(patchsDetail).map((v) => ({
      chemin: `/patch-notes/${v}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...([["news", "actualites"], ["patch-notes", "patch-notes"]] as const).flatMap(([route, section]) =>
      articles(section).map((a) => ({
        chemin: `/${route}/${a.slug}`,
        changeFrequency: "yearly" as const,
        priority: 0.7,
        lastModified: new Date(a.date),
      })),
    ),
  ];

  // Pour chaque chemin, une URL par langue ; les hreflang vivent dans les pages.
  return chemins.flatMap(({ chemin, changeFrequency, priority, lastModified }) => {
    return LANGUES.map((l) => ({
      url: `${site.url}/${l}${chemin}`,
      lastModified: lastModified ?? maintenant,
      changeFrequency,
      priority,
    }));
  });
}

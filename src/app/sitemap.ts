import type { MetadataRoute } from "next";
import { heros, modesSlugs, patchsDetail } from "@/lib/donnees";
import { articles } from "@/lib/contenu";
import { site } from "@/lib/site";
import { LANGUES, LANGUE_DEFAUT } from "@/i18n/config";

/**
 * Plan du site, multilingue.
 *
 * Chaque page existe dans chaque langue, sous son prefixe (`/fr/heros`…). Pour
 * chaque adresse on emet une entree par langue, et on relie les versions entre
 * elles par `alternates.languages` (hreflang) : les moteurs comprennent alors
 * qu'il s'agit de la meme page traduite, et servent la bonne selon l'utilisateur.
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
    { chemin: "/game-modes", changeFrequency: "monthly", priority: 0.6 },
    { chemin: "/items", changeFrequency: "monthly", priority: 0.7 },
    { chemin: "/emblems", changeFrequency: "monthly", priority: 0.7 },
    { chemin: "/news", changeFrequency: "daily", priority: 0.8 },
    { chemin: "/watch", changeFrequency: "hourly", priority: 0.6 },
    { chemin: "/patch-notes", changeFrequency: "weekly", priority: 0.8 },
    { chemin: "/api-doc", changeFrequency: "monthly", priority: 0.5 },
    { chemin: "/about", changeFrequency: "yearly", priority: 0.3 },
    { chemin: "/legal", changeFrequency: "yearly", priority: 0.2 },
    { chemin: "/privacy", changeFrequency: "yearly", priority: 0.2 },
    ...modesSlugs.map((slug) => ({ chemin: `/game-modes/${slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...heros.map((h) => ({ chemin: `/heroes/${h.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...Object.keys(patchsDetail).map((v) => ({
      chemin: `/patch-notes/${v}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...(["news", "patch-notes"] as const).flatMap((section) =>
      articles(section).map((a) => ({
        chemin: `/${section}/${a.slug}`,
        changeFrequency: "yearly" as const,
        priority: 0.7,
        lastModified: new Date(a.date),
      })),
    ),
  ];

  // Pour chaque chemin : une URL par langue, toutes reliees en hreflang.
  return chemins.flatMap(({ chemin, changeFrequency, priority, lastModified }) => {
    const languages = Object.fromEntries(LANGUES.map((l) => [l, `${site.url}/${l}${chemin}`]));
    languages["x-default"] = `${site.url}/${LANGUE_DEFAUT}${chemin}`;
    return LANGUES.map((l) => ({
      url: `${site.url}/${l}${chemin}`,
      lastModified: lastModified ?? maintenant,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}

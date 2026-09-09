import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Les pages de compte n'ont aucun interet pour un moteur et exposent
        // des URL personnelles : on les tient hors de l'index.
        disallow: ["/compte", "/connexion", "/api/"],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}

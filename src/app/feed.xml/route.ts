import { enHtml, tousLesArticles } from "@/lib/contenu";
import { site, urlAbsolue } from "@/lib/site";

/**
 * Flux RSS.
 *
 * Le flux porte le contenu complet de chaque article dans `content:encoded`,
 * pas seulement un resume tronque : un lecteur RSS doit pouvoir lire sans
 * revenir sur le site. `description` reste le chapeau, pour les agregateurs
 * qui n'affichent qu'un extrait.
 */
export const dynamic = "force-static";

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chemin(categorie: string, slug: string): string {
  return urlAbsolue(`/${categorie === "Patch" ? "patch-notes" : "actualites"}/${slug}`);
}

export function GET(): Response {
  const articles = tousLesArticles();
  const dernier = articles[0]?.date ?? new Date().toISOString();

  const entrees = articles
    .map((a) => {
      const lien = chemin(a.categorie, a.slug);
      return `    <item>
      <title>${echapper(a.titre)}</title>
      <link>${lien}</link>
      <guid isPermaLink="true">${lien}</guid>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
      <dc:creator>${echapper(a.auteur)}</dc:creator>
      <category>${echapper(a.categorie)}</category>
      <description>${echapper(a.chapeau)}</description>
      <content:encoded><![CDATA[${enHtml(a.contenu)}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const flux = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${echapper(site.nom)} — actualites et guides</title>
    <link>${site.url}</link>
    <description>${echapper(site.description)}</description>
    <language>fr-fr</language>
    <lastBuildDate>${new Date(dernier).toUTCString()}</lastBuildDate>
    <generator>${echapper(site.nom)}</generator>
    <atom:link href="${urlAbsolue("/feed.xml")}" rel="self" type="application/rss+xml" />
${entrees}
  </channel>
</rss>
`;

  return new Response(flux, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

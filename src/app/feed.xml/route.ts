import { toHtml, allArticles } from "@/lib/content";
import { site, absoluteUrl } from "@/lib/site";

/**
 * Flux RSS.
 *
 * Le flux porte le contenu complet de chaque article dans `content:encoded`,
 * pas seulement un resume tronque : un lecteur RSS doit pouvoir lire sans
 * revenir sur le site. `description` reste le chapeau, pour les agregateurs
 * qui n'affichent qu'un extrait.
 */
export const dynamic = "force-static";

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function path(category: string, slug: string): string {
  return absoluteUrl(`/${category === "Patch" ? "patch-notes" : "news"}/${slug}`);
}

export function GET(): Response {
  const articles = allArticles();
  const last = articles[0]?.date ?? new Date().toISOString();

  const entries = articles
    .map((a) => {
      const link = path(a.category, a.slug);
      return `    <item>
      <title>${escape(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
      <dc:creator>${escape(a.author)}</dc:creator>
      <category>${escape(a.category)}</category>
      <description>${escape(a.summary)}</description>
      <content:encoded><![CDATA[${toHtml(a.content)}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escape(site.name)} — actualites et guides</title>
    <link>${site.url}</link>
    <description>${escape(site.description)}</description>
    <language>fr-fr</language>
    <lastBuildDate>${new Date(last).toUTCString()}</lastBuildDate>
    <generator>${escape(site.name)}</generator>
    <atom:link href="${absoluteUrl("/feed.xml")}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

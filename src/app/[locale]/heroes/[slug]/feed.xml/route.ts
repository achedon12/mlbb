import { LOCALES, LOCALE_HTML, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { site, absoluteUrl } from "@/lib/site";
import { adjustmentsOf } from "@/lib/patch-tracking";
import type { HeroAdjustment } from "@/lib/types";

/**
 * A hero's RSS feed: its adjustments, patch by patch. Subscribing means
 * being told when your hero changes, without watching the patch notes.
 * One static file per hero and per language; only the labels change
 * from one language to another, the change details coming from the wiki.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => allHeroes.map((h) => ({ locale, slug: h.slug })));
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Detail of an adjustment, in plain HTML: introduction, then section by section. */
function detail(a: HeroAdjustment): string {
  const intro = a.intro ? `<p>${escape(a.intro)}</p>` : "";
  const sections = a.sections
    .map((s) => {
      const title = s.category ? `${s.name} (${s.category})` : s.name;
      const rows = s.changes
        .map((c) =>
          "text" in c
            ? `<li>${escape(c.text)}</li>`
            : `<li>${c.label ? `${escape(c.label)}: ` : ""}${escape(c.before)} → ${escape(c.after)}</li>`,
        )
        .join("");
      return `<h4>${escape(title)}</h4><ul>${rows}</ul>`;
    })
    .join("");
  // `]]>` would close the CDATA section.
  return (intro + sections).replaceAll("]]>", "]]&gt;");
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const h = heroesBySlug.get(slug);
  if (!h) return new Response("Not found", { status: 404 });

  const t = createT(locale);
  const entries = adjustmentsOf(slug);
  const sheet = absoluteUrl(`/${locale}/heroes/${slug}`);
  const dates = entries.flatMap((e) => (e.date ? [e.date] : [])).sort();
  const last = dates.at(-1);

  const items = entries
    .map(({ version, date, adjustment: a }) => {
      const type = a.type ? t(`patchHeroes.${a.type}`) : null;
      const title = type ? `Patch ${version} — ${type}` : `Patch ${version}`;
      const link = absoluteUrl(`/${locale}/patch-notes/${version}`);
      return `    <item>
      <title>${escape(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${escape(`${site.name}:${slug}:${version}`)}</guid>
${date ? `      <pubDate>${new Date(date).toUTCString()}</pubDate>\n` : ""}${type ? `      <category>${escape(type)}</category>\n` : ""}      <description>${escape(a.intro || title)}</description>
      <content:encoded><![CDATA[${detail(a)}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escape(`${h.name} — ${t("pages.heroDetail.statistics.adjustments")} · ${site.name}`)}</title>
    <link>${sheet}</link>
    <description>${escape(t("pages.heroDetail.statistics.adjustmentsIntro", { nom: h.name }))}</description>
    <language>${LOCALE_HTML[locale].toLowerCase()}</language>
${last ? `    <lastBuildDate>${new Date(last).toUTCString()}</lastBuildDate>\n` : ""}    <generator>${escape(site.name)}</generator>
    <atom:link href="${absoluteUrl(`/${locale}/heroes/${slug}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
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

import { LANGUES, LOCALE_HTML, type Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { heros, herosParSlug } from "@/lib/donnees";
import { site, urlAbsolue } from "@/lib/site";
import { ajustementsDe } from "@/lib/suivi-patchs";
import type { AjustementHeros } from "@/lib/types";

/**
 * Flux RSS d'un heros : ses ajustements, patch par patch. S'y abonner, c'est
 * etre prevenu quand son heros change, sans surveiller les notes de patch.
 * Un fichier statique par heros et par langue ; seuls les libelles changent
 * d'une langue a l'autre, le detail des changements venant du wiki.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUES.flatMap((locale) => heros.map((h) => ({ locale, slug: h.slug })));
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Detail d'un ajustement, en HTML simple : introduction, puis section par section. */
function detail(a: AjustementHeros): string {
  const intro = a.intro ? `<p>${echapper(a.intro)}</p>` : "";
  const sections = a.sections
    .map((s) => {
      const titre = s.categorie ? `${s.nom} (${s.categorie})` : s.nom;
      const lignes = s.changements
        .map((c) =>
          "texte" in c
            ? `<li>${echapper(c.texte)}</li>`
            : `<li>${c.libelle ? `${echapper(c.libelle)}: ` : ""}${echapper(c.avant)} → ${echapper(c.apres)}</li>`,
        )
        .join("");
      return `<h4>${echapper(titre)}</h4><ul>${lignes}</ul>`;
    })
    .join("");
  // `]]>` fermerait la section CDATA.
  return (intro + sections).replaceAll("]]>", "]]&gt;");
}

export async function GET(_requete: Request, { params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: brute, slug } = await params;
  const locale = brute as Langue;
  const h = herosParSlug.get(slug);
  if (!h) return new Response("Not found", { status: 404 });

  const t = creerT(locale);
  const entrees = ajustementsDe(slug);
  const fiche = urlAbsolue(`/${locale}/heroes/${slug}`);
  const dates = entrees.flatMap((e) => (e.date ? [e.date] : [])).sort();
  const dernier = dates.at(-1);

  const items = entrees
    .map(({ version, date, ajustement: a }) => {
      const type = a.type ? t(`patchHeros.${a.type}`) : null;
      const titre = type ? `Patch ${version} — ${type}` : `Patch ${version}`;
      const lien = urlAbsolue(`/${locale}/patch-notes/${version}`);
      return `    <item>
      <title>${echapper(titre)}</title>
      <link>${lien}</link>
      <guid isPermaLink="false">${echapper(`${site.nom}:${slug}:${version}`)}</guid>
${date ? `      <pubDate>${new Date(date).toUTCString()}</pubDate>\n` : ""}${type ? `      <category>${echapper(type)}</category>\n` : ""}      <description>${echapper(a.intro || titre)}</description>
      <content:encoded><![CDATA[${detail(a)}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const flux = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${echapper(`${h.nom} — ${t("pages.heroDetail.statistiques.ajustements")} · ${site.nom}`)}</title>
    <link>${fiche}</link>
    <description>${echapper(t("pages.heroDetail.statistiques.ajustementsIntro", { nom: h.nom }))}</description>
    <language>${LOCALE_HTML[locale].toLowerCase()}</language>
${dernier ? `    <lastBuildDate>${new Date(dernier).toUTCString()}</lastBuildDate>\n` : ""}    <generator>${echapper(site.nom)}</generator>
    <atom:link href="${urlAbsolue(`/${locale}/heroes/${slug}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
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

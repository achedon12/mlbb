import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import { serializeJsonLd } from "@/lib/html";
import { HeroList } from "@/components/hero-list";
import { PageHeader } from "@/components/ui";
import { allHeroes, heroAnalyses, countSkins } from "@/lib/data";
import { rankingFull, rateBySlug } from "@/lib/tier-list";
import { longDate, dateMeasure, listNames, patchCurrent } from "@/lib/freshness";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage } from "@/i18n/translations";
import { heroListData, metaPage } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Locale }> };

/** Description en donnees : effectif, patch et date du releve, trois premiers de la tier list. */
function descriptionCatalog(locale: Locale): string {
  const t = createT(locale);
  return t("pages.seo.heroes.description", {
    n: allHeroes.length,
    v: patchCurrent.version,
    date: longDate(locale),
    top: listNames(locale, rankingFull.slice(0, 3).map((e) => e.hero.name)),
    skins: countSkins,
    analyses: heroAnalyses.length,
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.heroes.title", { n: allHeroes.length, v: patchCurrent.version }),
    description: descriptionCatalog(locale),
    share: t("pages.heroes.ogDescription", { heros: allHeroes.length, skins: countSkins }),
    path: "/heroes",
  });
}

export default async function HeroPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);

  const structuredData = heroListData(locale, {
    name: t("pages.heroes.listLd"),
    description: descriptionCatalog(locale),
    path: "/heroes",
    heroes: allHeroes.map((h) => ({ name: h.name, slug: h.slug })),
    changed: dateMeasure,
  });

  // On n'envoie au client que les champs affiches par les vignettes.
  const previews = allHeroes.map((h) => {
    const rate = rateBySlug.get(h.slug);
    return {
      slug: h.slug,
      name: h.name,
      roles: h.roles,
      lanes: h.lanes,
      portrait: h.images.icon ?? h.images.portrait,
      skins: h.skins.length,
      analysis: h.analysis !== null,
      win: rate?.win ?? null,
      tier: rate?.tier ?? null,
    };
  });

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList"])}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PageHeader
        title={t("pages.heroes.title")}
        lead={t("pages.heroes.lead", {
          heros: allHeroes.length,
          skins: countSkins,
          analyses: heroAnalyses.length,
        })}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <HeroList heroes={previews} />
      </div>
    </ExtendMessages>
  );
}

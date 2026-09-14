import type { Metadata } from "next";
import { WikiCredit } from "@/components/wiki-credit";
import Link from "@/components/link";
import { StoryList, type EntryStory } from "@/components/story-list";
import { LorePairCard } from "@/components/lore-pair";
import { HeroPortrait } from "@/components/hero-portrait";
import { PageHeader, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { heroLabel } from "@/i18n/hero-data";
import { ExtendMessages } from "@/i18n/provider";
import { heroListData, metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { stories, sync } from "@/lib/data";
import { listNames } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { factionsLore, heroNames, pairsOf, pairsFeatured, regionOf, regionsLore, termsLore } from "@/lib/lore";

type Params = { params: Promise<{ locale: Locale }> };

/** Heroes for whom the wiki publishes a story or a narrative profile. */
function countStories(locale: Locale): number {
  const h = stories(locale);
  return regionsLore.reduce((n, r) => n + r.heroes.filter((x) => h[x.slug]?.lore.length || h[x.slug]?.profile).length, 0);
}

function description(locale: Locale): string {
  const t = createT(locale);
  return t("pages.seo.lore.description", {
    n: countStories(locale),
    regions: regionsLore.length,
    examples: listNames(locale, regionsLore.slice(0, 3).map((r) => heroLabel(t, "region", r.name)!)),
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.lore.title"),
    description: description(locale),
    path: "/lore",
    keywords: ["MLBB lore", "Mobile Legends lore", "Land of Dawn", "Moniyan Empire", "hero story"],
  });
}

export default async function LorePage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const h = stories(locale);
  const nameRegion = (name: string) => heroLabel(t, "region", name)!;
  const pairs = pairsOf(locale);
  const featured = pairsFeatured(pairs, 8);
  // Two-hero factions stay on the region pages: the hub keeps the largest ones.
  const factions = factionsLore(locale, 3);
  const total = regionsLore.reduce((n, r) => n + r.heroes.length, 0);
  const heroCount = (n: number) => t(n === 1 ? "pages.lore.nHeroes1" : "pages.lore.nHeroes", { n });
  const regionLabel = (slug: string) => {
    const key = regionOf(slug);
    const r = regionsLore.find((x) => x.key === key);
    return r ? nameRegion(r.name) : null;
  };

  const structuredData = heroListData(locale, {
    name: t("pages.lore.listLd"),
    description: description(locale),
    path: "/lore",
    heroes: regionsLore.flatMap((r) => r.heroes.map((x) => ({ name: x.name, slug: x.slug }))),
  });

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.loreUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.lore.title")}
        lead={t("pages.lore.lead", { n: countStories(locale), regions: regionsLore.length, links: pairs.length })}
      />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="regions">
          <SectionTitle lead={t("pages.lore.regionsLead")}>{t("pages.lore.regionsTitle")}</SectionTitle>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regionsLore.map((r) => (
              <li key={r.key}>
                <Link
                  href={`/lore/${r.key}`}
                  className="bevel group flex h-full flex-col gap-3 border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-heading text-lg font-bold text-chalk-100 group-hover:text-gold-400">{nameRegion(r.name)}</span>
                    <span className="shrink-0 text-xs text-chalk-500">{heroCount(r.heroes.length)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {r.heroes.slice(0, 5).map((x) => (
                      <HeroPortrait key={x.slug} source={x.images.icon ?? x.images.portrait} name={x.name} size="mini" decorative />
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {featured.length > 0 && (
          <section id="links">
            <SectionTitle lead={t("pages.lore.linksLead")}>{t("pages.lore.linksTitle")}</SectionTitle>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {featured.map((p) => (
                <li key={`${p.a}-${p.b}`}>
                  <LorePairCard pair={p} t={t} regions={[regionLabel(p.a), regionLabel(p.b)]} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {factions.length > 0 && (
          <section id="factions">
            <SectionTitle lead={t("pages.lore.factionsLead")}>{t("pages.lore.factionsTitle")}</SectionTitle>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {factions.map((f) => (
                <li key={f.key} className="bevel-sm border border-night-700/60 bg-night-900/40 p-4">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-chalk-100">{f.name}</span>
                    <span className="shrink-0 text-xs text-chalk-500">{heroCount(f.heroes.length)}</span>
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {f.heroes.map((s) => (
                      <li key={s}>
                        <Link
                          href={`/heroes/${s}#story`}
                          className="bevel-sm inline-block border border-night-700/70 bg-night-800/60 px-2 py-1 text-xs text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                        >
                          {heroNames.get(s) ?? s}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="stories">
          <SectionTitle lead={t("pages.lore.storiesLead")}>{t("pages.lore.storiesTitle")}</SectionTitle>
          <StoryList
            total={total}
            groups={regionsLore.map((r) => ({
              key: r.key,
              name: nameRegion(r.name),
              heroes: r.heroes.map(
                (x): EntryStory => [
                  x.slug,
                  x.name,
                  h[x.slug]?.tagline ?? h[x.slug]?.profile?.title ?? x.title,
                  x.images.icon ?? x.images.portrait,
                  termsLore(x, locale, nameRegion(r.name)),
                ],
              ),
            }))}
          />
        </section>

        <WikiCredit t={t} href={sync.source} messageKey="pages.lore.source" />
      </div>
    </ExtendMessages>
  );
}

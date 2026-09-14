import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WikiCredit } from "@/components/wiki-credit";
import Link from "@/components/link";
import { LorePairCard } from "@/components/lore-pair";
import { HeroPortrait } from "@/components/hero-portrait";
import { PageHeader, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { releaseDate, heroLabel } from "@/i18n/hero-data";
import { heroListData, metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { stories, sync } from "@/lib/data";
import { listNames } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import {
  heroNames,
  regionOf,
  regionByKey,
  regionsLore,
  summaryRegion,
  type LorePair,
  type RegionLore,
} from "@/lib/lore";

type Params = { params: Promise<{ locale: Locale; region: string }> };

/** Links shown right away; the others expand. */
const LINKS_VISIBLE = 10;

export const dynamicParams = false;

export function generateStaticParams() {
  return regionsLore.map((r) => ({ region: r.key }));
}

/** Heroes most linked to the others in their profiles: the region's figures, for the description. */
function figures(region: RegionLore, locale: Locale): string[] {
  const summary = summaryRegion(region, locale);
  const links = new Map<string, number>();
  for (const p of [...summary.internal, ...summary.external]) {
    for (const s of [p.a, p.b]) links.set(s, (links.get(s) ?? 0) + 1);
  }
  return [...region.heroes]
    .sort((a, b) => (links.get(b.slug) ?? 0) - (links.get(a.slug) ?? 0) || a.name.localeCompare(b.name, "en"))
    .slice(0, 3)
    .map((h) => h.name);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, region } = await params;
  const r = regionByKey.get(region);
  if (!r) return {};
  const t = createT(locale);
  const name = heroLabel(t, "region", r.name)!;
  return metaPage(locale, {
    title: t("pages.seo.loreRegion.title", { region: name }),
    description: t("pages.seo.loreRegion.description", {
      region: name,
      n: r.heroes.length,
      names: listNames(locale, figures(r, locale)),
    }),
    path: `/lore/${r.key}`,
    keywords: [`${r.name} MLBB`, "MLBB lore", "Mobile Legends lore", ...r.heroes.slice(0, 5).map((h) => `${h.name} lore`)],
  });
}

export default async function LoreRegionPage({ params }: Params) {
  const { locale, region } = await params;
  const r = regionByKey.get(region);
  if (!r) notFound();

  const t = createT(locale);
  const h = stories(locale);
  const nameRegion = (name: string) => heroLabel(t, "region", name)!;
  const name = nameRegion(r.name);
  const summary = summaryRegion(r, locale);
  const labelOf = (slug: string) => {
    const x = regionByKey.get(regionOf(slug) ?? "");
    return x ? nameRegion(x.name) : null;
  };

  // Facts drawn from the data, one per line: nothing here is written by hand.
  const facts: string[] = [
    t("pages.lore.region.factRoles", {
      n: r.heroes.length,
      roles: listNames(locale, summary.roles.slice(0, 3).map((x) => `${t(`roles.${x.role}`)} (${x.n})`)),
    }),
  ];
  if (summary.first && summary.last) {
    facts.push(
      t("pages.lore.region.factArrivals", {
        first: summary.first.name,
        firstDate: releaseDate(summary.first.release, locale, t) ?? "",
        latest: summary.last.name,
        lastDate: releaseDate(summary.last.release, locale, t) ?? "",
      }),
    );
  } else if (summary.first) {
    facts.push(
      t("pages.lore.region.factArrival", {
        name: summary.first.name,
        date: releaseDate(summary.first.release, locale, t) ?? "",
      }),
    );
  }
  if (summary.factions.length) {
    facts.push(t("pages.lore.region.factFactions", { list: listNames(locale, summary.factions.map((f) => `${f.name} (${f.n})`)) }));
  }
  if (summary.species.length) {
    facts.push(t("pages.lore.region.factSpecies", { list: listNames(locale, summary.species.map((e) => `${e.name} (${e.n})`)) }));
  }
  facts.push(t("pages.lore.region.factLinks", { internal: summary.internal.length, external: summary.external.length }));
  if (summary.neighbours.length) {
    facts.push(
      t("pages.lore.region.factNeighbours", {
        list: listNames(
          locale,
          summary.neighbours.slice(0, 3).map((v) => `${nameRegion(regionByKey.get(v.key)?.name ?? v.key)} (${v.n})`),
        ),
      }),
    );
  }

  const listPairs = (pairs: LorePair[], withRegions: boolean) => (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {pairs.map((p) => (
        <li key={`${p.a}-${p.b}`}>
          <LorePairCard pair={p} t={t} regions={withRegions ? [labelOf(p.a), labelOf(p.b)] : undefined} />
        </li>
      ))}
    </ul>
  );

  const rowLink = (p: LorePair) => {
    const natures = [p.deA?.nature, p.deB?.nature].filter((x): x is string => !!x);
    const link = (slug: string) => (
      <a href={`/${locale}/heroes/${slug}#story`} className="font-semibold text-chalk-100 hover:text-gold-400">
        {heroNames.get(slug) ?? slug}
      </a>
    );
    return (
      <>
        {link(p.a)} <span aria-hidden>↔</span>
        <span className="sr-only"> {t("pages.lore.and")} </span> {link(p.b)}
        {natures.length > 0 && <span className="text-chalk-500"> · {natures.join(" / ")}</span>}
      </>
    );
  };

  const structuredData = heroListData(locale, {
    name: t("pages.seo.loreRegion.title", { region: name }),
    description: facts[0],
    path: `/lore/${r.key}`,
    heroes: r.heroes.map((x) => ({ name: x.name, slug: x.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={name}
        lead={t("pages.lore.region.lead", { region: name })}
        crumbs={[
          { name: t("pages.lore.crumb"), href: "/lore" },
          { name, siblings: regionsLore.map((x) => ({ name: nameRegion(x.name), href: `/lore/${x.key}` })) },
        ]}
      />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="overview">
          <SectionTitle>{t("pages.lore.region.inBriefTitle")}</SectionTitle>
          <ul className="max-w-3xl list-disc space-y-2 pl-5 leading-relaxed text-chalk-300 marker:text-gold-400">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section id="heroes">
          <SectionTitle lead={t("pages.lore.region.heroesLead")}>{t("pages.lore.region.heroesTitle")}</SectionTitle>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {r.heroes.map((x) => {
              const sheet = h[x.slug]?.profile;
              const facts = [sheet?.species, sheet?.age ? t("pages.lore.age", { age: sheet.age }) : null].filter(Boolean);
              return (
                <li key={x.slug} id={x.slug} className="scroll-mt-24">
                  <article className="bevel flex h-full gap-4 border border-night-700/70 bg-night-900/60 p-4">
                    <HeroPortrait source={x.images.portrait ?? x.images.icon} name={x.name} size="sheet" decorative />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-xl font-bold text-chalk-100">
                        <Link href={`/heroes/${x.slug}`} className="hover:text-gold-400">
                          {x.name}
                        </Link>
                      </h3>
                      {(sheet?.title ?? x.title) && <p className="text-xs text-chalk-500">{sheet?.title ?? x.title}</p>}
                      {h[x.slug]?.tagline && (
                        <p className="mt-2 line-clamp-3 text-sm italic leading-relaxed text-chalk-300">{h[x.slug]!.tagline}</p>
                      )}
                      {facts.length > 0 && <p className="mt-2 text-xs text-chalk-400">{facts.join(" · ")}</p>}
                      {sheet?.affiliations.length ? (
                        <ul className="mt-2 flex flex-wrap gap-1">
                          {sheet.affiliations.slice(0, 3).map((a) => (
                            <li
                              key={a}
                              className="bevel-sm border border-night-700/70 bg-night-800/60 px-1.5 py-0.5 text-[0.7rem] text-chalk-300"
                            >
                              {a}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Link
                        href={`/heroes/${x.slug}#story`}
                        className="mt-3 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.lore.readStory")} →
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="links">
          <SectionTitle lead={t("pages.lore.region.linksLead")}>{t("pages.lore.region.linksTitle")}</SectionTitle>
          {summary.internal.length === 0 ? (
            <p className="text-chalk-500">{t("pages.lore.region.noLink")}</p>
          ) : (
            <>
              {listPairs(summary.internal.slice(0, LINKS_VISIBLE), false)}
              {summary.internal.length > LINKS_VISIBLE && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gold-400 hover:text-gold-500">
                    {t("pages.lore.region.otherLinks", { n: summary.internal.length - LINKS_VISIBLE })}
                  </summary>
                  {/* Rows without portraits: a large region counts more than a hundred links. */}
                  <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm leading-relaxed md:grid-cols-2">
                    {summary.internal.slice(LINKS_VISIBLE).map((p) => (
                      <li key={`${p.a}-${p.b}`}>{rowLink(p)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>

        {summary.external.length > 0 && (
          <section id="beyond">
            <SectionTitle lead={t("pages.lore.region.externalLead")}>
              {t("pages.lore.region.externalTitle")}
            </SectionTitle>
            {listPairs(summary.external.slice(0, 8), true)}
          </section>
        )}

        <nav aria-labelledby="other-regions">
          <h2 id="other-regions" className="font-heading text-lg font-bold text-chalk-100">
            {t("pages.lore.region.otherRegions")}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {regionsLore
              .filter((x) => x.key !== r.key)
              .map((x) => (
                <li key={x.key}>
                  <Link
                    href={`/lore/${x.key}`}
                    className="bevel-sm inline-block border border-night-700 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                  >
                    {nameRegion(x.name)} <span className="text-chalk-500">· {x.heroes.length}</span>
                  </Link>
                </li>
              ))}
          </ul>
          <p className="mt-4">
            <Link href="/lore" className="text-sm font-semibold text-gold-400 hover:text-gold-500">
              ← {t("pages.lore.backToHub")}
            </Link>
          </p>
        </nav>

        <WikiCredit t={t} href={sync.source} messageKey="pages.lore.source" />
      </div>
    </>
  );
}

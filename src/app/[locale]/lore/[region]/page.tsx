import type { Metadata } from "next";
import Image from "next/image";
import { WikiCredit } from "@/components/wiki-credit";
import Link from "@/components/link";
import { LorePairCard } from "@/components/lore-pair";
import { ENTRANCE, PosterHeader } from "@/components/poster-header";
import { heroArt } from "@/components/hero-art";
import { regionFaces } from "@/components/lore/lore-art";
import { Score, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { releaseDate, heroLabel } from "@/i18n/hero-data";
import { heroListData, metaPage, notFoundMetadata } from "@/i18n/seo";
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
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale; region: string }> };

/** Links shown right away; the others expand. */
const LINKS_VISIBLE = 10;

export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
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
  if (!r) return notFoundMetadata(locale);
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
    card: true,
    keywords: [`${r.name} MLBB`, "MLBB lore", "Mobile Legends lore", ...r.heroes.slice(0, 5).map((h) => `${h.name} lore`)],
  });
}

export default async function LoreRegionPage({ params }: Params) {
  const { locale, region } = await params;
  const r = regionByKey.get(region);
  if (!r) return <NotFoundPage />;

  const t = createT(locale);
  const h = stories(locale);
  const nameRegion = (name: string) => heroLabel(t, "region", name)!;
  const name = nameRegion(r.name);
  const summary = summaryRegion(r, locale);
  const faces = regionFaces(r);
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
      <PosterHeader
        title={name}
        lead={t("pages.lore.region.lead", { region: name })}
        crumbs={[
          { name: t("pages.lore.crumb"), href: "/lore" },
          { name, siblings: regionsLore.map((x) => ({ name: nameRegion(x.name), href: `/lore/${x.key}` })) },
        ]}
        art={faces.length > 2 ? faces.slice(0, 5).map((f) => f.art) : (faces[0]?.art ?? null)}
        tall
        aside={
          <p aria-hidden className="flex items-end gap-3 lg:flex-col lg:items-end lg:gap-1">
            <Score value={r.heroes.length} className="text-[clamp(4.5rem,2.6rem+5vw,8rem)]" />
            <span className="pb-2 font-heading text-base font-bold uppercase text-chalk-300 lg:pb-0">
              {t("nav.heroes.label")}
            </span>
          </p>
        }
      />

      <div className="page-wrap space-y-16 py-12">
        <section id="overview">
          <SectionTitle>{t("pages.lore.region.inBriefTitle")}</SectionTitle>
          <ul className="max-w-3xl space-y-3 leading-relaxed text-chalk-300">
            {facts.map((f) => (
              <li key={f} className="flex gap-3">
                <span aria-hidden className="eclat mt-2.5 h-[3px] w-5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="heroes" className={ENTRANCE}>
          <SectionTitle lead={t("pages.lore.region.heroesLead")}>{t("pages.lore.region.heroesTitle")}</SectionTitle>
          {/* Each hero as a character card: the artwork in its frame, the name on it, the story's opening line under. */}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {r.heroes.map((x) => {
              const sheet = h[x.slug]?.profile;
              const facts = [sheet?.species, sheet?.age ? t("pages.lore.age", { age: sheet.age }) : null].filter(Boolean);
              const art = heroArt(x.slug);
              const still = art ?? x.images.portrait ?? x.images.icon;
              return (
                <li key={x.slug} id={x.slug} className="scroll-mt-24">
                  <article className="group bevel flex h-full flex-col bg-night-900 transition-[translate] duration-200 hover:-translate-y-0.5">
                    <div className="relative aspect-[16/8] overflow-hidden bg-night-800">
                      {still && (
                        <Image
                          src={still}
                          alt=""
                          fill
                          sizes="(min-width: 1280px) 31vw, (min-width: 640px) 46vw, 92vw"
                          className={
                            art
                              ? "object-cover object-[50%_25%] transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                              : "object-contain object-right transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                          }
                        />
                      )}
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-900 via-night-900/70 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        {(sheet?.title ?? x.title) && (
                          <p className="text-sm font-semibold text-gold-400">{sheet?.title ?? x.title}</p>
                        )}
                        <h3 className="display-caps mt-0.5 text-[2.1rem] text-chalk-100">
                          <Link href={`/heroes/${x.slug}`} className="transition-colors hover:text-gold-300">
                            {x.name}
                          </Link>
                        </h3>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col px-4 pb-4 pt-1">
                      {h[x.slug]?.tagline && (
                        <p className="line-clamp-3 text-sm italic leading-relaxed text-chalk-300">{h[x.slug]!.tagline}</p>
                      )}
                      {facts.length > 0 && <p className="mt-2 text-xs text-chalk-400">{facts.join(" · ")}</p>}
                      {sheet?.affiliations.length ? (
                        <ul className="mt-2 flex flex-wrap gap-1">
                          {sheet.affiliations.slice(0, 3).map((a) => (
                            <li key={a} className="bevel-sm bg-night-800 px-1.5 py-0.5 text-[0.7rem] text-chalk-300">
                              {a}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Link
                        href={`/heroes/${x.slug}#story`}
                        className="mt-auto inline-flex items-center gap-1.5 pt-3 font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
                      >
                        {t("pages.lore.readStory")} <span aria-hidden>→</span>
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
          <h2 id="other-regions" className="type-section text-chalk-100">
            {t("pages.lore.region.otherRegions")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {regionsLore
              .filter((x) => x.key !== r.key)
              .map((x) => {
                const face = regionFaces(x)[0];
                return (
                  <li key={x.key}>
                    <Link href={`/lore/${x.key}`} className="eclat-under group relative block transition-[translate] duration-200 hover:-translate-y-0.5">
                      <span className="bevel-sm relative block aspect-[16/7] overflow-hidden bg-night-800">
                        {face && (
                          <Image
                            src={face.art}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
                            className="object-cover object-[50%_25%] opacity-70 transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.05] group-hover:opacity-100"
                          />
                        )}
                        <span aria-hidden className="absolute inset-0 bg-linear-to-r from-night-950/90 to-transparent" />
                        <span className="absolute inset-y-0 left-0 flex flex-col justify-center px-3">
                          <span className="display-caps text-xl text-chalk-100 transition-colors group-hover:text-gold-300">{nameRegion(x.name)}</span>
                          <span className="text-xs text-chalk-400">{x.heroes.length}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
          <p className="mt-6">
            <Link href="/lore" className="font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300">
              ← {t("pages.lore.backToHub")}
            </Link>
          </p>
        </nav>

        <WikiCredit t={t} href={sync.source} messageKey="pages.lore.source" />
      </div>
    </>
  );
}

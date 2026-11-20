import type { Metadata } from "next";
import Image from "next/image";
import { WikiCredit } from "@/components/wiki-credit";
import Link from "@/components/link";
import { StoryList, type EntryStory } from "@/components/story-list";
import { LorePairCard } from "@/components/lore-pair";
import { HeroPortrait } from "@/components/hero-portrait";
import { Dex } from "@/components/mascot";
import { ArtTile, ENTRANCE, PosterHeader } from "@/components/poster-header";
import { regionFaces } from "@/components/lore/lore-art";
import { SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { heroLabel } from "@/i18n/hero-data";
import { ExtendMessages } from "@/i18n/provider";
import { heroListData, metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { heroesBySlug, stories, sync } from "@/lib/data";
import { listNames } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { cn } from "@/lib/utils";
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
      <PosterHeader
        title={t("pages.lore.title")}
        lead={t("pages.lore.lead", { n: countStories(locale), regions: regionsLore.length, links: pairs.length })}
        art={regionsLore.slice(0, 5).map((r) => regionFaces(r)[0]?.art ?? null)}
        aside={<Dex pose="carte" height={170} priority className="hidden lg:inline-block" />}
      />

      <div className="page-wrap space-y-16 py-12">
        {/* The map of the Land of Dawn: one landscape per region, the most
            populated one drawn largest, its heroes in a row at its foot. */}
        <section id="regions" className={ENTRANCE}>
          <SectionTitle lead={t("pages.lore.regionsLead")}>{t("pages.lore.regionsTitle")}</SectionTitle>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {regionsLore.map((r, i) => {
              const faces = regionFaces(r);
              const art = faces[0]?.art ?? null;
              const big = i === 0;
              return (
                <li key={r.key} className={cn(big && "sm:col-span-2 lg:row-span-2")}>
                  <ArtTile
                    href={`/lore/${r.key}`}
                    art={art}
                    name={nameRegion(r.name)}
                    aspect={big ? "aspect-[16/10] lg:aspect-auto lg:h-full" : "aspect-[16/10]"}
                    position="50% 22%"
                    sizes={big ? "(min-width: 1024px) 50vw, (min-width: 640px) 90vw, 92vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 92vw"}
                    className="h-full"
                    nameClassName={big ? "text-[clamp(2.4rem,1.6rem+2.6vw,4.25rem)]" : undefined}
                  >
                    {" "}
                    <span className="mt-2 flex items-center gap-2.5">
                      <span aria-hidden className="flex gap-1">
                        {r.heroes.slice(0, big ? 8 : 4).map((x) => (
                          <HeroPortrait
                            key={x.slug}
                            source={x.images.icon ?? x.images.portrait}
                            name={x.name}
                            size={big ? "small" : "mini"}
                            decorative
                          />
                        ))}
                      </span>
                      <span className="text-sm font-semibold text-chalk-200">{heroCount(r.heroes.length)}</span>
                    </span>
                  </ArtTile>
                </li>
              );
            })}
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
            {/* A faction is a group photo: its members' portraits shoulder to shoulder, the names under it as links. */}
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
              {factions.map((f) => {
                const members = f.heroes.flatMap((s) => {
                  const x = heroesBySlug.get(s);
                  return x ? [x] : [];
                });
                return (
                  <li key={f.key} className="bevel min-w-0 bg-night-900 p-4">
                    <div aria-hidden className="flex h-28 gap-1 overflow-hidden sm:h-36">
                      {members.slice(0, 6).map((x) => (
                        <span key={x.slug} className="bevel-sm relative min-w-0 flex-1 overflow-hidden bg-night-800">
                          {(x.images.portrait ?? x.images.icon) && (
                            <Image
                              src={(x.images.portrait ?? x.images.icon)!}
                              alt=""
                              fill
                              sizes="8rem"
                              className="object-cover object-top"
                            />
                          )}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 flex items-baseline justify-between gap-3">
                      <span className="display-caps text-2xl text-chalk-100">{f.name}</span>
                      <span className="shrink-0 text-xs text-chalk-500">{heroCount(f.heroes.length)}</span>
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {f.heroes.map((s) => (
                        <li key={s}>
                          <Link
                            href={`/heroes/${s}#story`}
                            className="bevel-sm inline-block bg-night-800 px-2 py-1 text-xs text-chalk-200 transition-colors hover:bg-night-700 hover:text-gold-300"
                          >
                            {heroNames.get(s) ?? s}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
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
                  x.images.portrait ?? x.images.icon,
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

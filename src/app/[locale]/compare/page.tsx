import type { Metadata } from "next";
import { DuelTile } from "@/components/compare/hero-tile-row";
import { heroArt } from "@/components/hero-art";
import { HeroComparator, type BoundsRank, type HeroComparable, type RateRank } from "@/components/hero-comparator";
import { PageHeader, SectionTitle } from "@/components/ui";
import { counters, allHeroes, heroesBySlug } from "@/lib/data";
import { rankingFull, rankingOfRank, RANKS_CLASSES, statsByRank } from "@/lib/tier-list";
import { longDate, patchCurrent } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { measuredOpponents, pathPair, segmentPair } from "@/lib/pairs";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { createT, messagesPage } from "@/i18n/translations";
import { dataTool, metaPage } from "@/i18n/seo";

/** Description built from data: comparable heroes, measurement date and patch. */
function descriptionComparator(locale: Locale): string {
  const t = createT(locale);
  return t("pages.seo.compare.descriptionThree", { n: allHeroes.length, date: longDate(locale), v: patchCurrent.version });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.compare.title", { v: patchCurrent.version }),
    description: descriptionComparator(locale),
    share: t("pages.compare.ogDescription"),
    path: "/compare",
    card: true,
  });
}

const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * Comparator catalog: rates by rank as compact triplets (win,
 * ban, tier) — six ranks for 133 heroes fit in the page without weighing it down.
 */
const comparables: HeroComparable[] = allHeroes.map((h) => ({
  slug: h.slug,
  name: h.name,
  icon: h.images.icon ?? h.images.portrait,
  portrait: h.images.portrait ?? h.images.icon,
  art: heroArt(h.slug),
  roles: h.roles,
  lanes: h.lanes,
  notes: h.ratings,
  rate: Object.fromEntries(
    Object.entries(statsByRank(h.slug)).map(([r, s]) => [r, [tenth(s.winRate), tenth(s.banRate), s.tier] satisfies RateRank]),
  ),
  skins: h.skins.length,
}));

/** Rate range of each rank, over the whole catalog: the scale of the radar's "rate" axes. */
const bounds: Partial<Record<(typeof RANKS_CLASSES)[number], BoundsRank>> = Object.fromEntries(
  RANKS_CLASSES.map((r) => {
    const entries = rankingOfRank(r);
    const extent = (values: number[]): [number, number] => [Math.min(...values), Math.max(...values)];
    return [r, { win: extent(entries.map((e) => e.winRate)), ban: extent(entries.map((e) => e.banRate)) }];
  }),
);

/**
 * Head-to-heads featured under the tool: for each of the top-ranked
 * heroes, its most one-sided measured duel. The search engines' path to the
 * `/compare/{a}-vs-{b}` pages, which no menu lists.
 */
const FEATURED_DUELS = 12;
function featuredDuels(): { a: string; b: string }[] {
  const seen = new Set<string>();
  const output: { a: string; b: string }[] = [];
  for (const e of rankingFull) {
    const other = measuredOpponents(counters, e.hero.slug).find(
      (x) => heroesBySlug.has(x.slug) && !seen.has(segmentPair(e.hero.slug, x.slug)),
    );
    if (!other) continue;
    seen.add(segmentPair(e.hero.slug, other.slug));
    output.push({ a: e.hero.slug, b: other.slug });
    if (output.length === FEATURED_DUELS) break;
  }
  return output;
}

export default async function ComparePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const nameOf = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;

  const structuredData = dataTool(locale, {
    name: t("pages.compare.title"),
    description: descriptionComparator(locale),
    path: "/compare",
    category: "GameApplication",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PageHeader
        title={t("pages.compare.title")}
        lead={t("pages.compare.leadThree")}
      />
      <div className="page-wrap pb-14 pt-6 sm:pt-8">
        <ExtendMessages messages={messagesPage(locale, ["compareUI"])}>
          <HeroComparator heroes={comparables} ranks={[...RANKS_CLASSES]} bounds={bounds} />
        </ExtendMessages>

        <div aria-hidden className="eclat-rule mt-14 sm:mt-20" />
        <section aria-labelledby="duels" className="mt-10 sm:mt-14">
          <SectionTitle id="duels" lead={t("pages.compare.duels.intro")}>
            {t("pages.compare.duels.title")}
          </SectionTitle>
          <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
            {featuredDuels().map(({ a, b }) => (
              <li key={segmentPair(a, b)}>
                <DuelTile href={pathPair(a, b)} a={a} b={b} label={t("pages.versus.title", { a: nameOf(a), b: nameOf(b) })} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

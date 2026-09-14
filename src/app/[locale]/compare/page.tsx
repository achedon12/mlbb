import type { Metadata } from "next";
import Link from "@/components/link";
import { HeroComparator, type BoundsRank, type HeroComparable, type RateRank } from "@/components/hero-comparator";
import { PageHeader } from "@/components/ui";
import { counters, allHeroes, heroesBySlug } from "@/lib/data";
import { rankingFull, rankingOfRank, RANKS_CLASSES, statsByRank } from "@/lib/tier-list";
import { longDate, patchCurrent } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { measuredOpponents, pathPair, segmentPair } from "@/lib/pairs";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
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

  const link = "bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400";

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
      <div className="mx-auto max-w-3xl px-4 py-12">
        <HeroComparator heroes={comparables} ranks={[...RANKS_CLASSES]} bounds={bounds} />

        <section aria-labelledby="duels" className="mt-14">
          <h2 id="duels" className="font-heading text-xl font-bold text-chalk-100">
            {t("pages.compare.duels.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-chalk-500">{t("pages.compare.duels.intro")}</p>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {featuredDuels().map(({ a, b }) => (
              <li key={segmentPair(a, b)}>
                <Link href={pathPair(a, b)} className={link}>
                  {t("pages.versus.title", { a: nameOf(a), b: nameOf(b) })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

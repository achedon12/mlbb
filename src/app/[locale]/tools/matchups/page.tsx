import type { Metadata } from "next";
import Link from "@/components/link";
import { MatchupMatrix } from "@/components/matchup-matrix";
import { PageHeader } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { dataTool, metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { allHeroes, counters, heroesBySlug } from "@/lib/data";
import { longDate, patchCurrent } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { coverage, gapOf, measuredGaps, SIZE_SIDE } from "@/lib/matchups";
import { rankingFull, RANKS_CLASSES } from "@/lib/tier-list";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/tools/matchups";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.matchups.title"),
    description: t("pages.seo.matchups.description", { n: allHeroes.length }),
    path: PATH,
    keywords: ["matchup chart", "matchup matrix", "counter", "win rate", "Mobile Legends", "MLBB"],
  });
}

const exists = (slug: string) => heroesBySlug.has(slug);

/** The roster, reduced to what the picker shows: names and icons, no rate. */
const roster = allHeroes.map((h) => ({
  slug: h.slug,
  name: h.name,
  lanes: h.lanes,
  roles: h.roles,
  icon: h.images.icon ?? h.images.portrait,
}));

/**
 * Example lineups, measured at all ranks: the best-ranked hero against its
 * most one-sided opponents, then the hero with the most measured duels
 * against those same opponents. The first visit shows a filled matrix
 * rather than an empty grid.
 */
function exampleLineups(): { rows: string[]; columns: string[] } {
  const gaps = measuredGaps(counters, "all", exists);
  const first = rankingFull[0]?.hero.slug;
  if (!first) return { rows: [], columns: [] };
  const columns = allHeroes
    .flatMap((h) => {
      const gap = gapOf(gaps, first, h.slug);
      return gap === null ? [] : [{ slug: h.slug, size: Math.abs(gap) }];
    })
    .sort((a, b) => b.size - a.size || a.slug.localeCompare(b.slug))
    .slice(0, SIZE_SIDE)
    .map((x) => x.slug);
  const measuredAgainst = (slug: string) => columns.filter((c) => gapOf(gaps, slug, c) !== null).length;
  const second = rankingFull
    .map((e) => e.hero.slug)
    .filter((s) => s !== first && !columns.includes(s))
    .reduce<string | null>((best, s) => (best === null || measuredAgainst(s) > measuredAgainst(best) ? s : best), null);
  return { rows: second ? [first, second] : [first], columns };
}

export default async function MatchupsPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const structuredData = dataTool(locale, {
    name: t("pages.matchups.title"),
    description: t("pages.seo.matchups.description", { n: allHeroes.length }),
    path: PATH,
    category: "GameApplication",
  });

  // Share of the possible duels measured, lowest and highest over the ranks.
  const shares = RANKS_CLASSES.map((r) => coverage(measuredGaps(counters, r, exists), allHeroes.length));
  const possible = shares[0]?.possible ?? 0;
  const measured = shares.map((s) => s.measured);
  const integer = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const percent = new Intl.NumberFormat(LOCALE_HTML[locale], { style: "percent", maximumFractionDigits: 0 });

  const sectionTitle = "font-heading text-2xl font-bold text-chalk-100";
  const link = "font-semibold text-gold-400 transition-colors hover:text-gold-500";

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.matchupsUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader title={t("pages.matchups.title")} lead={t("pages.matchups.lead")} />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <MatchupMatrix heroes={roster} ranks={[...RANKS_CLASSES]} example={exampleLineups()} />

        <p className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/compare" className={link}>
            {t("pages.matchups.compareLink")} →
          </Link>
          <Link href="/draft" className={link}>
            {t("pages.matchups.draftLink")} →
          </Link>
        </p>

        <section aria-labelledby="method-title">
          <h2 id="method-title" className={sectionTitle}>
            {t("pages.matchups.methodTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-chalk-300">
            <p>{t("pages.matchups.method1")}</p>
            <p>{t("pages.matchups.method2")}</p>
            {possible > 0 && (
              <p>
                {t("pages.matchups.method3", {
                  min: integer.format(Math.min(...measured)),
                  max: integer.format(Math.max(...measured)),
                  total: integer.format(possible),
                  share: percent.format(Math.max(...measured) / possible),
                })}
              </p>
            )}
            <p className="text-sm text-chalk-500">
              {t("pages.matchups.measuredOn", { date: longDate(locale), v: patchCurrent.version })}
            </p>
          </div>
        </section>
      </div>
    </ExtendMessages>
  );
}

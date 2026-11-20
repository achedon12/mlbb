import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import Link from "@/components/link";
import {
  formatPrize,
  SourceCredit,
  StatusBadge,
  tournamentDates,
  wholePercent,
} from "@/components/esports-parts";
import { TeamCrest, TournamentCard, tournamentArt } from "@/components/esports-broadcast";
import { EditorialPoster, ENTRANCE, firstWithArt } from "@/components/editorial-poster";
import { HeroTile } from "@/components/hero-tile";
import { Dex } from "@/components/mascot";
import { PageLead } from "@/components/page-lead";
import { CardsTable } from "@/components/cards-table";
import { HeroPortrait } from "@/components/hero-portrait";
import { Foldable } from "@/components/foldable";
import { Score, SectionTitle } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import {
  META_WINDOW_DAYS,
  NOTABLE_PRO_PRESENCE,
  NOTABLE_RANKED_RANK,
  proMeta,
  proVsRanked,
  sortedTournaments,
  tournamentStatus,
  type ProHero,
  type ProVsRankedRow,
} from "@/lib/esports";
import { listNames, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale }> };

/**
 * Esports hub: the covered tournaments, the pro meta over the recent ones and
 * the pro vs ranked comparison. Every figure is a count over the drafts
 * recorded on Liquipedia; the page states its window and its method.
 */
const PATH = "/esports";

const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  const meta = proMeta();
  const picked = meta.picked[0];
  const banned = meta.banned[0];
  return metaPage(locale, {
    title: t("pages.esports.seo.hubTitle"),
    description:
      picked && banned
        ? t("pages.esports.seo.hubDescription", { games: meta.games, picked: heroName(picked.slug), banned: heroName(banned.slug) })
        : t("pages.esports.intro"),
    path: PATH,
    card: true,
  });
}

export default async function EsportsPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const now = new Date();
  const list = sortedTournaments(now);
  const meta = proMeta(now);
  const versus = proVsRanked(now);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("pages.esports.seo.hubTitle"),
    description: t("pages.esports.intro"),
    url: `${site.url}/${locale}${PATH}`,
    inLanguage: LOCALE_HTML[locale],
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: list.length,
      itemListElement: list.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: x.name,
        url: `${site.url}/${locale}/esports/${x.slug}`,
      })),
    },
  };

  // The poster: the tournament being played, else the next one, else the latest.
  const featured =
    list.find((x) => tournamentStatus(x, now) === "live") ??
    list.find((x) => tournamentStatus(x, now) === "upcoming") ??
    list[0];
  const featuredStatus = featured ? tournamentStatus(featured, now) : null;
  const shown = new Set<string>();
  const posterArt =
    (featured && tournamentArt(featured, shown)?.art) ??
    firstWithArt(meta.picked.map((h) => h.slug))?.art ??
    null;
  const featuredDates = featured ? tournamentDates(t, locale, featured) : null;
  const winners = meta.winners.filter((h) => heroesBySlug.has(h.slug));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <EditorialPoster
        art={posterArt}
        crumbs={[{ name: t("pages.esports.title") }]}
        aside={
          featured?.prizePool ? (
            <p className="lg:text-right">
              <Score value={formatPrize(locale, featured.prizePool)} className="text-[clamp(3rem,2rem+3vw,5.5rem)]" />
              <span className="mt-2 block text-sm text-chalk-300">{t("pages.esports.facts.prize")}</span>
            </p>
          ) : undefined
        }
      >
        <h1 className="display-caps text-[clamp(2.4rem,1.7rem+2.6vw,4rem)] text-chalk-100">{t("pages.esports.title")}</h1>
        <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
        <PageLead lead={t("pages.esports.intro")} />
        {featured && featuredStatus && (
          <Link href={`/esports/${featured.slug}`} className="group mt-8 block w-fit max-w-full">
            <StatusBadge status={featuredStatus} t={t} />
            <span className="affiche-name type-giant mt-3 block break-words text-chalk-100 transition-colors group-hover:text-gold-300">
              {featured.shortName}
            </span>
            <span className="mt-2 block font-heading text-xl font-bold text-chalk-200">{featured.name}</span>
            {featuredDates && <span className="mt-1 block text-chalk-300">{featuredDates}</span>}
            {featured.champion && (
              <span className="mt-5 flex items-center gap-4">
                <TeamCrest name={featured.champion} size="lg" champion />
                <span>
                  <span className="flex items-center gap-1.5 font-heading font-bold uppercase text-gold-400">
                    <Trophy size={16} aria-hidden />
                    {t("pages.esports.facts.champion")}
                  </span>
                  <span className="display-caps mt-1 block text-4xl text-gold-400">{featured.champion}</span>
                </span>
              </span>
            )}
          </Link>
        )}
      </EditorialPoster>

      <div className={cn("page-wrap space-y-12 pb-12 pt-10 sm:space-y-20 sm:pt-14", ENTRANCE)}>
        <section aria-labelledby="esports-tournaments">
          <SectionTitle id="esports-tournaments" lead={t("pages.esports.tournaments.intro")}>
            {t("pages.esports.tournaments.title")}
          </SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {list.map((x) => (
              <li key={x.slug}>
                <TournamentCard turn={x} t={t} locale={locale} now={now} art={tournamentArt(x, shown)?.art ?? null} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="esports-meta">
          <SectionTitle
            id="esports-meta"
            lead={
              meta.games > 0
                ? t("pages.esports.meta.intro", {
                    games: meta.games,
                    tournaments: listNames(locale, meta.tournaments.map((x) => x.shortName)),
                    days: META_WINDOW_DAYS,
                  })
                : undefined
            }
          >
            {t("pages.esports.meta.title")}
          </SectionTitle>
          {meta.games === 0 ? (
            <div className="flex items-end gap-4">
              <Dex pose="surpris" height={120} />
              <p className="pb-4 text-chalk-300">{t("pages.esports.meta.none")}</p>
            </div>
          ) : (
            <div className="space-y-10">
              <HeroRow
                title={t("pages.esports.meta.picked")}
                heroes={meta.picked}
                figure={(h) => String(h.picks)}
                label={(h) =>
                  `${t("pages.esports.meta.picks", { n: h.picks })}, ${t("pages.esports.meta.presence", { value: percentage(locale, h.presence) })}`
                }
              />
              <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
                <HeroRow
                  title={t("pages.esports.meta.banned")}
                  heroes={meta.banned}
                  figure={(h) => String(h.bans)}
                  label={(h) =>
                    `${t("pages.esports.meta.bans", { n: h.bans })}, ${t("pages.esports.meta.presence", { value: percentage(locale, h.presence) })}`
                  }
                  tone="enemy"
                  narrow
                />
                <div>
                  <h3 className="type-subtitle text-chalk-100">{t("pages.esports.meta.winners")}</h3>
                  <p className="mt-1 text-xs text-chalk-500">{t("pages.esports.meta.winnersNote", { n: meta.minimum })}</p>
                  <ol className="mt-3 divide-y divide-night-800">
                    {winners.map((h, i) => {
                      const hero = heroesBySlug.get(h.slug)!;
                      return (
                        <li key={h.slug}>
                          <Link href={`/heroes/${h.slug}`} className="group flex items-center gap-3 py-2">
                            <span aria-hidden className="score score-outline w-7 text-2xl">
                              {i + 1}
                            </span>
                            <HeroPortrait source={hero.images.icon ?? hero.images.portrait} name={hero.name} size="small" decorative />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-heading font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-400">
                                {hero.name}
                              </span>
                              <span className="block text-xs text-chalk-500">
                                {t("pages.esports.meta.record", { wins: h.wins, losses: h.losses })}
                              </span>
                            </span>
                            <span className="score text-2xl text-azure-400">{percentage(locale, h.winRate ?? 0)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="esports-versus">
          <SectionTitle id="esports-versus" lead={t("pages.esports.versus.intro", { total: versus.total })}>
            {t("pages.esports.versus.title")}
          </SectionTitle>
          {/*
            The comparison is the page's follow-up question, not its subject:
            twenty rows of two tables stay in the document, folded under the
            sentence that says what they show.
          */}
          <Foldable label={t("pages.esports.versus.open", { n: versus.proFavorites.length + versus.rankedFavorites.length })}>
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
            <VersusTable
              title={t("pages.esports.versus.pro")}
              note={t("pages.esports.versus.proNote", { min: wholePercent(locale, NOTABLE_PRO_PRESENCE) })}
              rows={versus.proFavorites}
              t={t}
              locale={locale}
            />
            <VersusTable
              title={t("pages.esports.versus.ranked")}
              note={t("pages.esports.versus.rankedNote", { n: NOTABLE_RANKED_RANK })}
              rows={versus.rankedFavorites}
              t={t}
              locale={locale}
            />
          </div>
          </Foldable>
        </section>

        {/*
          Reading key and the list of wiki pages the figures come from: a
          reader must be able to check them, but they are not what the page is
          about. They close it, folded.
        */}
        <Foldable label={t("common.method")}>
          <p className="max-w-3xl text-xs leading-relaxed text-chalk-500">{t("pages.esports.method")}</p>
          <SourceCredit t={t} locale={locale} sources={list.flatMap((x) => x.sources)} className="mt-4" />
        </Foldable>
      </div>
    </>
  );
}

/**
 * A top list as a row of portraits: the count in gold (red for bans) on each,
 * the sentence a screen reader hears beside it.
 */
function HeroRow({
  title,
  heroes,
  figure,
  label,
  tone = "gold",
  narrow = false,
}: {
  title: string;
  heroes: ProHero[];
  figure: (h: ProHero) => string;
  label: (h: ProHero) => string;
  tone?: "gold" | "enemy";
  /** In the wide column of a two-column row: fewer portraits a line. */
  narrow?: boolean;
}) {
  return (
    <div>
      <h3 className={cn("type-subtitle", tone === "enemy" ? "text-blood-400" : "text-chalk-100")}>{title}</h3>
      <ol className={cn("mt-3 grid grid-cols-4 gap-2 sm:gap-3", narrow ? "sm:grid-cols-4 xl:grid-cols-6" : "sm:grid-cols-6 lg:grid-cols-8")}>
        {heroes.map((h, i) => {
          const hero = heroesBySlug.get(h.slug);
          if (!hero) return null;
          return (
            <li key={h.slug}>
              <HeroTile
                href={`/heroes/${h.slug}`}
                name={hero.name}
                portrait={hero.images.portrait ?? hero.images.icon}
                figure={figure(h)}
                label={label(h)}
                rank={i + 1}
                tone={tone}
                sizes={narrow ? "(min-width: 1280px) 9vw, (min-width: 640px) 15vw, 23vw" : "(min-width: 1024px) 10vw, (min-width: 640px) 15vw, 23vw"}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function VersusTable({
  title,
  note,
  rows,
  t,
  locale,
}: {
  title: string;
  note: string;
  rows: ProVsRankedRow[];
  t: T;
  locale: Locale;
}) {
  // min-w-0: as a grid item, the table's minimum width would otherwise widen the page.
  return (
    <div className="min-w-0">
      <h3 className="type-subtitle text-chalk-100">{title}</h3>
      <p className="mt-1 mb-3 text-xs text-chalk-500">{note}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-chalk-500">{t("pages.esports.versus.none")}</p>
      ) : (
        // Four columns of rates needed 26 rem and were put in a sideways
        // scroller: they fit a 390 px screen once the cells stop reserving a
        // minimum width. Still a table — a card would cost a line per hero.
        <div className="bevel bg-night-900">
          <CardsTable
            t={t}
            cards={false}
            caption={title}
            rows={rows.filter((r) => heroesBySlug.has(r.slug))}
            rowKey={(r) => r.slug}
            columns={[
              {
                key: "hero",
                label: t("pages.esports.versus.hero"),
                head: true,
                className: "max-sm:w-[38%]",
                cell: (r) => {
                  const hero = heroesBySlug.get(r.slug)!;
                  return (
                    <Link href={`/heroes/${r.slug}`} className="group flex items-center gap-2">
                      <HeroPortrait
                        source={hero.images.icon ?? hero.images.portrait}
                        name={hero.name}
                        size="mini"
                        decorative
                      />
                      <span className="truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                        {hero.name}
                      </span>
                    </Link>
                  );
                },
              },
              {
                key: "pro",
                label: t("pages.esports.versus.proColumn"),
                className: "text-chalk-100",
                cell: (r) => t("pages.esports.versus.cell", { value: percentage(locale, r.proPresence), rank: r.proRank }),
              },
              {
                key: "ranked",
                label: t("pages.esports.versus.rankedColumn"),
                className: "text-chalk-300",
                cell: (r) =>
                  t("pages.esports.versus.cell", { value: percentage(locale, r.rankedPresence), rank: r.rankedRank }),
              },
              {
                key: "gap",
                label: t("pages.esports.versus.gapColumn"),
                cell: (r) => (
                  <span className={cn("font-semibold", r.gap > 0 ? "text-azure-400" : "text-blood-400")}>
                    {t("pages.esports.versus.gap", { n: r.gap > 0 ? `+${r.gap}` : r.gap })}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

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
import { CardsTable } from "@/components/cards-table";
import { HeroPortrait } from "@/components/hero-portrait";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
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
  type Tournament,
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PageHeader title={t("pages.esports.title")} lead={t("pages.esports.intro")} />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section>
          <SectionTitle lead={t("pages.esports.tournaments.intro")}>{t("pages.esports.tournaments.title")}</SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((x) => (
              <li key={x.slug}>
                <TournamentCard turn={x} t={t} locale={locale} now={now} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle
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
            <p className="text-sm text-chalk-500">{t("pages.esports.meta.none")}</p>
          ) : (
            <div className="grid gap-8 md:grid-cols-3">
              <HeroList
                title={t("pages.esports.meta.picked")}
                heroes={meta.picked}
                value={(h) => t("pages.esports.meta.picks", { n: h.picks })}
                detail={(h) => t("pages.esports.meta.presence", { value: percentage(locale, h.presence) })}
              />
              <HeroList
                title={t("pages.esports.meta.banned")}
                heroes={meta.banned}
                value={(h) => t("pages.esports.meta.bans", { n: h.bans })}
                detail={(h) => t("pages.esports.meta.presence", { value: percentage(locale, h.presence) })}
              />
              <HeroList
                title={t("pages.esports.meta.winners")}
                note={t("pages.esports.meta.winnersNote", { n: meta.minimum })}
                heroes={meta.winners}
                value={(h) => percentage(locale, h.winRate ?? 0)}
                detail={(h) => t("pages.esports.meta.record", { wins: h.wins, losses: h.losses })}
              />
            </div>
          )}
        </section>

        <section>
          <SectionTitle lead={t("pages.esports.versus.intro", { total: versus.total })}>
            {t("pages.esports.versus.title")}
          </SectionTitle>
          <div className="grid gap-8 lg:grid-cols-2">
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
        </section>

        <div>
          <p className="max-w-3xl text-xs leading-relaxed text-chalk-500">{t("pages.esports.method")}</p>
          <SourceCredit t={t} locale={locale} sources={list.flatMap((x) => x.sources)} className="mt-6" />
        </div>
      </div>
    </>
  );
}

function TournamentCard({ turn, t, locale, now }: { turn: Tournament; t: T; locale: Locale; now: Date }) {
  const dates = tournamentDates(t, locale, turn);
  return (
    <Link href={`/esports/${turn.slug}`} className="group block h-full">
      <Card className="flex h-full flex-col gap-3 group-hover:border-gold-500/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-chalk-500">{turn.shortName}</p>
            <h3 className="font-heading text-lg font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
              {turn.name}
            </h3>
          </div>
          <StatusBadge status={tournamentStatus(turn, now)} t={t} />
        </div>
        <ul className="space-y-1 text-sm text-chalk-300">
          {dates && <li>{dates}</li>}
          {turn.prizePool && <li>{t("pages.esports.card.prize", { amount: formatPrize(locale, turn.prizePool) })}</li>}
          {turn.teamCount && <li>{t("pages.esports.card.teams", { n: turn.teamCount })}</li>}
          {turn.champion && (
            <li className="flex items-center gap-1.5 font-semibold text-gold-400">
              <Trophy size={14} aria-hidden />
              {t("pages.esports.card.champion", { team: turn.champion })}
            </li>
          )}
        </ul>
        <p className="mt-auto flex items-center justify-between gap-2 text-xs text-chalk-500">
          <span>{turn.games ? t("pages.esports.card.games", { n: turn.games }) : t("pages.esports.card.noGames")}</span>
          <span aria-hidden className="font-semibold text-gold-400">
            →
          </span>
        </p>
      </Card>
    </Link>
  );
}

/** A top list: portrait, name, a detail under the name, the value on the right. */
function HeroList({
  title,
  note,
  heroes,
  value,
  detail,
}: {
  title: string;
  note?: string;
  heroes: ProHero[];
  value: (h: ProHero) => string;
  detail: (h: ProHero) => string;
}) {
  return (
    <div>
      <h3 className="font-heading text-lg font-bold text-chalk-100">{title}</h3>
      {note && <p className="mt-1 text-xs text-chalk-500">{note}</p>}
      <ol className="mt-3 space-y-2">
        {heroes.map((h) => {
          const hero = heroesBySlug.get(h.slug);
          if (!hero) return null;
          return (
            <li key={h.slug}>
              <Link
                href={`/heroes/${h.slug}`}
                className="bevel-sm group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2 transition-colors hover:border-gold-500/60"
              >
                <HeroPortrait source={hero.images.icon ?? hero.images.portrait} name={hero.name} size="small" decorative />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                    {hero.name}
                  </span>
                  <span className="block text-xs text-chalk-500">{detail(h)}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-gold-400">{value(h)}</span>
              </Link>
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
      <h3 className="font-heading text-lg font-bold text-chalk-100">{title}</h3>
      <p className="mt-1 mb-3 text-xs text-chalk-500">{note}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-chalk-500">{t("pages.esports.versus.none")}</p>
      ) : (
        // Four columns of rates needed 26 rem and were put in a sideways
        // scroller: they fit a 390 px screen once the cells stop reserving a
        // minimum width. Still a table — a card would cost a line per hero.
        <div className="sm:border sm:border-night-700/70">
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
                  <span className={cn("font-semibold", r.gap > 0 ? "text-emerald-400" : "text-blood-500")}>
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

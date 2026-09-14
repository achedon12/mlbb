import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RankBadge } from "@/components/rank-badge";
import { Breadcrumb } from "@/components/breadcrumb";
import { RecentMatches } from "@/components/recent-matches";
import {
  AnalysisInProgress,
  PlayerSummary,
  HeroTips,
  StateProfile,
  ListNemeses,
  NavSeasons,
  SectionUnavailable,
  SectionProfile,
  HeroTable,
} from "@/components/player-profile";
import { EvolutionPlayer, HeroRankSheets, TableRoles } from "@/components/player-profile-analysis";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage } from "@/i18n/seo";
import { createT, messagesPage, type T } from "@/i18n/translations";
import {
  WINDOW_SHAPE,
  MATCHES_MIN_ROLE,
  evolution,
  heroRankSheets,
  statsByPosition,
  statsByRole,
} from "@/lib/player-analysis";
import { plural } from "@/lib/player-format";
import type { MatchSummary } from "@/lib/player-api";
import {
  detailsMatches,
  seasonHeroes,
  historyMatches,
  pageMatches,
  seasons,
  statistics,
  type Result,
} from "@/lib/mlbb-auth";
import {
  ANALYZED_MATCHES,
  MATCHES_MIN,
  showMatch,
  summarySeason,
  nemeses,
  compareHeroes,
  belowAverageHeroes,
  bestHero,
  bucketOfRank,
} from "@/lib/player-profile";
import { readableRank } from "@/lib/ranks";
import { sessionPlayer } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return {
    ...metaPage(locale, {
      title: t("pages.accountProfile.metaTitle"),
      description: t("pages.accountProfile.metaDescription"),
      path: "/account/profile",
    }),
    robots: { index: false, follow: false },
  };
}

/** Personal page: never cached. The service's responses are, briefly, on the server. */
export const dynamic = "force-dynamic";

/** Heroes shown in the table; the summary counts all of them. */
const SHOWN_HEROES = 10;

type History = Promise<Result<{ matches: MatchSummary[]; end: boolean }>>;

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ season?: string | string[] }>;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  const t = createT(locale);
  const session = await sessionPlayer();
  if (session.state === "missing") redirect(`/${locale}/login`);

  const frame = (content: React.ReactNode) => (
    <ExtendMessages messages={messagesPage(locale, ["pages.accountProfile"])}>
      <div className="mx-auto max-w-4xl px-4 py-14">
        <Breadcrumb
          crumbs={[{ name: t("pages.account.metaTitle"), href: "/account" }, { name: t("pages.accountProfile.title") }]}
          className="mb-8"
        />
        {content}
      </div>
    </ExtendMessages>
  );

  if (session.state !== "ok") return frame(<StateProfile type={session.state} t={t} />);
  const { token, profile } = session;

  // Seasons first: every other route requires them. `/stats` carries
  // them too, which serves as a fallback when `/season` does not answer.
  const [stats, listSeasons] = await Promise.all([statistics(token), seasons(token)]);
  if (stats.status === "expired" || listSeasons.status === "expired") return frame(<StateProfile type="expired" t={t} />);

  const sids =
    listSeasons.status === "ok" && listSeasons.data.length > 0
      ? listSeasons.data
      : stats.status === "ok"
        ? stats.data.seasons
        : [];
  if (sids.length === 0) {
    const outage = listSeasons.status !== "ok" && stats.status !== "ok";
    return frame(<StateProfile type={outage ? "unavailable" : "empty"} t={t} />);
  }

  const requested = Number([search.season].flat()[0]);
  const season = sids.includes(requested) ? requested : sids[0];

  const [seasonHeroList, first] = await Promise.all([seasonHeroes(token, season), pageMatches(token, season, null)]);
  if (seasonHeroList.status === "expired" || first.status === "expired") return frame(<StateProfile type="expired" t={t} />);

  // History started here, awaited further down under `Suspense`: the
  // following pages load while the rest of the profile renders. The first one
  // is already in memory. Without it, no point insisting.
  const history: History | null = first.status === "ok" ? historyMatches(token, season) : null;

  const rank = readableRank(profile.rankCurrent);
  const bucket = bucketOfRank(profile.rankCurrent);
  const rows = seasonHeroList.status === "ok" ? compareHeroes(seasonHeroList.data.heroes, bucket) : null;
  const matches = first.status === "ok" ? first.data.entries : null;
  const nameBucket = t(`measuredRanks.${bucket}`);
  const waiting = (height: string) => (
    <AnalysisInProgress t={t} text={t("pages.accountProfile.historyPending")} className={`mt-6 ${height}`} />
  );

  return frame(
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold text-chalk-100">{t("pages.accountProfile.title")}</h1>
          <div aria-hidden className="gold-rule mt-3 h-0.5 w-16" />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk-500">
            {t("pages.accountProfile.lead", { name: profile.name })}
          </p>
        </div>
        <RankBadge rank={rank} size="sm" />
      </header>

      {sids.length > 1 && <NavSeasons seasons={sids} current={season} t={t} />}

      <SectionProfile id="summary" title={t("pages.accountProfile.summaryTitle", { n: season })}>
        {seasonHeroList.status === "ok" ? (
          <PlayerSummary
            summary={summarySeason(seasonHeroList.data.heroes)}
            full={seasonHeroList.data.full}
            rank={rank}
            stats={stats.status === "ok" ? stats.data : null}
            t={t}
            locale={locale}
          />
        ) : (
          <SectionUnavailable t={t} />
        )}
      </SectionProfile>

      <SectionProfile
        id="evolution"
        title={t("pages.accountProfile.trendTitle")}
        lead={t("pages.accountProfile.trendIntro", { n: WINDOW_SHAPE })}
      >
        {history === null ? (
          <SectionUnavailable t={t} />
        ) : (
          <Suspense fallback={waiting("min-h-[20rem]")}>
            <DeferredEvolution history={history} t={t} locale={locale} />
          </Suspense>
        )}
      </SectionProfile>

      <SectionProfile
        id="lanes"
        title={t("pages.accountProfile.rolesTitle")}
        lead={t("pages.accountProfile.rolesIntro", { n: MATCHES_MIN_ROLE })}
      >
        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-8">
          {seasonHeroList.status === "ok" ? (
            <TableRoles
              type="roles"
              title={t("pages.accountProfile.byRoleTitle")}
              source={t("pages.accountProfile.byRoleSource")}
              summary={statsByRole(seasonHeroList.data.heroes)}
              t={t}
              locale={locale}
            />
          ) : (
            <SectionUnavailable t={t} />
          )}
          {history === null ? (
            <SectionUnavailable t={t} />
          ) : (
            <Suspense fallback={waiting("min-h-[12rem]")}>
              <DeferredPositions history={history} t={t} locale={locale} />
            </Suspense>
          )}
        </div>
      </SectionProfile>

      <SectionProfile
        id="heroes"
        title={t("pages.accountProfile.heroesTitle")}
        lead={`${t("pages.accountProfile.heroesIntro", { rank: nameBucket })}${
          bucket === "all" ? ` ${t("pages.accountProfile.belowEpicBracket")}` : ""
        }`}
      >
        {rows === null ? (
          <SectionUnavailable t={t} />
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-chalk-500">{t("pages.accountProfile.heroesEmpty")}</p>
        ) : (
          <>
            <HeroTable rows={rows.slice(0, SHOWN_HEROES)} bucket={bucket} t={t} locale={locale} />
            <HeroRankSheets
              sheets={heroRankSheets(rows, bucket, matches ?? [])}
              bucket={bucket}
              t={t}
              locale={locale}
            />
          </>
        )}
      </SectionProfile>

      <SectionProfile
        id="advice"
        title={t("pages.accountProfile.adviceTitle")}
        lead={t("pages.accountProfile.adviceIntro", { n: MATCHES_MIN })}
      >
        <HeroTips
          rows={rows}
          best={rows ? bestHero(rows) : []}
          belowAverage={rows ? belowAverageHeroes(rows) : []}
          bucket={bucket}
          t={t}
          locale={locale}
          opponents={
            matches === null ? (
              <p className="text-sm text-chalk-400">{t("pages.accountProfile.sectionUnavailable")}</p>
            ) : matches.length === 0 ? (
              <p className="text-sm text-chalk-400">{t("pages.accountProfile.nemesesEmpty")}</p>
            ) : (
              <Suspense fallback={<AnalysisInProgress t={t} />}>
                <OpponentAnalysis
                  token={token}
                  season={season}
                  matches={matches}
                  me={{ roleId: profile.roleId, zoneId: profile.zoneId }}
                  t={t}
                  locale={locale}
                />
              </Suspense>
            )
          }
        />
      </SectionProfile>

      <SectionProfile id="games" title={t("pages.accountProfile.gamesTitle")}>
        {first.status === "ok" ? (
          <RecentMatches
            key={season}
            season={season}
            initials={first.data.entries.map(showMatch)}
            next={first.data.next}
          />
        ) : (
          <SectionUnavailable t={t} />
        )}
      </SectionProfile>
    </>,
  );
}

/** History unavailable or session expired, stated in place of a deferred section. */
function HistoryMissing({ state, t }: { state: "expired" | "unavailable"; t: T }) {
  return state === "expired" ? (
    <p className="mt-6 text-sm leading-relaxed text-chalk-400">{t("pages.accountProfile.expiredText")}</p>
  ) : (
    <SectionUnavailable t={t} />
  );
}

/** Season progression: awaits the match history, started by the page. */
async function DeferredEvolution({ history, t, locale }: { history: History; t: T; locale: Locale }) {
  const r = await history;
  if (r.status !== "ok") return <HistoryMissing state={r.status} t={t} />;
  return <EvolutionPlayer evo={evolution(r.data.matches)} end={r.data.end} t={t} locale={locale} />;
}

/** Lanes played over the history read: the same one, shared with the progression. */
async function DeferredPositions({ history, t, locale }: { history: History; t: T; locale: Locale }) {
  const r = await history;
  if (r.status !== "ok") return <HistoryMissing state={r.status} t={t} />;
  const summary = statsByPosition(r.data.matches);
  const n = summary.total + summary.excluded;
  return (
    <TableRoles
      type="lanes"
      title={t("pages.accountProfile.byPositionTitle")}
      source={t(`pages.accountProfile.byPositionSource.${plural(n, locale)}`, { n })}
      summary={summary}
      t={t}
      locale={locale}
    />
  );
}

/**
 * Opponents of the latest games. A separate server component, rendered under
 * `Suspense`: the detail of a dozen games takes time, the rest
 * of the profile does not have to wait for it. The token stays here, on the server.
 */
async function OpponentAnalysis({
  token,
  season,
  matches,
  me,
  t,
  locale,
}: {
  token: string;
  season: number;
  matches: MatchSummary[];
  me: { roleId: number; zoneId: number };
  t: T;
  locale: Locale;
}) {
  const recent = matches.slice(0, ANALYZED_MATCHES);
  const details = await detailsMatches(
    token,
    recent.map((p) => ({ id: p.id, season: p.season ?? season })),
  );
  if (details.status !== "ok") {
    const key = details.status === "expired" ? "expiredText" : "nemesesUnavailable";
    return <p className="text-sm leading-relaxed text-chalk-400">{t(`pages.accountProfile.${key}`)}</p>;
  }

  const analyzed = recent.flatMap((p) => {
    const participants = details.data.get(p.id);
    return participants ? [{ win: p.win, participants }] : [];
  });
  return <ListNemeses analysis={nemeses(analyzed, me)} t={t} locale={locale} />;
}

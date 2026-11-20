import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import {
  formatPartialDate,
  formatPrize,
  labelText,
  shortDate,
  SourceCredit,
  stageName,
  StatusBadge,
  tournamentDates,
  TournamentNav,
} from "@/components/esports-parts";
import { TeamNameLink } from "@/components/esports-pro";
import { Card, Score, SectionTitle } from "@/components/ui";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { TeamCrest, topHeroes, tournamentArt } from "@/components/esports-broadcast";
import { EditorialPoster, ENTRANCE, firstWithArt } from "@/components/editorial-poster";
import { percentText } from "@/components/esports-pro";
import { HeroTile } from "@/components/hero-tile";
import { Dex } from "@/components/mascot";
import { PageLead } from "@/components/page-lead";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT, messagesPage, type T } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import {
  pastEditionRedirect,
  tournamentBySlug,
  tournaments,
  tournamentStatus,
  withRates,
  type Bracket,
  type BracketMatch,
  type DraftMatch,
  type Standing,
  type Tournament,
} from "@/lib/esports";
import { hasPlayerStats, hasTeamPage, proTeams } from "@/lib/esports-players";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { DraftGames } from "./draft-games";
import { HeroStatsTable, type HeroStatRow } from "./hero-stats-table";
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale; tournament: string }> };

/**
 * One tournament: standings and bracket results as the source lists them,
 * hero statistics (sortable) and the latest drafts, game by game (the
 * older matches folded, see `DraftGames`).
 */
export function generateStaticParams() {
  // The current editions only; the older ones are rendered on first
  // request, then cached (src/lib/prerender.ts).
  return tournaments.filter((t) => t.current).map((t) => ({ tournament: t.slug }));
}

const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;

/** "MPL ID Season 18: …", "M7 World Championship: …", "MSC 2026: …". */
function seoTitle(t: T, turn: Tournament): string {
  if (turn.series === "mpl") {
    return t("pages.esports.seo.mplTitle", { league: turn.shortName.replace(/\s+S\d+$/, ""), n: turn.number });
  }
  if (turn.series === "m") return t("pages.esports.seo.mTitle", { n: turn.number });
  return t("pages.esports.seo.mscTitle", { year: turn.number });
}

function seoDescription(t: T, locale: Locale, turn: Tournament): string {
  const [picked] = [...turn.heroes].sort((a, b) => b.picks - a.picks);
  const [banned] = [...turn.heroes].sort((a, b) => b.bans - a.bans);
  if (turn.games > 0 && picked && banned) {
    return t("pages.esports.seo.tournamentDescription", {
      name: turn.name,
      games: turn.games,
      picked: heroName(picked.slug),
      banned: heroName(banned.slug),
    });
  }
  return t("pages.esports.seo.upcomingDescription", {
    name: turn.name,
    date: turn.startDate ? formatPartialDate(locale, turn.startDate) : "",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, tournament } = await params;
  const turn = tournamentBySlug.get(tournament);
  if (!turn) return notFoundMetadata(locale);
  const t = createT(locale);
  return metaPage(locale, {
    title: seoTitle(t, turn),
    description: seoDescription(t, locale, turn),
    path: `/esports/${turn.slug}`,
    card: true,
  });
}

/** Zones marked by the source, drawn as a bar in front of the rank. */
const ZONE_STYLE: Record<string, string> = {
  up: "bg-azure-400",
  seedup: "bg-azure-300",
  stayup: "bg-azure-400",
  stay: "bg-gold-400",
  staydown: "bg-gold-500",
  down: "bg-blood-400",
};
const knownZone = (z: string | null): z is string => z !== null && z in ZONE_STYLE;

export default async function TournamentPage({ params }: Params) {
  const { locale, tournament } = await params;
  const turn = tournamentBySlug.get(tournament);
  if (!turn) {
    // An older edition, not covered: the index lists those that are.
    const target = pastEditionRedirect(locale, tournament);
    if (target) permanentRedirect(target);
    return <NotFoundPage />;
  }
  const t = createT(locale);
  const now = new Date();
  const status = tournamentStatus(turn, now);
  const stages = turn.stages.filter((s) => s.standings.length > 0 || s.brackets.length > 0);
  const rows: HeroStatRow[] = turn.heroes.map((h) => {
    const r = withRates(h, turn.games);
    return {
      slug: h.slug,
      name: heroName(h.slug),
      picks: r.picks,
      bans: r.bans,
      presence: Math.round(r.presence * 10) / 10,
      wins: r.wins,
      losses: r.losses,
      winRate: r.winRate === null ? null : Math.round(r.winRate * 10) / 10,
    };
  });

  const art = tournamentArt(turn);
  const final = finalOf(turn);
  // Heroes the champion drafted, most played first: the art of its highlight.
  const championPicks = new Map<string, number>();
  for (const m of turn.drafts) {
    const side = m.teams.indexOf(turn.champion ?? "");
    if (side < 0) continue;
    for (const g of m.games) for (const slug of g.picks[side] ?? []) championPicks.set(slug, (championPicks.get(slug) ?? 0) + 1);
  }
  const championHeroes = [...championPicks].sort((x, y) => y[1] - x[1]).map(([slug]) => slug);
  const top = topHeroes(turn, 8);

  const fullDate = (d: string | null) => (d && d.length === 10 ? d : undefined);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: turn.name,
    description: seoDescription(t, locale, turn),
    sport: "Mobile Legends: Bang Bang",
    url: `${site.url}/${locale}/esports/${turn.slug}`,
    inLanguage: LOCALE_HTML[locale],
    ...(fullDate(turn.startDate) ? { startDate: fullDate(turn.startDate) } : {}),
    ...(fullDate(turn.endDate) ? { endDate: fullDate(turn.endDate) } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    ...(turn.city || turn.country
      ? {
          location: {
            "@type": "Place",
            name: [turn.city, turn.country].filter(Boolean).join(", "),
            address: {
              "@type": "PostalAddress",
              ...(turn.city ? { addressLocality: turn.city } : {}),
              ...(turn.country ? { addressCountry: turn.country } : {}),
            },
          },
        }
      : {}),
    isBasedOn: turn.sources[0]?.url,
    // Teams with a page, among those listed for this tournament.
    competitor: proTeams
      .filter((team) => hasTeamPage(team.slug) && team.tournaments.some((x) => x.tournament === turn.slug))
      .map((team) => ({ "@type": "SportsTeam", name: team.name, url: `${site.url}/${locale}/esports/teams/${team.slug}` })),
  };

  const dates = tournamentDates(t, locale, turn);
  const location = [turn.city, turn.country].filter(Boolean).join(", ");
  const patch = turn.patch && turn.endPatch && turn.endPatch !== turn.patch ? `${turn.patch} – ${turn.endPatch}` : turn.patch;
  const facts: [string, React.ReactNode][] = [
    ...(dates ? [[t("pages.esports.facts.dates"), dates] as [string, string]] : []),
    ...(turn.teamCount ? [[t("pages.esports.facts.teams"), String(turn.teamCount)] as [string, string]] : []),
    ...(location ? [[t("pages.esports.facts.location"), location] as [string, string]] : []),
    ...(patch ? [[t("pages.esports.facts.patch"), patch] as [string, string]] : []),
    ...(turn.champion ? [[t("pages.esports.facts.champion"), turn.champion] as [string, string]] : []),
    ...(turn.games ? [[t("pages.esports.facts.games"), String(turn.games)] as [string, string]] : []),
  ];

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.esportsUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <EditorialPoster
        art={art?.art ?? null}
        crumbs={[
          { name: t("pages.esports.title"), href: "/esports" },
          {
            name: turn.shortName,
            siblings: tournaments.map((x) => ({ name: x.shortName, href: `/esports/${x.slug}` })),
          },
        ]}
        aside={
          turn.prizePool ? (
            <p className="lg:text-right">
              <Score value={formatPrize(locale, turn.prizePool)} className="text-[clamp(3rem,2rem+3vw,5.5rem)]" />
              <span className="mt-2 block text-sm text-chalk-300">{t("pages.esports.facts.prize")}</span>
            </p>
          ) : undefined
        }
      >
        <StatusBadge status={status} t={t} />
        <h1 className="affiche-name display-caps mt-3 max-w-5xl text-balance text-[clamp(3rem,1.6rem+5vw,7rem)] text-chalk-100">
          {turn.name}
        </h1>
        <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
        <PageLead
          lead={
            turn.games > 0
              ? t("pages.esports.tournament.intro", { name: turn.name, games: turn.games })
              : t("pages.esports.tournament.introUpcoming", { name: turn.name })
          }
        />
        {/* The scoreboard: each fact as a figure in the display face. */}
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-chalk-400">{label}</dt>
              <dd className="display-caps mt-1 text-2xl text-chalk-100 sm:text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
        {hasPlayerStats(turn.slug) && <TournamentNav t={t} turn={turn} active="overview" />}
      </EditorialPoster>

      <div className={cn("page-wrap space-y-16 py-10 sm:space-y-20 sm:py-14", ENTRANCE)}>
        {turn.champion && (
          <ChampionBlock champion={turn.champion} final={final} t={t} heroes={championHeroes} />
        )}

        {stages.length === 0 && (
          <div className="flex items-end gap-4">
            <Dex pose="surpris" height={130} />
            <p className="dex-bubble mb-6 max-w-xl text-chalk-200">{t("pages.esports.empty")}</p>
          </div>
        )}

        {stages.map((stage) => (
          <section key={stage.page}>
            <SectionTitle>{stageName(t, stage.key, stage.title) || turn.shortName}</SectionTitle>
            <div className="space-y-8">
              {stage.standings.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-2">
                  {stage.standings.map((s, i) => (
                    <StandingTable
                      key={i}
                      // A table titled like its stage ("Regular Season") would repeat the heading, untranslated.
                      standing={
                        s.title && !s.label && s.title.toLowerCase() === (stage.title ?? "").toLowerCase()
                          ? { ...s, title: null }
                          : s
                      }
                      caption={
                        (s.title?.toLowerCase() === (stage.title ?? "").toLowerCase() ? null : labelText(t, s.label, s.title)) ??
                        stageName(t, stage.key, stage.title)
                      }
                      t={t}
                      champion={turn.champion}
                    />
                  ))}
                </div>
              )}
              {stage.brackets.map((b, i) => (
                <BracketView key={i} bracket={b} t={t} locale={locale} />
              ))}
            </div>
          </section>
        ))}
        {stages.some((s) => s.standings.length > 0) && (
          <p className="-mt-10 max-w-3xl text-xs leading-relaxed text-chalk-500">
            {t("pages.esports.standings.rating")} {t("pages.esports.zones.rating")}
          </p>
        )}

        {rows.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.heroes.intro", { games: turn.games })}>
              {t("pages.esports.heroes.title")}
            </SectionTitle>
            <ol className="mb-8 grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
              {top.map((h, i) => {
                const hero = heroesBySlug.get(h.slug)!;
                const presence = withRates(h, turn.games).presence;
                return (
                  <li key={h.slug} className={cn(i >= 4 && "max-sm:hidden")}>
                    <HeroTile
                      href={`/heroes/${h.slug}`}
                      name={hero.name}
                      portrait={hero.images.portrait ?? hero.images.icon}
                      figure={percentText(locale, presence)}
                      label={t("pages.esports.meta.presence", { value: percentText(locale, presence) })}
                      rank={i + 1}
                      sizes="(min-width: 640px) 11vw, 23vw"
                    />
                  </li>
                );
              })}
            </ol>
            <HeroStatsTable rows={rows} name={turn.name} />
          </section>
        )}

        {turn.drafts.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.drafts.intro", { n: turn.drafts.length })}>
              {t("pages.esports.drafts.title")}
            </SectionTitle>
            <ol className="grid gap-4 lg:grid-cols-2">
              {turn.drafts.map((m, i) => (
                <li key={`${m.date}-${m.teams.join("-")}`}>
                  <DraftCard match={m} open={i < OPEN_DRAFTS} turn={turn} t={t} locale={locale} />
                </li>
              ))}
            </ol>
          </section>
        )}

        <SourceCredit t={t} locale={locale} sources={turn.sources} />
      </div>
    </ExtendMessages>
  );
}

function StandingTable({ standing, caption, t, champion }: { standing: Standing; caption: string; t: T; champion: string | null }) {
  const zones = [...new Set(standing.rows.map((r) => r.zone).filter(knownZone))];
  const cell = "px-3 py-1.5 text-right";
  return (
    <div className="min-w-0">
      {standing.label || standing.title ? (
        <h3 className="mb-3 type-subtitle text-chalk-100">{caption}</h3>
      ) : null}
      <div className="bevel relative overflow-x-auto bg-night-900">
        <table className="w-full min-w-[22rem] border-collapse text-sm tabular-nums">
          <caption className="sr-only">{t("pages.esports.standings.caption", { title: caption })}</caption>
          <thead className="bg-night-800 font-heading text-sm uppercase text-chalk-400">
            <tr>
              <th scope="col" className="w-12 px-3 py-2 text-left font-bold">
                {t("pages.esports.standings.rank")}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {t("pages.esports.standings.team")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("pages.esports.standings.series")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("pages.esports.standings.games")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("pages.esports.standings.diff")}
              </th>
            </tr>
          </thead>
          <tbody>
            {standing.rows.map((r) => {
              const diff = r.games[0] - r.games[1];
              return (
                <tr key={r.team} className="border-t border-night-800">
                  <td className="display-caps relative px-3 py-1.5 text-xl text-chalk-300">
                    {knownZone(r.zone) && (
                      <span aria-hidden className={cn("absolute inset-y-1 left-0 w-1", ZONE_STYLE[r.zone])} />
                    )}
                    {r.rank}
                    {knownZone(r.zone) && <span className="sr-only">, {t(`pages.esports.zones.${r.zone}`)}</span>}
                  </td>
                  <th scope="row" className="px-3 py-1.5 text-left font-semibold text-chalk-100">
                    <span className="flex items-center gap-2.5">
                      <TeamCrest name={r.team} size="sm" champion={r.team === champion} />
                      <TeamNameLink name={r.team} className="truncate" />
                    </span>
                  </th>
                  <td className={cn(cell, "text-chalk-100")}>
                    {r.series[0]}–{r.series[1]}
                  </td>
                  <td className={cn(cell, "text-chalk-300")}>
                    {r.games[0]}–{r.games[1]}
                  </td>
                  <td className={cn(cell, "text-chalk-500")}>{diff > 0 ? `+${diff}` : diff}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {zones.length > 0 && (
        <ul
          aria-label={t("pages.esports.zones.title")}
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-500"
        >
          {zones.map((z) => (
            <li key={z} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("h-3 w-1", ZONE_STYLE[z])} />
              {t(`pages.esports.zones.${z}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BracketView({ bracket, t, locale }: { bracket: Bracket; t: T; locale: Locale }) {
  const title = labelText(t, bracket.label, bracket.title);
  return (
    <div>
      {title && <h3 className="mb-3 type-subtitle text-chalk-100">{title}</h3>}
      {/* Rounds side by side, left to right, like a broadcast bracket; it scrolls sideways on a phone. */}
      <ol className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
        {bracket.rounds.map((r, i) => (
          <li key={i} className="flex w-64 shrink-0 snap-start flex-col sm:w-72">
            <h4 className="font-heading text-sm font-bold uppercase text-gold-400">
              {labelText(t, r.label, r.title) ?? t("pages.esports.rounds.round", { n: r.number ?? i + 1 })}
            </h4>
            <ul className="mt-2 flex flex-1 flex-col justify-around gap-2">
              {r.matches.map((m, j) => (
                <MatchLine key={j} match={m} t={t} locale={locale} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function placeholderText(t: T, text: string | null): string {
  const seed = /^seed (\d+)$/i.exec(text ?? "");
  return seed ? t("pages.esports.match.seed", { n: seed[1] }) : t("pages.esports.match.tbd");
}

function MatchLine({ match: m, t, locale }: { match: BracketMatch; t: T; locale: Locale }) {
  // A 0–0 before the first game would read as a result: a dash says "not played".
  const played = m.winner !== null || (m.score !== null && m.score[0] + m.score[1] > 0);
  const side = (i: 0 | 1) => {
    const won = m.winner === i + 1;
    return (
      <div className={cn("flex items-center justify-between gap-3 px-3 py-1.5", won && "bg-night-800 shadow-[inset_3px_0_0_var(--color-gold-400)]")}>
        <span
          className={cn(
            "min-w-0 truncate",
            won ? "font-bold text-chalk-100" : m.winner ? "text-chalk-500" : "text-chalk-300",
          )}
        >
          {m.teams[i] ?? placeholderText(t, m.placeholders[i])}
          {won && <span className="sr-only"> ({t("pages.esports.match.winner")})</span>}
        </span>
        <span className={cn("display-caps shrink-0 text-xl", won ? "text-gold-400" : "text-chalk-500")}>
          {played && m.score ? m.score[i] : "–"}
        </span>
      </div>
    );
  };
  return (
    <li className="bevel-sm overflow-hidden bg-night-900 text-sm">
      {side(0)}
      <div aria-hidden className="h-px bg-night-700" />
      {side(1)}
      {m.date && (
        <time dateTime={m.date} className="block px-3 pb-1.5 pt-1 text-xs text-chalk-500">
          {shortDate(locale, m.date)}
        </time>
      )}
    </li>
  );
}

/** Matches whose games are drawn on the server (the latest); the older ones open on demand. */
const OPEN_DRAFTS = 1;

function DraftCard({
  match: m,
  open,
  turn,
  t,
  locale,
}: {
  match: DraftMatch;
  open: boolean;
  turn: Tournament;
  t: T;
  locale: Locale;
}) {
  const stage = turn.stages.find((s) => s.title === m.stage);
  const names = Object.fromEntries(
    [...new Set(m.games.flatMap((g) => [...g.picks.flat(), ...g.bans.flat()]))]
      .filter((slug) => heroesBySlug.has(slug))
      .map((slug) => [slug, heroName(slug)]),
  );
  return (
    <Card className="h-full p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-heading text-lg font-bold text-chalk-100">
          <TeamCrest name={m.teams[0]} size="sm" />
          <TeamNameLink name={m.teams[0]} />{" "}
          <span className="score text-3xl">{m.score ? `${m.score[0]}–${m.score[1]}` : "–"}</span>{" "}
          <TeamNameLink name={m.teams[1]} />
          <TeamCrest name={m.teams[1]} size="sm" />
        </h3>
        <p className="text-xs text-chalk-500">
          <time dateTime={m.date}>{shortDate(locale, m.date)}</time>
          {stage && <> · {stageName(t, stage.key, stage.title)}</>}
        </p>
      </div>
      <DraftGames
        teams={m.teams}
        games={m.games.map((g, i) => ({
          caption: [t("pages.esports.drafts.game", { n: i + 1 }), g.duration].filter(Boolean).join(" · "),
          won: t("pages.esports.drafts.won", { team: m.teams[g.winner - 1] }),
          winner: g.winner,
          team1Side: g.team1Side,
          picks: g.picks,
          bans: g.bans,
        }))}
        names={names}
        labels={{
          picks: t("pages.esports.drafts.picks"),
          bans: t("pages.esports.drafts.bans"),
          blue: t("pages.esports.drafts.blue"),
          red: t("pages.esports.drafts.red"),
          show: t("pages.esports.drafts.showGames", { n: m.games.length }),
          hide: t("pages.esports.drafts.hideGames"),
        }}
        open={open}
      />
    </Card>
  );
}

/** The champion's last won match of the last stage: the grand final. */
function finalOf(turn: Tournament): BracketMatch | null {
  if (!turn.champion) return null;
  for (const stage of [...turn.stages].reverse()) {
    for (const bracket of [...stage.brackets].reverse()) {
      for (const round of [...bracket.rounds].reverse()) {
        for (const m of [...round.matches].reverse()) {
          if (m.winner && m.teams[m.winner - 1] === turn.champion) return m;
        }
      }
    }
  }
  return null;
}

/**
 * The champion's highlight: a gold crest, the team's name set huge and the
 * grand final's score, the champion's side in gold. Behind it, the art of
 * the hero the champion drafted most in the final's games when the drafts
 * cover them.
 */
function ChampionBlock({
  champion,
  final,
  t,
  heroes,
}: {
  champion: string;
  final: BracketMatch | null;
  t: T;
  heroes: string[];
}) {
  const art = firstWithArt(heroes)?.art ?? null;
  const side = final ? (final.teams[0] === champion ? 0 : 1) : 0;
  return (
    <section aria-labelledby="tournament-champion" className="bevel-lg relative isolate overflow-hidden bg-night-900">
      {art && (
        <span aria-hidden className="absolute inset-y-0 right-0 -z-10 w-full sm:w-3/5">
          <Image src={art} alt="" fill sizes="(min-width: 640px) 60vw, 100vw" className="object-cover object-[50%_25%] opacity-70" />
          <span className="absolute inset-0 bg-linear-to-r from-night-900 via-night-900/70 to-transparent" />
          <span className="absolute inset-0 bg-linear-to-t from-night-900 to-transparent sm:hidden" />
        </span>
      )}
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-10 lg:p-12">
        <TeamCrest name={champion} size="xl" champion />
        <div className="min-w-0">
          <h2 id="tournament-champion" className="flex items-center gap-2 font-heading text-lg font-bold uppercase text-gold-400">
            <Trophy size={18} aria-hidden />
            {t("pages.esports.facts.champion")}
          </h2>
          <p className="display-caps mt-2 break-words text-[clamp(3rem,1.8rem+4.5vw,6.5rem)] text-chalk-100">
            <TeamNameLink name={champion} className="hover:text-gold-300" />
          </p>
          {final && final.score && (
            <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="score text-6xl">
                {final.score[side]}
                <span className="text-chalk-500">–</span>
                <span className="score-outline">{final.score[1 - side]}</span>
              </span>
              <span className="font-heading text-lg font-bold uppercase text-chalk-300">
                {t("pages.esports.pro.vs", { team: final.teams[1 - side] ?? "" })}
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

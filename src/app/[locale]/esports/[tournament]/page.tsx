import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  formatPartialDate,
  formatPrize,
  labelText,
  shortDate,
  SourceCredit,
  stageName,
  StatusBadge,
  tournamentDates,
} from "@/components/esports-parts";
import { HeroPortrait } from "@/components/hero-portrait";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage } from "@/i18n/seo";
import { createT, messagesPage, type T } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import {
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
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { HeroStatsTable, type HeroStatRow } from "./hero-stats-table";

type Params = { params: Promise<{ locale: Locale; tournament: string }> };

/**
 * One tournament: standings and bracket results as the source lists them,
 * hero statistics (sortable) and the latest drafts, game by game.
 */
export function generateStaticParams() {
  return tournaments.map((t) => ({ tournament: t.slug }));
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
  if (!turn) return {};
  const t = createT(locale);
  return metaPage(locale, {
    title: seoTitle(t, turn),
    description: seoDescription(t, locale, turn),
    path: `/esports/${turn.slug}`,
  });
}

/** Zones marked by the source, drawn as a bar in front of the rank. */
const ZONE_STYLE: Record<string, string> = {
  up: "bg-emerald-400",
  seedup: "bg-emerald-300",
  stayup: "bg-azure-400",
  stay: "bg-gold-400",
  staydown: "bg-gold-500",
  down: "bg-blood-500",
};
const knownZone = (z: string | null): z is string => z !== null && z in ZONE_STYLE;

export default async function TournamentPage({ params }: Params) {
  const { locale, tournament } = await params;
  const turn = tournamentBySlug.get(tournament);
  if (!turn) notFound();
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
  };

  const dates = tournamentDates(t, locale, turn);
  const location = [turn.city, turn.country].filter(Boolean).join(", ");
  const patch = turn.patch && turn.endPatch && turn.endPatch !== turn.patch ? `${turn.patch} – ${turn.endPatch}` : turn.patch;
  const facts: [string, React.ReactNode][] = [
    [t("pages.esports.facts.status"), <StatusBadge key="s" status={status} t={t} />],
    ...(dates ? [[t("pages.esports.facts.dates"), dates] as [string, string]] : []),
    ...(turn.prizePool ? [[t("pages.esports.facts.prize"), formatPrize(locale, turn.prizePool)] as [string, string]] : []),
    ...(turn.teamCount ? [[t("pages.esports.facts.teams"), String(turn.teamCount)] as [string, string]] : []),
    ...(location ? [[t("pages.esports.facts.location"), location] as [string, string]] : []),
    ...(patch ? [[t("pages.esports.facts.patch"), patch] as [string, string]] : []),
    ...(turn.champion ? [[t("pages.esports.facts.champion"), turn.champion] as [string, string]] : []),
    ...(turn.games ? [[t("pages.esports.facts.games"), String(turn.games)] as [string, string]] : []),
  ];

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.esportsUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PageHeader
        title={turn.name}
        lead={
          turn.games > 0
            ? t("pages.esports.tournament.intro", { name: turn.name, games: turn.games })
            : t("pages.esports.tournament.introUpcoming", { name: turn.name })
        }
        crumbs={[
          { name: t("pages.esports.title"), href: "/esports" },
          {
            name: turn.shortName,
            siblings: tournaments.map((x) => ({ name: x.shortName, href: `/esports/${x.slug}` })),
          },
        ]}
      >
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-chalk-100">{value}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        {stages.length === 0 && <p className="text-sm text-chalk-500">{t("pages.esports.empty")}</p>}

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
          <p className="-mt-8 max-w-3xl text-xs leading-relaxed text-chalk-500">
            {t("pages.esports.standings.rating")} {t("pages.esports.zones.rating")}
          </p>
        )}

        {rows.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.heroes.intro", { games: turn.games })}>
              {t("pages.esports.heroes.title")}
            </SectionTitle>
            <HeroStatsTable rows={rows} name={turn.name} />
          </section>
        )}

        {turn.drafts.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.drafts.intro", { n: turn.drafts.length })}>
              {t("pages.esports.drafts.title")}
            </SectionTitle>
            <ol className="grid gap-4 lg:grid-cols-2">
              {turn.drafts.map((m) => (
                <li key={`${m.date}-${m.teams.join("-")}`}>
                  <DraftCard match={m} turn={turn} t={t} locale={locale} />
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

function StandingTable({ standing, caption, t }: { standing: Standing; caption: string; t: T }) {
  const zones = [...new Set(standing.rows.map((r) => r.zone).filter(knownZone))];
  const cell = "px-3 py-1.5 text-right";
  return (
    <div className="min-w-0">
      {standing.label || standing.title ? (
        <h3 className="mb-2 font-heading text-lg font-bold text-chalk-100">{caption}</h3>
      ) : null}
      <div className="relative overflow-x-auto border border-night-700/70">
        <table className="w-full min-w-[22rem] border-collapse text-sm tabular-nums">
          <caption className="sr-only">{t("pages.esports.standings.caption", { title: caption })}</caption>
          <thead className="bg-night-900 text-xs uppercase tracking-wide text-chalk-500">
            <tr>
              <th scope="col" className="w-12 px-3 py-2 text-left font-medium">
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
                  <td className="relative px-3 py-1.5 text-chalk-500">
                    {knownZone(r.zone) && (
                      <span aria-hidden className={cn("absolute inset-y-1 left-0 w-1", ZONE_STYLE[r.zone])} />
                    )}
                    {r.rank}
                    {knownZone(r.zone) && <span className="sr-only">, {t(`pages.esports.zones.${r.zone}`)}</span>}
                  </td>
                  <th scope="row" className="px-3 py-1.5 text-left font-semibold text-chalk-100">
                    {r.team}
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
      {title && <h3 className="mb-3 font-heading text-lg font-bold text-chalk-100">{title}</h3>}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bracket.rounds.map((r, i) => (
          <li key={i} className="border border-night-700/70 bg-night-900/60 p-3">
            <h4 className="font-heading text-sm font-bold uppercase tracking-wide text-gold-400">
              {labelText(t, r.label, r.title) ?? t("pages.esports.rounds.round", { n: r.number ?? i + 1 })}
            </h4>
            <ul className="mt-1 divide-y divide-night-800">
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
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "min-w-0 truncate",
            won ? "font-bold text-chalk-100" : m.winner ? "text-chalk-500" : "text-chalk-300",
          )}
        >
          {m.teams[i] ?? placeholderText(t, m.placeholders[i])}
          {won && <span className="sr-only"> ({t("pages.esports.match.winner")})</span>}
        </span>
        <span className={cn("shrink-0 tabular-nums", won ? "font-bold text-gold-400" : "text-chalk-500")}>
          {played && m.score ? m.score[i] : "–"}
        </span>
      </div>
    );
  };
  return (
    <li className="py-2 text-sm">
      {side(0)}
      {side(1)}
      {m.date && (
        <time dateTime={m.date} className="mt-0.5 block text-xs text-chalk-500">
          {shortDate(locale, m.date)}
        </time>
      )}
    </li>
  );
}

function DraftCard({ match: m, turn, t, locale }: { match: DraftMatch; turn: Tournament; t: T; locale: Locale }) {
  const stage = turn.stages.find((s) => s.title === m.stage);
  return (
    <Card className="h-full p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-heading text-lg font-bold text-chalk-100">
          {m.teams[0]}{" "}
          <span className="tabular-nums text-gold-400">{m.score ? `${m.score[0]}–${m.score[1]}` : "–"}</span>{" "}
          {m.teams[1]}
        </h3>
        <p className="text-xs text-chalk-500">
          <time dateTime={m.date}>{shortDate(locale, m.date)}</time>
          {stage && <> · {stageName(t, stage.key, stage.title)}</>}
        </p>
      </div>
      <ol className="mt-3 space-y-3">
        {m.games.map((g, i) => {
          const other = g.team1Side === "blue" ? "red" : g.team1Side === "red" ? "blue" : null;
          return (
            <li key={i} className="border-t border-night-800 pt-3">
              <p className="text-xs text-chalk-500">
                {t("pages.esports.drafts.game", { n: i + 1 })}
                {g.duration && <> · {g.duration}</>} ·{" "}
                <span className="text-chalk-300">{t("pages.esports.drafts.won", { team: m.teams[g.winner - 1] })}</span>
              </p>
              <DraftSide team={m.teams[0]} side={g.team1Side} picks={g.picks[0]} bans={g.bans[0]} won={g.winner === 1} t={t} />
              <DraftSide team={m.teams[1]} side={other} picks={g.picks[1]} bans={g.bans[1]} won={g.winner === 2} t={t} />
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function DraftSide({
  team,
  side,
  picks,
  bans,
  won,
  t,
}: {
  team: string;
  side: "blue" | "red" | null;
  picks: string[];
  bans: string[];
  won: boolean;
  t: T;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <p className="flex w-full min-w-0 items-center gap-2 text-sm sm:w-40">
        {side && (
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", side === "blue" ? "bg-azure-400" : "bg-blood-500")}
          />
        )}
        <span className={cn("truncate", won ? "font-semibold text-chalk-100" : "text-chalk-300")}>{team}</span>
        {side && <span className="sr-only">({t(`pages.esports.drafts.${side}`)})</span>}
      </p>
      <HeroStrip label={t("pages.esports.drafts.picks")} heroes={picks} />
      <HeroStrip label={t("pages.esports.drafts.bans")} heroes={bans} ban />
    </div>
  );
}

function HeroStrip({ label, heroes, ban = false }: { label: string; heroes: string[]; ban?: boolean }) {
  if (heroes.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 text-[0.65rem] uppercase tracking-wide text-chalk-500">{label}</span>
      <ul className={cn("flex gap-1", ban && "opacity-60 grayscale")}>
        {heroes.map((h, i) => {
          const hero = heroesBySlug.get(h);
          return (
            // flex: the portrait is a span, sized only once it is a flex item.
            <li key={`${h}-${i}`} title={hero?.name ?? h} className="flex">

              {hero ? (
                <HeroPortrait source={hero.images.icon ?? hero.images.portrait} name={hero.name} size="micro" />
              ) : (
                <span className="text-xs text-chalk-300">{h}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

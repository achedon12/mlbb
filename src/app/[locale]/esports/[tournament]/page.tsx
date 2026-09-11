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
import { PortraitHeros } from "@/components/portrait-heros";
import { Carte, EnTetePage, TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { metaPage } from "@/i18n/seo";
import { creerT, messagesPage, type T } from "@/i18n/traductions";
import { herosParSlug } from "@/lib/donnees";
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
import { donneesLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { HeroStatsTable, type HeroStatRow } from "./hero-stats-table";

type Params = { params: Promise<{ locale: Langue; tournament: string }> };

/**
 * One tournament: standings and bracket results as the source lists them,
 * hero statistics (sortable) and the latest drafts, game by game.
 */
export function generateStaticParams() {
  return tournaments.map((t) => ({ tournament: t.slug }));
}

const heroName = (slug: string) => herosParSlug.get(slug)?.nom ?? slug;

/** "MPL ID Season 18: …", "M7 World Championship: …", "MSC 2026: …". */
function seoTitle(t: T, tour: Tournament): string {
  if (tour.series === "mpl") {
    return t("pages.esports.seo.mplTitle", { league: tour.shortName.replace(/\s+S\d+$/, ""), n: tour.number });
  }
  if (tour.series === "m") return t("pages.esports.seo.mTitle", { n: tour.number });
  return t("pages.esports.seo.mscTitle", { year: tour.number });
}

function seoDescription(t: T, locale: Langue, tour: Tournament): string {
  const [picked] = [...tour.heroes].sort((a, b) => b.picks - a.picks);
  const [banned] = [...tour.heroes].sort((a, b) => b.bans - a.bans);
  if (tour.games > 0 && picked && banned) {
    return t("pages.esports.seo.tournamentDescription", {
      name: tour.name,
      games: tour.games,
      picked: heroName(picked.slug),
      banned: heroName(banned.slug),
    });
  }
  return t("pages.esports.seo.upcomingDescription", {
    name: tour.name,
    date: tour.startDate ? formatPartialDate(locale, tour.startDate) : "",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, tournament } = await params;
  const tour = tournamentBySlug.get(tournament);
  if (!tour) return {};
  const t = creerT(locale);
  return metaPage(locale, {
    titre: seoTitle(t, tour),
    description: seoDescription(t, locale, tour),
    chemin: `/esports/${tour.slug}`,
  });
}

/** Zones marked by the source, drawn as a bar in front of the rank. */
const ZONE_STYLE: Record<string, string> = {
  up: "bg-emerald-400",
  seedup: "bg-emerald-300",
  stayup: "bg-azur-400",
  stay: "bg-or-400",
  staydown: "bg-or-500",
  down: "bg-sang-500",
};
const knownZone = (z: string | null): z is string => z !== null && z in ZONE_STYLE;

export default async function TournamentPage({ params }: Params) {
  const { locale, tournament } = await params;
  const tour = tournamentBySlug.get(tournament);
  if (!tour) notFound();
  const t = creerT(locale);
  const now = new Date();
  const status = tournamentStatus(tour, now);
  const stages = tour.stages.filter((s) => s.standings.length > 0 || s.brackets.length > 0);
  const rows: HeroStatRow[] = tour.heroes.map((h) => {
    const r = withRates(h, tour.games);
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
    name: tour.name,
    description: seoDescription(t, locale, tour),
    sport: "Mobile Legends: Bang Bang",
    url: `${site.url}/${locale}/esports/${tour.slug}`,
    inLanguage: LOCALE_HTML[locale],
    ...(fullDate(tour.startDate) ? { startDate: fullDate(tour.startDate) } : {}),
    ...(fullDate(tour.endDate) ? { endDate: fullDate(tour.endDate) } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    ...(tour.city || tour.country
      ? {
          location: {
            "@type": "Place",
            name: [tour.city, tour.country].filter(Boolean).join(", "),
            address: {
              "@type": "PostalAddress",
              ...(tour.city ? { addressLocality: tour.city } : {}),
              ...(tour.country ? { addressCountry: tour.country } : {}),
            },
          },
        }
      : {}),
    isBasedOn: tour.sources[0]?.url,
  };

  const dates = tournamentDates(t, locale, tour);
  const location = [tour.city, tour.country].filter(Boolean).join(", ");
  const patch = tour.patch && tour.endPatch && tour.endPatch !== tour.patch ? `${tour.patch} – ${tour.endPatch}` : tour.patch;
  const facts: [string, React.ReactNode][] = [
    [t("pages.esports.facts.status"), <StatusBadge key="s" status={status} t={t} />],
    ...(dates ? [[t("pages.esports.facts.dates"), dates] as [string, string]] : []),
    ...(tour.prizePool ? [[t("pages.esports.facts.prize"), formatPrize(locale, tour.prizePool)] as [string, string]] : []),
    ...(tour.teamCount ? [[t("pages.esports.facts.teams"), String(tour.teamCount)] as [string, string]] : []),
    ...(location ? [[t("pages.esports.facts.location"), location] as [string, string]] : []),
    ...(patch ? [[t("pages.esports.facts.patch"), patch] as [string, string]] : []),
    ...(tour.champion ? [[t("pages.esports.facts.champion"), tour.champion] as [string, string]] : []),
    ...(tour.games ? [[t("pages.esports.facts.games"), String(tour.games)] as [string, string]] : []),
  ];

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.esportsUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(jsonLd) }} />
      <EnTetePage
        titre={tour.name}
        chapeau={
          tour.games > 0
            ? t("pages.esports.tournament.intro", { name: tour.name, games: tour.games })
            : t("pages.esports.tournament.introUpcoming", { name: tour.name })
        }
        miettes={[
          { nom: t("pages.esports.title"), href: "/esports" },
          {
            nom: tour.shortName,
            freres: tournaments.map((x) => ({ nom: x.shortName, href: `/esports/${x.slug}` })),
          },
        ]}
      >
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-craie-500">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-craie-100">{value}</dd>
            </div>
          ))}
        </dl>
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        {stages.length === 0 && <p className="text-sm text-craie-500">{t("pages.esports.empty")}</p>}

        {stages.map((stage) => (
          <section key={stage.page}>
            <TitreSection>{stageName(t, stage.key, stage.title) || tour.shortName}</TitreSection>
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
          <p className="-mt-8 max-w-3xl text-xs leading-relaxed text-craie-500">
            {t("pages.esports.standings.note")} {t("pages.esports.zones.note")}
          </p>
        )}

        {rows.length > 0 && (
          <section>
            <TitreSection chapeau={t("pages.esports.heroes.intro", { games: tour.games })}>
              {t("pages.esports.heroes.title")}
            </TitreSection>
            <HeroStatsTable rows={rows} name={tour.name} />
          </section>
        )}

        {tour.drafts.length > 0 && (
          <section>
            <TitreSection chapeau={t("pages.esports.drafts.intro", { n: tour.drafts.length })}>
              {t("pages.esports.drafts.title")}
            </TitreSection>
            <ol className="grid gap-4 lg:grid-cols-2">
              {tour.drafts.map((m) => (
                <li key={`${m.date}-${m.teams.join("-")}`}>
                  <DraftCard match={m} tour={tour} t={t} locale={locale} />
                </li>
              ))}
            </ol>
          </section>
        )}

        <SourceCredit t={t} locale={locale} sources={tour.sources} />
      </div>
    </CompleterMessages>
  );
}

function StandingTable({ standing, caption, t }: { standing: Standing; caption: string; t: T }) {
  const zones = [...new Set(standing.rows.map((r) => r.zone).filter(knownZone))];
  const cell = "px-3 py-1.5 text-right";
  return (
    <div className="min-w-0">
      {standing.label || standing.title ? (
        <h3 className="mb-2 font-titre text-lg font-bold text-craie-100">{caption}</h3>
      ) : null}
      <div className="relative overflow-x-auto border border-nuit-700/70">
        <table className="w-full min-w-[22rem] border-collapse text-sm tabular-nums">
          <caption className="sr-only">{t("pages.esports.standings.caption", { title: caption })}</caption>
          <thead className="bg-nuit-900 text-xs uppercase tracking-wide text-craie-500">
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
                <tr key={r.team} className="border-t border-nuit-800">
                  <td className="relative px-3 py-1.5 text-craie-500">
                    {knownZone(r.zone) && (
                      <span aria-hidden className={cn("absolute inset-y-1 left-0 w-1", ZONE_STYLE[r.zone])} />
                    )}
                    {r.rank}
                    {knownZone(r.zone) && <span className="sr-only">, {t(`pages.esports.zones.${r.zone}`)}</span>}
                  </td>
                  <th scope="row" className="px-3 py-1.5 text-left font-semibold text-craie-100">
                    {r.team}
                  </th>
                  <td className={cn(cell, "text-craie-100")}>
                    {r.series[0]}–{r.series[1]}
                  </td>
                  <td className={cn(cell, "text-craie-300")}>
                    {r.games[0]}–{r.games[1]}
                  </td>
                  <td className={cn(cell, "text-craie-500")}>{diff > 0 ? `+${diff}` : diff}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {zones.length > 0 && (
        <ul
          aria-label={t("pages.esports.zones.title")}
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-craie-500"
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

function BracketView({ bracket, t, locale }: { bracket: Bracket; t: T; locale: Langue }) {
  const title = labelText(t, bracket.label, bracket.title);
  return (
    <div>
      {title && <h3 className="mb-3 font-titre text-lg font-bold text-craie-100">{title}</h3>}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bracket.rounds.map((r, i) => (
          <li key={i} className="border border-nuit-700/70 bg-nuit-900/60 p-3">
            <h4 className="font-titre text-sm font-bold uppercase tracking-wide text-or-400">
              {labelText(t, r.label, r.title) ?? t("pages.esports.rounds.round", { n: r.number ?? i + 1 })}
            </h4>
            <ul className="mt-1 divide-y divide-nuit-800">
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

function MatchLine({ match: m, t, locale }: { match: BracketMatch; t: T; locale: Langue }) {
  // A 0–0 before the first game would read as a result: a dash says "not played".
  const played = m.winner !== null || (m.score !== null && m.score[0] + m.score[1] > 0);
  const side = (i: 0 | 1) => {
    const won = m.winner === i + 1;
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "min-w-0 truncate",
            won ? "font-bold text-craie-100" : m.winner ? "text-craie-500" : "text-craie-300",
          )}
        >
          {m.teams[i] ?? placeholderText(t, m.placeholders[i])}
          {won && <span className="sr-only"> ({t("pages.esports.match.winner")})</span>}
        </span>
        <span className={cn("shrink-0 tabular-nums", won ? "font-bold text-or-400" : "text-craie-500")}>
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
        <time dateTime={m.date} className="mt-0.5 block text-xs text-craie-500">
          {shortDate(locale, m.date)}
        </time>
      )}
    </li>
  );
}

function DraftCard({ match: m, tour, t, locale }: { match: DraftMatch; tour: Tournament; t: T; locale: Langue }) {
  const stage = tour.stages.find((s) => s.title === m.stage);
  return (
    <Carte className="h-full p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-titre text-lg font-bold text-craie-100">
          {m.teams[0]}{" "}
          <span className="tabular-nums text-or-400">{m.score ? `${m.score[0]}–${m.score[1]}` : "–"}</span>{" "}
          {m.teams[1]}
        </h3>
        <p className="text-xs text-craie-500">
          <time dateTime={m.date}>{shortDate(locale, m.date)}</time>
          {stage && <> · {stageName(t, stage.key, stage.title)}</>}
        </p>
      </div>
      <ol className="mt-3 space-y-3">
        {m.games.map((g, i) => {
          const other = g.team1Side === "blue" ? "red" : g.team1Side === "red" ? "blue" : null;
          return (
            <li key={i} className="border-t border-nuit-800 pt-3">
              <p className="text-xs text-craie-500">
                {t("pages.esports.drafts.game", { n: i + 1 })}
                {g.duration && <> · {g.duration}</>} ·{" "}
                <span className="text-craie-300">{t("pages.esports.drafts.won", { team: m.teams[g.winner - 1] })}</span>
              </p>
              <DraftSide team={m.teams[0]} side={g.team1Side} picks={g.picks[0]} bans={g.bans[0]} won={g.winner === 1} t={t} />
              <DraftSide team={m.teams[1]} side={other} picks={g.picks[1]} bans={g.bans[1]} won={g.winner === 2} t={t} />
            </li>
          );
        })}
      </ol>
    </Carte>
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
            className={cn("size-2 shrink-0 rounded-full", side === "blue" ? "bg-azur-400" : "bg-sang-500")}
          />
        )}
        <span className={cn("truncate", won ? "font-semibold text-craie-100" : "text-craie-300")}>{team}</span>
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
      <span className="w-9 text-[0.65rem] uppercase tracking-wide text-craie-500">{label}</span>
      <ul className={cn("flex gap-1", ban && "opacity-60 grayscale")}>
        {heroes.map((h, i) => {
          const hero = herosParSlug.get(h);
          return (
            // flex: the portrait is a span, sized only once it is a flex item.
            <li key={`${h}-${i}`} title={hero?.nom ?? h} className="flex">

              {hero ? (
                <PortraitHeros source={hero.visuels.icone ?? hero.visuels.portrait} nom={hero.nom} taille="micro" />
              ) : (
                <span className="text-xs text-craie-300">{h}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

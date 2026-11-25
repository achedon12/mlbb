import type { Metadata } from "next";
import { ChevronDown, Trophy } from "lucide-react";
import { TeamCrest } from "@/components/esports-broadcast";
import { EditorialPoster, ENTRANCE, firstWithArt } from "@/components/editorial-poster";
import { Foldable } from "@/components/foldable";
import { PageLead } from "@/components/page-lead";
import { shortDate, SourceCredit, stageName } from "@/components/esports-parts";
import { PlayerLink, percentText, ProGameDraft, roleText, teamName } from "@/components/esports-pro";
import Link from "@/components/link";
import { Score, SectionTitle } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { tournamentBySlug } from "@/lib/esports";
import { hasPlayerPage, rate, teamProfile } from "@/lib/esports-players";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/**
 * One pro team: roster, record per tournament and every covered match, with
 * its drafts game by game (folded: a season is sixty games).
 */
export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = teamProfile(slug);
  if (!p) return notFoundMetadata(locale);
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.esports.pro.team.seoTitle", { name: p.team.name }),
    description: t("pages.esports.pro.team.seoDescription", {
      name: p.team.name,
      series: t("pages.esports.pro.record", { wins: p.series[0], losses: p.series[1] }),
      games: t("pages.esports.pro.record", { wins: p.games[0], losses: p.games[1] }),
      tournaments: p.records.length,
    }),
    path: `/esports/teams/${slug}`,
    card: true,
  });
}

export default async function TeamPage({ params }: Params) {
  const { locale, slug } = await params;
  const p = teamProfile(slug);
  if (!p) return <NotFoundPage />;
  const t = createT(locale);
  const latest = p.records[0];
  const titles = p.records.filter((r) => r.champion).length;
  const sources = p.records.flatMap((r) => r.turn.sources.slice(0, 1));
  const record = (r: [number, number]) => t("pages.esports.pro.record", { wins: r[0], losses: r[1] });
  const gameRate = rate(p.games[0], p.games[0] + p.games[1]);
  // The team's most drafted hero gives the poster its art.
  const picks = new Map<string, number>();
  for (const m of p.matches) {
    const side = m.teams.indexOf(slug);
    if (side < 0) continue;
    for (const g of m.games) for (const hero of g.picks[side] ?? []) picks.set(hero, (picks.get(hero) ?? 0) + 1);
  }
  const art = firstWithArt([...picks].sort((a, b) => b[1] - a[1]).map(([hero]) => hero))?.art ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: p.team.name,
    sport: "Mobile Legends: Bang Bang",
    url: `${site.url}/${locale}/esports/teams/${slug}`,
    inLanguage: LOCALE_HTML[locale],
    ...(latest
      ? {
          athlete: latest.roster
            .filter((r) => r.status !== "former")
            .map((r) => ({
              "@type": "Person",
              name: r.player.name,
              ...(hasPlayerPage(r.player.slug) ? { url: `${site.url}/${locale}/esports/players/${r.player.slug}` } : {}),
            })),
        }
      : {}),
  };

  const facts: [string, string][] = [
    [t("pages.esports.pro.team.facts.series"), record(p.series)],
    [t("pages.esports.pro.team.facts.games"), record(p.games)],
    [t("pages.esports.pro.team.facts.tournaments"), String(p.records.length)],
    ...(titles ? [[t("pages.esports.pro.team.facts.titles"), String(titles)] as [string, string]] : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <EditorialPoster
        art={art}
        crumbs={[{ name: t("pages.esports.title"), href: "/esports" }, { name: p.team.name }]}
        aside={
          gameRate !== null ? (
            <p className="lg:text-right">
              <Score value={new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(gameRate)} unit="%" className="text-[clamp(4rem,2.5rem+5vw,8rem)]" />
              <span className="mt-2 block text-sm text-chalk-300">{t("pages.esports.pro.columns.winRate")}</span>
            </p>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-end gap-5 sm:gap-8">
          <TeamCrest name={p.team.name} size="xl" champion={titles > 0} />
          <div className="min-w-0">
            {titles > 0 && (
              <p className="flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400">
                <Trophy size={16} aria-hidden />
                {t("pages.esports.pro.team.champion")} × {titles}
              </p>
            )}
            <h1 className="affiche-name type-giant mt-1 break-words text-chalk-100">{p.team.name}</h1>
          </div>
        </div>
        <div aria-hidden className="eclat mt-5 h-[3px] w-24" />
        <PageLead lead={t("pages.esports.pro.team.lead", { name: p.team.name })} />
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-chalk-400">{label}</dt>
              <dd className="display-caps mt-1 text-3xl text-chalk-100">{value}</dd>
            </div>
          ))}
        </dl>
        <Foldable label={t("pages.esports.pro.methodLabel")} className="mt-5 max-w-2xl">
          <p>{t("pages.esports.pro.method")}</p>
        </Foldable>
      </EditorialPoster>

      <div className={cn("page-wrap space-y-14 py-10 sm:space-y-20 sm:py-14", ENTRANCE)}>
        {latest && latest.roster.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.pro.team.rosterIntro", { name: latest.turn.name })}>
              {t("pages.esports.pro.team.rosterTitle")}
            </SectionTitle>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {latest.roster.map((r) => (
                <li
                  key={r.player.slug}
                  className={cn("bevel relative bg-night-900 px-4 pb-4 pt-3 transition-[translate] duration-200 hover:-translate-y-0.5", r.status && "opacity-75")}
                >
                  <p className="font-heading text-sm font-bold uppercase text-gold-400">{roleText(t, r.role)}</p>
                  <PlayerLink slug={r.player.slug} className="display-caps mt-1 block truncate pr-[0.15em] text-3xl text-chalk-100 sm:text-4xl" />
                  <p className="text-xs text-chalk-500">
                    {r.status ? `${t(`pages.esports.pro.status.${r.status}`)} · ` : ""}
                    {t("pages.esports.pro.team.gamesPlayed", { n: r.games })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle>{t("pages.esports.pro.team.recordsTitle")}</SectionTitle>
          <div className="bevel relative overflow-x-auto bg-night-900">
            <table className="w-full min-w-[30rem] border-collapse text-sm tabular-nums">
              <thead className="bg-night-800 font-heading text-sm uppercase text-chalk-400">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t("pages.esports.pro.columns.tournament")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("pages.esports.pro.team.facts.series")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("pages.esports.pro.team.facts.games")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("pages.esports.pro.columns.winRate")}</th>
                </tr>
              </thead>
              <tbody>
                {p.records.map((r) => (
                  <tr key={r.turn.slug} className="border-t border-night-800">
                    <th scope="row" className="px-3 py-1.5 text-left font-semibold text-chalk-100">
                      <Link href={`/esports/${r.turn.slug}`} prefetch={false} className="transition-colors hover:text-gold-400">
                        {r.turn.name}
                      </Link>
                      {r.champion && (
                        <span className="bevel-sm ml-2 inline-flex items-center gap-1 bg-gold-400 px-1.5 py-0.5 font-heading text-xs font-bold uppercase text-night-950">
                          <Trophy size={11} aria-hidden />
                          {t("pages.esports.pro.team.champion")}
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-1.5 text-right text-chalk-100">{record(r.series)}</td>
                    <td className="px-3 py-1.5 text-right text-chalk-300">{record(r.games)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gold-400">
                      {percentText(locale, rate(r.games[0], r.games[0] + r.games[1]))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {p.matches.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.pro.team.matchesIntro", { n: p.matches.length })}>
              {t("pages.esports.pro.team.matchesTitle")}
            </SectionTitle>
            <ol className="space-y-2">
              {p.matches.map((m, i) => {
                const side = m.teams.indexOf(slug);
                const won = m.winner === side + 1;
                const turn = tournamentBySlug.get(m.tournament);
                const stage = turn?.stages.find((s) => s.title === m.stage);
                const score = m.score ? `${m.score[side]}–${m.score[1 - side]}` : null;
                const line = (
                  <>
                    <span
                      className={cn(
                        "w-28 shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wide",
                        won ? "text-azure-400" : "text-blood-400",
                      )}
                    >
                      {won ? t("pages.esports.pro.win") : t("pages.esports.pro.loss")}
                      {score && <span className="ml-1.5 tabular-nums text-chalk-300">{score}</span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-chalk-100">
                      {/* Plain text: a link inside the summary would compete with opening it. */}
                      {t("pages.esports.pro.vs", { team: teamName(m.teams[1 - side]!) })}
                    </span>
                    <span className="text-xs text-chalk-500">
                      {turn?.shortName}
                      {stage && <> · {stageName(t, stage.key, stage.title)}</>}
                      {m.date && (
                        <>
                          {" · "}
                          <time dateTime={m.date}>{shortDate(locale, m.date)}</time>
                        </>
                      )}
                    </span>
                  </>
                );
                const row = "flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm";
                return (
                  <li key={i}>
                    {m.games.length === 0 ? (
                      // A forfeit: no game, nothing to open.
                      <div className={cn(row, "bevel-sm bg-night-900")}>
                        {line}
                        <span className="text-xs text-chalk-500">{t("pages.esports.pro.team.forfeit")}</span>
                      </div>
                    ) : (
                      <details className="bevel-sm group bg-night-900">
                        <summary
                          className={cn(
                            row,
                            "cursor-pointer list-none outline-none transition-colors hover:bg-night-800 focus-visible:ring-2 focus-visible:ring-gold-400 [&::-webkit-details-marker]:hidden",
                          )}
                        >
                          {line}
                          <ChevronDown
                            size={16}
                            aria-hidden
                            className="shrink-0 text-chalk-500 transition-transform duration-150 group-open:rotate-180"
                          />
                        </summary>
                        <div className="space-y-3 px-3 pb-3">
                          {m.games.map((g, j) => (
                            <ProGameDraft key={j} match={m} game={g} index={j} t={t} />
                          ))}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <SourceCredit t={t} locale={locale} sources={sources} />
      </div>
    </>
  );
}

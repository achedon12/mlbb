import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink as ExternalIcon } from "lucide-react";
import { interpolate, shortDate, SourceCredit } from "@/components/esports-parts";
import { HeroIcon, heroName, percentText, roleText, TeamLink } from "@/components/esports-pro";
import Link from "@/components/link";
import { PageHeader, SectionTitle } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import { esportsSource, tournamentBySlug } from "@/lib/esports";
import { playedSlugs, playerProfile, rate } from "@/lib/esports-players";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/**
 * One pro player: latest team and role, heroes played (wins and losses per
 * hero), tournament by tournament results and the latest matches.
 */
export function generateStaticParams() {
  return [...playedSlugs].map((slug) => ({ slug }));
}

/** Latest matches listed on the page. */
const RECENT = 10;

const liquipediaUrl = (page: string) => `${esportsSource.url}${encodeURI(page.replace(/ /g, "_"))}`;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = playerProfile(slug);
  if (!p) return {};
  const t = createT(locale);
  const team = p.team?.name;
  const heroes = p.heroes
    .filter((h) => heroesBySlug.has(h.slug))
    .slice(0, 3)
    .map((h) => heroName(h.slug))
    .join(", ");
  return metaPage(locale, {
    title: team
      ? t("pages.esports.pro.player.seoTitle", { name: p.player.name, team })
      : t("pages.esports.pro.player.seoTitleAlone", { name: p.player.name }),
    description: t("pages.esports.pro.player.seoDescription", {
      name: p.player.name,
      role: roleText(t, p.role),
      team: team ?? "—",
      games: p.games,
      rate: percentText(locale, rate(p.wins, p.games)),
      heroes,
    }),
    path: `/esports/players/${slug}`,
  });
}

export default async function PlayerPage({ params }: Params) {
  const { locale, slug } = await params;
  const p = playerProfile(slug);
  if (!p) notFound();
  const t = createT(locale);
  const heroes = p.heroes.filter((h) => heroesBySlug.has(h.slug));
  const recent = p.matches.slice(0, RECENT);
  const sources = p.tournaments.flatMap((l) => l.turn.sources.slice(0, 1));
  const url = `${site.url}/${locale}/esports/players/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.player.name,
    url,
    inLanguage: LOCALE_HTML[locale],
    knowsAbout: "Mobile Legends: Bang Bang",
    ...(p.team
      ? { memberOf: { "@type": "SportsTeam", name: p.team.name, sport: "Mobile Legends: Bang Bang", url: `${site.url}/${locale}/esports/teams/${p.team.slug}` } }
      : {}),
    ...(p.player.page ? { sameAs: [liquipediaUrl(p.player.page)] } : {}),
  };

  const facts: [string, React.ReactNode][] = [
    ...(p.team ? [[t("pages.esports.pro.player.facts.team"), <TeamLink key="team" slug={p.team.slug} />] as [string, React.ReactNode]] : []),
    [t("pages.esports.pro.player.facts.role"), roleText(t, p.role)],
    [t("pages.esports.pro.player.facts.games"), String(p.games)],
    [t("pages.esports.pro.player.facts.record"), t("pages.esports.pro.record", { wins: p.wins, losses: p.games - p.wins })],
    [t("pages.esports.pro.player.facts.winRate"), percentText(locale, rate(p.wins, p.games))],
    [t("pages.esports.pro.player.facts.mvps"), String(p.mvps)],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PageHeader
        title={p.player.name}
        lead={t("pages.esports.pro.player.lead", {
          name: p.player.name,
          role: roleText(t, p.role),
          team: p.team?.name ?? "—",
          games: p.games,
        })}
        crumbs={[
          { name: t("pages.esports.title"), href: "/esports" },
          ...(p.team ? [{ name: p.team.name, href: `/esports/teams/${p.team.slug}` }] : []),
          { name: p.player.name },
        ]}
        actions={
          p.player.page ? (
            <a
              href={liquipediaUrl(p.player.page)}
              rel="noreferrer nofollow"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:underline"
            >
              {t("pages.esports.pro.player.liquipedia")}
              <ExternalIcon size={14} aria-hidden />
            </a>
          ) : undefined
        }
        details={{ label: t("pages.esports.pro.methodLabel"), content: <p>{t("pages.esports.pro.method")}</p> }}
      >
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
              <dd className="mt-1 truncate text-sm font-semibold text-chalk-100">{value}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {heroes.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.pro.player.heroesIntro", { n: heroes.length })}>
              {t("pages.esports.pro.player.heroesTitle")}
            </SectionTitle>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {heroes.map((h) => {
                const share = (h.games / heroes[0]!.games) * 100;
                return (
                  <li key={h.slug} className="flex items-center gap-3 border border-night-700/70 bg-night-900/60 px-3 py-2">
                    <HeroIcon slug={h.slug} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <Link href={`/heroes/${h.slug}`} prefetch={false} className="truncate font-heading font-bold text-chalk-100 transition-colors hover:text-gold-400">
                          {heroName(h.slug)}
                        </Link>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gold-400">
                          {percentText(locale, rate(h.wins, h.games))}
                        </span>
                      </div>
                      <p className="text-xs tabular-nums text-chalk-500">
                        {t("pages.esports.pro.team.gamesPlayed", { n: h.games })} ·{" "}
                        {t("pages.esports.pro.record", { wins: h.wins, losses: h.games - h.wins })}
                      </p>
                      <div aria-hidden className="mt-1 h-1 bg-night-800">
                        <div className="h-full bg-gold-500/70" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle>{t("pages.esports.pro.player.tournamentsTitle")}</SectionTitle>
          <div className="relative overflow-x-auto border border-night-700/70">
            <table className="w-full min-w-[36rem] border-collapse text-sm tabular-nums">
              <thead className="bg-night-900 text-xs uppercase tracking-wide text-chalk-500">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t("pages.esports.pro.columns.tournament")}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t("pages.esports.pro.columns.team")}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t("pages.esports.pro.columns.role")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("pages.esports.pro.columns.games")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("pages.esports.pro.columns.record")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("pages.esports.pro.columns.winRate")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("pages.esports.pro.columns.mvps")}</th>
                </tr>
              </thead>
              <tbody>
                {p.tournaments.map((l) => (
                  <tr key={l.tournament} className="border-t border-night-800">
                    <th scope="row" className="px-3 py-1.5 text-left font-semibold text-chalk-100">
                      <Link href={`/esports/${l.tournament}/players`} prefetch={false} className="transition-colors hover:text-gold-400">
                        {l.turn.shortName}
                      </Link>
                    </th>
                    <td className="px-3 py-1.5 text-chalk-300">
                      <TeamLink slug={l.team} />
                    </td>
                    <td className="px-3 py-1.5 text-chalk-300">{roleText(t, l.role)}</td>
                    <td className="px-3 py-1.5 text-right text-chalk-100">{l.games}</td>
                    <td className="px-3 py-1.5 text-right text-chalk-300">
                      {t("pages.esports.pro.record", { wins: l.wins, losses: l.games - l.wins })}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gold-400">{percentText(locale, rate(l.wins, l.games))}</td>
                    <td className="px-3 py-1.5 text-right text-chalk-100">{l.mvps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {recent.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.pro.player.matchesIntro", { n: recent.length })}>
              {t("pages.esports.pro.player.matchesTitle")}
            </SectionTitle>
            <ol className="divide-y divide-night-800 border border-night-700/70 bg-night-900/40">
              {recent.map(({ match: m, side, heroes: played }, i) => {
                const won = m.winner === side + 1;
                const opponent = m.teams[1 - side]!;
                const score = m.score ? `${m.score[side]}–${m.score[1 - side]}` : null;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 text-sm">
                    <span
                      className={cn(
                        "w-28 shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wide",
                        won ? "text-emerald-400" : "text-blood-500",
                      )}
                    >
                      {won ? t("pages.esports.pro.win") : t("pages.esports.pro.loss")}
                      {score && <span className="ml-1.5 tabular-nums text-chalk-300">{score}</span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-chalk-100">
                      {interpolate(t("pages.esports.pro.vs"), { team: <TeamLink slug={opponent} className="font-semibold" /> })}
                      {m.mvp === p.player.slug && (
                        <span className="ml-2 border border-gold-500/50 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-400">
                          {t("pages.esports.pro.player.mvp")}
                        </span>
                      )}
                    </span>
                    <ul className="flex gap-1">
                      {played.map((g, j) =>
                        g.hero ? (
                          <li
                            key={j}
                            className={cn("flex border-b-2", g.won ? "border-emerald-400" : "border-blood-500")}
                            title={heroName(g.hero)}
                          >
                            <HeroIcon slug={g.hero} size={24} />
                          </li>
                        ) : null,
                      )}
                    </ul>
                    <span className="w-40 shrink-0 text-right text-xs text-chalk-500 max-sm:w-auto max-sm:text-left">
                      {tournamentBySlug.get(m.tournament)?.shortName}
                      {m.date && (
                        <>
                          {" · "}
                          <time dateTime={m.date}>{shortDate(locale, m.date)}</time>
                        </>
                      )}
                    </span>
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


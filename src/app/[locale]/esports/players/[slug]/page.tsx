import type { Metadata } from "next";
import { ExternalLink as ExternalIcon } from "lucide-react";
import { interpolate, shortDate, SourceCredit } from "@/components/esports-parts";
import { HeroIcon, heroName, percentText, roleText, TeamLink } from "@/components/esports-pro";
import Link from "@/components/link";
import { Score, SectionTitle } from "@/components/ui";
import { EditorialPoster, ENTRANCE, firstWithArt } from "@/components/editorial-poster";
import { Foldable } from "@/components/foldable";
import { HeroTile } from "@/components/hero-tile";
import { PageLead } from "@/components/page-lead";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import { esportsSource, tournamentBySlug } from "@/lib/esports";
import { playerProfile, rate } from "@/lib/esports-players";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/**
 * One pro player: latest team and role, heroes played (wins and losses per
 * hero), tournament by tournament results and the latest matches.
 */
export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
}

/** Latest matches listed on the page. */
const RECENT = 10;

const liquipediaUrl = (page: string) => `${esportsSource.url}${encodeURI(page.replace(/ /g, "_"))}`;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = playerProfile(slug);
  if (!p) return notFoundMetadata(locale);
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
  if (!p) return <NotFoundPage />;
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

  const winRate = rate(p.wins, p.games);
  // Team and role open the poster, the win rate is its figure: the scoreboard keeps the counts.
  const facts: [string, React.ReactNode][] = [
    [t("pages.esports.pro.player.facts.games"), String(p.games)],
    [t("pages.esports.pro.player.facts.record"), t("pages.esports.pro.record", { wins: p.wins, losses: p.games - p.wins })],
    [t("pages.esports.pro.player.facts.mvps"), String(p.mvps)],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <EditorialPoster
        art={firstWithArt(heroes.map((h) => h.slug))?.art ?? null}
        crumbs={[
          { name: t("pages.esports.title"), href: "/esports" },
          ...(p.team ? [{ name: p.team.name, href: `/esports/teams/${p.team.slug}` }] : []),
          { name: p.player.name },
        ]}
        aside={
          winRate !== null ? (
            <p className="lg:text-right">
              <Score value={new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(winRate)} unit="%" className="text-[clamp(4rem,2.5rem+5vw,8rem)]" />
              <span className="mt-2 block text-sm text-chalk-300">{t("pages.esports.pro.player.facts.winRate")}</span>
            </p>
          ) : undefined
        }
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-base font-bold uppercase text-gold-400">
          {roleText(t, p.role)}
          {p.team && (
            <>
              <span aria-hidden className="text-chalk-500">·</span>
              <TeamLink slug={p.team.slug} className="text-chalk-200" />
            </>
          )}
        </p>
        <h1 className="affiche-name type-giant mt-1 break-words text-chalk-100">{p.player.name}</h1>
        <div aria-hidden className="eclat mt-5 h-[3px] w-24" />
        <PageLead
          lead={t("pages.esports.pro.player.lead", {
            name: p.player.name,
            role: roleText(t, p.role),
            team: p.team?.name ?? "—",
            games: p.games,
          })}
        />
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-chalk-400">{label}</dt>
              <dd className="display-caps mt-1 truncate text-3xl text-chalk-100">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap items-start gap-4">
          {p.player.page && (
            <a href={liquipediaUrl(p.player.page)} rel="noreferrer nofollow" target="_blank" className="btn btn-secondary btn-sm">
              {t("pages.esports.pro.player.liquipedia")}
              <ExternalIcon size={14} aria-hidden />
            </a>
          )}
          <Foldable label={t("pages.esports.pro.methodLabel")} className="max-w-2xl flex-1">
            <p>{t("pages.esports.pro.method")}</p>
          </Foldable>
        </div>
      </EditorialPoster>

      <div className={cn("page-wrap space-y-14 py-10 sm:space-y-20 sm:py-14", ENTRANCE)}>
        {heroes.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.esports.pro.player.heroesIntro", { n: heroes.length })}>
              {t("pages.esports.pro.player.heroesTitle")}
            </SectionTitle>
            <ol className="mb-6 grid grid-cols-3 gap-2 sm:max-w-2xl sm:gap-4">
              {heroes.slice(0, 3).map((h, i) => {
                const hero = heroesBySlug.get(h.slug)!;
                const value = rate(h.wins, h.games);
                return (
                  <li key={h.slug}>
                    <HeroTile
                      href={`/heroes/${h.slug}`}
                      name={hero.name}
                      portrait={hero.images.portrait ?? hero.images.icon}
                      figure={String(h.games)}
                      label={`${t("pages.esports.pro.team.gamesPlayed", { n: h.games })}, ${percentText(locale, value)}`}
                      rank={i + 1}
                      sizes="(min-width: 640px) 14rem, 30vw"
                    />
                  </li>
                );
              })}
            </ol>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {heroes.slice(3).map((h) => {
                const share = (h.games / heroes[0]!.games) * 100;
                return (
                  <li key={h.slug} className="bevel-sm flex items-center gap-3 bg-night-900 px-3 py-2">
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
                        <div className="h-full bg-gold-400" style={{ width: `${share}%` }} />
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
          <div className="bevel relative overflow-x-auto bg-night-900">
            <table className="w-full min-w-[36rem] border-collapse text-sm tabular-nums">
              <thead className="bg-night-800 font-heading text-sm uppercase text-chalk-400">
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
            <ol className="bevel divide-y divide-night-800 bg-night-900">
              {recent.map(({ match: m, side, heroes: played }, i) => {
                const won = m.winner === side + 1;
                const opponent = m.teams[1 - side]!;
                const score = m.score ? `${m.score[side]}–${m.score[1 - side]}` : null;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 text-sm">
                    <span
                      className={cn(
                        "w-28 shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wide",
                        won ? "text-azure-400" : "text-blood-400",
                      )}
                    >
                      {won ? t("pages.esports.pro.win") : t("pages.esports.pro.loss")}
                      {score && <span className="ml-1.5 tabular-nums text-chalk-300">{score}</span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-chalk-100">
                      {interpolate(t("pages.esports.pro.vs"), { team: <TeamLink slug={opponent} className="font-semibold" /> })}
                      {m.mvp === p.player.slug && (
                        <span className="bevel-sm ml-2 bg-gold-400 px-1.5 py-0.5 font-heading text-xs font-bold uppercase text-night-950">
                          {t("pages.esports.pro.player.mvp")}
                        </span>
                      )}
                    </span>
                    <ul className="flex gap-1">
                      {played.map((g, j) =>
                        g.hero ? (
                          <li
                            key={j}
                            className={cn("flex border-b-2", g.won ? "border-azure-400" : "border-blood-400")}
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


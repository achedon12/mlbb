import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import Link from "@/components/lien";
import {
  formatPrize,
  SourceCredit,
  StatusBadge,
  tournamentDates,
  wholePercent,
} from "@/components/esports-parts";
import { PortraitHeros } from "@/components/portrait-heros";
import { Carte, EnTetePage, TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT, type T } from "@/i18n/traductions";
import { herosParSlug } from "@/lib/donnees";
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
import { listeNoms, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Langue }> };

/**
 * Esports hub: the covered tournaments, the pro meta over the recent ones and
 * the pro vs ranked comparison. Every figure is a count over the drafts
 * recorded on Liquipedia; the page states its window and its method.
 */
const PATH = "/esports";

const heroName = (slug: string) => herosParSlug.get(slug)?.name ?? slug;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  const meta = proMeta();
  const picked = meta.picked[0];
  const banned = meta.banned[0];
  return metaPage(locale, {
    titre: t("pages.esports.seo.hubTitle"),
    description:
      picked && banned
        ? t("pages.esports.seo.hubDescription", { games: meta.games, picked: heroName(picked.slug), banned: heroName(banned.slug) })
        : t("pages.esports.intro"),
    chemin: PATH,
  });
}

export default async function EsportsPage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
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
    isPartOf: { "@type": "WebSite", name: site.nom, url: site.url },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(jsonLd) }} />
      <EnTetePage titre={t("pages.esports.title")} chapeau={t("pages.esports.intro")} />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section>
          <TitreSection chapeau={t("pages.esports.tournaments.intro")}>{t("pages.esports.tournaments.title")}</TitreSection>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((x) => (
              <li key={x.slug}>
                <TournamentCard tour={x} t={t} locale={locale} now={now} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <TitreSection
            chapeau={
              meta.games > 0
                ? t("pages.esports.meta.intro", {
                    games: meta.games,
                    tournaments: listeNoms(locale, meta.tournaments.map((x) => x.shortName)),
                    days: META_WINDOW_DAYS,
                  })
                : undefined
            }
          >
            {t("pages.esports.meta.title")}
          </TitreSection>
          {meta.games === 0 ? (
            <p className="text-sm text-chalk-500">{t("pages.esports.meta.none")}</p>
          ) : (
            <div className="grid gap-8 md:grid-cols-3">
              <HeroList
                title={t("pages.esports.meta.picked")}
                heroes={meta.picked}
                value={(h) => t("pages.esports.meta.picks", { n: h.picks })}
                detail={(h) => t("pages.esports.meta.presence", { value: pourcentage(locale, h.presence) })}
              />
              <HeroList
                title={t("pages.esports.meta.banned")}
                heroes={meta.banned}
                value={(h) => t("pages.esports.meta.bans", { n: h.bans })}
                detail={(h) => t("pages.esports.meta.presence", { value: pourcentage(locale, h.presence) })}
              />
              <HeroList
                title={t("pages.esports.meta.winners")}
                note={t("pages.esports.meta.winnersNote", { n: meta.minimum })}
                heroes={meta.winners}
                value={(h) => pourcentage(locale, h.winRate ?? 0)}
                detail={(h) => t("pages.esports.meta.record", { wins: h.wins, losses: h.losses })}
              />
            </div>
          )}
        </section>

        <section>
          <TitreSection chapeau={t("pages.esports.versus.intro", { total: versus.total })}>
            {t("pages.esports.versus.title")}
          </TitreSection>
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

function TournamentCard({ tour, t, locale, now }: { tour: Tournament; t: T; locale: Langue; now: Date }) {
  const dates = tournamentDates(t, locale, tour);
  return (
    <Link href={`/esports/${tour.slug}`} className="group block h-full">
      <Carte className="flex h-full flex-col gap-3 group-hover:border-gold-500/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-chalk-500">{tour.shortName}</p>
            <h3 className="font-heading text-lg font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
              {tour.name}
            </h3>
          </div>
          <StatusBadge status={tournamentStatus(tour, now)} t={t} />
        </div>
        <ul className="space-y-1 text-sm text-chalk-300">
          {dates && <li>{dates}</li>}
          {tour.prizePool && <li>{t("pages.esports.card.prize", { amount: formatPrize(locale, tour.prizePool) })}</li>}
          {tour.teamCount && <li>{t("pages.esports.card.teams", { n: tour.teamCount })}</li>}
          {tour.champion && (
            <li className="flex items-center gap-1.5 font-semibold text-gold-400">
              <Trophy size={14} aria-hidden />
              {t("pages.esports.card.champion", { team: tour.champion })}
            </li>
          )}
        </ul>
        <p className="mt-auto flex items-center justify-between gap-2 text-xs text-chalk-500">
          <span>{tour.games ? t("pages.esports.card.games", { n: tour.games }) : t("pages.esports.card.noGames")}</span>
          <span aria-hidden className="font-semibold text-gold-400">
            →
          </span>
        </p>
      </Carte>
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
          const hero = herosParSlug.get(h.slug);
          if (!hero) return null;
          return (
            <li key={h.slug}>
              <Link
                href={`/heroes/${h.slug}`}
                className="bevel-sm group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2 transition-colors hover:border-gold-500/60"
              >
                <PortraitHeros source={hero.images.icon ?? hero.images.portrait} nom={hero.name} taille="petite" decoratif />
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
  locale: Langue;
}) {
  // min-w-0: as a grid item, the table's minimum width would otherwise widen the page.
  return (
    <div className="min-w-0">
      <h3 className="font-heading text-lg font-bold text-chalk-100">{title}</h3>
      <p className="mt-1 mb-3 text-xs text-chalk-500">{note}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-chalk-500">{t("pages.esports.versus.none")}</p>
      ) : (
        <div className="relative overflow-x-auto border border-night-700/70">
          <table className="w-full min-w-[26rem] border-collapse text-sm tabular-nums">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-night-900 text-xs uppercase tracking-wide text-chalk-500">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("pages.esports.versus.hero")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("pages.esports.versus.proColumn")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("pages.esports.versus.rankedColumn")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("pages.esports.versus.gapColumn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hero = herosParSlug.get(r.slug);
                if (!hero) return null;
                return (
                  <tr key={r.slug} className="border-t border-night-800">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal">
                      <Link href={`/heroes/${r.slug}`} className="group flex items-center gap-2">
                        <PortraitHeros
                          source={hero.images.icon ?? hero.images.portrait}
                          nom={hero.name}
                          taille="mini"
                          decoratif
                        />
                        <span className="truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                          {hero.name}
                        </span>
                      </Link>
                    </th>
                    <td className="px-3 py-1.5 text-right text-chalk-100">
                      {t("pages.esports.versus.cell", { value: pourcentage(locale, r.proPresence), rank: r.proRank })}
                    </td>
                    <td className="px-3 py-1.5 text-right text-chalk-300">
                      {t("pages.esports.versus.cell", { value: pourcentage(locale, r.rankedPresence), rank: r.rankedRank })}
                    </td>
                    <td className={cn("px-3 py-1.5 text-right font-semibold", r.gap > 0 ? "text-emerald-400" : "text-blood-500")}>
                      {t("pages.esports.versus.gap", { n: r.gap > 0 ? `+${r.gap}` : r.gap })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

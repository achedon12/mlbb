import Link from "@/components/link";
import { ShortCredit } from "@/components/esports-parts";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import { heroInPro, META_WINDOW_DAYS, rankedPresence } from "@/lib/esports";
import { listNames, percentage } from "@/lib/freshness";
import { rankingFull } from "@/lib/tier-list";

/**
 * A hero in pro play, for its hero page: presence, picks, bans and win rate
 * over the recent tournaments, next to its ranked figures. Renders nothing
 * when the hero was never picked nor banned in the covered games — an empty
 * block would teach the reader nothing.
 */
export function HeroProStats({ slug, locale }: { slug: string; locale: Locale }) {
  const pro = heroInPro(slug);
  const hero = heroesBySlug.get(slug);
  if (!pro || !hero) return null;
  const t = createT(locale);
  const ranked = rankingFull.find((e) => e.hero.slug === slug);
  const share = (n: number) => t("pages.esports.heroPro.share", { value: percentage(locale, (n / pro.games) * 100) });
  const tiles = [
    {
      label: t("pages.esports.heroPro.presence"),
      value: percentage(locale, pro.presence),
      detail: t("pages.esports.heroPro.rank", { rank: pro.rank, total: pro.heroesSeen }),
    },
    { label: t("pages.esports.heroPro.picks"), value: String(pro.picks), detail: share(pro.picks) },
    { label: t("pages.esports.heroPro.bans"), value: String(pro.bans), detail: share(pro.bans) },
    {
      label: t("pages.esports.heroPro.winRate"),
      value: pro.winRate === null ? "—" : percentage(locale, pro.winRate),
      detail: t("pages.esports.meta.record", { wins: pro.wins, losses: pro.losses }),
    },
    ...(ranked
      ? [
          {
            label: t("pages.esports.heroPro.ranked"),
            value: percentage(locale, ranked.winRate),
            detail: t("pages.esports.heroPro.rankedDetail", { value: percentage(locale, rankedPresence(ranked)) }),
          },
        ]
      : []),
  ];

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.esports.heroPro.title", { name: hero.name })}</h3>
        <Link href="/esports" className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500">
          {t("pages.esports.heroPro.link")} →
        </Link>
      </div>
      <p className="mt-1 mb-4 text-sm text-chalk-500">
        {t("pages.esports.heroPro.intro", {
          games: pro.games,
          tournaments: listNames(locale, pro.tournaments.map((x) => x.shortName)),
          days: META_WINDOW_DAYS,
        })}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="bevel-sm border border-night-700/70 bg-night-900/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-chalk-500">{tile.label}</dt>
            <dd className="mt-1 font-heading text-xl font-bold tabular-nums text-gold-400">{tile.value}</dd>
            <dd className="text-xs text-chalk-500">{tile.detail}</dd>
          </div>
        ))}
      </dl>
      <ShortCredit t={t} tournaments={pro.tournaments} className="mt-3" />
    </section>
  );
}

import Image from "next/image";
import Link from "@/components/link";
import { SCROLL_ROW } from "@/components/home/scroll-row";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { illustrations } from "@/lib/data";
import { patchCurrent, percentage } from "@/lib/freshness";
import { rankingFull, type RankedEntry } from "@/lib/tier-list";
import { cn } from "@/lib/utils";

/** Heroes in the patch's top: five read at a glance, the full ranking is one click away. */
const TOP = 5;

/**
 * The number one's art for this row: its second official artwork when it
 * has one (the poster above already shows the first), its first otherwise.
 */
function leaderArt(slug: string): string | null {
  const arts = Object.values(illustrations[slug] ?? {});
  return arts[1] ?? arts[0] ?? null;
}

/**
 * The meta in one screen and one message: who rules the patch. The title
 * names the number one, then the patch's top five stand in a row as large
 * art — the number one twice as wide, in its official artwork, the four
 * others in their tall portraits — each with its rank in a large outlined
 * figure and its name and win rate over the art. One call to action: the
 * tier list. The detailed rankings live on their pages.
 */
export function HomeMeta({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const top = rankingFull.slice(0, TOP);
  const leader = top[0];

  return (
    <section aria-labelledby="home-meta" className={className}>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <h2 id="home-meta" className="max-w-4xl text-chalk-100">
          {leader ? (
            <span className="display-caps block text-balance pr-[0.1em] text-[clamp(2.75rem,1rem+5.6vw,6.5rem)] leading-[0.86]">
              {leader.hero.name} {t("home.meta.rules", { version: patchCurrent.version })}
            </span>
          ) : (
            <span className="type-section">{t("home.meta.title", { version: patchCurrent.version })}</span>
          )}
        </h2>
        <Link href="/tier-list" className="btn btn-primary px-7">
          {t("home.tierListCta")}
        </Link>
      </div>

      {top.length > 0 && (
        <div className="mt-10 sm:mt-14">
          <h3 className="font-heading text-lg font-bold uppercase text-chalk-300">{t("home.meta.top5")}</h3>
          <ol className={cn(SCROLL_ROW, "mt-4 gap-2 lg:grid lg:grid-cols-6 lg:gap-2")}>
            {top.map((e, i) => (
              <li
                key={e.hero.slug}
                className={cn(
                  "shrink-0 snap-start",
                  i === 0 ? "w-[78vw] max-w-[30rem] lg:col-span-2 lg:w-auto lg:max-w-none" : "w-[46vw] max-w-[16rem] lg:w-auto lg:max-w-none",
                )}
              >
                <TopArt entry={e} rank={i + 1} wide={i === 0} locale={locale} t={t} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/**
 * One of the top five, as a tall frame of art: the rank in a large outlined
 * figure at the top, the name and the win rate over the foot, where the
 * night closes in. The art zooms a little on hover.
 */
function TopArt({ entry: e, rank, wide, locale, t }: { entry: RankedEntry; rank: number; wide: boolean; locale: Locale; t: T }) {
  const art = wide ? (leaderArt(e.hero.slug) ?? e.hero.images.portrait) : (e.hero.images.portrait ?? e.hero.images.icon);
  return (
    <Link href={`/heroes/${e.hero.slug}`} className="scheme-dark group relative block h-[26rem] overflow-hidden bg-night-900 sm:h-[30rem] lg:h-[min(34rem,62svh)]">
      {art && (
        <Image
          src={art}
          alt=""
          fill
          sizes={wide ? "(min-width: 1024px) 34vw, 78vw" : "(min-width: 1024px) 17vw, 46vw"}
          className={cn(
            "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
            wide ? "object-[58%_20%]" : "object-[50%_15%]",
          )}
        />
      )}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-night-950 via-night-950/60 to-transparent" />
      <span aria-hidden className="score score-outline absolute left-3 top-2 text-[5rem] sm:text-[6.5rem]">
        {rank}
      </span>
      <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <span
          className={cn(
            "display-caps block truncate pr-[0.12em] text-chalk-100 transition-colors group-hover:text-gold-300",
            wide ? "text-[clamp(2.5rem,1.6rem+2.4vw,4rem)]" : "text-[clamp(1.6rem,1.2rem+1vw,2.25rem)]",
          )}
        >
          {e.hero.name}
        </span>
        <span aria-hidden className="mt-1 block text-sm text-chalk-300">
          <span className="font-semibold text-chalk-100">{percentage(locale, e.winRate)}</span> {t("home.meta.moverRate.winRate")}
          {" · "}
          <span className="font-semibold text-chalk-100">{percentage(locale, e.banRate)}</span> {t("home.meta.moverRate.banRate")}
        </span>
      </span>
      <span className="sr-only">
        {t("home.meta.topLabel", {
          rank,
          tier: e.tier,
          win: percentage(locale, e.winRate),
          ban: percentage(locale, e.banRate),
        })}
      </span>
    </Link>
  );
}

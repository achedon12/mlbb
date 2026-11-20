import Image from "next/image";
import Link from "@/components/link";
import { HeroTile } from "@/components/hero-tile";
import { heroArt } from "@/components/stage";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { FrequentHero } from "@/lib/player-api";
import { formatPercent, plural } from "@/lib/player-format";
import { shownHero } from "@/lib/player-profile";

/**
 * The player's most played heroes, as artwork: the first one large on its
 * official art with its win rate as the screen's big figure, the next ones
 * as a row of portrait tiles with their win rate in gold over them.
 */
export function PlayerTopHeroes({ heroes, t, locale, max = 6 }: { heroes: FrequentHero[]; t: T; locale: Locale; max?: number }) {
  const top = [...heroes]
    .filter((h) => h.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, max)
    .map((h) => ({ ...h, shown: shownHero(h.hero), rate: (h.wins / h.matches) * 100 }));
  if (top.length === 0) return null;
  const [first, ...rest] = top;
  const art = first.shown.slug ? heroArt(first.shown.slug) : null;
  const games = (n: number) => t(`pages.accountProfile.nGames.${plural(n, locale)}`, { n });

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Link
        href={first.shown.slug ? `/heroes/${first.shown.slug}` : "/heroes"}
        className="art-tile card-link group flex min-h-[17rem] flex-col justify-end bg-night-800 p-5 sm:min-h-[20rem] sm:p-7"
      >
        {(art ?? first.shown.portrait) && (
          <span aria-hidden className="absolute inset-0 -z-10">
            <Image
              src={(art ?? first.shown.portrait)!}
              alt=""
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="art-tile-img object-cover object-[55%_20%]"
            />
            <span className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/65 to-transparent" />
          </span>
        )}
        <span className="score block text-[clamp(3.5rem,2.4rem+4vw,5.5rem)]">{formatPercent(first.rate, locale)}</span>
        <span className="display-caps mt-1 block text-[clamp(2.6rem,1.8rem+3vw,4.5rem)] text-chalk-100 transition-colors group-hover:text-gold-300">
          {first.shown.name}
        </span>
        <span className="mt-2 text-sm text-chalk-300">{games(first.matches)}</span>
      </Link>
      {rest.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3">
          {rest.map((h) => (
            <li key={h.hero.hid}>
              <HeroTile
                href={h.shown.slug ? `/heroes/${h.shown.slug}` : "/heroes"}
                name={h.shown.name}
                portrait={h.shown.portrait}
                figure={formatPercent(h.rate, locale)}
                label={`${formatPercent(h.rate, locale)}, ${games(h.matches)}`}
                sizes="(min-width: 1024px) 12rem, 30vw"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

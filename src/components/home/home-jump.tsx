import Image from "next/image";
import Link from "@/components/link";
import { SCROLL_ROW } from "@/components/home/scroll-row";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { illustrations } from "@/lib/data";
import { rankingFull } from "@/lib/tier-list";
import { cn } from "@/lib/utils";

/** The five doors, in the order a player looks for them. */
const DOORS = [
  { href: "/tier-list", label: "nav.tierList.label" },
  { href: "/heroes", label: "nav.heroes.label" },
  { href: "/builds", label: "nav.communityBuilds.label" },
  { href: "/tools", label: "nav.groups.tools" },
  { href: "/esports", label: "nav.esports.label" },
];

/**
 * The art of each door: the official artwork of the heroes ranked just
 * after the top five (the meta section shows those), one per door, so the
 * row changes with the meta and never repeats a face of the page above.
 */
function doorArts(n: number): string[] {
  const arts: string[] = [];
  for (const e of rankingFull.slice(5)) {
    const art = Object.values(illustrations[e.hero.slug] ?? {})[0];
    if (art) arts.push(art);
    if (arts.length === n) break;
  }
  return arts;
}

/**
 * Where to go next, as one row of five tall image tiles of the game's art,
 * each named in large type over its foot: the tier list, the heroes, the
 * players' builds, the tools and esports. On a phone the row scrolls.
 */
export function HomeJump({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const arts = doorArts(DOORS.length);
  return (
    <section aria-labelledby="home-jump" className={className}>
      <h2 id="home-jump" className="display-caps text-[clamp(2.6rem,1.6rem+3vw,4.5rem)] leading-[0.88] text-chalk-100">
        {t("home.jump.title")}
      </h2>
      <ul className={cn(SCROLL_ROW, "mt-8 gap-2 lg:grid lg:grid-cols-5")}>
        {DOORS.map((d, i) => (
          <li key={d.href} className="w-[60vw] max-w-[18rem] shrink-0 snap-start lg:w-auto lg:max-w-none">
            <Link href={d.href} className="scheme-dark group relative block h-[22rem] overflow-hidden bg-night-900 sm:h-[26rem]">
              {arts[i] && (
                <Image
                  src={arts[i]}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20vw, 60vw"
                  className="object-cover object-[55%_25%] transition-transform duration-500 group-hover:scale-[1.03]"
                />
              )}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-night-950 via-night-950/60 to-transparent" />
              <span className="display-caps absolute inset-x-0 bottom-0 p-5 pr-[0.6em] text-[clamp(1.9rem,1.3rem+1.4vw,2.75rem)] leading-[0.9] text-chalk-100 transition-colors group-hover:text-gold-300">
                {t(d.label)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

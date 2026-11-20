import Image from "next/image";
import Link from "@/components/link";
import type { T } from "@/i18n/t";
import {
  labelRarity,
  seriesLabel,
  linkSkin,
  rarityOfRank,
  textPrice,
  type SkinCatalog,
} from "@/lib/skin-catalog";
import { formatRelease } from "@/lib/skins";
import { RarityBlade, RarityGem } from "@/components/skins/skin-tile";
import { ProvisionalBadge } from "@/components/provisional-badge";

/**
 * Skin thumbnail: the shop portrait with its rarity gem and blade, and on
 * the art its name (the whole frame links to the hero's gallery), its hero
 * and a few pre-formatted facts. No state
 * and no translation: the server-rendered calendar and its client-side
 * explorer share it.
 */
export interface PropsCardSkin {
  name: string;
  href: string;
  hero: string;
  heroHref: string;
  image: string | null;
  color: string;
  rarity: string;
  details: string[];
  /** Badge of a skin whose visual may still change, already translated (`ProvisionalBadge`). */
  provisional?: { label: string; hint: string } | null;
}

export function propsCardSkin(
  s: SkinCatalog,
  heroName: string,
  t: T,
  localeHtml: string,
  count: Intl.NumberFormat,
): PropsCardSkin {
  return {
    name: s.name,
    href: linkSkin(s),
    hero: heroName,
    heroHref: `/heroes/${s.hero}`,
    image: s.image,
    color: rarityOfRank(s.rarity).color,
    rarity: labelRarity(t, s.rarity),
    details: [
      s.release ? formatRelease(s.release, localeHtml) : null,
      s.series ? seriesLabel(t, s.series) : null,
      textPrice(s.price, t, count) ?? s.acquisition,
    ].filter((x): x is string => !!x),
  };
}

export function SkinCard({ name, href, hero: heroes, heroHref, image, color, rarity, details, provisional }: PropsCardSkin) {
  return (
    <article className="group relative h-full transition-[translate] duration-200 hover:-translate-y-0.5">
      <div className="bevel-sm relative aspect-[240/390] overflow-hidden bg-night-800">
        <Link href={href} className="absolute inset-0 z-10" aria-label={name} />
        {image && (
          <Image
            src={image}
            alt=""
            width={120}
            height={195}
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          />
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-night-950 via-night-950/80 to-transparent" />
        <RarityGem color={color} className="absolute left-1.5 top-1.5" />
        {provisional && <ProvisionalBadge {...provisional} className="absolute right-1.5 top-1.5" />}
        {/* Everything on the art, nothing under it: the name, the hero, the facts. */}
        <div className="absolute inset-x-0 bottom-0 px-1.5 pb-2 sm:px-2">
          <p aria-hidden className="display-caps line-clamp-2 text-[0.85rem] font-extrabold leading-[0.95] text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-[0.95rem]">
            {name}
          </p>
          <Link
            href={heroHref}
            className="relative z-20 mt-0.5 block truncate text-[0.7rem] font-semibold text-chalk-200 transition-colors hover:text-gold-400"
          >
            {heroes}
          </Link>
          <p className="truncate text-[0.65rem] leading-snug">
            <span style={{ color }}>{rarity}</span>
            {details.map((d) => (
              <span key={d} className="text-chalk-400">
                {" · "}
                {d}
              </span>
            ))}
          </p>
        </div>
        <RarityBlade color={color} />
      </div>
    </article>
  );
}

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

/**
 * Skin thumbnail: shop portrait framed in its rarity colour, its name (linking
 * to the hero's gallery), its hero and a few pre-formatted lines. No state
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

export function SkinCard({ name, href, hero: heroes, heroHref, image, color, rarity, details }: PropsCardSkin) {
  return (
    <article
      className="bevel-sm flex h-full flex-col overflow-hidden border-2 bg-night-900/60"
      style={{ borderColor: color }}
    >
      <Link href={href} className="group block">
        <span className="relative block aspect-[240/390] bg-night-800">
          {image && <Image src={image} alt="" width={120} height={195} className="size-full object-cover" />}
        </span>
        <span className="block px-2 pt-2 text-xs font-semibold leading-snug text-chalk-100 transition-colors group-hover:text-gold-400">
          {name}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-0.5 px-2 pb-2 pt-0.5 text-xs leading-snug">
        <Link href={heroHref} className="text-chalk-300 transition-colors hover:text-gold-400">
          {heroes}
        </Link>
        <span style={{ color }}>{rarity}</span>
        {details.map((d) => (
          <span key={d} className="text-chalk-500">
            {d}
          </span>
        ))}
      </div>
    </article>
  );
}

import Image from "next/image";
import { skinArt } from "@/components/hero-art";
import { ArtTile } from "@/components/poster-header";
import { ProvisionalBadge } from "@/components/provisional-badge";
import type { PropsCardSkin } from "@/components/skin-card";
import type { EventSkin } from "@/lib/events";

/** The skin's full artwork, when the catalogue holds one under its name: never a provisional one. */
export const eventArt = (s: EventSkin) => skinArt(s.hero, s.name);

/**
 * A headline skin of the month (StarLight, Collector): its full artwork as a
 * poster tile, the skin's name in the display face over it, its hero above,
 * the rarity in its own colour under. Without an artwork, the shop portrait
 * stands at the right of the frame.
 */
export function FeatureSkin({
  skin,
  card,
  sizes,
  aspect = "aspect-[16/9]",
}: {
  skin: EventSkin;
  card: PropsCardSkin;
  sizes?: string;
  aspect?: string;
}) {
  const art = eventArt(skin);
  return (
    <ArtTile
      href={card.href}
      art={art}
      name={card.name}
      kicker={card.hero}
      aspect={aspect}
      position="50% 25%"
      sizes={sizes}
      className="h-full"
      figure={card.provisional ? <ProvisionalBadge {...card.provisional} /> : undefined}
      fallback={
        // A provisional visual is not blown up into a poster tile.
        card.image && !skin.provisional ? (
          <span className="absolute inset-y-0 right-0 aspect-[240/390]">
            <Image src={card.image} alt="" fill sizes="12rem" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
          </span>
        ) : null
      }
    >
      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="bevel-sm bg-night-950/85 px-1.5 py-0.5 font-semibold" style={{ color: card.color }}>
          {card.rarity}
        </span>
        {card.details.slice(0, 2).map((d) => (
          <span key={d} className="text-chalk-300">
            {d}
          </span>
        ))}
      </span>
    </ArtTile>
  );
}

import Image from "next/image";
import Link from "@/components/link";
import type { T } from "@/i18n/t";
import { heroesBySlug } from "@/lib/data";
import type { LinkLore, LorePair } from "@/lib/lore";
import type { Hero } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Two heroes linked by their pages, face to face: each one's portrait at an
 * end of the card, the second turned towards the first, and between them what
 * each page says about the other, word for word ("younger brother", "rival").
 * A side stays silent when its page does not name the other hero. `regions`:
 * each one's region label, for the links that cross a region boundary.
 */
export function LorePairCard({
  pair,
  t,
  regions,
}: {
  pair: LorePair;
  t: T;
  regions?: [string | null, string | null];
}) {
  const a = heroesBySlug.get(pair.a);
  const b = heroesBySlug.get(pair.b);
  if (!a || !b) return null;

  const side = (h: Hero, link: LinkLore | null, other: Hero) =>
    link && (
      <div>
        <dt className="text-xs text-chalk-500">
          {h.name} <span aria-hidden>→</span>
          <span className="sr-only"> {t("pages.lore.about")} </span> {other.name}
        </dt>
        <dd className="font-heading text-lg font-bold leading-tight text-gold-300">{link.nature ?? t("pages.lore.noNature")}</dd>
      </div>
    );

  const portrait = (h: Hero, region: string | null | undefined, facing: "right" | "left") => (
    <Link
      href={`/heroes/${h.slug}#story`}
      className="group relative block w-24 shrink-0 sm:w-28"
    >
      <span className="bevel relative block aspect-[240/390] overflow-hidden bg-night-800">
        {(h.images.portrait ?? h.images.icon) && (
          // The second hero turns to face the first.
          <span className={cn("absolute inset-0", facing === "left" && "-scale-x-100")}>
            <Image
              src={(h.images.portrait ?? h.images.icon)!}
              alt=""
              fill
              sizes="7rem"
              className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            />
          </span>
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-night-950 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 p-1.5">
          <span className="display-caps block truncate text-lg text-chalk-100 transition-colors group-hover:text-gold-300">{h.name}</span>
          {region && <span className="block truncate text-[0.7rem] text-chalk-400">{region}</span>}
        </span>
      </span>
    </Link>
  );

  return (
    <div className="bevel flex h-full items-stretch gap-3 bg-night-900 p-2.5 sm:gap-4">
      {portrait(a, regions?.[0], "right")}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 py-2 text-center">
        <span aria-hidden className="eclat mx-auto h-[3px] w-16" />
        <dl className="space-y-3 text-sm leading-relaxed">
          {side(a, pair.deA, b)}
          {side(b, pair.deB, a)}
        </dl>
        <span aria-hidden className="eclat mx-auto h-[3px] w-16 -scale-x-100" />
      </div>
      {portrait(b, regions?.[1], "left")}
    </div>
  );
}

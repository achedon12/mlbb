import Image from "next/image";
import Link from "@/components/link";
import visuals from "@/data/game/visuals.json";
import { itemsFor } from "@/lib/data";

/**
 * Item in a build's purchase order.
 *
 * The image matters more than the name: in game, players recognise their items by
 * their icon. The name stays shown below for those who do not know them yet,
 * and the whole thing links to the item page.
 */
const IMAGES = visuals.items as Record<string, string>;
const BY_NAME = new Map(itemsFor("en").map((o) => [o.name, o]));

export function BuildItem({ name, rank }: { name: string; rank: number }) {
  const item = BY_NAME.get(name);
  const image = item ? IMAGES[item.slug] : undefined;

  const content = (
    <>
      <span className="relative mx-auto block size-11">
        {image ? (
          <Image
            src={image}
            alt=""
            width={44}
            height={44}
            className="size-full object-contain"
          />
        ) : (
          <span className="grid size-full place-items-center bg-night-800 text-xs text-chalk-500">
            {rank}
          </span>
        )}
        {/* The number gives the purchase order, which matters as much as the list. */}
        <span className="absolute -left-1 -top-1 grid size-4 place-items-center bg-gold-500 text-[0.6rem] font-bold text-night-950">
          {rank}
        </span>
      </span>
      <span className="mt-1.5 block text-[0.7rem] leading-tight text-chalk-300">
        {name}
      </span>
    </>
  );

  if (!item) {
    return (
      <li className="bevel-sm border border-night-700 bg-night-850 p-2 text-center">
        {content}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/items/${item.slug}`}
        title={item.bonus ?? item.name}
        className="bevel-sm block border border-night-700 bg-night-850 p-2 text-center transition-colors hover:border-gold-500/60"
      >
        {content}
      </Link>
    </li>
  );
}

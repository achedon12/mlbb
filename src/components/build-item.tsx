import Image from "next/image";
import Link from "@/components/link";
import visuals from "@/data/game/visuals.json";
import { itemsFor } from "@/lib/data";

/**
 * Objet dans l'ordre d'achat d'un build.
 *
 * L'image compte plus que le nom : en jeu, un joueur reconnait ses objets a
 * leur icone. Le nom reste affiche dessous pour qui ne les connait pas encore,
 * et le tout renvoie a la page de l'objet.
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
            fill
            unoptimized
            className="object-contain"
          />
        ) : (
          <span className="grid size-full place-items-center bg-night-800 text-xs text-chalk-500">
            {rank}
          </span>
        )}
        {/* Le rang dit l'ordre d'achat, qui compte autant que la liste. */}
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

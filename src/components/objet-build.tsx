import Image from "next/image";
import Link from "@/components/lien";
import visuels from "@/data/jeu/visuels.json";
import { objets } from "@/lib/donnees";

/**
 * Objet dans l'ordre d'achat d'un build.
 *
 * L'image compte plus que le nom : en jeu, un joueur reconnait ses objets a
 * leur icone. Le nom reste affiche dessous pour qui ne les connait pas encore,
 * et le tout renvoie a la page de l'objet.
 */
const IMAGES = visuels.items as Record<string, string>;
const PAR_NOM = new Map(objets("en").map((o) => [o.name, o]));

export function ObjetBuild({ nom, rang }: { nom: string; rang: number }) {
  const objet = PAR_NOM.get(nom);
  const image = objet ? IMAGES[objet.slug] : undefined;

  const contenu = (
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
            {rang}
          </span>
        )}
        {/* Le rang dit l'ordre d'achat, qui compte autant que la liste. */}
        <span className="absolute -left-1 -top-1 grid size-4 place-items-center bg-gold-500 text-[0.6rem] font-bold text-night-950">
          {rang}
        </span>
      </span>
      <span className="mt-1.5 block text-[0.7rem] leading-tight text-chalk-300">
        {nom}
      </span>
    </>
  );

  if (!objet) {
    return (
      <li className="bevel-sm border border-night-700 bg-night-850 p-2 text-center">
        {contenu}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/items/${objet.slug}`}
        title={objet.bonus ?? objet.name}
        className="bevel-sm block border border-night-700 bg-night-850 p-2 text-center transition-colors hover:border-gold-500/60"
      >
        {contenu}
      </Link>
    </li>
  );
}

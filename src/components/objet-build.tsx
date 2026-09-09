import Image from "next/image";
import Link from "next/link";
import visuelsObjets from "@/data/genere/visuels-objets.json";
import { objets } from "@/lib/donnees";

/**
 * Objet dans l'ordre d'achat d'un build.
 *
 * L'image compte plus que le nom : en jeu, un joueur reconnait ses objets a
 * leur icone. Le nom reste affiche dessous pour qui ne les connait pas encore,
 * et le tout renvoie a la fiche de l'objet.
 */
const IMAGES = visuelsObjets as Record<string, string>;
const PAR_NOM = new Map(objets.map((o) => [o.nom, o]));

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
            sizes="44px"
            loading="eager"
            className="object-contain"
          />
        ) : (
          <span className="grid size-full place-items-center bg-nuit-800 text-xs text-craie-500">
            {rang}
          </span>
        )}
        {/* Le rang dit l'ordre d'achat, qui compte autant que la liste. */}
        <span className="absolute -left-1 -top-1 grid size-4 place-items-center bg-or-500 text-[0.6rem] font-bold text-nuit-950">
          {rang}
        </span>
      </span>
      <span className="mt-1.5 block text-[0.7rem] leading-tight text-craie-300">
        {nom}
      </span>
    </>
  );

  if (!objet) {
    return (
      <li className="biseau-sm border border-nuit-700 bg-nuit-850 p-2 text-center">
        {contenu}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/objets#${objet.slug}`}
        title={objet.bonus ?? objet.nom}
        className="biseau-sm block border border-nuit-700 bg-nuit-850 p-2 text-center transition-colors hover:border-or-500/60"
      >
        {contenu}
      </Link>
    </li>
  );
}

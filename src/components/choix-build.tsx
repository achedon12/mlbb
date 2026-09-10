import Image from "next/image";

/**
 * Un choix de build — embleme, talent ou sort : l'icone d'abord, le nom
 * ensuite. En jeu, on reconnait ces choix a leur icone bien avant de lire leur
 * nom. Sans visuel connu, l'initiale tient la place.
 */
export function ChoixBuild({
  libelle,
  nom,
  image,
}: {
  libelle?: string;
  nom: string;
  image: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-nuit-700 bg-nuit-800">
        {image ? (
          <Image src={image} alt="" fill sizes="36px" loading="eager" className="object-contain" />
        ) : (
          <span className="grid size-full place-items-center text-xs font-semibold text-craie-500">
            {nom.charAt(0)}
          </span>
        )}
      </span>
      <span className="min-w-0">
        {libelle && (
          <span className="block text-[0.65rem] uppercase tracking-wide text-craie-500">{libelle}</span>
        )}
        <span className="block truncate text-sm text-craie-100">{nom}</span>
      </span>
    </div>
  );
}

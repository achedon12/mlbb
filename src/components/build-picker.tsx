import Image from "next/image";
import Link from "@/components/link";

/**
 * Un choix de build — embleme, talent ou sort : l'icone d'abord, le nom
 * ensuite. En jeu, on reconnait ces choix a leur icone bien avant de lire leur
 * nom. Sans visuel connu, l'initiale tient la place. Avec `href`, le choix mene
 * a sa page (embleme, sort).
 */
export function BuildPicker({
  label,
  name,
  image,
  href,
}: {
  label?: string;
  name: string;
  image: string | null;
  href?: string;
}) {
  const content = (
    <>
      <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-night-700 bg-night-800">
        {image ? (
          <Image src={image} alt="" fill unoptimized className="object-contain" />
        ) : (
          <span className="grid size-full place-items-center text-xs font-semibold text-chalk-500">
            {name.charAt(0)}
          </span>
        )}
      </span>
      <span className="min-w-0">
        {label && (
          <span className="block text-[0.65rem] uppercase tracking-wide text-chalk-500">{label}</span>
        )}
        <span className="block truncate text-sm text-chalk-100 transition-colors group-hover:text-gold-400">{name}</span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="group flex min-w-0 items-center gap-2.5">
      {content}
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-2.5">{content}</div>
  );
}

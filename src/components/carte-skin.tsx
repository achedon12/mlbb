import Image from "next/image";
import Link from "@/components/lien";
import type { T } from "@/i18n/t";
import {
  libelleRarete,
  libelleSerie,
  lienSkin,
  rareteDeRang,
  textePrix,
  type SkinCatalogue,
} from "@/lib/catalogue-skins";
import { formaterSortie } from "@/lib/skins";

/**
 * Vignette d'un skin : portrait de boutique cerne de la couleur de sa rarete,
 * son nom (vers la galerie du heros), son heros et quelques lignes deja
 * formatees. Ni etat ni traduction : le calendrier, rendu par le serveur, et
 * son explorateur, cote client, la partagent.
 */
export interface ProprietesCarteSkin {
  nom: string;
  href: string;
  heros: string;
  hrefHeros: string;
  image: string | null;
  couleur: string;
  rarete: string;
  details: string[];
}

export function proprietesCarteSkin(
  s: SkinCatalogue,
  nomHeros: string,
  t: T,
  langueHtml: string,
  nombre: Intl.NumberFormat,
): ProprietesCarteSkin {
  return {
    nom: s.nom,
    href: lienSkin(s),
    heros: nomHeros,
    hrefHeros: `/heroes/${s.heros}`,
    image: s.image,
    couleur: rareteDeRang(s.rarete).couleur,
    rarete: libelleRarete(t, s.rarete),
    details: [
      s.sortie ? formaterSortie(s.sortie, langueHtml) : null,
      s.serie ? libelleSerie(t, s.serie) : null,
      textePrix(s.prix, t, nombre) ?? s.obtention,
    ].filter((x): x is string => !!x),
  };
}

export function CarteSkin({ nom, href, heros, hrefHeros, image, couleur, rarete, details }: ProprietesCarteSkin) {
  return (
    <article
      className="bevel-sm flex h-full flex-col overflow-hidden border-2 bg-night-900/60"
      style={{ borderColor: couleur }}
    >
      <Link href={href} className="group block">
        <span className="relative block aspect-[240/390] bg-night-800">
          {image && <Image src={image} alt="" width={120} height={195} className="size-full object-cover" />}
        </span>
        <span className="block px-2 pt-2 text-xs font-semibold leading-snug text-chalk-100 transition-colors group-hover:text-gold-400">
          {nom}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-0.5 px-2 pb-2 pt-0.5 text-xs leading-snug">
        <Link href={hrefHeros} className="text-chalk-300 transition-colors hover:text-gold-400">
          {heros}
        </Link>
        <span style={{ color: couleur }}>{rarete}</span>
        {details.map((d) => (
          <span key={d} className="text-chalk-500">
            {d}
          </span>
        ))}
      </div>
    </article>
  );
}

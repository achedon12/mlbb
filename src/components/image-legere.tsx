import { getImageProps } from "next/image";

/**
 * Image a taille fixe servie en une seule adresse optimisee, celle du 2x.
 *
 * `next/image` ecrit pour chaque image un `srcset` de deux adresses, un `src`
 * et un style : pres de 400 octets, plus que le reste d'une ligne de tableau.
 * Sur 132 lignes ou une centaine de vignettes, c'etait le premier poste du
 * HTML. L'adresse reste celle de l'optimiseur de Next (redimensionnee, en
 * AVIF ou WebP) ; seul le choix entre 1x et 2x disparait, au profit du 2x.
 */
export function ImageLegere({
  src,
  alt,
  largeur,
  hauteur,
  immediate = false,
  className,
}: {
  src: string;
  alt: string;
  largeur: number;
  hauteur: number;
  /** Premier ecran : chargee tout de suite plutot qu'a l'approche. */
  immediate?: boolean;
  className?: string;
}) {
  const { props } = getImageProps({ src, alt, width: largeur, height: hauteur });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- adresse de l'optimiseur de Next, sans srcset (voir plus haut)
    <img
      src={props.src}
      alt={alt}
      width={largeur}
      height={hauteur}
      loading={immediate ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}

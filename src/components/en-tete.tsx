import Link from "next/link";
import { navigation, site } from "@/lib/site";
import { BoutonCompte } from "./bouton-compte";
import { LienNav } from "./lien-nav";
import { MenuMobile } from "./menu-mobile";

/**
 * En-tete du site.
 *
 * Sans lecture de session cote serveur : l'etat de connexion est charge par
 * `BoutonCompte` apres l'affichage, ce qui laisse toutes les pages de contenu
 * generees au build.
 *
 * La navigation apparait des la largeur des tablettes plutot qu'a partir des
 * grands ecrans : huit liens tiennent largement sur 900 px, et reduire une
 * tablette a un menu burger serait un recul.
 */
export function EnTete() {
  const jeu = navigation.filter((l) => l.groupe === "jeu");
  const actualite = navigation.filter((l) => l.groupe === "actualite");

  return (
    <header className="sticky top-0 z-40 border-b border-nuit-700/70 bg-nuit-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span
            aria-hidden
            className="biseau-sm grid size-8 place-items-center bg-linear-to-br from-or-400 to-or-600 font-titre text-sm font-bold text-nuit-950 transition-transform group-hover:scale-105"
          >
            ML
          </span>
          <span className="font-titre text-lg font-bold tracking-wide text-craie-100">
            {site.nom}
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden md:block">
          <ul className="flex items-center">
            {jeu.map((lien) => (
              <li key={lien.href}>
                <LienNav href={lien.href} label={lien.label} />
              </li>
            ))}

            {/* Separateur entre les deux familles de rubriques. */}
            <li aria-hidden className="mx-2 h-4 w-px bg-nuit-700" />

            {actualite.map((lien) => (
              <li key={lien.href}>
                <LienNav href={lien.href} label={lien.label} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BoutonCompte />
          <MenuMobile />
        </div>
      </div>
    </header>
  );
}

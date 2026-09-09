import Link from "next/link";
import { navigation, site } from "@/lib/site";
import { BoutonCompte } from "./bouton-compte";
import { MenuMobile } from "./menu-mobile";

/**
 * En-tete du site.
 *
 * Volontairement sans lecture de session cote serveur : l'etat de connexion
 * est charge par `BoutonCompte` apres l'affichage, ce qui laisse toutes les
 * pages de contenu generees au build.
 */
export function EnTete() {
  return (
    <header className="sticky top-0 z-40 border-b border-nuit-700/70 bg-nuit-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="biseau-sm grid size-8 place-items-center bg-linear-to-br from-or-400 to-or-600 font-titre text-sm font-bold text-nuit-950"
          >
            ML
          </span>
          <span className="font-titre text-lg font-bold tracking-wide text-craie-100">
            {site.nom}
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navigation.map((lien) => (
              <li key={lien.href}>
                <Link
                  href={lien.href}
                  className="block px-3 py-2 text-sm font-medium text-craie-300 transition-colors hover:text-or-400"
                >
                  {lien.label}
                </Link>
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

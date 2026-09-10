import Link from "@/components/lien";
import type { Langue } from "@/i18n/config";
import { site } from "@/lib/site";
import { BoutonCompte } from "./bouton-compte";
import { MenuBureau } from "./menu-bureau";
import { MenuMobile } from "./menu-mobile";
import { SelecteurLangue } from "./selecteur-langue";

/**
 * En-tete du site.
 *
 * Sans lecture de session cote serveur : l'etat de connexion est charge par
 * `BoutonCompte` apres l'affichage, ce qui laisse toutes les pages de contenu
 * generees au build.
 *
 * La navigation est rangee en deux menus deroulants (`MenuBureau`) a partir des
 * grands ecrans ; en dessous, le menu deplie (`MenuMobile`) prend le relais.
 */
export function EnTete({ langue }: { langue: Langue }) {
  return (
    <header className="sticky top-0 z-40 border-b border-nuit-700/70 bg-nuit-950/85 backdrop-blur">
      {/* Liseré doré en tête, rappel du filet des titres. */}
      <div aria-hidden className="h-px w-full bg-linear-to-r from-transparent via-or-500/60 to-transparent" />
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="biseau-sm grid size-9 place-items-center bg-linear-to-br from-or-400 to-or-600 font-titre text-sm font-bold text-nuit-950 shadow-lg shadow-or-500/20 transition-transform group-hover:scale-105"
          >
            ML
          </span>
          <span className="font-titre text-lg font-bold tracking-wide text-craie-100">
            {site.nom}
          </span>
        </Link>

        <div className="ml-4 hidden lg:block">
          <MenuBureau />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SelecteurLangue langue={langue} />
          <BoutonCompte />
          <MenuMobile />
        </div>
      </div>
    </header>
  );
}

import Link from "@/components/lien";
import type { Langue } from "@/i18n/config";
import { site } from "@/lib/site";
import { BoutonCompte } from "./bouton-compte";
import { MenuBureau } from "./menu-bureau";
import { MenuMobile } from "./menu-mobile";
import { RechercheGlobale } from "./recherche-globale";
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
    <header className="sticky top-0 z-40 border-b border-night-700/70 bg-night-950/85 backdrop-blur">
      {/* Liseré doré en tête, rappel du filet des titres. */}
      <div aria-hidden className="h-px w-full bg-linear-to-r from-transparent via-gold-500/60 to-transparent" />
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="bevel-sm grid size-9 place-items-center bg-linear-to-br from-gold-400 to-gold-600 font-heading text-sm font-bold text-night-950 shadow-lg shadow-gold-500/20 transition-transform group-hover:scale-105"
          >
            ML
          </span>
          <span className="font-heading text-lg font-bold tracking-wide text-chalk-100">
            {site.nom}
          </span>
        </Link>

        <div className="ml-4 hidden lg:block">
          <MenuBureau />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <RechercheGlobale />
          <SelecteurLangue langue={langue} />
          <BoutonCompte />
          <MenuMobile />
        </div>
      </div>
    </header>
  );
}

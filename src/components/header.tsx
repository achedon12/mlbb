import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { site } from "@/lib/site";
import { AccountButton } from "./account-button";
import { DesktopMenu } from "./desktop-menu";
import { MobileMenu } from "./mobile-menu";
import { GlobalSearch } from "./global-search";
import { LocalePicker } from "./locale-picker";

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
export function Header({ locale }: { locale: Locale }) {
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
            {site.name}
          </span>
        </Link>

        <div className="ml-4 hidden lg:block">
          <DesktopMenu />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <GlobalSearch />
          <LocalePicker locale={locale} />
          <AccountButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { site } from "@/lib/site";
import { AccountButton } from "./account-button";
import { DesktopMenu } from "./desktop-menu";
import { MobileMenu } from "./mobile-menu";
import { GlobalSearch } from "./global-search";
import { LocalePicker } from "./locale-picker";

/**
 * Site header.
 *
 * No server-side session read: the sign-in state is loaded by
 * `AccountButton` after render, which keeps every content page generated
 * at build time.
 *
 * Navigation is arranged in two dropdown menus (`DesktopMenu`) from large
 * screens up; below that, the expanded menu (`MobileMenu`) takes over.
 */
export function Header({ locale }: { locale: Locale }) {
  return (
    <header className="sticky top-0 z-40 border-b border-night-700/70 bg-night-950/85 backdrop-blur">
      {/* Gold edge at the top, echoing the heading rule. */}
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

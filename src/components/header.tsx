import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { communityInvite } from "@/lib/bot/public";
import { site } from "@/lib/site";
import { DiscordMark } from "./bot/discord-mark";
import { DiscordJoinLink } from "./discord-join-link";
import { AccountButton } from "./account-button";
import { BrandMark } from "./brand-mark";
import { GlobalSearch } from "./global-search";
import { LocalePicker } from "./locale-picker";
import { SiteNav } from "./site-nav";
import { ThemeButton } from "./theme-button";

/**
 * Site header: the logo, six sections, then search, Discord, theme,
 * language and account. Below `sm` the bar has no room left beside the
 * logo: the theme button moves into the menu sheet, as a full row.
 *
 * No server-side session read: the sign-in state is loaded by
 * `AccountButton` after render, which keeps every content page generated
 * at build time. The sections and their panels come from `SiteNav`, which
 * builds a panel in the browser when it opens.
 */
export function Header({ locale }: { locale: Locale }) {
  const t = createT(locale);
  // Community server invite, inlined at build time; no link without it.
  const discord = communityInvite();
  return (
    // Opaque night, no glass: the page's artwork never shows through the bar.
    <header className="sticky top-0 z-40 border-b border-night-800 bg-night-950/[0.97]">
      <div className="page-wrap flex h-16 items-center gap-2">
        <Link href="/" aria-label={site.name} className="group flex shrink-0 items-center">
          <BrandMark />
        </Link>

        <SiteNav
          label={t("nav.main")}
          openLabel={t("nav.open")}
          closeLabel={t("nav.close")}
          sheetFooter={
            <>
              <ThemeButton variant="row" className="mb-4" />
              {discord && (
                <DiscordJoinLink
                  href={discord}
                  placement="Menu"
                  className="btn btn-primary w-full"
                >
                  <DiscordMark size={18} />
                  {t("common.joinDiscord")}
                </DiscordJoinLink>
              )}
            </>
          }
          actions={
            <>
              <GlobalSearch />
              {discord && (
                // In ally blue: a grey glyph among grey glyphs went unseen.
                <DiscordJoinLink
                  href={discord}
                  placement="Header"
                  label={t("common.joinDiscord")}
                  title={t("common.discordServer")}
                  className="bevel-sm hidden size-9 place-items-center bg-azure-500/15 text-azure-300 transition-colors hover:bg-azure-500 hover:text-night-950 sm:grid"
                >
                  <DiscordMark size={18} />
                </DiscordJoinLink>
              )}
              <ThemeButton className="max-sm:hidden" />
              <LocalePicker locale={locale} />
              <AccountButton />
            </>
          }
        />
      </div>
    </header>
  );
}

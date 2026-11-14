import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { communityInvite } from "@/lib/bot/public";
import { SECTIONS } from "@/lib/sections";
import { site } from "@/lib/site";
import { DiscordMark } from "./bot/discord-mark";
import { AccountButton } from "./account-button";
import { GlobalSearch } from "./global-search";
import { LocalePicker } from "./locale-picker";
import { NavPanel } from "./nav-panel";
import { SiteNav } from "./site-nav";

/**
 * Site header: the logo, six sections, then search, Discord, language and
 * account.
 *
 * No server-side session read: the sign-in state is loaded by
 * `AccountButton` after render, which keeps every content page generated
 * at build time. The section panels are rendered here, on the server; the
 * browser only runs the toggle of `SiteNav`.
 */
export function Header({ locale }: { locale: Locale }) {
  const t = createT(locale);
  // Community server invite, inlined at build time; no link without it.
  const discord = communityInvite();
  return (
    <header className="sticky top-0 z-40 border-b border-night-700/70 bg-night-950/90 backdrop-blur">
      {/* Gold edge at the top, echoing the heading rule. */}
      <div aria-hidden className="h-px w-full bg-linear-to-r from-transparent via-gold-500/60 to-transparent" />
      <div className="page-wrap flex h-16 items-center gap-2">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="bevel-sm grid size-9 place-items-center bg-linear-to-br from-gold-400 to-gold-600 font-heading text-sm font-bold text-night-950 shadow-lg shadow-gold-500/20 transition-transform group-hover:scale-105"
          >
            ML
          </span>
          <span className="font-heading text-lg font-bold tracking-wide text-chalk-100">{site.name}</span>
        </Link>

        <SiteNav
          label={t("nav.main")}
          openLabel={t("nav.open")}
          closeLabel={t("nav.close")}
          items={SECTIONS.map((s) => ({
            key: s.key,
            label: t(`nav.groups.${s.key}`),
            icon: <s.icon size={16} />,
            panel: <NavPanel section={s} t={t} />,
          }))}
          sheetFooter={
            discord && (
              <a
                href={discord}
                rel="noopener"
                className="bevel-sm flex items-center justify-center gap-2 bg-blurple-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blurple-600"
              >
                <DiscordMark size={18} />
                {t("common.joinDiscord")}
              </a>
            )
          }
          actions={
            <>
              <GlobalSearch />
              {discord && (
                <a
                  href={discord}
                  rel="noopener"
                  aria-label={t("common.joinDiscord")}
                  title={t("common.discordServer")}
                  className="hidden size-9 place-items-center rounded-md text-chalk-300 transition-colors hover:text-gold-400 sm:grid"
                >
                  <DiscordMark size={18} />
                </a>
              )}
              <LocalePicker locale={locale} />
              <AccountButton />
            </>
          }
        />
      </div>
    </header>
  );
}

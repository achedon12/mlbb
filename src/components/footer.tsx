"use client";

import Link from "@/components/link";
import { Rss } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import type { T } from "@/i18n/translations";
import { communityInvite } from "@/lib/bot/public";
import { FOOTER, type Chip } from "@/lib/sections";
import { site } from "@/lib/site";
import { DiscordMark } from "./bot/discord-mark";
import { DiscordJoinLink } from "./discord-join-link";
import { SupportFooterLink } from "./support-links";
import { BrandMark } from "./brand-mark";
import { ConsentSettingsButton } from "./consent-banner";
import { Dex } from "./mascot";
import { ThemePicker } from "./theme-picker";

/** Footer link column: one per header section, plus the site's own pages. */
function Column({ title, links, t }: { title: string; links: readonly Chip[]; t: T }) {
  return (
    <nav aria-label={title}>
      <p className="font-heading text-lg font-bold uppercase text-chalk-100">{title}</p>
      {/* Each link a 40 px row: a finger lands on one, not between two. */}
      <ul className="mt-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="inline-flex min-h-10 items-center text-sm text-chalk-400 transition-colors hover:text-gold-300">
              {t(link.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** GitHub mark (Octicons, MIT license): lucide 1.0 dropped brand icons. */
function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * Site footer: the brand's signature (Dex, a line, his page and the
 * Discord), the site's map in six columns, and its credits.
 *
 * Rendered in the browser's bundle rather than on the server: the same
 * forty links in every page wrote their markup out twice, in the HTML and
 * again in the RSC payload. As a client component, the payload only names
 * it; its labels come from the shared catalog (`footer`, `nav`). The year
 * comes from the server, which rendered the page, so that the browser does
 * not write another one over it.
 */
export function Footer({ locale, year }: { locale: Locale; year: number }) {
  const t = useT();
  const discord = communityInvite();

  return (
    <footer className="mt-16 bg-night-900">
      {/* The éclat closes the page, as it separates its sections. */}
      <div aria-hidden className="eclat-rule" />
      {/* The brand's signature: Dex sees the visitor off (still: the page has had its moment), with the way to his page and to the server. */}
      <div className="page-wrap flex items-end gap-4 pt-8 sm:gap-6 sm:pt-10">
        <span className="dex-host shrink-0">
          <span className="block sm:hidden">
            <Dex pose="salut" height={76} still />
          </span>
          <span className="hidden sm:block">
            <Dex pose="salut" height={100} still />
          </span>
        </span>
        <div className="min-w-0 flex-1 pb-1">
          <p className="display-caps text-[1.6rem] leading-none text-chalk-100 sm:text-[2.25rem]">{t("brandSignature.tagline")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/dex" className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-300">
              {t("brandSignature.dexLink")} →
            </Link>
            {discord && (
              <DiscordJoinLink
                href={discord}
                placement="Footer"
                className="bevel-sm flex min-h-9 items-center gap-2 bg-night-800 px-3 text-sm text-chalk-300 transition-[color,background-color,translate] hover:-translate-y-px hover:bg-night-700 hover:text-gold-300"
              >
                <DiscordMark />
                {t("footer.discord")}
              </DiscordJoinLink>
            )}
            <SupportFooterLink className="flex min-h-9 items-center gap-1.5 text-sm text-chalk-400 transition-colors hover:text-gold-300" />
          </div>
        </div>
      </div>
      <div className="page-wrap grid gap-x-12 gap-y-8 py-10 sm:py-12 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div className="relative">
          <Link href={`/${locale}`} aria-label={site.name} className="group flex w-fit items-center">
            <BrandMark />
          </Link>
          <p className="mt-3 line-clamp-3 max-w-xs text-sm leading-relaxed text-chalk-500 sm:line-clamp-none">
            {t("footer.intro")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={site.repository}
              className="bevel-sm flex min-h-9 items-center gap-2 bg-night-800 px-3 text-sm text-chalk-300 transition-[color,background-color,translate] hover:-translate-y-px hover:bg-night-700 hover:text-gold-300"
              rel="noreferrer"
              target="_blank"
            >
              <GithubMark />
              {t("footer.sourceCode")}
            </a>
            <Link
              href="/feed.xml"
              className="bevel-sm flex min-h-9 items-center gap-2 bg-night-800 px-3 text-sm text-chalk-300 transition-[color,background-color,translate] hover:-translate-y-px hover:bg-night-700 hover:text-gold-300"
            >
              <Rss size={16} aria-hidden />
              RSS
            </Link>
          </div>
        </div>

        {/* Two by two on a phone, three on a tablet, all six in a row from `xl`. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 xl:grid-cols-6">
          {FOOTER.map((c) => (
            <Column key={c.key} title={t(`footer.columns.${c.key}`)} links={c.links} t={t} />
          ))}
        </div>
      </div>

      <div className="border-t border-night-800">
        <p className="page-wrap py-3 text-xs text-chalk-500">{t("footer.sources")}</p>
      </div>

      <div className="border-t border-night-800">
        <div className="page-wrap flex flex-col gap-2 py-4 text-xs leading-relaxed text-chalk-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name} — {t("footer.rights", { author: site.author })}
            <span> · {t("footer.version", { v: process.env.VERSION_SITE ?? "" })}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ThemePicker />
            <ConsentSettingsButton className="text-chalk-500 underline-offset-2 transition-colors hover:text-chalk-100 hover:underline" />
            <span>{t("footer.brand")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

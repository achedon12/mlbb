import Link from "@/components/link";
import { Rss } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { communityInvite } from "@/lib/bot/public";
import { FOOTER, type Chip } from "@/lib/sections";
import { site } from "@/lib/site";
import { DiscordMark } from "./bot/discord-mark";

/** Footer link column: one per header section, plus the site's own pages. */
function Column({ title, links, t }: { title: string; links: readonly Chip[]; t: T }) {
  return (
    <nav aria-label={title}>
      <p className="font-heading text-sm font-semibold text-gold-400">{title}</p>
      <ul className="mt-2.5 space-y-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-chalk-500 transition-colors hover:text-chalk-100">
              {t(link.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const YEAR = new Date().getFullYear();

/** GitHub mark (Octicons, MIT license): lucide 1.0 dropped brand icons. */
function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const discord = communityInvite();

  return (
    <footer className="mt-16 border-t border-night-700/70 bg-night-900/40">
      <div className="page-wrap grid gap-x-12 gap-y-8 py-8 sm:py-12 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div>
          <Link href={`/${locale}`} className="group flex items-center gap-2.5">
            <span
              aria-hidden
              className="bevel-sm grid size-8 place-items-center bg-linear-to-br from-gold-400 to-gold-600 font-heading text-sm font-bold text-night-950"
            >
              ML
            </span>
            <span className="font-heading text-lg font-bold tracking-wide text-chalk-100">{site.name}</span>
          </Link>
          <p className="mt-3 line-clamp-3 max-w-xs text-sm leading-relaxed text-chalk-500 sm:line-clamp-none">
            {t("footer.intro")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={site.repository}
              className="flex items-center gap-2 text-sm text-chalk-300 transition-colors hover:text-gold-400"
              rel="noreferrer"
              target="_blank"
            >
              <GithubMark />
              {t("footer.sourceCode")}
            </a>
            <Link
              href="/feed.xml"
              className="flex items-center gap-2 text-sm text-chalk-300 transition-colors hover:text-gold-400"
            >
              <Rss size={16} aria-hidden />
              RSS
            </Link>
            {discord && (
              <a
                href={discord}
                className="flex items-center gap-2 text-sm text-chalk-300 transition-colors hover:text-gold-400"
                rel="noopener"
              >
                <DiscordMark />
                {t("footer.discord")}
              </a>
            )}
          </div>
        </div>

        {/* Two by two on a phone, three on a tablet, all six in a row from `xl`. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 xl:grid-cols-6">
          {FOOTER.map((c) => (
            <Column key={c.key} title={t(`footer.columns.${c.key}`)} links={c.links} t={t} />
          ))}
        </div>
      </div>

      <div className="border-t border-night-800/80">
        <p className="page-wrap py-3 text-xs text-chalk-600">{t("footer.sources")}</p>
      </div>

      <div className="border-t border-night-800">
        <div className="page-wrap flex flex-col gap-2 py-4 text-xs leading-relaxed text-chalk-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {YEAR} {site.name} — {t("footer.rights", { author: site.author })}
            <span className="text-chalk-600"> · {t("footer.version", { v: process.env.VERSION_SITE ?? "" })}</span>
          </p>
          <p className="text-chalk-600">{t("footer.brand")}</p>
        </div>
      </div>
    </footer>
  );
}

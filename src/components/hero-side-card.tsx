import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { RoleBadge } from "@/components/role-badge";
import { BadgeTier } from "@/components/ui";
import { counters, heroesBySlug } from "@/lib/data";
import { duos } from "@/lib/duos";
import { percentage } from "@/lib/freshness";
import { heroGallery } from "@/lib/hero-skins";
import { rateBySlug } from "@/lib/tier-list";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { cn } from "@/lib/utils";

/**
 * The hero's card beside a hero sub-page (counters, duos, skins), from `xl`
 * up: who the page is about, its tier and win rate, and the way to its other
 * pages. The hero page has the full version of it; this one stays sticky
 * while the tables scroll.
 */
export function HeroSideCard({ slug, locale, current }: { slug: string; locale: Locale; current: string }) {
  const h = heroesBySlug.get(slug);
  if (!h) return null;
  const t = createT(locale);
  const rate = rateBySlug.get(slug);
  const pages = [
    { href: `/heroes/${slug}`, label: t("pages.heroDetail.tab.analysis") },
    ...(counters[slug] ? [{ href: `/heroes/${slug}/counters`, label: t("pages.heroDetail.tab.counters") }] : []),
    ...(duos[slug] ? [{ href: `/heroes/${slug}/duos`, label: t("pages.heroDetail.duosShort") }] : []),
    ...(heroGallery(h).total > 0 ? [{ href: `/heroes/${slug}/skins`, label: t("pages.heroDetail.tab.skins") }] : []),
  ];

  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
      <Link href={`/heroes/${slug}`} className="group flex items-center gap-3">
        <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="thumb" decorative />
        <span className="min-w-0">
          <span className="block truncate font-heading text-xl font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
            {h.name}
          </span>
          {h.title && <span className="block truncate text-sm text-gold-400">{h.title}</span>}
        </span>
      </Link>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {h.roles.map((r) => (
          <RoleBadge key={r} role={r} />
        ))}
      </div>
      {rate && (
        <dl className="mt-4 flex items-center gap-4 border-t border-night-800 pt-4 text-sm">
          <div className="flex items-center gap-2">
            <dt className="sr-only">{t("pages.heroDetail.stat.tierList")}</dt>
            <dd>
              <BadgeTier tier={rate.tier} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-chalk-500">{t("pages.heroDetail.stat.winRate")}</dt>
            <dd className="font-semibold tabular-nums text-chalk-100">{percentage(locale, rate.win)}</dd>
          </div>
          <div>
            <dt className="text-xs text-chalk-500">{t("pages.heroDetail.stat.banRate")}</dt>
            <dd className="font-semibold tabular-nums text-chalk-100">{percentage(locale, rate.ban)}</dd>
          </div>
        </dl>
      )}
      <nav aria-label={h.name} className="mt-4 border-t border-night-800 pt-3">
        <ul className="space-y-0.5">
          {pages.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={p.href === current ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition-colors",
                  p.href === current ? "bg-night-800 text-gold-400" : "text-chalk-300 hover:bg-night-800/60 hover:text-gold-400",
                )}
              >
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * Two columns for a hero sub-page from `xl` up: the hero's card on the left,
 * sticky, the page's content beside it. Below, the content alone.
 */
export function HeroSubLayout({
  slug,
  locale,
  current,
  className,
  children,
}: {
  slug: string;
  locale: Locale;
  current: string;
  /** Spacing of the content column. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-wrap xl:grid xl:grid-cols-[17rem_minmax(0,1fr)] xl:items-start xl:gap-10">
      <aside className="hidden xl:sticky xl:top-24 xl:mt-8 xl:block">
        <HeroSideCard slug={slug} locale={locale} current={current} />
      </aside>
      <div className={cn("min-w-0", className)}>{children}</div>
    </div>
  );
}

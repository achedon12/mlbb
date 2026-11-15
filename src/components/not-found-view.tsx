"use client";

import Link from "@/components/link";
import { SearchAllButton } from "@/components/home/search-all-button";
import { useT } from "@/i18n/provider";

/**
 * Body of the site's 404 page, in the visitor's language: what happened and
 * where to go next (search, heroes, tier list, home).
 *
 * Shared by `[locale]/not-found.tsx` (the boundary every `notFound()` lands
 * in the browser) and `NotFoundPage`, which renders it on the server so the
 * 404 HTML is never an empty shell. Both render the exact same markup: when
 * the boundary takes over on the client, nothing moves.
 */
export function NotFoundView() {
  const t = useT();
  const secondary =
    "bevel-sm border border-night-600 px-6 py-3 font-semibold text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400";
  return (
    // `data-not-found`: the audience measurement files this view as a 404.
    <div data-not-found className="mx-auto max-w-2xl px-4 py-32 text-center">
      <p className="font-heading text-6xl font-bold text-gold-400">404</p>
      <h1 className="mt-4 font-heading text-2xl font-bold text-chalk-100">{t("pages.notFound.title")}</h1>
      <p className="mt-4 leading-relaxed text-chalk-500">{t("pages.notFound.text")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="bevel-sm bg-gold-500 px-6 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {t("pages.notFound.home")}
        </Link>
        <Link href="/heroes" className={secondary}>
          {t("pages.notFound.heroes")}
        </Link>
        <Link href="/tier-list" className={secondary}>
          {t("pages.notFound.tierList")}
        </Link>
      </div>
      <div className="mt-6 flex justify-center">
        <SearchAllButton label={t("pages.notFound.search")} />
      </div>
    </div>
  );
}

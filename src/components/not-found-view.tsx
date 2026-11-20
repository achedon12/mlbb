"use client";

import { ArrowRight, House, Swords, Trophy } from "lucide-react";
import Link from "@/components/link";
import { DexScreen } from "@/components/dex-screen";
import { SearchAllButton } from "@/components/home/search-all-button";
import { useT } from "@/i18n/provider";

/**
 * Body of the site's 404 page, in the visitor's language: Dex, surprised,
 * what happened and where to go next (home, heroes, tier list, search).
 *
 * Shared by `[locale]/not-found.tsx` (the boundary every `notFound()` lands
 * in the browser) and `NotFoundPage`, which renders it on the server so the
 * 404 HTML is never an empty shell. Both render the exact same markup: when
 * the boundary takes over on the client, nothing moves.
 */
export function NotFoundView() {
  const t = useT();
  const doors = [
    { href: "/", icon: House, title: t("pages.notFound.home"), text: t("pages.notFound.homeText") },
    { href: "/heroes", icon: Swords, title: t("pages.notFound.heroes"), text: t("pages.notFound.heroesText") },
    { href: "/tier-list", icon: Trophy, title: t("pages.notFound.tierList"), text: t("pages.notFound.tierListText") },
  ];
  return (
    // `data-not-found`: the audience measurement files this view as a 404.
    <DexScreen
      data-not-found
      figure="404"
      pose="surpris"
      title={t("pages.notFound.title")}
      text={t("pages.notFound.text")}
      line={t("pages.notFound.dexLine")}
      actions={
        <>
          <Link href="/" className="btn btn-primary">
            {t("pages.notFound.home")}
            <ArrowRight size={17} aria-hidden />
          </Link>
          <Link href="/heroes" className="btn btn-secondary">
            {t("pages.notFound.heroes")}
          </Link>
        </>
      }
    >
      <p className="mt-5">
        <SearchAllButton label={t("pages.notFound.search")} />
      </p>
      <ul className="mt-8 grid max-w-2xl gap-2 sm:grid-cols-3">
        {doors.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link href={href} className="card-link group flex h-full flex-col gap-1 p-4">
              <Icon size={20} aria-hidden className="text-gold-400" />
              <span className="mt-1 font-heading text-lg font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-300">
                {title}
              </span>
              <span className="text-sm leading-snug text-chalk-500">{text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DexScreen>
  );
}

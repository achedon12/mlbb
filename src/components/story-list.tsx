"use client";

import { useMemo, useState } from "react";
import { SearchField } from "@/components/search-field";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { useT } from "@/i18n/provider";
import { keySearch } from "@/lib/utils";

/** A hero of the list, as a tuple: slug, name, tagline, icon, already normalised search terms. */
export type EntryStory = [slug: string, name: string, tagline: string | null, icon: string | null, terms: string];

export interface GroupStories {
  key: string;
  /** Region name, in the page's language. */
  name: string;
  heroes: EntryStory[];
}

/**
 * All the stories, by region, with a search on the name, full name, title
 * and affiliations. The server renders the whole list; the browser only
 * receives these tuples, not the tree of a hundred and thirty cards a second
 * time.
 */
export function StoryList({ groups, total }: { groups: GroupStories[]; total: number }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const term = keySearch(search.trim());
  const visible = useMemo(
    () =>
      term
        ? groups
            .map((g) => ({ ...g, heroes: g.heroes.filter((h) => h[4].includes(term)) }))
            .filter((g) => g.heroes.length > 0)
        : groups,
    [groups, term],
  );
  const found = visible.reduce((n, g) => n + g.heroes.length, 0);

  return (
    <div>
      <SearchField value={search} onChange={setSearch} label={t("pages.loreUI.search")} className="max-w-md" />
      <p aria-live="polite" className="mt-3 text-sm text-chalk-500">
        {!term
          ? t("pages.loreUI.total", { n: total })
          : found === 0
            ? t("pages.loreUI.none")
            : t(found === 1 ? "pages.loreUI.found1" : "pages.loreUI.found", { n: found })}
      </p>
      {visible.map((g) => (
        <section key={g.key} className="mt-8">
          <h3 className="flex items-baseline justify-between gap-3 border-b border-night-800 pb-2">
            <Link href={`/lore/${g.key}`} className="font-heading text-xl font-bold text-chalk-100 hover:text-gold-400">
              {g.name}
            </Link>
            <span className="shrink-0 text-xs text-chalk-500">
              {t(g.heroes.length === 1 ? "pages.loreUI.nHeroes1" : "pages.loreUI.nHeroes", { n: g.heroes.length })}
            </span>
          </h3>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.heroes.map(([slug, name, tagline, icon]) => (
              <li key={slug}>
                <Link
                  href={`/heroes/${slug}#histoire`}
                  className="bevel-sm flex h-full items-start gap-3 border border-night-700/50 bg-night-900/40 p-3 transition-colors hover:border-gold-500/60"
                >
                  <HeroPortrait source={icon} name={name} size="icon" decorative />
                  <span className="min-w-0">
                    <span className="block font-semibold text-chalk-100">{name}</span>
                    {tagline && <span className="line-clamp-2 text-sm leading-snug text-chalk-400">{tagline}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

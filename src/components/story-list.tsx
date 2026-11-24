"use client";

import { useMemo, useState } from "react";
import { SearchField } from "@/components/search-field";
import Link from "@/components/link";
import Image from "next/image";
import { Dex } from "@/components/mascot";
import { useT } from "@/i18n/provider";
import { keySearch } from "@/lib/utils";

/** A hero of the list, as a tuple: slug, name, tagline, portrait (the icon as a fallback), already normalised search terms. */
export type EntryStory = [slug: string, name: string, tagline: string | null, portrait: string | null, terms: string];

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
      <div className="mt-3 flex items-end gap-3">
        {/* Nothing found: Dex is let down, beside the message. */}
        {term && found === 0 && <Dex pose="triste" height={96} />}
        <p aria-live="polite" className={found === 0 && term ? "dex-bubble text-sm" : "text-sm text-chalk-500"}>
          {!term
            ? t("pages.loreUI.total", { n: total })
            : found === 0
              ? t("pages.loreUI.none")
              : t(found === 1 ? "pages.loreUI.found1" : "pages.loreUI.found", { n: found })}
        </p>
      </div>
      {visible.map((g) => (
        <section key={g.key} className="mt-10">
          <h3 className="flex items-end justify-between gap-3">
            <Link href={`/lore/${g.key}`} className="display-caps text-3xl text-chalk-100 transition-colors hover:text-gold-300">
              {g.name}
            </Link>
            <span className="shrink-0 text-xs text-chalk-500">
              {t(g.heroes.length === 1 ? "pages.loreUI.nHeroes1" : "pages.loreUI.nHeroes", { n: g.heroes.length })}
            </span>
          </h3>
          <div aria-hidden className="eclat-rule mt-3" />
          <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {g.heroes.map(([slug, name, tagline, portrait]) => (
              <li key={slug}>
                <Link
                  href={`/heroes/${slug}#story`}
                  className="bevel group flex h-full items-stretch gap-3 bg-night-900 pr-3 transition-[translate,background-color] duration-200 hover:-translate-y-0.5 hover:bg-night-850"
                >
                  <span className="relative w-16 shrink-0 overflow-hidden bg-night-800 sm:w-[4.5rem]">
                    {portrait && (
                      <Image
                        src={portrait}
                        alt=""
                        width={72}
                        height={117}
                        className="size-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                      />
                    )}
                  </span>
                  <span className="min-w-0 self-center py-2.5">
                    <span className="display-caps block text-xl text-chalk-100 transition-colors group-hover:text-gold-300">{name}</span>
                    {tagline && <span className="mt-1 line-clamp-2 text-sm italic leading-snug text-chalk-400">{tagline}</span>}
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

"use client";

import Image from "next/image";
import { useDeferredValue, useState } from "react";
import { Search, Users } from "lucide-react";
import { useT } from "@/i18n/provider";
import { keySearch } from "@/lib/utils";

/**
 * The game account's friends, as cards: avatar (or initials) and name. The
 * service gives nothing else — no id, no rank — so a friend cannot be linked
 * to a profile. A long list gets a search field and is cut to its first
 * cards until asked.
 */
const FIRST = 12;
const SEARCH_FROM = 9;

export function AccountFriends({ friends }: { friends: { name: string; avatar: string | null }[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const q = keySearch(useDeferredValue(query).trim());
  const found = q ? friends.filter((f) => keySearch(f.name).includes(q)) : friends;
  const shown = q || all ? found : found.slice(0, FIRST);

  return (
    <div>
      {friends.length >= SEARCH_FROM && (
        <label className="bevel mb-4 flex min-h-12 items-center gap-3 bg-night-900 px-4 focus-within:shadow-[inset_0_0_0_1px_var(--color-gold-500)] sm:max-w-sm">
          <Search size={16} aria-hidden className="shrink-0 text-chalk-500" />
          <span className="sr-only">{t("pages.account.hub.friendsSearch")}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pages.account.hub.friendsSearch")}
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-chalk-100 placeholder:text-chalk-500 focus:outline-none sm:text-sm"
          />
        </label>
      )}
      {shown.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-chalk-400">
          <Users size={16} aria-hidden />
          {t("pages.account.hub.friendsNone", { q: query.trim() })}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((friend, i) => (
            <li
              key={`${friend.name}-${i}`}
              className="bevel group relative flex flex-col items-center gap-2.5 overflow-hidden bg-linear-to-b from-night-800 to-night-900 px-3 pb-4 pt-5 text-center transition-[translate] duration-200 hover:-translate-y-0.5"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-linear-to-r from-transparent via-gold-500/70 to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
              <span className="bevel relative size-16 shrink-0 overflow-hidden bg-night-950 shadow-[0_0_0_2px_rgb(245_196_81/0.35)] sm:size-[4.5rem]">
                {friend.avatar ? (
                  <Image src={friend.avatar} alt="" fill sizes="72px" className="object-cover" />
                ) : (
                  <span className="display-caps grid size-full place-items-center text-2xl text-chalk-500">{friend.name.slice(0, 2).toUpperCase() || "?"}</span>
                )}
              </span>
              <span className="w-full truncate font-heading text-base font-semibold text-chalk-100">{friend.name || "?"}</span>
            </li>
          ))}
        </ul>
      )}
      {!q && found.length > FIRST && (
        <button type="button" onClick={() => setAll((a) => !a)} className="btn btn-secondary btn-sm mt-4 w-full sm:w-auto">
          {all ? t("pages.account.hub.friendsFewer") : t("pages.account.hub.friendsAll", { n: found.length })}
        </button>
      )}
    </div>
  );
}

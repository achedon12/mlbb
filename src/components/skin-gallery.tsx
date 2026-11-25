"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/link";
import { Pager } from "@/components/pager";
import { SearchField } from "@/components/search-field";
import Image from "next/image";
import { DexSays } from "@/components/mascot";
import { ENTRANCE } from "@/components/poster-header";
import { SkinTile } from "@/components/skins/skin-tile";
import { ChoiceUnique } from "@/components/chip";
import { ChipActive, FilterBar, ResetFilters } from "@/components/filter-bar";
import { useLocale, useT } from "@/i18n/provider";
import { RARITY_ORIGIN, RARITIES } from "@/lib/rarities";
import { uniqueAnchors, filterGroups, imageOfThumb, type GroupSkins } from "@/lib/skins";
import { imageRole } from "@/lib/emblems";
import { pageHref, paging, pathWithoutPage, slicePage } from "@/lib/pager";
import { ROLES } from "@/lib/statistics-table";
import type { Role } from "@/lib/types";

/**
 * Hero galleries per page. A hero has seven skins on average, four per row on
 * a phone: a gallery runs about two thirds of a screen, so four of them keep
 * the section under three — the reader after one hero in particular goes
 * through the index at the foot of the page rather than through here.
 */
const BY_PAGE = 4;

/** Outline colour per rarity rank; 0 stands for the default skin or an unknown rarity. */
const COLORS = [
  RARITY_ORIGIN.color,
  ...Object.values(RARITIES)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.color),
];

/**
 * Filterable gallery of every skin, grouped by hero.
 *
 * Thumbnails arrive as compact tuples (`SkinThumb`): a thousand skins reach
 * the browser for a few tens of KB. Filter by role, search on the hero or
 * skin name, and read it one page of heroes at a time: the "show twelve more"
 * button grew the page without end and left no way back, where
 * `/skins/page/n` is an address the server prerenders and a crawler follows.
 * Each hero opens on a banner of their artwork, then the wall of their
 * portraits framed by rarity.
 */
export function SkinGallery({
  groups,
  arts,
  page: pageServer = 1,
}: {
  groups: GroupSkins[];
  /** Each hero's main artwork, for the banner over their skins. */
  arts?: Record<string, string>;
  page?: number;
}) {
  const t = useT();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [page, setPage] = useState(pageServer);

  // Same rule as the hero catalogue: the server render starts unfiltered,
  // the URL (?q=, ?role=) is only read after mount, then follows every change.
  const rise = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!rise.current) {
      rise.current = true;
      const q = params.get("q");
      const roleUrl = ROLES.find((r) => r === params.get("role")) ?? null;
      if (q || roleUrl) {
        /* eslint-disable react-hooks/set-state-in-effect -- reading the URL after mount */
        if (q) setSearch(q);
        if (roleUrl) setRole(roleUrl);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    const values: [string, string | null][] = [
      ["q", search.trim() || null],
      ["role", role],
    ];
    for (const [key, value] of values) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // The page is a path segment, the filters a query.
    window.history.replaceState(null, "", pageHref(pathWithoutPage(window.location.pathname), params, page));
  }, [search, role, page]);

  // Anchors computed on the full gallery: a filter must not shift them.
  const anchors = useMemo(
    () =>
      new Map(
        groups.map((g) => {
          const names = g.skins.map(([name]) => name);
          const list = uniqueAnchors(names);
          const byName = new Map<string, string>();
          names.forEach((name, i) => byName.has(name) || byName.set(name, list[i]));
          return [g.slug, byName];
        }),
      ),
    [groups],
  );

  const results = useMemo(() => filterGroups(groups, { role, search }), [groups, role, search]);
  const view = paging(results.length, page, BY_PAGE);
  const visible = slicePage(results, view.page, BY_PAGE);
  const total = results.reduce((n, g) => n + g.skins.length, 0);
  const request = new URLSearchParams([
    ...(search.trim() ? [["q", search.trim()] as [string, string]] : []),
    ...(role ? [["role", role] as [string, string]] : []),
  ]);
  const count = new Intl.NumberFormat(locale);
  const filtered = !!search.trim() || role !== null;
  const reset = () => {
    setSearch("");
    setRole(null);
    setPage(1);
  };
  const plural = new Intl.PluralRules(locale);

  return (
    <div>
      <FilterBar
        content={
          <>
            {results.length === 0 ? (
              <DexSays pose="surpris" height={110} className="mt-10">
                <p className="text-chalk-200">{t("pages.heroesList.none")}</p>
                {filtered && <ResetFilters onClick={reset} />}
              </DexSays>
            ) : (
              <div className="space-y-12 sm:space-y-16">
                {visible.map((g, n) => {
                  const art = arts?.[g.slug];
                  return (
                    <section key={g.slug} aria-labelledby={`skins-${g.slug}`} className={n === 0 ? ENTRANCE : undefined}>
                      {/* The hero's banner: their artwork, the name over it, the way to the full gallery. */}
                      <div className="bevel relative isolate flex min-h-[7.5rem] items-end overflow-hidden bg-night-900 sm:min-h-[10rem]">
                        {art && (
                          <Image
                            src={art}
                            alt=""
                            fill
                            sizes="(min-width: 1280px) 70vw, 100vw"
                            className="-z-10 object-cover object-[60%_22%]"
                          />
                        )}
                        <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-night-950 via-night-950/75 to-night-950/10" />
                        <span aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-linear-to-t from-night-950/80 to-transparent" />
                        <div className="flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-2 p-4 sm:p-5">
                          <h3 id={`skins-${g.slug}`} className="display-caps text-[clamp(2rem,1.4rem+2.2vw,3.25rem)] text-chalk-100">
                            {g.name}
                            <span className="ml-3 font-body text-sm font-medium normal-case not-italic tracking-normal text-chalk-300">
                              {t(`pages.skinsGallery.count.${plural.select(g.skins.length) === "one" ? "one" : "other"}`, {
                                n: g.skins.length,
                              })}
                            </span>
                          </h3>
                          <Link href={`/heroes/${g.slug}/skins`} prefetch={false} className="btn btn-secondary btn-sm">
                            {t("pages.skinsGallery.seeAll")} →
                          </Link>
                        </div>
                      </div>
                      {/* Four portraits per row on a phone: the same wall in two thirds of the height. */}
                      <ul className="mt-2.5 grid grid-cols-4 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] sm:gap-2.5">
                        {g.skins.map((thumb, k) => {
                          const [name, , rarity] = thumb;
                          const src = imageOfThumb(g.slug, thumb);
                          return (
                            <li key={`${name}-${k}`}>
                              <SkinTile
                                href={`/heroes/${g.slug}/skins#${anchors.get(g.slug)?.get(name) ?? ""}`}
                                prefetch={false}
                                src={src}
                                name={name}
                                alt={t("pages.skinsGallery.alt", { hero: g.name, skin: name })}
                                color={COLORS[rarity] ?? COLORS[0]}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}

            <Pager paging={view} href={(n) => pageHref("/skins", request, n)} onNavigate={setPage} t={t} />
          </>
        }
        search={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            label={t("pages.heroesList.search")}
            dense
          />
        }
        active={
          role && (
            <ChipActive
              label={t(`roles.${role}`)}
              emblem={imageRole(role)}
              onRemove={() => {
                setRole(null);
                setPage(1);
              }}
            />
          )
        }
        clear={filtered ? { label: t("common.clearFilters"), onClick: reset } : undefined}
        count={
          <span aria-live="polite">
            {t("pages.skinsGallery.account", { h: results.length, n: count.format(total) })}
          </span>
        }
      >
        <ChoiceUnique
          legend={t("pages.heroesList.role")}
          values={ROLES}
          active={role}
          onChange={(r) => {
            setRole(r);
            setPage(1);
          }}
          label={(r) => t(`roles.${r}`)}
          emblem={imageRole}
        />
      </FilterBar>
    </div>
  );
}

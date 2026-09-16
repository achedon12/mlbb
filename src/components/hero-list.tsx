"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HeroCard, type HeroPreview } from "@/components/hero-card";
import { Pager } from "@/components/pager";
import type { Lane, Role } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { SearchField } from "@/components/search-field";
import { FilterGroup, Chip } from "@/components/chip";
import { ChipActive, FilterBar } from "@/components/filter-bar";
import { imageLane, imageRole } from "@/lib/emblems";
import { pageHref, paging, pathWithoutPage, slicePage, SIZE_CARDS } from "@/lib/pager";
import { keySearch } from "@/lib/utils";
import { laneFromParam } from "@/lib/draft";

const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
const LANES: Lane[] = ["Gold", "Exp", "Mid", "Jungle", "Roam"];

type Sort = "name" | "win" | "tier";
const SORTS: { key: Sort; keyI18n: string }[] = [
  { key: "name", keyI18n: "sortName" },
  { key: "win", keyI18n: "sortWin" },
  { key: "tier", keyI18n: "sortTier" },
];
const RANK_TIER: Record<string, number> = { "S+": 0, S: 1, A: 2, B: 3, C: 4 };

/**
 * Filterable, paged catalogue.
 *
 * Filtering happens on the client from the data already in
 * the page: no network round trip on each click, for a volume that stays
 * small once unused fields are dropped.
 *
 * A hundred and thirty-four cards ran twenty screens on a phone. Only one
 * page of them is rendered — the one the address names, `/heroes/page/4`,
 * which the server prerenders and opens without a line of JavaScript — and a
 * change of filter starts again at the first page, since the fourth page of
 * eleven results holds nothing.
 */
export function HeroList({ heroes, page: pageServer = 1 }: { heroes: HeroPreview[]; page?: number }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(pageServer);

  // Search, role and lane go through the URL on the client, which keeps the
  // page static and makes a filter shareable, reachable from the home page,
  // a hero page's breadcrumb or the search engine's search action. Server and
  // first hydration start empty (identical, so no mismatch);
  // only after mount do we adopt ?q=, ?role= and ?lane=, then every
  // change is written back to the URL.
  const rise = useRef(false);
  useEffect(() => {
    if (!rise.current) {
      rise.current = true;
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      const roleUrl = ROLES.find((r) => r === params.get("role")) ?? null;
      const laneUrl = laneFromParam(params.get("lane"));
      if (q || roleUrl || laneUrl) {
        /* eslint-disable react-hooks/set-state-in-effect -- reading the URL after mount */
        if (q) setSearch(q);
        if (roleUrl) setRole(roleUrl);
        if (laneUrl) setLane(laneUrl);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    const params = new URLSearchParams(window.location.search);
    const values: [string, string | null][] = [
      ["q", search.trim() || null],
      ["role", role],
      ["lane", lane],
    ];
    for (const [key, value] of values) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // The page is a path segment, the filters a query: paging in place writes
    // the address the pager's link already held.
    window.history.replaceState(null, "", pageHref(pathWithoutPage(window.location.pathname), params, page));
  }, [search, role, lane, page]);

  const results = useMemo(() => {
    const term = keySearch(search.trim());
    const filters = heroes.filter((h) => {
      if (term && !keySearch(h.name).includes(term)) return false;
      if (role && !h.roles.includes(role)) return false;
      if (lane && !h.lanes.includes(lane)) return false;
      return true;
    });

    const ordered = [...filters];
    if (sort === "win") {
      // Unmeasured heroes go to the end of the list.
      ordered.sort((a, b) => (b.win ?? -1) - (a.win ?? -1));
    } else if (sort === "tier") {
      ordered.sort(
        (a, b) =>
          (RANK_TIER[a.tier ?? ""] ?? 99) - (RANK_TIER[b.tier ?? ""] ?? 99) ||
          (b.win ?? -1) - (a.win ?? -1),
      );
    } else {
      ordered.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }
    return ordered;
  }, [heroes, search, role, lane, sort]);

  const view = paging(results.length, page, SIZE_CARDS);
  const slice = slicePage(results, view.page, SIZE_CARDS);
  /* Any change of view starts again at the first page. */
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const request = new URLSearchParams([
    ...(search.trim() ? [["q", search.trim()] as [string, string]] : []),
    ...(role ? [["role", role] as [string, string]] : []),
    ...(lane ? [["lane", lane] as [string, string]] : []),
  ]);

  return (
    <div>
      <FilterBar
        search={
          <SearchField value={search} onChange={filter(setSearch)} label={t("pages.heroesList.search")} dense />
        }
        active={
          <>
            {role && (
              <ChipActive
                key="role"
                label={t(`roles.${role}`)}
                emblem={imageRole(role)}
                onRemove={() => filter(setRole)(null)}
              />
            )}
            {lane && (
              <ChipActive key="lane" label={t(`lanes.${lane}`)} emblem={imageLane(lane)} onRemove={() => filter(setLane)(null)} />
            )}
          </>
        }
        count={
          <span aria-live="polite">
            {t("pages.heroesList.account", { n: results.length })}
            {results.length !== heroes.length && ` ${t("pages.heroesList.countOf", { total: heroes.length })}`}
          </span>
        }
      >
        <Filters
          legend={t("pages.heroesList.role")}
          values={ROLES}
          active={role}
          onChange={filter(setRole)}
          label={(r) => t(`roles.${r}`)}
          emblem={imageRole}
        />
        <Filters
          legend={t("pages.heroesList.position")}
          values={LANES}
          active={lane}
          onChange={filter(setLane)}
          label={(l) => t(`lanes.${l}`)}
          emblem={imageLane}
        />

        <FilterGroup legend={t("pages.heroesList.sort")}>
          {SORTS.map((sort_) => (
            <Chip key={sort_.key} active={sort === sort_.key} onClick={() => filter(setSort)(sort_.key)}>
              {t(`pages.heroesList.${sort_.keyI18n}`)}
            </Chip>
          ))}
        </FilterGroup>
      </FilterBar>

      {/* Grid heading for screen readers: the cards carry h3s. */}
      <h2 className="sr-only">{t("pages.heroesList.list")}</h2>
      {slice.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {slice.map((h) => (
            <HeroCard key={h.slug} hero={h} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-chalk-500">{t("pages.heroesList.none")}</p>
      )}
      <Pager paging={view} href={(n) => pageHref("/heroes", request, n)} onNavigate={setPage} t={t} />
    </div>
  );
}

function Filters<T extends string>({
  legend,
  values,
  active,
  onChange,
  label,
  emblem,
}: {
  legend: string;
  values: readonly T[];
  active: T | null;
  onChange: (v: T | null) => void;
  label: (v: T) => string;
  /** Emblem of each value: the role emblem, the lane icon. */
  emblem?: (v: T) => string | undefined;
}) {
  return (
    <FilterGroup legend={legend}>
      {values.map((v) => (
        <Chip
          key={v}
          active={active === v}
          emblem={emblem?.(v)}
          onClick={() => onChange(active === v ? null : v)}
        >
          {label(v)}
        </Chip>
      ))}
    </FilterGroup>
  );
}

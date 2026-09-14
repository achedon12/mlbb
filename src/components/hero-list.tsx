"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HeroCard, type HeroPreview } from "@/components/hero-card";
import type { Lane, Role } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { SearchField } from "@/components/search-field";
import { FilterGroup, Chip } from "@/components/chip";
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
 * Filterable catalogue.
 *
 * Filtering happens on the client from the data already in
 * the page: no network round trip on each click, for a volume that stays
 * small once unused fields are dropped.
 */
export function HeroList({ heroes }: { heroes: HeroPreview[] }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [sort, setSort] = useState<Sort>("name");

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
    const suffix = params.toString();
    window.history.replaceState(null, "", suffix ? `?${suffix}` : window.location.pathname);
  }, [search, role, lane]);

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

  return (
    <div>
      <div className="flex flex-col gap-4">
        <SearchField
          value={search}
          onChange={setSearch}
          label={t("pages.heroesList.search")}
          className="max-w-md"
        />

        <Filters legend={t("pages.heroesList.role")} values={ROLES} active={role} onChange={setRole} label={(r) => t(`roles.${r}`)} />
        <Filters legend={t("pages.heroesList.position")} values={LANES} active={lane} onChange={setLane} label={(l) => t(`lanes.${l}`)} />

        <FilterGroup legend={t("pages.heroesList.sort")}>
          {SORTS.map((sort_) => (
            <Chip key={sort_.key} active={sort === sort_.key} onClick={() => setSort(sort_.key)}>
              {t(`pages.heroesList.${sort_.keyI18n}`)}
            </Chip>
          ))}
        </FilterGroup>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {t("pages.heroesList.account", { n: results.length })}
        {results.length !== heroes.length && ` ${t("pages.heroesList.countOf", { total: heroes.length })}`}
      </p>

      {/* Grid heading for screen readers: the cards carry h3s. */}
      <h2 className="sr-only">{t("pages.heroesList.list")}</h2>
      {results.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((h) => (
            <HeroCard key={h.slug} hero={h} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-chalk-500">{t("pages.heroesList.none")}</p>
      )}
    </div>
  );
}

function Filters<T extends string>({
  legend,
  values,
  active,
  onChange,
  label,
}: {
  legend: string;
  values: readonly T[];
  active: T | null;
  onChange: (v: T | null) => void;
  label: (v: T) => string;
}) {
  return (
    <FilterGroup legend={legend}>
      {values.map((v) => (
        <Chip key={v} active={active === v} onClick={() => onChange(active === v ? null : v)}>
          {label(v)}
        </Chip>
      ))}
    </FilterGroup>
  );
}

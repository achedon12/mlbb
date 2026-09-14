"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { SearchField } from "@/components/search-field";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { FilterGroup, Chip } from "@/components/chip";
import { useT } from "@/i18n/provider";
import { LANES, ROLES, type Suggestion } from "@/lib/draft";
import type { Lane, Role } from "@/lib/types";
import { keySearch, cn } from "@/lib/utils";

/**
 * Pieces communes a l'aide au draft et a l'analyse d'equipe : la vignette d'un
 * heros, la fenetre de choix dans le roster et la carte d'une suggestion.
 */

/** Ce qu'il faut d'un heros pour le montrer et le filtrer. */
export interface HeroPickable {
  slug: string;
  name: string;
  lanes: Lane[];
  roles: Role[];
  icon: string | null;
}

export function HeroThumb({
  hero: heroes,
  small = false,
}: {
  hero: Pick<HeroPickable, "name" | "icon">;
  small?: boolean;
}) {
  return <HeroPortrait source={heroes.icon} name={heroes.name} size={small ? "mini" : "icon"} decorative />;
}

/**
 * Choix d'un heros dans le roster.
 *
 * Tout le roster est proposable. La liste s'ouvre sur les heros de la lane
 * demandee (ou sur tous), « Toutes » l'elargit aux 133, et le filtre de role
 * la resserre. Taper un nom cherche dans tout le roster : la lane se relache
 * d'elle-meme.
 */
export function HeroSelector({
  heroes,
  excluded,
  lane,
  title,
  onChoose,
  onClose,
}: {
  heroes: HeroPickable[];
  excluded: Set<string>;
  /** Lane sur laquelle la liste s'ouvre ; null pour tout le roster. */
  lane: Lane | null;
  /** Nom de la fenetre pour les lecteurs d'ecran. */
  title: string;
  onChoose: (slug: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [laneFilter, setLaneFilter] = useState<Lane | null>(lane);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const results = useMemo(() => {
    const term = keySearch(search.trim());
    return heroes
      .filter((h) => !excluded.has(h.slug))
      .filter((h) => !laneFilter || h.lanes.includes(laneFilter))
      .filter((h) => !role || h.roles.includes(role))
      .filter((h) => !term || keySearch(h.name).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [heroes, excluded, laneFilter, role, search]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 p-4"
      onClick={onClose}
    >
      <div
        className="bevel flex max-h-[85vh] w-full max-w-3xl flex-col border border-night-700 bg-night-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <SearchField
            dense
            autoFocus
            value={search}
            onChange={(value) => {
              setSearch(value);
              if (value.trim()) setLaneFilter(null);
            }}
            label={t("draftUI.search")}
            className="flex-1"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("draftUI.close")}
            className="grid size-9 place-items-center text-chalk-500 hover:text-chalk-100"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <FilterGroup legend={t("draftUI.laneFilter")} widthLegend="w-16" className="gap-1.5">
            <Chip dense active={laneFilter === null} onClick={() => setLaneFilter(null)}>
              {t("draftUI.allLanes")}
            </Chip>
            {LANES.map((l) => (
              <Chip dense key={l} active={laneFilter === l} onClick={() => setLaneFilter(l)}>
                {t(`lanes.${l}`)}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup legend={t("draftUI.roleFilter")} widthLegend="w-16" className="gap-1.5">
            <Chip dense active={role === null} onClick={() => setRole(null)}>
              {t("draftUI.allRoles")}
            </Chip>
            {ROLES.map((r) => (
              <Chip dense key={r} active={role === r} onClick={() => setRole(role === r ? null : r)}>
                {t(`roles.${r}`)}
              </Chip>
            ))}
          </FilterGroup>
        </div>

        <p aria-live="polite" className="mt-3 text-xs text-chalk-500">
          {t("draftUI.account", { n: results.length })}
        </p>

        <ul className="mt-2 grid grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
          {results.map((h) => (
            <li key={h.slug}>
              <button
                type="button"
                onClick={() => onChoose(h.slug)}
                title={h.name}
                className="bevel-sm flex w-full flex-col items-center gap-1 border border-night-700/70 p-2 text-center transition-colors hover:border-gold-500/60 hover:bg-night-850"
              >
                <HeroThumb hero={h} />
                <span className="w-full truncate text-xs text-chalk-100">{h.name}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="col-span-full py-6 text-center text-sm text-chalk-500">{t("draftUI.noHero")}</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** Un heros propose, ses arguments et le bouton qui le prend. */
export function CardSuggestion({
  suggestion: s,
  first,
  titleTake,
  onTake,
  empty,
}: {
  suggestion: Suggestion;
  /** La meilleure de sa lane, soulignee. */
  first: boolean;
  titleTake: string;
  onTake: () => void;
  /** Ligne affichee quand aucun argument ne ressort ; par defaut, celle du draft. */
  empty?: string;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "bevel flex h-full gap-3 border bg-night-900/60 p-3",
        first ? "border-gold-500/50" : "border-night-700/70",
      )}
    >
      <HeroThumb hero={s.hero} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/heroes/${s.hero.slug}`}
          className="font-heading font-bold text-chalk-100 transition-colors hover:text-gold-400"
        >
          {s.hero.name}
        </Link>
        <ul className="mt-1 space-y-0.5">
          {s.reasons.map((r) => (
            <li
              key={r.type}
              className={cn("text-xs leading-snug", r.favorable ? "text-emerald-400" : "text-blood-500")}
            >
              {r.favorable ? "+ " : "− "}
              {t(`draftUI.reasons.${r.type}`, { detail: r.detail })}
            </li>
          ))}
          {s.reasons.length === 0 && <li className="text-xs text-chalk-500">{empty ?? t("draftUI.noCounter")}</li>}
        </ul>
      </div>
      <button
        type="button"
        onClick={onTake}
        title={titleTake}
        className="bevel-sm self-start border border-night-600 px-2 py-1 text-xs text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400"
      >
        {t("draftUI.pick")}
      </button>
    </div>
  );
}

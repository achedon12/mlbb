"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { SearchField } from "@/components/search-field";
import { FilterGroup, Chip } from "@/components/chip";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import type { ItemOption } from "@/lib/build-simulator";
import { keySearch } from "@/lib/utils";

/**
 * Item choice for one simulator slot: search by name or by attribute
 * ("crit", "HP"), filter by category.
 *
 * The bevel sits on a background layer: on the panel itself, its clip-path
 * would cut whatever overflows, starting with the buttons' focus ring.
 */
export function ItemPicker({
  items,
  categories,
  title,
  current,
  onPick,
  onRemove,
  onClose,
}: {
  items: ItemOption[];
  categories: string[];
  /** Dialog name for screen readers. */
  title: string;
  /** Item already in the slot, which can be removed from here. */
  current: ItemOption | null;
  onPick: (slug: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const gold = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", escape);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  const results = useMemo(() => {
    const term = keySearch(search.trim());
    return items
      .filter((o) => !category || o.category === category)
      .filter((o) => !term || keySearch(`${o.name} ${o.text ?? ""}`).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [items, category, search, locale]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 p-3 sm:p-4"
      onClick={onClose}
    >
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div aria-hidden className="bevel absolute inset-0 border border-night-700 bg-night-900" />
        <div className="relative flex min-h-0 flex-1 flex-col p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <SearchField
              dense
              autoFocus
              value={search}
              onChange={setSearch}
              label={t("pages.buildSimulatorUI.searchItem")}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="grid size-11 shrink-0 place-items-center text-chalk-500 transition-colors hover:text-chalk-100"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <FilterGroup legend={t("pages.buildSimulatorUI.category")} widthLegend="sr-only" className="mt-3 gap-1.5">
            <Chip dense active={category === null} onClick={() => setCategory(null)}>
              {t("pages.buildSimulatorUI.allCategories")}
            </Chip>
            {categories.map((c) => (
              <Chip dense key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                {t(`categories.${c}`)}
              </Chip>
            ))}
          </FilterGroup>

          {current && (
            <button
              type="button"
              onClick={onRemove}
              className="mt-3 flex min-h-11 items-center gap-2 self-start border border-blood-500/50 px-3 text-sm text-chalk-200 transition-colors hover:border-blood-500 hover:text-chalk-100"
            >
              <Trash2 size={16} aria-hidden />
              {t("pages.buildSimulatorUI.removeItem", { item: current.name })}
            </button>
          )}

          <p aria-live="polite" className="sr-only">
            {t("pages.buildSimulatorUI.results", { n: results.length })}
          </p>
          {results.length === 0 ? (
            <p className="mt-6 text-center text-sm text-chalk-500">{t("pages.buildSimulatorUI.noItem")}</p>
          ) : (
            <ul className="-mx-1 mt-3 grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto px-1 py-1 min-[380px]:grid-cols-2 sm:grid-cols-3">
              {results.map((o) => (
                <li key={o.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(o.slug)}
                    aria-current={current?.slug === o.slug || undefined}
                    className="flex min-h-14 w-full items-center gap-2.5 border border-night-700 bg-night-850 p-2 text-left transition-colors hover:border-gold-500/60 aria-[current]:border-gold-500"
                  >
                    <span className="relative size-10 shrink-0 bg-night-800">
                      {o.image && <Image src={o.image} alt="" fill unoptimized className="object-contain" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm leading-tight text-chalk-100">{o.name}</span>
                      {o.price !== null && (
                        <span className="mt-0.5 block text-xs tabular-nums text-gold-400">
                          {t("pages.buildSimulatorUI.price", { gold: gold.format(o.price) })}
                        </span>
                      )}
                      {o.text && <span className="mt-0.5 line-clamp-2 block text-[0.7rem] leading-snug text-chalk-500">{o.text}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

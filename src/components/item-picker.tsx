"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { ChampRecherche } from "@/components/champ-recherche";
import { GroupeFiltres, Puce } from "@/components/puce";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import type { ItemOption } from "@/lib/build-simulator";
import { cleRecherche } from "@/lib/utils";

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
  const langue = useLangue();
  const gold = new Intl.NumberFormat(LOCALE_HTML[langue]);
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
    const term = cleRecherche(search.trim());
    return items
      .filter((o) => !category || o.category === category)
      .filter((o) => !term || cleRecherche(`${o.name} ${o.text ?? ""}`).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, langue));
  }, [items, category, search, langue]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-nuit-950/80 p-3 sm:p-4"
      onClick={onClose}
    >
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div aria-hidden className="biseau absolute inset-0 border border-nuit-700 bg-nuit-900" />
        <div className="relative flex min-h-0 flex-1 flex-col p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ChampRecherche
              dense
              autoFocus
              valeur={search}
              onChange={setSearch}
              libelle={t("pages.buildSimulatorUI.searchItem")}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label={t("commun.fermer")}
              className="grid size-11 shrink-0 place-items-center text-craie-500 transition-colors hover:text-craie-100"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <GroupeFiltres legende={t("pages.buildSimulatorUI.category")} largeurLegende="sr-only" className="mt-3 gap-1.5">
            <Puce dense actif={category === null} onClick={() => setCategory(null)}>
              {t("pages.buildSimulatorUI.allCategories")}
            </Puce>
            {categories.map((c) => (
              <Puce dense key={c} actif={category === c} onClick={() => setCategory(category === c ? null : c)}>
                {t(`categories.${c}`)}
              </Puce>
            ))}
          </GroupeFiltres>

          {current && (
            <button
              type="button"
              onClick={onRemove}
              className="mt-3 flex min-h-11 items-center gap-2 self-start border border-sang-500/50 px-3 text-sm text-craie-200 transition-colors hover:border-sang-500 hover:text-craie-100"
            >
              <Trash2 size={16} aria-hidden />
              {t("pages.buildSimulatorUI.removeItem", { item: current.name })}
            </button>
          )}

          <p aria-live="polite" className="sr-only">
            {t("pages.buildSimulatorUI.results", { n: results.length })}
          </p>
          {results.length === 0 ? (
            <p className="mt-6 text-center text-sm text-craie-500">{t("pages.buildSimulatorUI.noItem")}</p>
          ) : (
            <ul className="-mx-1 mt-3 grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto px-1 py-1 min-[380px]:grid-cols-2 sm:grid-cols-3">
              {results.map((o) => (
                <li key={o.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(o.slug)}
                    aria-current={current?.slug === o.slug || undefined}
                    className="flex min-h-14 w-full items-center gap-2.5 border border-nuit-700 bg-nuit-850 p-2 text-left transition-colors hover:border-or-500/60 aria-[current]:border-or-500"
                  >
                    <span className="relative size-10 shrink-0 bg-nuit-800">
                      {o.image && <Image src={o.image} alt="" fill unoptimized className="object-contain" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm leading-tight text-craie-100">{o.name}</span>
                      {o.price !== null && (
                        <span className="mt-0.5 block text-xs tabular-nums text-or-400">
                          {t("pages.buildSimulatorUI.price", { gold: gold.format(o.price) })}
                        </span>
                      )}
                      {o.text && <span className="mt-0.5 line-clamp-2 block text-[0.7rem] leading-snug text-craie-500">{o.text}</span>}
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

"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { SearchField } from "@/components/search-field";
import {
  catalogRecipes,
  EffectsItem,
  RecipeItem,
  type PreviewItem,
  type CatalogRecipes,
  type ToItem,
} from "@/components/item-sheet";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { Chip } from "@/components/chip";
import { Drawer } from "@/components/drawer";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { keySearch, cn } from "@/lib/utils";

/**
 * Catalogue des objets.
 *
 * Une grille dense d'icones plutot que des fiches empilees : on compare des
 * objets, et comparer suppose de les voir ensemble. Le detail complet s'ouvre
 * dans un panneau lateral, ce qui evite de repeter dix lignes de statistiques
 * sur chaque vignette. Chaque objet a aussi sa page, rendue au serveur.
 */
export type { PreviewItem };

/** Heros cite par un objet : de quoi afficher sa vignette. */
export interface HeroThumb {
  name: string;
  portrait: string | null;
}

/**
 * Le catalogue vu depuis les recettes et les builds : chaque objet par son nom,
 * ce qu'il sert a fabriquer, et les heros qui le prennent.
 */
interface Catalog extends CatalogRecipes {
  usedBy: Record<string, string[]>;
  heroes: Record<string, HeroThumb>;
}

/**
 * Change l'objet ouvert.
 *
 * `replaceState` ne declenche pas `hashchange` : on previent donc nous-memes,
 * sinon l'affichage ne suivrait pas le changement d'adresse.
 */
function select(slug: string | null) {
  history.replaceState(null, "", slug ? `#${slug}` : window.location.pathname);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function closeItem() {
  select(null);
}

/** Dans le catalogue, un autre objet s'ouvre sur place, par l'ancre. */
const toAnchor: ToItem = (o, content, className) => (
  <button type="button" onClick={() => select(o.slug)} className={className}>
    {content}
  </button>
);

export function ItemList({
  items,
  categories,
  usedBy,
  heroThumbs,
}: {
  items: PreviewItem[];
  categories: string[];
  /** Heros qui prennent chaque objet (par slug d'objet), les plus joues d'abord. */
  usedBy: Record<string, string[]>;
  heroThumbs: Record<string, HeroThumb>;
}) {
  const [search, setSearch] = useState("");
  const t = useT();
  const locale = useLocale();
  const [category, setCategory] = useState<string | null>(null);

  const slugsKnown = useMemo(() => new Set(items.map((o) => o.slug)), [items]);

  /**
   * L'objet ouvert est designe par l'adresse, pas par un etat local.
   *
   * Les builds des fiches heros renvoient ici avec une ancre — par exemple
   * `/objets#bloodlust-axe`. Faire de l'adresse la source unique evite d'avoir
   * a synchroniser deux verites : le lien entrant, la selection et le lien
   * partageable decrivent tous la meme chose.
   */
  const anchor = useSyncExternalStore(
    (refresh) => {
      window.addEventListener("hashchange", refresh);
      return () => window.removeEventListener("hashchange", refresh);
    },
    () => window.location.hash,
    // Rendu serveur : aucune ancre connue.
    () => "",
  );

  const active = useMemo(() => {
    const target = decodeURIComponent(anchor.replace(/^#/, ""));
    return target && slugsKnown.has(target) ? target : null;
  }, [anchor, slugsKnown]);

  // Un objet designe par l'adresse doit etre visible : on amene la grille
  // dessus plutot que de laisser l'utilisateur le chercher.
  useEffect(() => {
    if (!active) return;
    const image = requestAnimationFrame(() => {
      document.getElementById(active)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(image);
  }, [active]);

  const results = useMemo(() => {
    const term = keySearch(search.trim());
    return items.filter((o) => {
      // L'objet ouvert reste toujours affiche, meme hors du filtre courant.
      if (o.slug === active) return true;
      if (category && o.category !== category) return false;
      if (!term) return true;
      return (
        keySearch(o.name).includes(term) ||
        keySearch(o.bonus ?? "").includes(term) ||
        keySearch(o.passive ?? "").includes(term)
      );
    });
  }, [items, search, category, active]);

  const item = items.find((o) => o.slug === active) ?? null;

  // Les recettes nomment leurs composants : on les retrouve par nom, et on lit
  // les recettes a l'envers pour savoir ce que chaque objet sert a fabriquer.
  const catalog = useMemo<Catalog>(
    () => ({ ...catalogRecipes(items), usedBy, heroes: heroThumbs }),
    [items, usedBy, heroThumbs],
  );

  return (
    <div>
      <div className="flex flex-col gap-4">
        <SearchField
          value={search}
          onChange={setSearch}
          label={t("pages.itemsList.search")}
          className="max-w-md"
        />

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {t(`categories.${c}`)}
            </Chip>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {t("pages.itemsList.account", { n: results.length })}
        {results.length !== items.length && ` ${t("pages.itemsList.countOf", { total: items.length })}`}
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_21rem]">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
          {results.map((o) => {
            const selected = o.slug === item?.slug;
            return (
              <li key={o.slug} className="offscreen">
                <button
                  type="button"
                  id={o.slug}
                  onClick={() => select(selected ? null : o.slug)}
                  aria-pressed={selected}
                  className={cn(
                    "bevel-sm flex h-full w-full flex-col items-center gap-1.5 border p-2 text-center transition-colors",
                    selected
                      ? "border-gold-500 bg-gold-500/10"
                      : "border-night-700/70 bg-night-900/60 hover:border-gold-500/50",
                  )}
                >
                  <span className="relative size-11 shrink-0">
                    {o.image ? (
                      <Image src={o.image} alt="" width={44} height={44} className="size-full object-contain" />
                    ) : (
                      <span className="grid size-full place-items-center bg-night-800 text-[0.6rem] text-chalk-500">
                        —
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium leading-tight text-chalk-100">
                    {o.name}
                  </span>
                  {o.price !== null && (
                    // L'unite est ecrite en toutes lettres : un nombre nu sous
                    // une icone d'objet se lit comme un niveau ou une quantite,
                    // pas comme un prix.
                    <span className="text-xs tabular-nums text-gold-400">
                      {o.price.toLocaleString(LOCALE_HTML[locale])} {t("pages.itemsList.gold")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
          {item ? (
            <ItemSheet item={item} catalog={catalog} />
          ) : (
            <p className="bevel border border-dashed border-night-700 p-5 text-sm leading-relaxed text-chalk-500">
              {t("pages.itemsList.choose")}
            </p>
          )}
        </aside>
      </div>

      {/*
        Sur mobile, la fiche monte en tiroir depuis le bas : pas besoin de
        redescendre sous une grille de cent objets pour la lire.
      */}
      {item && (
        <Drawer title={item.name} onClose={closeItem} labelClose={t("pages.itemsList.close")}>
          <ItemSheet item={item} catalog={catalog} withoutFrame />
        </Drawer>
      )}
    </div>
  );
}

/** Fiche detaillee d'un objet, commune a la colonne laterale et au tiroir. */
function ItemSheet({
  item,
  catalog,
  withoutFrame = false,
}: {
  item: PreviewItem;
  catalog: Catalog;
  withoutFrame?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const users = catalog.usedBy[item.slug] ?? [];
  return (
            <div className={cn("p-5", !withoutFrame && "bevel border border-night-700/70 bg-night-900/60")}>
              <div className="flex items-start gap-3">
                {item.image && (
                  <span className="relative size-14 shrink-0">
                    <Image src={item.image} alt="" fill sizes="56px" className="object-contain" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-bold leading-tight text-chalk-100">
                    {item.name}
                  </h2>
                  {item.summary && (
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-chalk-500">
                      {item.summary}
                    </p>
                  )}
                  {item.price !== null && (
                    <p className="mt-1 text-sm text-chalk-500">
                      {t("pages.itemsList.price")}{" "}
                      <span className="font-heading text-gold-400">
                        {item.price.toLocaleString(LOCALE_HTML[locale])} {t("pages.itemsList.gold")}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <EffectsItem item={item} t={t} />
                <RecipeItem item={item} catalog={catalog} t={t} locale={locale} to={toAnchor} />
                {users.length > 0 && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsList.usedBy")}</dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {users.map((slug) => (
                        <Link
                          key={slug}
                          href={`/heroes/${slug}`}
                          className="bevel-sm group flex items-center gap-1.5 border border-night-700/70 bg-night-900/60 py-1 pl-1 pr-2 transition-colors hover:border-gold-500/60"
                        >
                          <HeroPortrait
                            source={catalog.heroes[slug]?.portrait ?? null}
                            name={catalog.heroes[slug]?.name ?? slug}
                            size="micro"
                            decorative
                          />
                          <span className="text-xs text-chalk-300 group-hover:text-gold-400">{catalog.heroes[slug]?.name ?? slug}</span>
                        </Link>
                      ))}
                    </dd>
                    <p className="mt-1.5 text-xs text-chalk-500">{t("pages.itemsList.usedByHelp")}</p>
                  </div>
                )}
              </dl>

              {/* La page de l'objet ajoute ce que la fiche ne peut pas tenir : taux par heros et par rang. */}
              <Link
                href={`/items/${item.slug}`}
                className="mt-5 inline-block text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500"
              >
                {t("pages.itemsList.fullPage")} →
              </Link>
            </div>
  );
}

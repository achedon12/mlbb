import Image from "next/image";
import type { ReactNode } from "react";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { GeneratedItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Parts of an item sheet, shared by the catalogue (side panel and drawer, in
 * the browser) and each item's page (rendered on the server).
 *
 * No hooks: the caller provides the translation, the language, and the way
 * to open another item — a button that changes the anchor in the catalogue, a
 * link to its page elsewhere.
 */
export interface PreviewItem extends GeneratedItem {
  image: string | null;
}

/** Items by name, and what each one builds into (recipes read backwards). */
export interface CatalogRecipes {
  byName: Map<string, PreviewItem>;
  outlets: Map<string, PreviewItem[]>;
}

export function catalogRecipes(items: PreviewItem[]): CatalogRecipes {
  const byName = new Map(items.map((o) => [o.name, o]));
  const outlets = new Map<string, PreviewItem[]>();
  for (const o of items) {
    for (const c of new Set(o.recipe)) outlets.set(c, [...(outlets.get(c) ?? []), o]);
  }
  return { byName, outlets };
}

/** Opens another item: receives the target item, the link content and its classes. */
export type ToItem = (o: PreviewItem, content: ReactNode, className: string) => ReactNode;

/** What the assembly itself costs, once the components are owned. */
export function costMerge(item: PreviewItem, catalog: CatalogRecipes): number | null {
  const components = item.recipe.map((name) => catalog.byName.get(name));
  if (item.price === null || components.length === 0 || !components.every((c) => c?.price != null)) return null;
  return item.price - components.reduce((sum, c) => sum + (c?.price ?? 0), 0);
}

const count = (locale: Locale, n: number) => n.toLocaleString(LOCALE_HTML[locale]);

/** Stats and effects, as `dt`/`dd` pairs to place in a `dl`. */
export function EffectsItem({ item, t }: { item: PreviewItem; t: T }) {
  return (
    <>
      {item.bonus && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsList.statistics")}</dt>
          <dd className="mt-1 leading-snug text-chalk-100">{item.bonus}</dd>
        </div>
      )}
      {item.unique && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsList.unique")}</dt>
          <dd className="mt-1 leading-snug text-azure-400">{item.unique}</dd>
        </div>
      )}
      {item.passive && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsList.passive")}</dt>
          <dd className="mt-1 leading-relaxed text-chalk-300">{item.passive}</dd>
        </div>
      )}
      {item.active && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsList.active")}</dt>
          <dd className="mt-1 leading-relaxed text-chalk-300">{item.active}</dd>
        </div>
      )}
    </>
  );
}

/** Recipe (with the merge cost) and items this one builds into, as `dt`/`dd` pairs. */
export function RecipeItem({
  item,
  catalog,
  t,
  locale,
  to,
}: {
  item: PreviewItem;
  catalog: CatalogRecipes;
  t: T;
  locale: Locale;
  to: ToItem;
}) {
  const merge = costMerge(item, catalog);
  const factory = catalog.outlets.get(item.name) ?? [];
  return (
    <>
      {item.recipe.length > 0 && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsList.recipe")}</dt>
          <dd className="mt-2">
            <RecipeTree names={item.recipe} catalog={catalog} t={t} locale={locale} to={to} />
            {merge !== null && (
              <p className="mt-2 text-xs text-chalk-500">
                {t("pages.itemsList.merge", { price: count(locale, merge) })}
              </p>
            )}
          </dd>
        </div>
      )}
      {factory.length > 0 && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsList.buildsInto")}</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {factory.map((o) => (
              <span key={o.slug} className="contents">
                {to(
                  o,
                  <>
                    <ItemIcon image={o.image} size={22} />
                    <span className="text-xs text-chalk-300 group-hover:text-gold-400">{o.name}</span>
                  </>,
                  "bevel-sm group flex items-center gap-1.5 border border-night-700/70 bg-night-900/60 py-1 pl-1 pr-2 transition-colors hover:border-gold-500/60",
                )}
              </span>
            ))}
          </dd>
        </div>
      )}
    </>
  );
}

/**
 * Build tree: each component with its icon and price, then its own components
 * indented. Each component opens its own sheet.
 */
export function RecipeTree({
  names,
  catalog,
  t,
  locale,
  to,
  depth = 0,
}: {
  names: string[];
  catalog: CatalogRecipes;
  t: T;
  locale: Locale;
  to: ToItem;
  depth?: number;
}) {
  return (
    <ul className={cn("space-y-1.5", depth > 0 && "ml-3.5 mt-1.5 border-l border-night-700 pl-3")}>
      {names.map((name, i) => {
        const o = catalog.byName.get(name);
        const content = (
          <>
            <ItemIcon image={o?.image ?? null} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm text-chalk-100 group-hover:text-gold-400">{name}</span>
            {o?.price != null && (
              <span className="shrink-0 text-xs tabular-nums text-gold-400">
                {count(locale, o.price)} {t("pages.itemsList.gold")}
              </span>
            )}
          </>
        );
        const cssClass = "group flex w-full items-center gap-2 text-left";
        return (
          <li key={`${name}-${i}`}>
            {o ? to(o, content, cssClass) : <span className={cssClass}>{content}</span>}
            {/* Safeguard: a mistyped recipe must not loop forever. */}
            {o && o.recipe.length > 0 && depth < 4 && (
              <RecipeTree
                names={o.recipe}
                catalog={catalog}
                t={t}
                locale={locale}
                to={to}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Fixed-size icon: with width and height known, the browser only has two
 * versions to choose from (1x, 2x). With `fill`, each icon carried the fifteen
 * configured widths, i.e. 1 KB of HTML per thumbnail.
 */
export function ItemIcon({ image, size }: { image: string | null; size: number }) {
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      {image ? (
        <Image src={image} alt="" width={size} height={size} className="size-full object-contain" />
      ) : (
        <span className="grid size-full place-items-center bg-night-800 text-[0.6rem] text-chalk-500">—</span>
      )}
    </span>
  );
}

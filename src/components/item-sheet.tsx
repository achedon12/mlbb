import Image from "next/image";
import type { ReactNode } from "react";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { GeneratedItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pieces de la fiche d'un objet, communes au catalogue (panneau lateral et
 * tiroir, dans le navigateur) et a la page de chaque objet (rendue au serveur).
 *
 * Aucun hook : l'appelant fournit la traduction, la langue, et la facon
 * d'ouvrir un autre objet — un bouton qui change l'ancre dans le catalogue, un
 * lien vers sa page ailleurs.
 */
export interface PreviewItem extends GeneratedItem {
  image: string | null;
}

/** Les objets par nom, et ce que chacun sert a fabriquer (recettes lues a l'envers). */
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

/** Ouvre un autre objet : recoit l'objet vise, le contenu du lien et ses classes. */
export type ToItem = (o: PreviewItem, content: ReactNode, className: string) => ReactNode;

/** Ce que coute l'assemblage lui-meme, une fois les composants en poche. */
export function costMerge(item: PreviewItem, catalog: CatalogRecipes): number | null {
  const components = item.recipe.map((name) => catalog.byName.get(name));
  if (item.price === null || components.length === 0 || !components.every((c) => c?.price != null)) return null;
  return item.price - components.reduce((sum, c) => sum + (c?.price ?? 0), 0);
}

const count = (locale: Locale, n: number) => n.toLocaleString(LOCALE_HTML[locale]);

/** Statistiques et effets, en paires `dt`/`dd` a placer dans un `dl`. */
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

/** Recette (avec le cout de fusion) et objets que celui-ci sert a fabriquer, en paires `dt`/`dd`. */
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
                {t("pages.itemsList.merge", { prix: count(locale, merge) })}
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
 * Arbre de fabrication : chaque composant avec son icone et son prix, puis ses
 * propres composants en retrait. Chaque composant ouvre sa propre fiche.
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
            {/* Garde-fou : une recette mal saisie ne doit pas boucler sans fin. */}
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
 * Icone a taille fixe : largeur et hauteur connues, le navigateur n'a que deux
 * versions a choisir (1x, 2x). En `fill`, chaque icone emportait les quinze
 * largeurs de la configuration, soit 1 Ko de HTML par vignette.
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

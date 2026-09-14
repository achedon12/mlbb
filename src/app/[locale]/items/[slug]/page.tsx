import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  catalogRecipes,
  EffectsItem,
  ItemIcon,
  RecipeItem,
  type PreviewItem,
  type ToItem,
} from "@/components/item-sheet";
import { ListLinks, TableRanks, TableUsage } from "@/components/usage-sheet";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import visuals from "@/data/game/visuals.json";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { heroesBySlug, itemsFor } from "@/lib/data";
import { dataSheet, summaryRanks, usage } from "@/lib/usage-sheets";
import { longDate, listNames, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/** Une page par objet, generee au build ; toute autre adresse est une 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return itemsFor("en").map((o) => ({ slug: o.slug }));
}

const images = visuals.items as Record<string, string>;
const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
/** Un effet se termine deja par un point : la phrase n'en ajoute pas un second. */
const withoutPoint = (text: string) => text.replace(/[.\s]+$/, "");

/**
 * Ce que la page et ses metadonnees disent d'un objet. Titre et description
 * sont faits des donnees : nom, prix, effet, heros qui le prennent, patch.
 */
function sheet(locale: Locale, slug: string) {
  const o = itemsFor(locale).find((x) => x.slug === slug);
  if (!o) return null;
  const t = createT(locale);
  const heroes = usage("item", slug);
  const price = o.price === null ? null : `${o.price.toLocaleString(LOCALE_HTML[locale])} ${t("pages.itemsList.gold")}`;
  const details = [t(`categories.${o.category}`), price].filter(Boolean).join(", ");
  const effect = o.bonus ?? o.summary;
  const sentences = [
    effect
      ? t("pages.itemDetail.itemDesc", { nom: o.name, details, effet: withoutPoint(effect) })
      : t("pages.itemDetail.itemDescAlone", { nom: o.name, details }),
  ];
  const first = heroes[0];
  if (first) {
    const names = listNames(locale, heroes.slice(0, 3).map((h) => heroName(h.slug)));
    sentences.push(
      first.win === null
        ? t("pages.itemDetail.heroDescSimple", { heros: names })
        : t("pages.itemDetail.heroDesc", {
            heros: names,
            premier: heroName(first.slug),
            taux: percentage(locale, first.win),
          }),
    );
  }
  return {
    o,
    t,
    heroes,
    title: t("pages.itemDetail.title", { nom: o.name, v: patchCurrent?.version ?? "" }),
    lead: sentences.join(" "),
    description: [...sentences, t("pages.sheets.updateDesc", { date: longDate(locale) })].join(" "),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const f = sheet(locale, slug);
  if (!f) return {};
  return metaPage(locale, { title: f.title, description: f.description, path: `/items/${slug}` });
}

/** Sur la page d'un objet, un autre objet s'ouvre sur sa propre page. */
const toPage: ToItem = (o, content, className) => (
  <Link href={`/items/${o.slug}`} className={className}>
    {content}
  </Link>
);

export default async function ItemPage({ params }: Params) {
  const { locale, slug } = await params;
  const f = sheet(locale, slug);
  if (!f) notFound();
  const { o, t, heroes } = f;

  const previews: PreviewItem[] = itemsFor(locale).map((x) => ({ ...x, image: images[x.slug] ?? null }));
  const item = previews.find((x) => x.slug === slug)!;
  const catalog = catalogRecipes(previews);
  const hasRecipe = item.recipe.length > 0 || (catalog.outlets.get(item.name)?.length ?? 0) > 0;
  const price = (n: number) => `${n.toLocaleString(LOCALE_HTML[locale])} ${t("pages.itemsList.gold")}`;
  const category = t(`categories.${o.category}`);

  // Objets voisins : meme categorie, les plus proches en prix, puis ranges par prix.
  const gap = (x: PreviewItem) => Math.abs((x.price ?? 0) - (o.price ?? 0));
  const similar = previews
    .filter((x) => x.category === o.category && x.slug !== slug)
    .sort((a, b) => gap(a) - gap(b))
    .slice(0, 8)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  const heroTitle = t("pages.itemDetail.heroesTitle", { nom: o.name });
  const data = dataSheet(locale, {
    title: f.title,
    description: f.description,
    path: `/items/${slug}`,
    name: o.name,
    summary: o.summary,
    image: item.image,
    listName: heroTitle,
    heroes: heroes.slice(0, 10).map((h) => ({ name: heroName(h.slug), slug: h.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
      <PageHeader
        title={o.name}
        lead={f.lead}
        icon={item.image ? <ItemIcon image={item.image} size={64} /> : undefined}
        crumbs={[
          { name: t("nav.items.label"), href: "/items" },
          {
            name: o.name,
            siblings: [...previews]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((x) => ({ name: x.name, href: `/items/${x.slug}` })),
          },
        ]}
      >
        <FreshnessLine locale={locale} className="mt-4" />
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section className={cn("grid gap-4", hasRecipe && "md:grid-cols-2")}>
          <Card>
            <h2 className="font-heading text-lg font-bold text-chalk-100">{t("pages.itemDetail.effects")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemDetail.category")}</dt>
                  <dd className="mt-1 text-chalk-100">{category}</dd>
                </div>
                {o.price !== null && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemDetail.price")}</dt>
                    <dd className="mt-1 font-heading text-gold-400">{price(o.price)}</dd>
                  </div>
                )}
              </div>
              <EffectsItem item={item} t={t} />
            </dl>
          </Card>
          {hasRecipe && (
            <Card>
              <h2 className="font-heading text-lg font-bold text-chalk-100">{t("pages.itemDetail.crafting")}</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <RecipeItem item={item} catalog={catalog} t={t} locale={locale} to={toPage} />
              </dl>
            </Card>
          )}
        </section>

        <section>
          <SectionTitle lead={t("pages.sheets.help")}>{heroTitle}</SectionTitle>
          {heroes.length > 0 ? (
            <TableUsage rows={heroes} legend={heroTitle} t={t} locale={locale} />
          ) : (
            <p className="text-sm text-chalk-500">{t("pages.sheets.none")}</p>
          )}
        </section>

        {heroes.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.sheets.byRankIntro")}>{t("pages.sheets.byRank")}</SectionTitle>
            <TableRanks summary={summaryRanks("item", slug)} legend={t("pages.sheets.byRank")} t={t} locale={locale} />
          </section>
        )}

        {similar.length > 0 && (
          <section>
            <SectionTitle>{t("pages.itemDetail.similar", { categorie: category })}</SectionTitle>
            <ListLinks
              links={similar.map((x) => ({
                href: `/items/${x.slug}`,
                name: x.name,
                image: x.image,
                detail: x.price === null ? undefined : price(x.price),
              }))}
            />
          </section>
        )}
      </div>
    </>
  );
}

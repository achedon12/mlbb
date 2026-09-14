import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemIcon } from "@/components/item-sheet";
import { ListLinks, PartsChoice, TableRanks, TableUsage } from "@/components/usage-sheet";
import { FreshnessLine } from "@/components/freshness";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import {
  dataSheet,
  emblemsSheets,
  partsWith,
  summaryRanks,
  spellSheets,
  textChoice,
  usage,
} from "@/lib/usage-sheets";
import { longDate, listNames, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/** Une page par sort de combat, generee au build ; toute autre adresse est une 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return spellSheets.map((s) => ({ slug: s.slug }));
}

const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;

/**
 * Ce que la page et ses metadonnees disent d'un sort : son effet quand il est
 * decrit (aucune description n'est inventee), et les heros qui le prennent.
 */
function sheet(locale: Locale, slug: string) {
  const s = spellSheets.find((x) => x.slug === slug);
  if (!s) return null;
  const t = createT(locale);
  const name = textChoice(t, slug, "name", s.name)!;
  const effect = textChoice(t, slug, "description");
  const bestFor = textChoice(t, slug, "bestFor");
  const heroes = usage("spell", slug);
  const first = heroes[0];
  const sentences = [
    ...(effect ? [t("pages.spellDetail.effectDesc", { nom: name, effet: effect })] : []),
    first
      ? first.win === null
        ? t("pages.sheets.heroDescSimple", { heros: listNames(locale, heroes.slice(0, 3).map((h) => heroName(h.slug))) })
        : t("pages.sheets.heroDesc", {
            heros: listNames(locale, heroes.slice(0, 3).map((h) => heroName(h.slug))),
            premier: heroName(first.slug),
            taux: percentage(locale, first.win),
          })
      : t("pages.spellDetail.noneDesc", { nom: name }),
  ];
  return {
    s,
    t,
    name,
    effect,
    bestFor,
    heroes,
    title: t("pages.spellDetail.title", { nom: name, v: patchCurrent?.version ?? "" }),
    lead: sentences.join(" "),
    description: [...sentences, t("pages.sheets.updateDesc", { date: longDate(locale) })].join(" "),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const f = sheet(locale, slug);
  if (!f) return {};
  return metaPage(locale, { title: f.title, description: f.description, path: `/spells/${slug}` });
}

export default async function SpellPage({ params }: Params) {
  const { locale, slug } = await params;
  const fi = sheet(locale, slug);
  if (!fi) notFound();
  const { s, t, name, heroes } = fi;

  const emblemsBySlug = new Map(emblemsSheets.map((e) => [e.slug, e]));
  const emblems = partsWith("spell", slug, "emblem")
    .slice(0, 4)
    .flatMap((p) => {
      const e = emblemsBySlug.get(p.key);
      return e
        ? [{
            key: p.key,
            name: textChoice(t, e.emblem.key, "name", e.emblem.name)!,
            image: e.image,
            part: p.part,
            href: `/emblems/${e.slug}`,
          }]
        : [];
    });

  const heroTitle = t("pages.sheets.heroesTitle");
  const data = dataSheet(locale, {
    title: fi.title,
    description: fi.description,
    path: `/spells/${slug}`,
    name,
    summary: fi.effect,
    image: s.image,
    listName: t("pages.sheets.listLd", { nom: name }),
    heroes: heroes.slice(0, 10).map((h) => ({ name: heroName(h.slug), slug: h.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
      <PageHeader
        title={name}
        lead={fi.lead}
        icon={s.image ? <ItemIcon image={s.image} size={64} /> : undefined}
        crumbs={[
          { name: t("nav.emblems.label"), href: "/emblems" },
          {
            name,
            siblings: spellSheets.map((x) => ({ name: textChoice(t, x.slug, "name", x.name)!, href: `/spells/${x.slug}` })),
          },
        ]}
      >
        <FreshnessLine locale={locale} className="mt-4" />
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <Card>
          <dl className="grid gap-4 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.spellDetail.effect")}</dt>
              <dd className="mt-1 leading-relaxed text-chalk-100">
                {fi.effect ?? <span className="text-chalk-500">{t("pages.spellDetail.noDescription")}</span>}
              </dd>
            </div>
            {s.cooldown !== null && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.spellDetail.cooldown")}</dt>
                <dd className="mt-1 font-heading tabular-nums text-gold-400">{t("pages.spellDetail.seconds", { n: s.cooldown })}</dd>
              </div>
            )}
            {fi.bestFor && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.sheets.bestFor")}</dt>
                <dd className="mt-1 leading-relaxed text-chalk-300">{fi.bestFor}</dd>
              </div>
            )}
          </dl>
        </Card>

        <section>
          <SectionTitle lead={t("pages.sheets.help")}>{heroTitle}</SectionTitle>
          {heroes.length > 0 ? (
            <TableUsage rows={heroes} legend={heroTitle} t={t} locale={locale} />
          ) : (
            <p className="text-sm text-chalk-500">{t("pages.sheets.none")}</p>
          )}
        </section>

        {emblems.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.spellDetail.emblemsIntro")}>{t("pages.spellDetail.emblemsTitle")}</SectionTitle>
            <div className="max-w-md">
              <PartsChoice locale={locale} entries={emblems} />
            </div>
          </section>
        )}

        {heroes.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.sheets.byRankIntro")}>{t("pages.sheets.byRank")}</SectionTitle>
            <TableRanks summary={summaryRanks("spell", slug)} legend={t("pages.sheets.byRank")} t={t} locale={locale} />
          </section>
        )}

        <section>
          <SectionTitle>{t("pages.spellDetail.others")}</SectionTitle>
          <ListLinks
            links={spellSheets
              .filter((x) => x.slug !== slug)
              .map((x) => {
                const n = usage("spell", x.slug).length;
                return {
                  href: `/spells/${x.slug}`,
                  name: textChoice(t, x.slug, "name", x.name)!,
                  image: x.image,
                  detail: n ? t("pages.sheets.nHeroes", { n }) : undefined,
                };
              })}
          />
        </section>
      </div>
    </>
  );
}

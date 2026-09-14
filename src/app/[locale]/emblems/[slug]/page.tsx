import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemIcon } from "@/components/item-sheet";
import { ListLinks, PartsChoice, TableRanks, TableUsage } from "@/components/usage-sheet";
import { FreshnessLine } from "@/components/freshness";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import type { T } from "@/i18n/t";
import { createT } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import {
  dataSheet,
  emblemsSheets,
  imageTalent,
  nameTalent,
  partsWith,
  summaryRanks,
  spellSheets,
  talentsWithEmblem,
  textChoice,
  usage,
} from "@/lib/usage-sheets";
import { longDate, listNames, patchCurrent } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/** One page per emblem, generated at build time; any other address is a 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return emblemsSheets.map((e) => ({ slug: e.slug }));
}

const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
const nameEmblem = (t: T, f: (typeof emblemsSheets)[number]) =>
  textChoice(t, f.emblem.key, "name", f.emblem.name)!;

/**
 * What the page and its metadata say about an emblem: its bonuses, the heroes
 * that take it in their most played builds, and the talents chosen with it.
 */
function sheet(locale: Locale, slug: string) {
  const f = emblemsSheets.find((e) => e.slug === slug);
  if (!f) return null;
  const t = createT(locale);
  const name = nameEmblem(t, f);
  const bonus = textChoice(t, f.emblem.key, "bonus", f.emblem.bonus)!;
  const bestFor = textChoice(t, f.emblem.key, "bestFor", f.emblem.bestFor)!;
  const heroes = usage("emblem", slug);
  const talents = talentsWithEmblem(slug);
  const first = heroes[0];
  const sentences = first
    ? [
        t("pages.emblemDetail.desc", {
          nom: name,
          bonus,
          n: heroes.length,
          heros: listNames(locale, heroes.slice(0, 3).map((h) => heroName(h.slug))),
        }),
        ...(talents[2].length
          ? [t("pages.emblemDetail.talentsDesc", { talents: listNames(locale, talents[2].slice(0, 2).map((p) => nameTalent(t, p.key))) })]
          : []),
      ]
    : [t("pages.emblemDetail.descWithout", { nom: name, bonus, pourQui: bestFor })];
  return {
    f,
    t,
    name,
    bonus,
    bestFor,
    heroes,
    talents,
    title: t("pages.emblemDetail.title", { nom: name, v: patchCurrent?.version ?? "" }),
    lead: sentences.join(" "),
    description: [...sentences, t("pages.sheets.updateDesc", { date: longDate(locale) })].join(" "),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const f = sheet(locale, slug);
  if (!f) return {};
  return metaPage(locale, { title: f.title, description: f.description, path: `/emblems/${slug}` });
}

export default async function EmblemPage({ params }: Params) {
  const { locale, slug } = await params;
  const fi = sheet(locale, slug);
  if (!fi) notFound();
  const { f, t, name, heroes, talents } = fi;

  const spellsBySlug = new Map(spellSheets.map((s) => [s.slug, s]));
  const sorts = partsWith("emblem", slug, "spell")
    .slice(0, 4)
    .map((p) => {
      const s = spellsBySlug.get(p.key);
      return {
        key: p.key,
        name: textChoice(t, p.key, "name", s?.name ?? p.key)!,
        image: s?.image ?? null,
        part: p.part,
        href: s ? `/spells/${p.key}` : undefined,
      };
    });
  const levels = [
    t("pages.emblemDetail.tier", { n: 1 }),
    t("pages.emblemDetail.tier", { n: 2 }),
    t("emblemsUI.talents"),
  ];

  const heroTitle = t("pages.sheets.heroesTitle");
  const data = dataSheet(locale, {
    title: fi.title,
    description: fi.description,
    path: `/emblems/${slug}`,
    name,
    summary: fi.bonus,
    image: f.image,
    listName: t("pages.sheets.listLd", { nom: name }),
    heroes: heroes.slice(0, 10).map((h) => ({ name: heroName(h.slug), slug: h.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
      <PageHeader
        title={name}
        lead={fi.lead}
        icon={f.image ? <ItemIcon image={f.image} size={64} /> : undefined}
        crumbs={[
          { name: t("nav.emblems.label"), href: "/emblems" },
          { name, siblings: emblemsSheets.map((e) => ({ name: nameEmblem(t, e), href: `/emblems/${e.slug}` })) },
        ]}
      >
        <FreshnessLine locale={locale} className="mt-4" />
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <Card>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.emblemDetail.bonus")}</dt>
              <dd className="mt-1 text-chalk-100">{fi.bonus}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.sheets.bestFor")}</dt>
              <dd className="mt-1 leading-relaxed text-chalk-300">{fi.bestFor}</dd>
            </div>
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

        {talents.some((e) => e.length > 0) && (
          <section>
            <SectionTitle lead={t("pages.emblemDetail.talentsIntro")}>{t("pages.emblemDetail.talentsTitle")}</SectionTitle>
            <div className="grid gap-8 md:grid-cols-3">
              {talents.map((parts, i) => (
                <div key={levels[i]}>
                  <h3 className="mb-3 font-heading font-bold text-chalk-100">{levels[i]}</h3>
                  <PartsChoice
                    locale={locale}
                    entries={parts.slice(0, 4).map((p) => ({
                      key: p.key,
                      name: nameTalent(t, p.key),
                      image: imageTalent(p.key),
                      part: p.part,
                    }))}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {sorts.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.emblemDetail.spellsIntro")}>{t("pages.emblemDetail.spellsTitle")}</SectionTitle>
            <div className="max-w-md">
              <PartsChoice locale={locale} entries={sorts} />
            </div>
          </section>
        )}

        {heroes.length > 0 && (
          <section>
            <SectionTitle lead={t("pages.sheets.byRankIntro")}>{t("pages.sheets.byRank")}</SectionTitle>
            <TableRanks
              summary={summaryRanks("emblem", slug)}
              legend={t("pages.sheets.byRank")}
              t={t}
              locale={locale}
            />
          </section>
        )}

        <section>
          <SectionTitle>{t("pages.emblemDetail.others")}</SectionTitle>
          <ListLinks
            links={emblemsSheets
              .filter((e) => e.slug !== slug)
              .map((e) => {
                const n = usage("emblem", e.slug).length;
                return {
                  href: `/emblems/${e.slug}`,
                  name: nameEmblem(t, e),
                  image: e.image,
                  detail: n ? t("pages.sheets.nHeroes", { n }) : undefined,
                };
              })}
          />
        </section>
      </div>
    </>
  );
}

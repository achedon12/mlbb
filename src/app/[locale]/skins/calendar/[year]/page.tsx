import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { propsCardSkin } from "@/components/skin-card";
import { WikiCredit } from "@/components/wiki-credit";
import { SkinGrid } from "@/components/skin-grid";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { PageHeader, SectionTitle } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import {
  groupByDate,
  labelRarity,
  seriesLabel,
  linkSkin,
  readRelease,
  seriesStats,
  type YearSkins,
} from "@/lib/skin-catalog";
import { calendarYears, dataListSkins, catalogHeroes, releasedSkins } from "@/lib/skin-catalog-server";
import { sync } from "@/lib/data";
import { listNames, monthYear } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Locale; year: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return calendarYears().map((a) => ({ year: String(a) }));
}

function yearOf(year: string): YearSkins | null {
  const n = Number(year);
  return groupByDate(releasedSkins().filter((s) => readRelease(s.release)?.year === n), "chronologique")[0] ?? null;
}

/** Series et heros qui dominent l'annee, en chiffres. */
function factsYear(a: YearSkins) {
  const skins = a.month.flatMap((m) => m.skins);
  const byHero = new Map<string, number>();
  for (const s of skins) byHero.set(s.hero, (byHero.get(s.hero) ?? 0) + 1);
  const byRarity = new Map<number, number>();
  for (const s of skins) byRarity.set(s.rarity, (byRarity.get(s.rarity) ?? 0) + 1);
  return {
    series: seriesStats(skins),
    heroes: [...byHero].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])),
    rarities: [...byRarity].sort((x, y) => y[0] - x[0]),
  };
}

const uppercase = (s: string, locale: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

function description(locale: Locale, a: YearSkins): string {
  const t = createT(locale);
  const f = factsYear(a);
  const heroes = catalogHeroes();
  return t("pages.seo.calendarYear.description", {
    annee: a.year,
    n: a.total,
    series: listNames(locale, f.series.slice(0, 3).map((s) => `${seriesLabel(t, s.series)} (${s.total})`)) || "—",
    heros: f.heroes[0] ? `${heroes.get(f.heroes[0][0])?.name ?? f.heroes[0][0]} (${f.heroes[0][1]})` : "—",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, year } = await params;
  const a = yearOf(year);
  if (!a) return {};
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.calendarYear.title", { annee: a.year }),
    description: description(locale, a),
    path: `/skins/calendar/${a.year}`,
    keywords: [`MLBB skins ${a.year}`, `Mobile Legends skins ${a.year}`, "skin release date"],
  });
}

export default async function SkinsYearPage({ params }: Params) {
  const { locale, year } = await params;
  const a = yearOf(year);
  if (!a) notFound();

  const t = createT(locale);
  const localeHtml = LOCALE_HTML[locale];
  const count = new Intl.NumberFormat(localeHtml);
  const heroes = catalogHeroes();
  const years = calendarYears();
  const f = factsYear(a);
  const i = years.indexOf(a.year);
  const [next, previous] = [years[i - 1], years[i + 1]];
  const nameMonth = (m: number) => uppercase(monthYear(locale, `${a.year}-${String(m).padStart(2, "0")}-01`), localeHtml);
  const anchor = (m: number | null) => (m ? `m-${String(m).padStart(2, "0")}` : "m-inconnu");

  const facts = [
    f.series.length > 0 &&
      t("pages.skinsCalendar.year.factSeries", {
        liste: listNames(locale, f.series.slice(0, 5).map((s) => `${seriesLabel(t, s.series)} (${s.total})`)),
      }),
    f.heroes.length > 0 &&
      t("pages.skinsCalendar.year.factHeroes", {
        liste: listNames(locale, f.heroes.slice(0, 3).map(([s, n]) => `${heroes.get(s)?.name ?? s} (${n})`)),
      }),
    t("pages.skinsCalendar.year.factRarities", {
      liste: listNames(locale, f.rarities.map(([r, n]) => `${labelRarity(t, r)} (${n})`)),
    }),
  ].filter((x): x is string => !!x);

  const structuredData = dataListSkins(locale, {
    name: t("pages.skinsCalendar.year.title", { annee: a.year }),
    description: description(locale, a),
    path: `/skins/calendar/${a.year}`,
    elements: a.month.flatMap((m) =>
      m.skins.map((s) => ({ name: `${s.name} (${heroes.get(s.hero)?.name ?? s.hero})`, path: linkSkin(s) })),
    ),
  });

  const navigation = (
    <nav aria-label={t("pages.skinsCalendar.year.navYears")} className="flex flex-wrap justify-between gap-3 text-sm">
      {previous ? (
        <Link href={`/skins/calendar/${previous}`} className="font-semibold text-gold-400 hover:text-gold-500">
          ← {previous}
        </Link>
      ) : (
        <span />
      )}
      <Link href="/skins/calendar" className="text-chalk-300 hover:text-gold-400">
        {t("pages.skinsCalendar.crumb")}
      </Link>
      {next ? (
        <Link href={`/skins/calendar/${next}`} className="font-semibold text-gold-400 hover:text-gold-500">
          {next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.skinsCalendar.year.title", { annee: a.year })}
        lead={t("pages.skinsCalendar.year.lead", { annee: a.year, n: count.format(a.total) })}
        crumbs={[
          { name: t("pages.skinsCalendar.crumbSkins"), href: "/skins" },
          { name: t("pages.skinsCalendar.crumb"), href: "/skins/calendar" },
          { name: String(a.year), siblings: years.map((x) => ({ name: String(x), href: `/skins/calendar/${x}` })) },
        ]}
      >
        <FreshnessLine locale={locale} className="mt-4" />
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        <section>
          <ul className="max-w-3xl list-disc space-y-2 pl-5 leading-relaxed text-chalk-300 marker:text-gold-400">
            {facts.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <nav aria-label={t("pages.skinsCalendar.year.navMonths")} className="mt-6">
            <ul className="flex flex-wrap gap-2">
              {a.month.map((m) => (
                <li key={anchor(m.month)}>
                  <a
                    href={`#${anchor(m.month)}`}
                    className="bevel-sm inline-block border border-night-700 px-2.5 py-1 text-xs text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                  >
                    {m.month ? nameMonth(m.month) : t("pages.skinsCalendar.unknownMonth")}{" "}
                    <span className="text-chalk-500">· {m.skins.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        {a.month.map((m) => (
          <section key={anchor(m.month)} id={anchor(m.month)} className="scroll-mt-24">
            <SectionTitle>
              {m.month ? nameMonth(m.month) : t("pages.skinsCalendar.unknownMonth")}{" "}
              <span className="text-base font-normal text-chalk-500">
                · {t(m.skins.length === 1 ? "pages.skinsCalendar.nSkins1" : "pages.skinsCalendar.nSkins", {
                  n: count.format(m.skins.length),
                })}
              </span>
            </SectionTitle>
            <SkinGrid
              cards={m.skins.map((s) => propsCardSkin(s, heroes.get(s.hero)?.name ?? s.hero, t, localeHtml, count))}
            />
          </section>
        ))}

        {navigation}
        <WikiCredit t={t} href={sync.source} messageKey="pages.skinsCalendar.source" />
      </div>
    </>
  );
}

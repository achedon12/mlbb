import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/link";
import { FreshnessLine } from "@/components/freshness";
import { HeroPortrait } from "@/components/hero-portrait";
import { classesChip } from "@/components/chip";
import { BadgeTier, PageHeader } from "@/components/ui";
import { allHeroes } from "@/lib/data";
import { ROLES } from "@/lib/draft";
import { pathFilter, pathRole, roleOfSlug, SLUGS_ROLE } from "@/lib/tier-list-filters";
import { longDate, dateMeasure, listNames, patchCurrent } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { rankingFull } from "@/lib/tier-list";
import type { Role } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { heroListData, metaPage } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Locale; role: string }> };

/**
 * A role's page: its heroes, from strongest to weakest, with tier, win
 * rate and lanes. It replaces `/heroes?role=…` as the breadcrumb target
 * of hero pages: that address canonicalizes to the whole catalog,
 * whereas a role page can be indexed on its own.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(SLUGS_ROLE).map((role) => ({ role }));
}

/**
 * Heroes of the role, main or secondary, in tier list order (all
 * ranks); those the game does not measure yet close the list, by name.
 */
function roleHeroes(role: Role) {
  const classes = rankingFull.filter((e) => e.hero.roles.includes(role));
  const measures = new Set(classes.map((e) => e.hero.slug));
  const others = allHeroes
    .filter((h) => h.roles.includes(role) && !measures.has(h.slug))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [
    ...classes.map((e) => ({ heroes: e.hero, tier: e.tier, win: e.winRate as number | null })),
    ...others.map((h) => ({ heroes: h, tier: null, win: null })),
  ];
}

const markers = (t: T, role: Role, n: number) => ({
  role: t(`roles.${role}`),
  plural: t(`pages.tierList.rolePlural.${role}`),
  n,
});

/** Description built from data: roster size, top three, measurement date and patch. */
function description(locale: Locale, role: Role): string {
  const t = createT(locale);
  const list = roleHeroes(role);
  return t("pages.seo.heroesRole.description", {
    ...markers(t, role, list.length),
    top: listNames(locale, list.filter((e) => e.tier).slice(0, 3).map((e) => e.heroes.name)),
    date: longDate(locale),
    v: patchCurrent.version,
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, role: slug } = await params;
  const role = roleOfSlug(slug);
  if (!role) return {};
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.heroesRole.title", { ...markers(t, role, roleHeroes(role).length), v: patchCurrent.version }),
    description: description(locale, role),
    path: pathRole(role),
  });
}

export default async function RolePage({ params }: Params) {
  const { locale, role: slug } = await params;
  const role = roleOfSlug(slug);
  if (!role) notFound();
  const t = createT(locale);
  const list = roleHeroes(role);
  const r = markers(t, role, list.length);
  const title = t("pages.heroesRole.title", r);
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const structuredData = heroListData(locale, {
    name: title,
    description: description(locale, role),
    path: pathRole(role),
    heroes: list.map((e) => ({ name: e.heroes.name, slug: e.heroes.slug })),
    changed: dateMeasure,
    ranked: true,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PageHeader
        title={title}
        lead={t("pages.heroesRole.lead", r)}
        crumbs={[
          { name: t("nav.heroes.label"), href: "/heroes" },
          { name: r.role, siblings: ROLES.map((x) => ({ name: t(`roles.${x}`), href: pathRole(x) })) },
        ]}
      >
        <FreshnessLine locale={locale} before={t("pages.heroesRole.nHeroes", r)} className="mt-6" />
      </PageHeader>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <Link
          href={pathFilter({ type: "role", value: role })}
          className="bevel-sm inline-flex items-center gap-2 bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {t("pages.heroesRole.seeTierList", r)} →
        </Link>

        <nav aria-label={t("pages.heroesRole.otherRoles")} className="mb-8 mt-6 flex flex-wrap items-center gap-2">
          <span aria-hidden className="mr-1 text-xs uppercase tracking-wide text-chalk-500">
            {t("pages.heroesRole.otherRoles")}
          </span>
          {ROLES.map((x) => (
            <Link
              key={x}
              href={pathRole(x)}
              aria-current={x === role ? "page" : undefined}
              className={classesChip(x === role)}
            >
              {t(`roles.${x}`)}
            </Link>
          ))}
        </nav>

        <ul className="space-y-1.5">
          {list.map((e) => (
            <li key={e.heroes.slug}>
              <Link href={`/heroes/${e.heroes.slug}`} className="tier-row">
                <HeroPortrait
                  source={e.heroes.images.icon ?? e.heroes.images.portrait}
                  name={e.heroes.name}
                  size="icon"
                  decorative
                />
                <div className="tier-row-identity sm:w-auto sm:flex-1">
                  <span className="tier-row-name">{e.heroes.name}</span>
                  <span className="tier-row-lanes">
                    {e.heroes.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}
                  </span>
                </div>
                {e.tier ? (
                  <>
                    <span className="sr-only">{t("pages.tierList.tier", { p: e.tier })}</span>
                    <span aria-hidden>
                      <BadgeTier tier={e.tier} />
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-chalk-500">{t("pages.heroesRole.notMeasured")}</span>
                )}
                <dl className="tier-row-rates">
                  <div>
                    <dt>{t("pages.tierList.win")}</dt>
                    <dd>{e.win === null ? "—" : `${percent.format(e.win)} %`}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/link";
import { FreshnessLine } from "@/components/freshness";
import { GuideLink } from "@/components/guide";
import { HeroCard } from "@/components/hero-card";
import { heroArt } from "@/components/hero-art";
import { ArtTile, ENTRANCE, PosterHeader } from "@/components/poster-header";
import { GUIDE_LANE_OF_ROLE, guideOfLane } from "@/lib/guides";
import { imageRole } from "@/lib/emblems";
import { BadgeTier, Score } from "@/components/ui";
import { cn } from "@/lib/utils";
import { allHeroes } from "@/lib/data";
import { ROLES } from "@/lib/draft";
import { pathFilter, pathRole, roleOfSlug, SLUGS_ROLE } from "@/lib/tier-list-filters";
import { longDate, dateMeasure, listNames, patchCurrent } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { rankingFull } from "@/lib/tier-list";
import type { Role } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { heroListData, metaPage, notFoundMetadata } from "@/i18n/seo";
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale; role: string }> };

/**
 * A role's page: its heroes, from strongest to weakest, with tier, win
 * rate and lanes. It replaces `/heroes?role=…` as the breadcrumb target
 * of hero pages: that address canonicalizes to the whole catalog,
 * whereas a role page can be indexed on its own.
 */
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
  if (!role) return notFoundMetadata(locale);
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
  if (!role) return <NotFoundPage />;
  const t = createT(locale);
  const list = roleHeroes(role);
  const r = markers(t, role, list.length);
  const title = t("pages.heroesRole.title", r);
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const emblem = imageRole(role);
  // Only measured heroes stand on the podium.
  const podium = list.filter((e) => e.tier).slice(0, 3);
  const rest = list.slice(podium.length);

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
      <PosterHeader
        title={title}
        lead={t("pages.heroesRole.lead", r)}
        crumbs={[
          { name: t("nav.heroes.label"), href: "/heroes" },
          { name: r.role, siblings: ROLES.map((x) => ({ name: t(`roles.${x}`), href: pathRole(x) })) },
        ]}
        art={list[0] ? heroArt(list[0].heroes.slug) : null}
        position="55% 25%"
        actions={
          <>
            <Link href={pathFilter({ type: "role", value: role })} className="btn btn-primary btn-sm">
              {t("pages.heroesRole.seeTierList", r)} →
            </Link>
            <GuideLink guide={guideOfLane(GUIDE_LANE_OF_ROLE[role], locale)} locale={locale} className="btn btn-secondary btn-sm" />
          </>
        }
        aside={
          emblem && (
            // The role's insignia, as large as a crest: the one mark beside the title.
            <Image
              src={emblem}
              alt=""
              width={160}
              height={160}
              priority
              className="hidden size-36 object-contain drop-shadow-[0_8px_24px_rgb(0_0_0/0.6)] lg:block xl:size-40"
            />
          )
        }
      >
        <FreshnessLine locale={locale} before={t("pages.heroesRole.nHeroes", r)} className="mt-5" />
      </PosterHeader>

      <div className="page-wrap pb-14 pt-6">
        <nav aria-label={t("pages.heroesRole.otherRoles")} className="flex flex-wrap items-center gap-2">
          {ROLES.map((x) => {
            const on = x === role;
            const icon = imageRole(x);
            return (
              <Link
                key={x}
                href={pathRole(x)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "bevel-sm eclat-under inline-flex items-center gap-1.5 px-3 py-2 font-heading text-sm font-bold uppercase transition-[background-color,color,translate] hover:-translate-y-0.5",
                  on ? "bg-gold-400 text-night-950" : "bg-night-800 text-chalk-200 hover:text-gold-300",
                )}
              >
                {icon && <Image src={icon} alt="" width={20} height={20} className="size-5 object-contain" />}
                {t(`roles.${x}`)}
              </Link>
            );
          })}
        </nav>

        <h2 className="sr-only">{t("pages.heroesList.list")}</h2>
        {/* The podium: the role's three strongest heroes, on their artwork. */}
        {podium.length > 0 && (
          <ol className={cn("mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4", ENTRANCE)}>
            {podium.map((e, i) => (
              <li key={e.heroes.slug}>
                <ArtTile
                  href={`/heroes/${e.heroes.slug}`}
                  art={heroArt(e.heroes.slug)}
                  name={e.heroes.name}
                  heading="h3"
                  aspect="aspect-[16/10] sm:aspect-[4/5] lg:aspect-[16/10]"
                  position="50% 22%"
                  sizes="(min-width: 640px) 32vw, 92vw"
                  fallback={
                    e.heroes.images.portrait && (
                      <Image src={e.heroes.images.portrait} alt="" fill sizes="30vw" className="object-cover object-top" />
                    )
                  }
                  figure={
                    <span className="flex items-start gap-2">
                      <span aria-hidden className="score score-outline text-5xl">
                        {i + 1}
                      </span>
                      {e.tier && (
                        <>
                          <span className="sr-only">{t("pages.tierList.tier", { p: e.tier })}</span>
                          <span aria-hidden>
                            <BadgeTier tier={e.tier} />
                          </span>
                        </>
                      )}
                    </span>
                  }
                >
                  <span className="mt-1.5 flex items-end justify-between gap-3">
                    <span className="truncate text-sm text-chalk-300">
                      {e.heroes.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}
                    </span>
                    {e.win !== null && (
                      <span className="shrink-0 text-right">
                        <Score value={percent.format(e.win)} unit="%" className="text-[2.6rem]" />
                        <span className="sr-only"> {t("pages.tierList.win")}</span>
                      </span>
                    )}
                  </span>
                </ArtTile>
              </li>
            ))}
          </ol>
        )}

        {/* Then the rest of the role, as the catalogue's tiles, in tier list order. */}
        {rest.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-2.5 min-[560px]:grid-cols-3 sm:mt-5 sm:gap-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
            {rest.map((e) => (
              <li key={e.heroes.slug}>
                <HeroCard
                  hero={{
                    slug: e.heroes.slug,
                    name: e.heroes.name,
                    roles: e.heroes.roles,
                    lanes: e.heroes.lanes,
                    portrait: e.heroes.images.portrait ?? e.heroes.images.icon,
                    skins: e.heroes.skins.length,
                    analysis: e.heroes.analysis !== null,
                    win: e.win,
                    tier: e.tier,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

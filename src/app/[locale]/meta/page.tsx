import type { Metadata } from "next";
import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { FreshnessLine } from "@/components/freshness";
import { HeroPortrait } from "@/components/hero-portrait";
import { BadgeTier, PageHeader, SectionTitle } from "@/components/ui";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { LANES } from "@/lib/draft";
import { trendsOf } from "@/lib/evolution";
import { pathFilter } from "@/lib/tier-list-filters";
import { longDate, dateMeasure, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import {
  changesOfTier,
  groupAdjustments,
  firstNBy,
  ADJUSTMENT_DIRECTIONS,
  type ChangeTier,
  type AdjustmentDirection,
} from "@/lib/meta-report";
import { site } from "@/lib/site";
import { describeGap, formatGap, movesWeek, THRESHOLD_NOTABLE, type Motion } from "@/lib/trends";
import { rankingFull, ruleTierList, type RankedEntry } from "@/lib/tier-list";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale }> };

/**
 * Rapport meta de la semaine.
 *
 * Page generee au build a partir des donnees synchronisees, et donc refaite a
 * chaque synchronisation quotidienne : hausses et baisses du taux de victoire,
 * changements de palier, heros les plus bannis et les plus joues, dernier
 * patch, meilleurs heros par lane. Aucune prose inventee : chaque phrase est
 * un gabarit rempli par les chiffres du releve, et une rubrique sans donnees
 * le dit plutot que de broder.
 */
const PATH = "/meta";
/** Lignes par liste : assez pour voir le mouvement, sans refaire la tier list. */
const COUNT = 5;
const COUNT_TIERS = 8;

const READING = (() => {
  const week = movesWeek(
    allHeroes.map((h) => ({ slug: h.slug, series: trendsOf(h.slug).all })),
    COUNT,
  );
  const tiers = changesOfTier(
    rankingFull.map((e) => ({ slug: e.hero.slug, series: trendsOf(e.hero.slug).all, tierCurrent: e.tier })),
    ruleTierList,
  );
  return {
    week,
    tiers,
    banned: firstNBy(rankingFull, (e) => e.banRate, COUNT),
    played: firstNBy(rankingFull, (e) => e.pickRate, COUNT),
    patch: patchCurrent ? groupAdjustments(patchCurrent.adjustments) : null,
    byLane: LANES.map((lane) => ({
      lane,
      entries: rankingFull.filter((e) => e.hero.lanes.includes(lane)).slice(0, 3),
    })),
  };
})();

const version = () => patchCurrent?.version ?? "—";

const titleSeo = (t: T, locale: Locale) => t("pages.seo.meta.title", { date: longDate(locale), v: version() });

function descriptionReport(t: T, locale: Locale): string {
  const first = rankingFull[0];
  const banned = READING.banned[0];
  if (!first || !banned) {
    return t("pages.meta.lead", { date: longDate(locale), n: rankingFull.length, v: version() });
  }
  return t("pages.seo.meta.description", {
    date: longDate(locale),
    v: version(),
    premier: first.hero.name,
    banni: banned.hero.name,
    ban: percentage(locale, banned.banRate),
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: titleSeo(t, locale),
    description: descriptionReport(t, locale),
    path: PATH,
    type: "article",
    published: dateMeasure,
  });
}

const COLOR: Record<AdjustmentDirection, string> = {
  buff: "text-emerald-400",
  nerf: "text-blood-500",
  adjust: "text-azure-400",
};

export default async function MetaReportPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const { week, tiers, banned, played, patch, byLane } = READING;
  const date = longDate(locale);
  const threshold = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(THRESHOLD_NOTABLE);
  const name = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
  const first = rankingFull[0];
  const rise = week.rises[0];
  const drop = week.drops[0];
  const changes = tiers.climbs.length + tiers.drops.length;

  // Le resume : des phrases-gabarits remplies par les chiffres, rien d'autre.
  const summary = [
    first &&
      t("pages.meta.summary.top", {
        nom: first.hero.name,
        palier: first.tier,
        victoire: percentage(locale, first.winRate),
        ban: percentage(locale, first.banRate),
      }),
    rise &&
      t("pages.meta.summary.rise", {
        nom: name(rise.slug),
        avant: percentage(locale, rise.variation.before),
        actuel: percentage(locale, rise.variation.current),
        jours: rise.variation.days,
      }),
    drop &&
      t("pages.meta.summary.fall", {
        nom: name(drop.slug),
        avant: percentage(locale, drop.variation.before),
        actuel: percentage(locale, drop.variation.current),
        jours: drop.variation.days,
      }),
    changes > 0 &&
      t("pages.meta.summary.tiers", { montees: tiers.climbs.length, descentes: tiers.drops.length }),
    banned[0] && t("pages.meta.summary.banned", { nom: banned[0].hero.name, ban: percentage(locale, banned[0].banRate) }),
  ].filter((p): p is string => typeof p === "string");

  // Article date du releve : c'est lui qui change le contenu, chaque jour.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: titleSeo(t, locale),
    description: descriptionReport(t, locale),
    datePublished: dateMeasure,
    dateModified: dateMeasure,
    inLanguage: LOCALE_HTML[locale],
    image: `${site.url}/opengraph-image`,
    author: { "@type": "Organization", name: site.name, url: site.url },
    publisher: { "@type": "Organization", name: site.name, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}${PATH}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PageHeader
        title={t("pages.meta.title", { date })}
        lead={t("pages.meta.lead", { date, n: rankingFull.length, v: version() })}
      >
        <FreshnessLine locale={locale} className="mt-6" />
        {summary.length > 0 && (
          <ul className="mt-6 max-w-2xl space-y-1.5 text-sm leading-relaxed text-chalk-300">
            {summary.map((sentence) => (
              <li key={sentence} className="flex gap-2">
                <span aria-hidden className="text-gold-400">
                  •
                </span>
                {sentence}
              </li>
            ))}
          </ul>
        )}
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        {/* ── Hausses et baisses ─────────────────────────────────────────── */}
        <section>
          <SectionTitle lead={t("home.trends.lead", { seuil: threshold })}>{t("home.trends.title")}</SectionTitle>
          <div className="grid gap-8 md:grid-cols-2">
            <Moves
              title={t("home.trends.rise")}
              empty={t("home.trends.noRise")}
              moves={week.rises}
              rise
              locale={locale}
              t={t}
            />
            <Moves
              title={t("home.trends.fall")}
              empty={t("home.trends.noFall")}
              moves={week.drops}
              rise={false}
              locale={locale}
              t={t}
            />
          </div>
        </section>

        {/* ── Changements de palier ──────────────────────────────────────── */}
        <section>
          <SectionTitle lead={t("pages.meta.tiers.lead")}>{t("pages.meta.tiers.title")}</SectionTitle>
          <div className="grid gap-8 md:grid-cols-2">
            <Tiers
              title={t("pages.meta.tiers.promotions")}
              empty={t("pages.meta.tiers.noPromotion")}
              changes={tiers.climbs.slice(0, COUNT_TIERS)}
              rise
              t={t}
            />
            <Tiers
              title={t("pages.meta.tiers.demotions")}
              empty={t("pages.meta.tiers.noDemotion")}
              changes={tiers.drops.slice(0, COUNT_TIERS)}
              rise={false}
              t={t}
            />
          </div>
        </section>

        {/* ── Bans et picks ──────────────────────────────────────────────── */}
        <section>
          <SectionTitle lead={t("pages.meta.bansPicks.lead", { date })}>
            {t("pages.meta.bansPicks.title")}
          </SectionTitle>
          <div className="grid gap-8 md:grid-cols-2">
            <Ranking
              title={t("pages.meta.bansPicks.banned")}
              entries={banned}
              value={(e) => percentage(locale, e.banRate)}
            />
            <Ranking
              title={t("pages.meta.bansPicks.played")}
              entries={played}
              value={(e) => percentage(locale, e.pickRate)}
            />
          </div>
        </section>

        {/* ── Dernier patch ──────────────────────────────────────────────── */}
        {patchCurrent && patch && (
          <section>
            <SectionTitle
              lead={
                patchCurrent.date
                  ? t("pages.patchNotes.publishedOn", { date: longDate(locale, patchCurrent.date) })
                  : undefined
              }
              action={{ href: `/patch-notes/${patchCurrent.version}`, label: t("home.readNotes") }}
            >
              {t("pages.meta.patch.title", { v: patchCurrent.version })}
            </SectionTitle>
            <div className="space-y-6">
              {patchCurrent.newHeroes.length > 0 && (
                <HeroGroup title={t("pages.meta.patch.newcomers")} list={patchCurrent.newHeroes} color="text-gold-400" />
              )}
              {ADJUSTMENT_DIRECTIONS.map((direction) =>
                patch[direction].length > 0 ? (
                  <HeroGroup
                    key={direction}
                    title={t(`patchHeroes.plural.${direction}`)}
                    list={patch[direction]}
                    color={COLOR[direction]}
                  />
                ) : null,
              )}
              {patchCurrent.newHeroes.length === 0 && ADJUSTMENT_DIRECTIONS.every((s) => patch[s].length === 0) && (
                <p className="text-sm text-chalk-500">{t("pages.meta.patch.none")}</p>
              )}
            </div>
          </section>
        )}

        {/* ── Meilleurs heros par lane ───────────────────────────────────── */}
        <section>
          <SectionTitle lead={t("pages.meta.lanes.lead")}>{t("pages.meta.lanes.title")}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {byLane.map(({ lane, entries }) => (
              <div key={lane} className="bevel flex flex-col border border-night-700/70 bg-night-900/60 p-4">
                <h3 className="font-heading text-lg font-bold text-gold-400">{t(`lanes.${lane}`)}</h3>
                <ol className="mt-3 flex-1 space-y-2.5">
                  {entries.map((e) => (
                    <li key={e.hero.slug}>
                      <Link href={`/heroes/${e.hero.slug}`} className="group flex items-center gap-2.5">
                        <HeroPortrait
                          source={e.hero.images.icon ?? e.hero.images.portrait}
                          name={e.hero.name}
                          size="small"
                          decorative
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                            {e.hero.name}
                          </span>
                          <span className="block text-xs text-chalk-500">
                            {t("pages.meta.lanes.row", { palier: e.tier, victoire: percentage(locale, e.winRate) })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link
                  href={pathFilter({ type: "lane", value: lane })}
                  className="mt-4 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
                >
                  {t("pages.meta.lanes.see", { lane: t(`pages.tierList.laneSeo.${lane}`) })} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <p className="border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500">
          {t("pages.meta.method", { date, seuil: threshold })}
        </p>
      </div>
    </>
  );
}

/** Ligne d'un heros : portrait, nom, un detail sous le nom, une valeur a droite. */
function HeroRow({ slug, detail, children }: { slug: string; detail?: string; children?: React.ReactNode }) {
  const h = heroesBySlug.get(slug);
  if (!h) return null;
  return (
    <Link
      href={`/heroes/${slug}`}
      className="bevel-sm group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2.5 transition-colors hover:border-gold-500/60"
    >
      <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="icon" decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
          {h.name}
        </span>
        {detail && <span className="block text-xs text-chalk-500">{detail}</span>}
      </span>
      {children}
    </Link>
  );
}

/** Hausses ou baisses : taux d'il y a sept jours et du jour, ecart en points. */
function Moves({
  title,
  empty,
  moves,
  rise,
  locale,
  t,
}: {
  title: string;
  empty: string;
  moves: Motion[];
  rise: boolean;
  locale: Locale;
  t: T;
}) {
  const Icon = rise ? TrendingUp : TrendingDown;
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div>
      <h3
        className={cn(
          "mb-3 flex items-center gap-2 font-heading text-lg font-bold",
          rise ? "text-emerald-400" : "text-blood-500",
        )}
      >
        <Icon size={18} aria-hidden />
        {title}
      </h3>
      {moves.length === 0 ? (
        <p className="text-sm text-chalk-500">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {moves.map(({ slug, variation: v }) => (
            <li key={slug}>
              <HeroRow
                slug={slug}
                detail={`${percent.format(v.before)} → ${percent.format(v.current)} ${t("home.winPercent")}`}
              >
                <span
                  className={cn("shrink-0 font-semibold tabular-nums", rise ? "text-emerald-400" : "text-blood-500")}
                >
                  <span aria-hidden>
                    {formatGap(v.gap, locale)} {t("counters.pts")}
                  </span>
                  <span className="sr-only">{describeGap(t, locale, v.gap, v.days)}</span>
                </span>
              </HeroRow>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Montees ou descentes de palier : ancien et nouveau palier. */
function Tiers({
  title,
  empty,
  changes,
  rise,
  t,
}: {
  title: string;
  empty: string;
  changes: ChangeTier[];
  rise: boolean;
  t: T;
}) {
  const Icon = rise ? TrendingUp : TrendingDown;
  return (
    <div>
      <h3
        className={cn(
          "mb-3 flex items-center gap-2 font-heading text-lg font-bold",
          rise ? "text-emerald-400" : "text-blood-500",
        )}
      >
        <Icon size={18} aria-hidden />
        {title}
      </h3>
      {changes.length === 0 ? (
        <p className="text-sm text-chalk-500">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {changes.map((c) => (
            <li key={c.slug}>
              <HeroRow slug={c.slug}>
                <span aria-hidden className="flex shrink-0 items-center gap-1.5">
                  <BadgeTier tier={c.before} />
                  <span className="text-chalk-500">→</span>
                  <BadgeTier tier={c.after} />
                </span>
                <span className="sr-only">{t("pages.meta.tiers.sr", { avant: c.before, apres: c.after })}</span>
              </HeroRow>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Les premiers selon un taux (ban, selection), avec la valeur. */
function Ranking({
  title,
  entries,
  value,
}: {
  title: string;
  entries: RankedEntry[];
  value: (e: RankedEntry) => string;
}) {
  return (
    <div>
      <h3 className="mb-3 font-heading text-lg font-bold text-chalk-100">{title}</h3>
      <ol className="space-y-2">
        {entries.map((e) => (
          <li key={e.hero.slug}>
            <HeroRow slug={e.hero.slug}>
              <span className="shrink-0 font-semibold tabular-nums text-gold-400">{value(e)}</span>
            </HeroRow>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Heros d'un patch, en pastilles : lien vers la fiche quand elle existe. */
function HeroGroup({
  title,
  list,
  color,
}: {
  title: string;
  list: { slug: string; name: string }[];
  color: string;
}) {
  return (
    <div>
      <h3 className={cn("font-heading text-lg font-bold", color)}>
        {title} <span className="text-sm font-medium text-chalk-500">{list.length}</span>
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {list.map((a) => {
          const h = heroesBySlug.get(a.slug);
          const content = (
            <>
              <HeroPortrait
                source={h?.images.icon ?? h?.images.portrait ?? null}
                name={h?.name ?? a.name}
                size="micro"
                decorative
              />
              <span className="font-medium text-chalk-100">{h?.name ?? a.name}</span>
            </>
          );
          const classes = "bevel-sm flex items-center gap-2 border border-night-700/70 bg-night-900/60 py-1 pl-1 pr-2.5 text-sm";
          return (
            <li key={a.slug}>
              {h ? (
                <Link href={`/heroes/${a.slug}`} className={cn(classes, "transition-colors hover:border-gold-500/60")}>
                  {content}
                </Link>
              ) : (
                <span className={classes}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

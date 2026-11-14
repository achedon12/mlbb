import { FlaskConical, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { advanceVersions, isUnderTest } from "@/lib/advance-server";
import { detailedPatches, heroesBySlug } from "@/lib/data";
import { historyOf } from "@/lib/evolution";
import { longDate, patchCurrent } from "@/lib/freshness";
import { ADJUSTMENT_DIRECTIONS, groupAdjustments, type AdjustmentDirection } from "@/lib/meta-report";
import { DAYS_IMPACT, formatGap, impactsOfPatch, THRESHOLD_IMPACT } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** Heroes shown per direction; the rest is one link away, in the notes. */
const PER_DIRECTION = 8;
/** Fewer on a phone, where the three columns stack. */
const PER_DIRECTION_PHONE = 4;

const STYLE: Record<AdjustmentDirection, { color: string; icon: typeof TrendingUp }> = {
  buff: { color: "text-emerald-400", icon: TrendingUp },
  nerf: { color: "text-blood-500", icon: TrendingDown },
  adjust: { color: "text-azure-400", icon: Minus },
};

/**
 * What the live patch changed, hero by hero, with what it did to them: each
 * hero carries the gap between its average win rate the week before and the
 * week after the patch, when the history covers both. The patch notes say
 * what was announced; this says what came of it.
 */
export function HomePatch({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const patch = detailedPatches(locale)[patchCurrent.version] ?? patchCurrent;
  const groups = groupAdjustments(patch.adjustments);
  const impacts = impactsOfPatch(patch, historyOf);
  const changed = ADJUSTMENT_DIRECTIONS.reduce((n, d) => n + groups[d].length, 0);
  const testing = advanceVersions(locale).find((v) => isUnderTest(v.version, patch.version));
  const hasImpacts = Object.keys(impacts).length > 0;

  return (
    <section aria-labelledby="home-patch" className="border-y border-night-700/70 bg-night-900/30">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-16">
        <SectionTitle
          id="home-patch"
          lead={
            patch.date
              ? t("home.patch.lead", { n: changed, date: longDate(locale, patch.date) })
              : t("home.patch.leadUndated", { n: changed })
          }
          action={{ href: `/patch-notes/${patch.version}`, label: t("home.readNotes") }}
        >
          {t("home.patch.title", { version: patch.version })}
        </SectionTitle>

        {patch.newHeroes.length > 0 && (
          <ul className="mb-6 flex flex-wrap gap-2">
            {patch.newHeroes.map((n) => {
              const h = heroesBySlug.get(n.slug);
              return (
                <li key={n.slug}>
                  <Link
                    href={h ? `/heroes/${n.slug}` : `/patch-notes/${patch.version}`}
                    className="bevel-sm flex items-center gap-2 border border-gold-500/50 bg-gold-500/10 py-1 pl-1 pr-3 text-sm font-semibold text-gold-400 transition-colors hover:border-gold-400"
                  >
                    <HeroPortrait source={h?.images.icon ?? null} name={n.name} size="small" decorative />
                    <Sparkles size={14} aria-hidden />
                    {t("home.patch.newHero", { name: n.name })}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {ADJUSTMENT_DIRECTIONS.map((direction) => {
            const list = groups[direction];
            if (list.length === 0) return null;
            const { color, icon: Icon } = STYLE[direction];
            const rest = Math.max(0, list.length - PER_DIRECTION);
            const restPhone = Math.max(0, list.length - PER_DIRECTION_PHONE);
            return (
              <div key={direction} className="bevel border border-night-700/70 bg-night-900/60 p-3 sm:p-4">
                <h3 className={cn("flex items-center gap-2 font-heading text-base font-bold", color)}>
                  <Icon size={16} aria-hidden />
                  {t(`patchHeroes.plural.${direction}`)}
                  <span className="text-sm font-medium text-chalk-500">{list.length}</span>
                </h3>
                <ul className="mt-2 space-y-1">
                  {list.slice(0, PER_DIRECTION).map((a, i) => {
                    const h = heroesBySlug.get(a.slug);
                    const impact = impacts[a.slug];
                    const net = impact && Math.abs(impact.gap) >= THRESHOLD_IMPACT - 1e-9;
                    return (
                      <li key={a.slug} className={cn(i >= PER_DIRECTION_PHONE && "max-sm:hidden")}>
                        <Link href={h ? `/heroes/${a.slug}` : `/patch-notes/${patch.version}`} className="group flex items-center gap-2.5 py-0.5">
                          <HeroPortrait source={h?.images.icon ?? h?.images.portrait ?? null} name={h?.name ?? a.name} size="small" decorative />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk-200 transition-colors group-hover:text-gold-400">
                            {h?.name ?? a.name}
                          </span>
                          {impact && (
                            <span
                              className={cn(
                                "shrink-0 text-xs tabular-nums",
                                !net ? "text-chalk-500" : impact.gap > 0 ? "text-emerald-400" : "text-blood-500",
                              )}
                            >
                              <span aria-hidden>{formatGap(impact.gap, locale)} {t("counters.pts")}</span>
                              <span className="sr-only">
                                {t("home.patch.impact", { gap: formatGap(impact.gap, locale) })}
                              </span>
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {restPhone > 0 && (
                  <Link
                    href={`/patch-notes/${patch.version}`}
                    className={cn(
                      "mt-2 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500",
                      rest === 0 && "sm:hidden",
                    )}
                  >
                    <span className="sm:hidden">{t("home.patch.more", { n: restPhone })}</span>
                    {rest > 0 && <span className="max-sm:hidden">{t("home.patch.more", { n: rest })}</span>}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 text-xs leading-relaxed text-chalk-500 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          {hasImpacts && <p className="max-w-2xl">{t("home.patch.impactNote", { n: DAYS_IMPACT })}</p>}
          <p className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/meta" className="font-semibold text-gold-400 hover:text-gold-500">
              {t("home.patch.metaReport")}
            </Link>
            <Link
              href={testing ? `/patch-notes/advance-server/${testing.version}` : "/patch-notes/advance-server"}
              className="inline-flex items-center gap-1.5 font-semibold text-gold-400 hover:text-gold-500"
            >
              <FlaskConical size={14} aria-hidden />
              {testing ? t("home.patch.testing", { version: testing.version }) : t("nav.advanceServer.label")}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

import { LiquipediaPatchNote } from "@/components/patch-credit";
import { FlaskConical, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { HeroTile } from "@/components/hero-tile";
import { SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { advanceDocumented } from "@/lib/advance-fresh";
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
  buff: { color: "text-azure-400", icon: TrendingUp },
  nerf: { color: "text-blood-400", icon: TrendingDown },
  adjust: { color: "text-chalk-300", icon: Minus },
};

/**
 * What the live patch changed, hero by hero, with what it did to them: each
 * hero carries the gap between its average win rate the week before and the
 * week after the patch, when the history covers both. The patch notes say
 * what was announced; this says what came of it.
 *
 * Buffs and nerfs are rows of portraits, the gap over each in the colour of
 * its direction (ally blue up, enemy red down); the plain adjustments, which
 * neither help nor hurt, follow as a line of names.
 */
export function HomePatch({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const patch = detailedPatches(locale)[patchCurrent.version] ?? patchCurrent;
  const groups = groupAdjustments(patch.adjustments);
  const impacts = impactsOfPatch(patch, historyOf);
  const changed = ADJUSTMENT_DIRECTIONS.reduce((n, d) => n + groups[d].length, 0);
  const testing = advanceVersions(locale).find((v) => isUnderTest(v.version, patch.version));
  const hasImpacts = Object.keys(impacts).length > 0;

  return (
    <section aria-labelledby="home-patch" className={className}>
      <div>
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
                    className="btn btn-primary btn-sm pl-1"
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

        <div className="space-y-8">
          {ADJUSTMENT_DIRECTIONS.map((direction) => {
            const list = groups[direction];
            if (list.length === 0) return null;
            const { color, icon: Icon } = STYLE[direction];
            const rest = Math.max(0, list.length - PER_DIRECTION);
            const restPhone = Math.max(0, list.length - PER_DIRECTION_PHONE);
            const more = restPhone > 0 && (
              <Link
                href={`/patch-notes/${patch.version}`}
                className={cn(
                  "font-heading text-base font-bold uppercase text-gold-400 hover:text-gold-300",
                  rest === 0 && "sm:hidden",
                )}
              >
                <span className="sm:hidden">{t("home.patch.more", { n: restPhone })}</span>
                {rest > 0 && <span className="max-sm:hidden">{t("home.patch.more", { n: rest })}</span>}
              </Link>
            );
            const heading = (
              <h3 className={cn("flex items-center gap-2 type-subtitle", color)}>
                <Icon size={18} aria-hidden />
                {t(`patchHeroes.plural.${direction}`)}
                <span className="font-heading text-base font-bold text-chalk-500">{list.length}</span>
              </h3>
            );
            if (direction === "adjust") {
              return (
                <div key={direction}>
                  {heading}
                  <ul className="mt-3 flex flex-wrap items-center gap-2">
                    {list.slice(0, PER_DIRECTION).map((a, i) => {
                      const h = heroesBySlug.get(a.slug);
                      return (
                        <li key={a.slug} className={cn(i >= PER_DIRECTION_PHONE && "max-sm:hidden")}>
                          <Link
                            href={h ? `/heroes/${a.slug}` : `/patch-notes/${patch.version}`}
                            className="bevel-sm group flex items-center gap-2 bg-night-900 py-1 pl-1 pr-3 transition-colors hover:bg-night-800"
                          >
                            <HeroPortrait source={h?.images.icon ?? h?.images.portrait ?? null} name={h?.name ?? a.name} size="small" decorative />
                            <span className="font-heading font-bold uppercase text-chalk-200 transition-colors group-hover:text-gold-400">
                              {h?.name ?? a.name}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                    {more && <li>{more}</li>}
                  </ul>
                </div>
              );
            }
            return (
              <div key={direction}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  {heading}
                  {more}
                </div>
                <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3 lg:grid-cols-8">
                  {list.slice(0, PER_DIRECTION).map((a, i) => {
                    const h = heroesBySlug.get(a.slug);
                    const impact = impacts[a.slug];
                    const net = impact && Math.abs(impact.gap) >= THRESHOLD_IMPACT - 1e-9;
                    return (
                      <li key={a.slug} className={cn(i >= PER_DIRECTION_PHONE && "max-sm:hidden", i >= 6 && "sm:max-lg:hidden")}>
                        <HeroTile
                          href={h ? `/heroes/${a.slug}` : `/patch-notes/${patch.version}`}
                          name={h?.name ?? a.name}
                          portrait={h?.images.portrait ?? h?.images.icon ?? null}
                          figure={impact ? `${formatGap(impact.gap, locale)}` : undefined}
                          label={impact ? t("home.patch.impact", { gap: formatGap(impact.gap, locale) }) : undefined}
                          tone={!impact || !net ? "muted" : impact.gap > 0 ? "ally" : "enemy"}
                          sizes="(min-width: 1024px) 9vw, (min-width: 640px) 15vw, 23vw"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 text-xs leading-relaxed text-chalk-500 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="max-w-2xl space-y-1">
            {hasImpacts && <p>{t("home.patch.impactNote", { n: DAYS_IMPACT })}</p>}
            <LiquipediaPatchNote t={t} patches={[patch]} />
          </div>
          <p className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/meta" className="font-heading text-base font-bold uppercase text-gold-400 hover:text-gold-300">
              {t("home.patch.metaReport")}
            </Link>
            {(testing || advanceDocumented()) && (
              <Link
                href={testing ? `/patch-notes/advance-server/${testing.version}` : "/patch-notes/advance-server"}
                className="inline-flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400 hover:text-gold-300"
              >
                <FlaskConical size={14} aria-hidden />
                {testing ? t("home.patch.testing", { version: testing.version }) : t("nav.advanceServer.label")}
              </Link>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

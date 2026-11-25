import { LiquipediaPatchNote } from "@/components/patch-credit";
import { FlaskConical, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { HeroTile } from "@/components/hero-tile";
import { splitRow } from "@/components/home/patch-row";
import { SCROLL_ROW } from "@/components/home/scroll-row";
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

/** Plain adjustments shown as names; the rest in the notes. */
const ADJUSTED = 8;

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
 * Buffs and nerfs share one row from `lg`, each group as wide as its share
 * of the portraits, so the row is always full whatever the counts — never a
 * line of six over a line of three. The gap over each portrait is in the
 * colour of its direction (ally blue up, enemy red down). Below `lg` each
 * group is a line that scrolls sideways. The plain adjustments, which
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
  const [buffs, nerfs] = splitRow(groups.buff.length, groups.nerf.length);
  const row = (
    [
      ["buff", buffs],
      ["nerf", nerfs],
    ] as const
  ).filter(([, n]) => n > 0);
  const notes = `/patch-notes/${patch.version}`;

  const heading = (direction: AdjustmentDirection, shown: number) => {
    const { color, icon: Icon } = STYLE[direction];
    const total = groups[direction].length;
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={cn("flex items-center gap-2 type-subtitle", color)}>
          <Icon size={18} aria-hidden />
          {t(`patchHeroes.plural.${direction}`)}
          <span className="font-heading text-base font-bold text-chalk-500">{total}</span>
        </h3>
        {total > shown && (
          <Link href={notes} className="font-heading text-sm font-bold uppercase text-gold-400 hover:text-gold-300">
            {t("home.patch.more", { n: total - shown })}
          </Link>
        )}
      </div>
    );
  };

  return (
    <section aria-labelledby="home-patch" data-home-patch className={className}>
      <SectionTitle
        id="home-patch"
        lead={
          patch.date
            ? t("home.patch.lead", { n: changed, date: longDate(locale, patch.date) })
            : t("home.patch.leadUndated", { n: changed })
        }
        action={{ href: notes, label: t("home.readNotes") }}
      >
        {t("home.patch.title", { version: patch.version })}
      </SectionTitle>

      {patch.newHeroes.length > 0 && (
        <ul className="mb-6 flex flex-wrap gap-2">
          {patch.newHeroes.map((n) => {
            const h = heroesBySlug.get(n.slug);
            return (
              <li key={n.slug}>
                <Link href={h ? `/heroes/${n.slug}` : notes} className="btn btn-primary btn-sm min-h-11 pl-1">
                  <HeroPortrait source={h?.images.icon ?? null} name={n.name} size="small" decorative />
                  <Sparkles size={14} aria-hidden />
                  {t("home.patch.newHero", { name: n.name })}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {row.length > 0 && (
        <div className="space-y-8 lg:flex lg:gap-8 lg:space-y-0">
          {row.map(([direction, shown]) => (
            <div key={direction} className="min-w-0 lg:basis-0" style={{ flexGrow: shown }}>
              {heading(direction, shown)}
              <ul
                className={cn(SCROLL_ROW, "mt-3 gap-2 sm:gap-3 lg:grid lg:grid-cols-[repeat(var(--tiles),minmax(0,1fr))]")}
                style={{ "--tiles": shown } as React.CSSProperties}
              >
                {groups[direction].slice(0, shown).map((a) => {
                  const h = heroesBySlug.get(a.slug);
                  const impact = impacts[a.slug];
                  const net = impact && Math.abs(impact.gap) >= THRESHOLD_IMPACT - 1e-9;
                  return (
                    <li key={a.slug} className="w-[7.25rem] shrink-0 snap-start sm:w-32 lg:w-auto lg:min-w-0">
                      <HeroTile
                        href={h ? `/heroes/${a.slug}` : notes}
                        name={h?.name ?? a.name}
                        portrait={h?.images.portrait ?? h?.images.icon ?? null}
                        figure={impact ? `${formatGap(impact.gap, locale)}` : undefined}
                        label={impact ? t("home.patch.impact", { gap: formatGap(impact.gap, locale) }) : undefined}
                        tone={!impact || !net ? "muted" : impact.gap > 0 ? "ally" : "enemy"}
                        sizes="(min-width: 1024px) 9vw, (min-width: 640px) 8rem, 7.25rem"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {groups.adjust.length > 0 && (
        <div className="mt-8">
          {heading("adjust", Math.min(groups.adjust.length, ADJUSTED))}
          <ul className="mt-3 flex flex-wrap items-center gap-2">
            {groups.adjust.slice(0, ADJUSTED).map((a) => {
              const h = heroesBySlug.get(a.slug);
              return (
                <li key={a.slug}>
                  <Link
                    href={h ? `/heroes/${a.slug}` : notes}
                    className="bevel-sm group flex min-h-11 items-center gap-2 bg-night-900 py-1 pl-1 pr-3 transition-colors hover:bg-night-800"
                  >
                    <HeroPortrait source={h?.images.icon ?? h?.images.portrait ?? null} name={h?.name ?? a.name} size="small" decorative />
                    <span className="font-heading font-bold uppercase text-chalk-200 transition-colors group-hover:text-gold-400">
                      {h?.name ?? a.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
    </section>
  );
}

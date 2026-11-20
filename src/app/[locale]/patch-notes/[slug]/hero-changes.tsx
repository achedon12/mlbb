import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { HeroTile } from "@/components/hero-tile";
import { DIRECTION_TONE } from "@/components/patch-visuals";
import { SectionTitle } from "@/components/ui";
import { heroesBySlug } from "@/lib/data";
import { historyOf } from "@/lib/evolution";
import { groupAdjustments, ADJUSTMENT_DIRECTIONS } from "@/lib/meta-report";
import { formatGap, impactsOfPatch, DAYS_IMPACT, THRESHOLD_IMPACT } from "@/lib/trends";
import type { DetailedPatch } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { cn } from "@/lib/utils";

/** Number of distinct heroes affected by a patch. */
export function changedHeroCount(patch: Pick<DetailedPatch, "adjustments">): number {
  const groups = groupAdjustments(patch.adjustments);
  return ADJUSTMENT_DIRECTIONS.reduce((n, direction) => n + groups[direction].length, 0);
}

/**
 * All of a patch's hero changes, in three groups: buffed, nerfed, adjusted.
 * Rendered by the server, with a link to each hero page: the detailed list
 * further down only shows its own once expanded.
 *
 * Buffs and nerfs are rows of portraits. When the rate history covers the
 * patch, each carries the gap between its average win rate over the seven
 * days before and after, in ally blue when it rose, enemy red when it fell,
 * grey within the noise; otherwise the direction's arrow, in its colour.
 * The plain adjustments, which neither help nor hurt, follow as a line of
 * names.
 */
export function HeroChanges({
  patch,
  locale,
  anchorDetail,
}: {
  patch: DetailedPatch;
  locale: Locale;
  /** Anchor of the detailed adjustments section, when the patch has one. */
  anchorDetail: string | null;
}) {
  const t = createT(locale);
  const groups = groupAdjustments(patch.adjustments);
  const impacts = impactsOfPatch(patch, historyOf);
  const n = changedHeroCount(patch);
  const shape = new Intl.PluralRules(locale).select(n) === "one" ? "one" : "other";
  const percent = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rate = (v: number) => percent.format(v / 100);

  return (
    <section aria-labelledby="hero-changes" className="scroll-mt-24">
      <SectionTitle id="hero-changes">{t("pages.patchNotes.changes.title", { v: patch.version })}</SectionTitle>
      <p className="-mt-2 mb-8 max-w-3xl text-chalk-300 sm:-mt-4">
        {t(`pages.patchNotes.changes.summary.${shape}`, { n, v: patch.version })}
        {anchorDetail && (
          <>
            {" "}
            <a href={`#${anchorDetail}`} className="font-heading font-bold uppercase text-gold-400 hover:text-gold-300">
              {t("pages.patchNotes.changes.detail")} ↓
            </a>
          </>
        )}
      </p>

      <div className="space-y-10">
        {ADJUSTMENT_DIRECTIONS.map((direction) => {
          const list = groups[direction];
          if (list.length === 0) return null;
          const { text, Icon } = DIRECTION_TONE[direction];
          const heading = (
            <h3 className={cn("flex items-center gap-2 type-subtitle", text)}>
              <Icon size={18} aria-hidden />
              {t(`patchHeroes.plural.${direction}`)}
              <span className="font-heading text-base font-bold text-chalk-500">{list.length}</span>
            </h3>
          );

          if (direction === "adjust") {
            return (
              <div key={direction}>
                {heading}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {list.map((a) => {
                    const sheet = heroesBySlug.get(a.slug);
                    const content = (
                      <>
                        <HeroPortrait
                          source={sheet?.images.icon ?? sheet?.images.portrait ?? null}
                          name={sheet?.name ?? a.name}
                          size="small"
                          decorative
                        />
                        <span className="font-heading font-bold uppercase text-chalk-200 transition-colors group-hover:text-gold-400">
                          {sheet?.name ?? a.name}
                        </span>
                      </>
                    );
                    const classes = "bevel-sm group flex items-center gap-2 bg-night-900 py-1 pl-1 pr-3";
                    return (
                      <li key={a.slug}>
                        {sheet ? (
                          <Link href={`/heroes/${a.slug}`} className={cn(classes, "transition-colors hover:bg-night-800")}>
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

          return (
            <div key={direction}>
              {heading}
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3 lg:grid-cols-6 xl:grid-cols-8">
                {list.map((a) => {
                  const sheet = heroesBySlug.get(a.slug);
                  const impact = impacts[a.slug];
                  const net = impact && Math.abs(impact.gap) >= THRESHOLD_IMPACT - 1e-9;
                  const name = sheet?.name ?? a.name;
                  return (
                    <li key={a.slug}>
                      <HeroTile
                        href={sheet ? `/heroes/${a.slug}` : `/patch-notes/${patch.version}`}
                        name={name}
                        portrait={sheet?.images.portrait ?? sheet?.images.icon ?? null}
                        figure={impact ? formatGap(impact.gap, locale) : direction === "buff" ? "▲" : "▼"}
                        label={
                          impact
                            ? t("pages.patchNotes.changes.impact", { before: rate(impact.before), after: rate(impact.after) })
                            : t(`patchHeroes.${direction}`)
                        }
                        tone={
                          impact
                            ? !net
                              ? "muted"
                              : impact.gap > 0
                                ? "ally"
                                : "enemy"
                            : direction === "buff"
                              ? "ally"
                              : "enemy"
                        }
                        sizes="(min-width: 1280px) 10vw, (min-width: 640px) 18vw, 30vw"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {Object.keys(impacts).length > 0 && (
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-chalk-500">
          {t("pages.patchNotes.changes.impactNote", { n: DAYS_IMPACT })}
        </p>
      )}
    </section>
  );
}

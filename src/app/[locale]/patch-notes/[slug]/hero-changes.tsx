import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { heroesBySlug } from "@/lib/data";
import { historyOf } from "@/lib/evolution";
import { groupAdjustments, ADJUSTMENT_DIRECTIONS, type AdjustmentDirection } from "@/lib/meta-report";
import { impactsOfPatch, DAYS_IMPACT, THRESHOLD_IMPACT, type ImpactAdjustment } from "@/lib/trends";
import type { DetailedPatch } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { cn } from "@/lib/utils";

const STYLE: Record<AdjustmentDirection, { color: string; border: string; icon: React.ReactNode }> = {
  buff: { color: "text-emerald-400", border: "border-emerald-500/30", icon: <TrendingUp size={16} aria-hidden /> },
  nerf: { color: "text-blood-500", border: "border-blood-500/30", icon: <TrendingDown size={16} aria-hidden /> },
  adjust: { color: "text-azure-400", border: "border-azure-500/30", icon: <Minus size={16} aria-hidden /> },
};

/** Number of distinct heroes affected by a patch. */
export function changedHeroCount(patch: Pick<DetailedPatch, "adjustments">): number {
  const groups = groupAdjustments(patch.adjustments);
  return ADJUSTMENT_DIRECTIONS.reduce((n, direction) => n + groups[direction].length, 0);
}

/**
 * All of a patch's hero changes, in three lists: buffed,
 * nerfed, adjusted. Rendered by the server, with a link to each hero page:
 * the detailed list further down only shows its own once expanded. When
 * the rate history covers the patch, each hero carries its average win
 * rate over the seven days before and after; otherwise, nothing.
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
    <section aria-labelledby="hero-changes" className="mt-10">
      <h2 id="hero-changes" className="scroll-mt-24 font-heading text-2xl font-bold text-chalk-100">
        {t("pages.patchNotes.changes.title", { v: patch.version })}
      </h2>
      <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
      <p className="mt-4 text-sm text-chalk-300">
        {t(`pages.patchNotes.changes.summary.${shape}`, { n, v: patch.version })}
        {anchorDetail && (
          <>
            {" "}
            <a href={`#${anchorDetail}`} className="font-semibold text-gold-400 hover:text-gold-500">
              {t("pages.patchNotes.changes.detail")} ↓
            </a>
          </>
        )}
      </p>

      <div className="mt-6 space-y-6">
        {ADJUSTMENT_DIRECTIONS.map((direction) =>
          groups[direction].length === 0 ? null : (
            <div key={direction}>
              <h3 className={cn("flex items-center gap-2 font-heading text-lg font-bold", STYLE[direction].color)}>
                {STYLE[direction].icon}
                {t(`patchHeroes.plural.${direction}`)}
                <span className="text-sm font-medium text-chalk-500">{groups[direction].length}</span>
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {groups[direction].map((a) => {
                  const sheet = heroesBySlug.get(a.slug);
                  const impact = impacts[a.slug];
                  const content = (
                    <>
                      <HeroPortrait
                        source={sheet?.images.icon ?? sheet?.images.portrait ?? null}
                        name={sheet?.name ?? a.name}
                        size="micro"
                        decorative
                      />
                      <span className="font-medium text-chalk-100">{sheet?.name ?? a.name}</span>
                      {impact && <Impact impact={impact} rate={rate} sr={t} />}
                    </>
                  );
                  const classes = cn(
                    "bevel-sm flex items-center gap-2 border bg-night-900/60 py-1 pl-1 pr-2.5 text-sm",
                    STYLE[direction].border,
                  );
                  return (
                    <li key={a.slug}>
                      {sheet ? (
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
          ),
        )}
      </div>

      {Object.keys(impacts).length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-chalk-500">
          {t("pages.patchNotes.changes.impactNote", { n: DAYS_IMPACT })}
        </p>
      )}
    </section>
  );
}

/** "51.2 % → 52.4 %": the color follows the direction of the gap, beyond the noise. */
function Impact({
  impact,
  rate,
  sr,
}: {
  impact: ImpactAdjustment;
  rate: (v: number) => string;
  sr: ReturnType<typeof createT>;
}) {
  const net = Math.abs(impact.gap) >= THRESHOLD_IMPACT - 1e-9;
  return (
    <span className="whitespace-nowrap text-xs tabular-nums">
      <span aria-hidden>
        <span className="text-chalk-500">{rate(impact.before)} → </span>
        <span
          className={cn(
            "font-semibold",
            !net ? "text-chalk-300" : impact.gap > 0 ? "text-emerald-400" : "text-blood-500",
          )}
        >
          {rate(impact.after)}
        </span>
      </span>
      <span className="sr-only">
        {sr("pages.patchNotes.changes.impact", { before: rate(impact.before), after: rate(impact.after) })}
      </span>
    </span>
  );
}

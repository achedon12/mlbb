import Image from "next/image";
import { LiquipediaPatchNote } from "@/components/patch-credit";
import Link from "@/components/link";
import { Face } from "@/components/home/face";
import { splitRow } from "@/components/home/patch-row";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { advanceDocumented } from "@/lib/advance-fresh";
import { advanceVersions, isUnderTest } from "@/lib/advance-server";
import { detailedPatches, heroesBySlug, illustrations } from "@/lib/data";
import { historyOf } from "@/lib/evolution";
import { longDate, patchCurrent } from "@/lib/freshness";
import { groupAdjustments, type AdjustmentDirection } from "@/lib/meta-report";
import { DAYS_IMPACT, formatGap, impactsOfPatch, THRESHOLD_IMPACT, type ImpactPatch } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** Plain adjustments named; the rest in the notes. */
const ADJUSTED = 8;

const COLOR: Record<AdjustmentDirection, string> = {
  buff: "text-azure-400",
  nerf: "text-blood-400",
  adjust: "text-chalk-300",
};

const ARROW: Record<AdjustmentDirection, string> = { buff: "↑", nerf: "↓", adjust: "" };

/**
 * What the live patch changed, as one editorial composition. On the left,
 * the version set very large, one sentence (how many heroes, and when) and
 * the links to the notes; a new hero is shown by its official artwork. On
 * the right, the heroes buffed and nerfed as rows of faces, each with the
 * gap between its average win rate the week before and the week after the
 * patch, when the history covers both, in the colour of its direction (ally
 * blue up, enemy red down, grey when too small to count). The plain
 * adjustments follow as a line of names.
 *
 * The patch notes say what was announced; this says what came of it.
 */
export function HomePatch({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const patch = detailedPatches(locale)[patchCurrent.version] ?? patchCurrent;
  const groups = groupAdjustments(patch.adjustments);
  const impacts = impactsOfPatch(patch, historyOf);
  const changed = groups.buff.length + groups.nerf.length + groups.adjust.length;
  const testing = advanceVersions(locale).find((v) => isUnderTest(v.version, patch.version));
  const hasImpacts = Object.keys(impacts).length > 0;
  const [buffs, nerfs] = splitRow(groups.buff.length, groups.nerf.length);
  const notes = `/patch-notes/${patch.version}`;
  const newHero = patch.newHeroes[0];
  const newHeroArt = newHero
    ? (Object.values(illustrations[newHero.slug] ?? {})[0] ?? heroesBySlug.get(newHero.slug)?.images.portrait ?? null)
    : null;
  const link = "inline-flex min-h-11 items-center font-semibold text-gold-400 underline decoration-1 underline-offset-4 hover:text-gold-300";

  return (
    <section aria-labelledby="home-patch" data-home-patch className={className}>
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0">
          <h2 id="home-patch" className="text-chalk-100">
            <span className="block font-heading text-2xl font-bold uppercase text-chalk-300">{t("home.patch.word")}</span>
            <span className="display-caps mt-1 block pr-[0.1em] text-[clamp(5.5rem,2rem+12vw,12rem)] leading-[0.78]">
              {patch.version}
            </span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-snug text-chalk-200 sm:text-xl">
            {patch.date
              ? t("home.patch.lead", { n: changed, date: longDate(locale, patch.date) })
              : t("home.patch.leadUndated", { n: changed })}
          </p>
          <p className="mt-4 flex flex-wrap gap-x-6">
            <Link href={notes} className={link}>
              {t("home.readNotes")}
            </Link>
            <Link href="/meta" className={link}>
              {t("home.patch.metaReport")}
            </Link>
            {(testing || advanceDocumented()) && (
              <Link
                href={testing ? `/patch-notes/advance-server/${testing.version}` : "/patch-notes/advance-server"}
                className={link}
              >
                {testing ? t("home.patch.testing", { version: testing.version }) : t("nav.advanceServer.label")}
              </Link>
            )}
          </p>

          {newHero && (
            <Link href={heroesBySlug.has(newHero.slug) ? `/heroes/${newHero.slug}` : notes} className="group mt-10 block">
              {newHeroArt && (
                <span className="relative block aspect-video overflow-hidden">
                  <Image
                    src={newHeroArt}
                    alt=""
                    fill
                    sizes="(min-width: 1600px) 36rem, (min-width: 1024px) 38vw, 100vw"
                    className="object-cover object-[50%_25%] transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </span>
              )}
              <span className="mt-3 block font-heading text-xl font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
                {t("home.patch.newHero", { name: newHero.name })}
              </span>
            </Link>
          )}
        </div>

        <div className="min-w-0 space-y-10 lg:pt-4">
          {(
            [
              ["buff", buffs],
              ["nerf", nerfs],
            ] as const
          )
            .filter(([, n]) => n > 0)
            .map(([direction, shown]) => (
              <div key={direction}>
                <Heading direction={direction} total={groups[direction].length} shown={shown} notes={notes} t={t} />
                <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-4 gap-y-6">
                  {groups[direction].slice(0, shown).map((a) => {
                    const h = heroesBySlug.get(a.slug);
                    const impact = impacts[a.slug];
                    return (
                      <li key={a.slug} className="min-w-0">
                        <Link href={h ? `/heroes/${a.slug}` : notes} className="group flex flex-col items-start">
                          <Face
                            source={h?.images.icon ?? h?.images.portrait}
                            name={h?.name ?? a.name}
                            size="lg"
                            className="transition-transform duration-200 group-hover:-translate-y-0.5"
                          />
                          <span className="mt-2 block max-w-full truncate font-heading text-base font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
                            {h?.name ?? a.name}
                          </span>
                          <Gap impact={impact} locale={locale} t={t} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

          {groups.adjust.length > 0 && (
            <div>
              <Heading
                direction="adjust"
                total={groups.adjust.length}
                shown={Math.min(groups.adjust.length, ADJUSTED)}
                notes={notes}
                t={t}
              />
              <ul className="mt-2 flex flex-wrap gap-x-5">
                {groups.adjust.slice(0, ADJUSTED).map((a) => {
                  const h = heroesBySlug.get(a.slug);
                  return (
                    <li key={a.slug}>
                      <Link
                        href={h ? `/heroes/${a.slug}` : notes}
                        className="inline-flex min-h-11 items-center font-heading text-lg font-bold uppercase text-chalk-200 transition-colors hover:text-gold-300"
                      >
                        {h?.name ?? a.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="max-w-2xl space-y-1 text-xs leading-relaxed text-chalk-500">
            {hasImpacts && <p>{t("home.patch.impactNote", { n: DAYS_IMPACT })}</p>}
            <LiquipediaPatchNote t={t} patches={[patch]} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Heading({
  direction,
  total,
  shown,
  notes,
  t,
}: {
  direction: AdjustmentDirection;
  total: number;
  shown: number;
  notes: string;
  t: T;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-night-800 pb-2">
      <h3 className={cn("font-heading text-xl font-bold uppercase", COLOR[direction])}>
        {ARROW[direction] && <span aria-hidden>{ARROW[direction]} </span>}
        {t(`patchHeroes.plural.${direction}`)} <span className="text-chalk-500">{total}</span>
      </h3>
      {total > shown && (
        <Link href={notes} className="ml-auto text-sm font-semibold text-gold-400 hover:text-gold-300">
          {t("home.patch.more", { n: total - shown })}
        </Link>
      )}
    </div>
  );
}

/** A hero's win-rate gap since the patch, in the colour of its sign; grey when too small to count. */
function Gap({ impact, locale, t }: { impact: ImpactPatch | undefined; locale: Locale; t: T }) {
  if (!impact) return <span aria-hidden className="text-sm text-chalk-600">–</span>;
  const net = Math.abs(impact.gap) >= THRESHOLD_IMPACT - 1e-9;
  return (
    <span
      className={cn(
        "text-sm font-semibold tabular-nums",
        !net ? "text-chalk-500" : impact.gap > 0 ? "text-azure-400" : "text-blood-400",
      )}
    >
      <span aria-hidden>
        {formatGap(impact.gap, locale)} {t("counters.pts")}
      </span>
      <span className="sr-only">{t("home.patch.impact", { gap: formatGap(impact.gap, locale) })}</span>
    </span>
  );
}

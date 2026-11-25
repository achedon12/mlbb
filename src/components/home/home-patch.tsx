import Image from "next/image";
import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { detailedPatches, heroesBySlug, illustrations } from "@/lib/data";
import { historyOf } from "@/lib/evolution";
import { longDate, patchCurrent } from "@/lib/freshness";
import { groupAdjustments } from "@/lib/meta-report";
import { formatGap, impactsOfPatch, THRESHOLD_IMPACT } from "@/lib/trends";
import { cn } from "@/lib/utils";

const firstArt = (slug: string) => Object.values(illustrations[slug] ?? {})[0] ?? null;

/**
 * The live patch in one screen: one hero's artwork across most of the
 * screen and, beside it, the version set very large, one sentence and the
 * notes. The hero is the patch's new one when it brings one, the hero whose
 * win rate moved most since the patch otherwise (the gap between the week
 * before and the week after, when the history covers both), so the art
 * says what the patch did. The full list of changes lives in the notes.
 */
export function HomePatch({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const patch = detailedPatches(locale)[patchCurrent.version] ?? patchCurrent;
  const groups = groupAdjustments(patch.adjustments);
  const changed = groups.buff.length + groups.nerf.length + groups.adjust.length;
  const impacts = impactsOfPatch(patch, historyOf);
  const notes = `/patch-notes/${patch.version}`;

  // The biggest measured move, among the heroes with an artwork.
  const mover = Object.entries(impacts)
    .filter(([slug, i]) => firstArt(slug) && Math.abs(i.gap) >= THRESHOLD_IMPACT - 1e-9)
    .sort((a, b) => Math.abs(b[1].gap) - Math.abs(a[1].gap) || a[0].localeCompare(b[0]))[0];
  const newHero = patch.newHeroes.find((n) => firstArt(n.slug));
  const fallback = [...groups.buff, ...groups.nerf].find((a) => firstArt(a.slug));
  const featured = newHero?.slug ?? mover?.[0] ?? fallback?.slug ?? null;
  const art = featured ? firstArt(featured) : null;
  const moverHero = mover ? heroesBySlug.get(mover[0]) : null;

  return (
    <section aria-labelledby="home-patch" data-home-patch className={cn("scheme-dark relative isolate overflow-hidden bg-night-950", className)}>
      {art && featured && (
        <div
          aria-hidden
          className="scheme-dark group relative block aspect-[16/10] overflow-hidden lg:absolute lg:inset-y-0 lg:left-0 lg:aspect-auto lg:w-[62%]"
        >
          <Image
            src={art}
            alt=""
            fill
            sizes="(min-width: 1024px) 62vw, 100vw"
            className="object-cover object-[50%_25%]"
          />
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-night-950 to-transparent lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-1/2 lg:bg-linear-to-l" />
        </div>
      )}

      <div className="page-wrap relative flex py-14 sm:py-20 lg:min-h-[clamp(36rem,88svh,52rem)] lg:items-center lg:justify-end lg:py-24">
        <div className="lg:w-[34%] lg:pl-4">
          <h2 id="home-patch" className="text-chalk-100">
            <span className="block font-heading text-2xl font-bold uppercase text-gold-400">{t("home.patch.word")}</span>
            <span className="display-caps mt-1 block pr-[0.1em] text-[clamp(5rem,2rem+9vw,10.5rem)] leading-[0.8]">{patch.version}</span>
          </h2>
          <p className="mt-6 max-w-sm text-lg leading-snug text-chalk-200 sm:text-xl">
            {patch.date
              ? t("home.patch.headline", { n: changed, date: longDate(locale, patch.date) })
              : t("home.patch.leadUndated", { n: changed })}
          </p>
          {newHero && (
            <p className="mt-3 font-heading text-xl font-bold uppercase text-chalk-100">{t("home.patch.newHero", { name: newHero.name })}</p>
          )}
          {mover && moverHero && (
            <p className="mt-3 text-chalk-300">
              {t("home.patch.mover", { hero: moverHero.name })}{" "}
              <span className={cn("font-semibold tabular-nums", mover[1].gap > 0 ? "text-azure-400" : "text-blood-400")}>
                {formatGap(mover[1].gap, locale)} {t("counters.pts")}
              </span>
            </p>
          )}
          <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={notes} className="btn btn-primary px-7">
              {t("home.readNotes")}
            </Link>
            <Link href="/meta" className="inline-flex min-h-11 items-center font-semibold text-chalk-100 underline decoration-1 underline-offset-4 hover:text-gold-300">
              {t("home.patch.metaReport")}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import Link from "@/components/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import type { NewHero } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Enrichment resolved on the server: visuals and whether a hero page exists. */
export interface EnrichedNewHero extends NewHero {
  portrait: string | null;
  illustration: string | null;
  roles: string[];
  sheet: boolean;
}

/**
 * Showcase of a hero introduced by the patch.
 *
 * The most striking part of an update deserves better than a wall of text:
 * a banner with the hero's artwork, then their skills as cards — role, name,
 * effects — to grasp the kit at a glance.
 */
export function NewHero({ hero: heroes, locale }: { hero: EnrichedNewHero; locale: Locale }) {
  const t = createT(locale);
  return (
    <div>
      {/* Banner: artwork in the background, identity on top. */}
      <div
        id={heroes.anchor ?? undefined}
        className="scheme-dark bevel-lg group relative flex min-h-[20rem] scroll-mt-24 items-end overflow-hidden bg-night-900 sm:min-h-[26rem]"
      >
        {heroes.illustration && (
          <Image
            src={heroes.illustration}
            alt=""
            fill
            sizes="(min-width: 1024px) 48rem, 100vw"
            className="object-cover object-[50%_25%] transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-r from-night-950/90 via-night-950/40 to-transparent" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-night-950 via-night-950/60 to-transparent"
        />

        <div className="relative flex items-end gap-4 p-5 sm:gap-6 sm:p-8">
          {heroes.portrait && (
            <span className="bevel relative h-28 w-20 shrink-0 overflow-hidden bg-night-800 sm:h-36 sm:w-24">
              <Image src={heroes.portrait} alt={heroes.name} fill sizes="96px" className="object-cover object-top" />
            </span>
          )}

          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400">
              <Sparkles size={13} aria-hidden />
              {t("newHero.title")}
            </p>
            {heroes.epithet && (
              <p className="mt-1 font-heading text-lg text-chalk-200">{heroes.epithet}</p>
            )}
            <h3 className="display-caps mt-1 text-[clamp(3rem,2rem+4vw,5.5rem)] text-chalk-100">
              {heroes.name}
            </h3>
            {heroes.roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {heroes.roles.map((role) => (
                  <span
                    key={role}
                    className="bevel-sm bg-night-800/90 px-2 py-0.5 font-heading text-sm font-bold uppercase text-chalk-200"
                  >
                    {t(`roles.${role}`)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Story and distinctive trait. */}
      {(heroes.lore.length > 0 || heroes.feature) && (
        <div className="mt-4 space-y-3">
          {heroes.lore.map((row, i) => (
            <p key={i} className="text-sm leading-relaxed text-chalk-300">
              {row}
            </p>
          ))}
          {heroes.feature && (
            <p className="bevel-sm bg-night-900 px-4 py-3 text-sm leading-relaxed text-chalk-200 shadow-[inset_3px_0_0_var(--color-gold-400)]">
              <span className="font-semibold text-gold-400">{t("newHero.highlight")}</span>
              {heroes.feature}
            </p>
          )}
        </div>
      )}

      {/* Kit: one card per skill. */}
      {heroes.skills.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {heroes.skills.map((c, i) => {
            // The role may be translated; the "+" of combined skills
            // ("1st + 2nd Combo Skill") survives translation.
            const combo = /combo|\+/i.test(c.role);
            return (
              <div
                key={i}
                className={cn(
                  "bevel bg-night-900 p-4",
                  combo && "shadow-[inset_3px_0_0_var(--color-blood-400)]",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "bevel-sm px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                      combo
                        ? "bg-blood-400/15 text-blood-400"
                        : "bg-gold-500/15 text-gold-400",
                    )}
                  >
                    {c.role}
                  </span>
                  {c.name && (
                    <span className="font-heading text-sm font-bold text-chalk-100">{c.name}</span>
                  )}
                </div>
                {c.description.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {c.description.map((d, j) => (
                      <li key={j} className="text-sm leading-relaxed text-chalk-300">
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {heroes.sheet && (
        <Link
          href={`/heroes/${heroes.slug}`}
          className="btn btn-primary btn-sm mt-5"
        >
          {t("newHero.seeSheet", { name: heroes.name })}
          <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

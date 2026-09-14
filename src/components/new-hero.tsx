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
        className="bevel relative scroll-mt-24 overflow-hidden border border-night-800"
      >
        {heroes.illustration && (
          <Image
            src={heroes.illustration}
            alt=""
            fill
            sizes="(min-width: 1024px) 48rem, 100vw"
            className="object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-r from-night-950 via-night-950/85 to-night-950/30" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-night-950 to-transparent"
        />

        <div className="relative flex items-center gap-4 p-5 sm:p-6">
          {heroes.portrait && (
            <span className="bevel-sm relative size-16 shrink-0 overflow-hidden border border-gold-500/40 sm:size-20">
              <Image src={heroes.portrait} alt={heroes.name} fill sizes="80px" className="object-cover" />
            </span>
          )}

          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold-400">
              <Sparkles size={13} aria-hidden />
              {t("newHero.title")}
            </p>
            {heroes.epithet && (
              <p className="mt-1 font-heading text-sm text-chalk-300">{heroes.epithet}</p>
            )}
            <h3 className="font-heading text-3xl font-bold text-chalk-100 sm:text-4xl">
              {heroes.name}
            </h3>
            {heroes.roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {heroes.roles.map((role) => (
                  <span
                    key={role}
                    className="bevel-sm border border-night-700 bg-night-900/70 px-2 py-0.5 text-xs font-medium text-chalk-300"
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
            <p className="bevel-sm border-l-2 border-gold-500 bg-night-900/60 px-4 py-3 text-sm leading-relaxed text-chalk-200">
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
                  "bevel-sm border bg-night-900/50 p-4",
                  combo ? "border-blood-500/25" : "border-night-700/70",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "bevel-sm px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                      combo
                        ? "bg-blood-500/15 text-blood-500"
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
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-500"
        >
          {t("newHero.seeSheet", { name: heroes.name })}
          <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

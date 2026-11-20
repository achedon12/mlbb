import { ArrowRight, Gift } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { currentFreeRotation, PATH_FREE_ROTATION } from "@/lib/free-rotation-server";
import { heroesBySlug } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Portraits shown in the strip; the rest is a count. */
const SHOWN = 6;

/**
 * One slim row pointing to the week's free heroes. It renders nothing when
 * the list is missing or stale: a teaser for an empty page would be a dead
 * end, and the page itself already says why it is empty.
 */
export function FreeRotationTeaser({ locale, className }: { locale: Locale; className?: string }) {
  const rotation = currentFreeRotation();
  if (rotation.state !== "current") return null;
  const t = createT(locale);
  const heroes = rotation.heroes.flatMap((slug) => heroesBySlug.get(slug) ?? []);
  const rest = heroes.length - SHOWN;

  return (
    <Link
      href={PATH_FREE_ROTATION}
      className={cn("card-link eclat-under group flex items-center gap-3 p-2.5 pr-4", className)}
    >
      <Gift size={18} aria-hidden className="ml-1 shrink-0 text-gold-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-base font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
          {t("pages.freeRotation.teaser", { n: heroes.length })}
        </span>
        <span className="mt-1.5 flex items-center gap-1" aria-hidden>
          {heroes.slice(0, SHOWN).map((h) => (
            <HeroPortrait key={h.slug} source={h.images.icon ?? h.images.portrait} name={h.name} size="small" decorative />
          ))}
          {rest > 0 && <span className="pl-1 font-heading text-sm font-bold text-gold-400">+{rest}</span>}
        </span>
      </span>
      <ArrowRight size={16} aria-hidden className="shrink-0 text-gold-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

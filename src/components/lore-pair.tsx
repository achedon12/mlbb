import { ArrowLeftRight } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import type { T } from "@/i18n/t";
import { heroesBySlug } from "@/lib/data";
import type { LinkLore, LorePair } from "@/lib/lore";

/**
 * Deux heros lies par leurs fiches : ce que chacune dit de l'autre, mot pour
 * mot (« frere cadet », « rivale »). Un cote reste muet quand sa fiche ne
 * nomme pas l'autre heros. `regions` : libelle de la region de chacun, pour
 * les liens qui sortent d'une region.
 */
export function LorePairCard({
  pair,
  t,
  regions,
}: {
  pair: LorePair;
  t: T;
  regions?: [string | null, string | null];
}) {
  const a = heroesBySlug.get(pair.a);
  const b = heroesBySlug.get(pair.b);
  if (!a || !b) return null;

  const side = (h: typeof a, link: LinkLore | null, other: typeof a) =>
    link && (
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-chalk-500">
          {h.name} <span aria-hidden>→</span>
          <span className="sr-only"> {t("pages.lore.about")} </span> {other.name}
          <span aria-hidden> ·</span>
        </dt>
        <dd className="text-chalk-200">{link.nature ?? t("pages.lore.noNature")}</dd>
      </div>
    );

  const heroes = (h: typeof a, region: string | null | undefined) => (
    <Link href={`/heroes/${h.slug}#histoire`} className="flex min-w-0 items-center gap-2 hover:text-gold-400">
      <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="icon" decorative />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-chalk-100">{h.name}</span>
        {region && <span className="block truncate text-xs text-chalk-500">{region}</span>}
      </span>
    </Link>
  );

  return (
    <div className="bevel-sm h-full border border-night-700/60 bg-night-900/50 p-4">
      <div className="flex items-center gap-3">
        {heroes(a, regions?.[0])}
        <ArrowLeftRight size={16} aria-hidden className="shrink-0 text-gold-400" />
        {heroes(b, regions?.[1])}
      </div>
      <dl className="mt-3 space-y-1 text-sm leading-relaxed">
        {side(a, pair.deA, b)}
        {side(b, pair.deB, a)}
      </dl>
    </div>
  );
}

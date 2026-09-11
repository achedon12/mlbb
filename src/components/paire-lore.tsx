import { ArrowLeftRight } from "lucide-react";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import type { T } from "@/i18n/t";
import { herosParSlug } from "@/lib/donnees";
import type { LienLore, PaireLore } from "@/lib/lore";

/**
 * Deux heros lies par leurs fiches : ce que chacune dit de l'autre, mot pour
 * mot (« frere cadet », « rivale »). Un cote reste muet quand sa fiche ne
 * nomme pas l'autre heros. `regions` : libelle de la region de chacun, pour
 * les liens qui sortent d'une region.
 */
export function PaireLoreCarte({
  paire,
  t,
  regions,
}: {
  paire: PaireLore;
  t: T;
  regions?: [string | null, string | null];
}) {
  const a = herosParSlug.get(paire.a);
  const b = herosParSlug.get(paire.b);
  if (!a || !b) return null;

  const cote = (h: typeof a, lien: LienLore | null, autre: typeof a) =>
    lien && (
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-craie-500">
          {h.nom} <span aria-hidden>→</span>
          <span className="sr-only"> {t("pages.lore.envers")} </span> {autre.nom}
          <span aria-hidden> ·</span>
        </dt>
        <dd className="text-craie-200">{lien.nature ?? t("pages.lore.sansNature")}</dd>
      </div>
    );

  const heros = (h: typeof a, region: string | null | undefined) => (
    <Link href={`/heroes/${h.slug}#histoire`} className="flex min-w-0 items-center gap-2 hover:text-or-400">
      <PortraitHeros source={h.visuels.icone ?? h.visuels.portrait} nom={h.nom} taille="icone" decoratif />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-craie-100">{h.nom}</span>
        {region && <span className="block truncate text-xs text-craie-500">{region}</span>}
      </span>
    </Link>
  );

  return (
    <div className="biseau-sm h-full border border-nuit-700/60 bg-nuit-900/50 p-4">
      <div className="flex items-center gap-3">
        {heros(a, regions?.[0])}
        <ArrowLeftRight size={16} aria-hidden className="shrink-0 text-or-400" />
        {heros(b, regions?.[1])}
      </div>
      <dl className="mt-3 space-y-1 text-sm leading-relaxed">
        {cote(a, paire.deA, b)}
        {cote(b, paire.deB, a)}
      </dl>
    </div>
  );
}

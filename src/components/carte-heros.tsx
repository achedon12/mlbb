import Link from "next/link";
import type { EntreeRoster } from "@/data/roster";
import { detailParSlug } from "@/data/heros";
import { BadgeRole, Difficulte } from "./ui";

/** Vignette d'un heros dans la liste et dans les blocs de suggestion. */
export function CarteHeros({ heros }: { heros: EntreeRoster }) {
  const detaille = detailParSlug.has(heros.slug);

  return (
    <Link
      href={`/heros/${heros.slug}`}
      className="biseau group flex flex-col border border-nuit-700/70 bg-nuit-900/60 p-4 transition-colors hover:border-or-500/60 hover:bg-nuit-850"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-titre text-lg font-bold text-craie-100 transition-colors group-hover:text-or-400">
          {heros.nom}
        </h3>
        {detaille && (
          <span
            className="mt-1 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-or-500"
            title="Fiche complete disponible"
          >
            Fiche
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {heros.roles.map((r) => (
          <BadgeRole key={r} role={r} />
        ))}
      </div>

      <p className="mt-3 text-xs text-craie-500">{heros.lanes.join(" · ")}</p>

      <div className="mt-4 flex items-center justify-between border-t border-nuit-800 pt-3">
        <Difficulte valeur={heros.difficulte} />
        <span className="text-xs text-craie-500">{heros.sortie}</span>
      </div>
    </Link>
  );
}

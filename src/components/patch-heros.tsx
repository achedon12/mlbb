"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { AjustementHeros, TypeAjustement } from "@/lib/types";

/** Ajustement enrichi cote serveur : portrait et existence de fiche resolus. */
export interface AjustementEnrichi extends AjustementHeros {
  portrait: string | null;
  fiche: boolean;
}
import { cn } from "@/lib/utils";

/**
 * Ajustements de heros d'un patch.
 *
 * Le wikitexte des notes suit une grammaire reguliere : chaque heros a un type
 * — amelioration, affaiblissement, ajustement — et, quand le wiki les detaille,
 * des changements « avant → apres ». On les montre en liste : portrait, badge
 * de type, et le detail deplie a la demande. Un mur de texte devient une liste
 * ou l'on trouve son heros d'un coup d'oeil.
 */
const STYLE: Record<
  TypeAjustement,
  { libelle: string; couleur: string; fond: string; icone: React.ReactNode }
> = {
  amelioration: {
    libelle: "Amelioration",
    couleur: "text-emerald-400",
    fond: "border-emerald-500/30",
    icone: <TrendingUp size={14} aria-hidden />,
  },
  affaiblissement: {
    libelle: "Affaiblissement",
    couleur: "text-sang-500",
    fond: "border-sang-500/30",
    icone: <TrendingDown size={14} aria-hidden />,
  },
  ajustement: {
    libelle: "Ajustement",
    couleur: "text-azur-400",
    fond: "border-azur-500/30",
    icone: <Minus size={14} aria-hidden />,
  },
};

export function PatchHeros({
  ajustements,
  bilan,
}: {
  ajustements: AjustementEnrichi[];
  bilan: Record<TypeAjustement, number>;
}) {
  const [filtre, setFiltre] = useState<TypeAjustement | null>(null);

  const visibles = filtre ? ajustements.filter((a) => a.type === filtre) : ajustements;

  return (
    <div>
      {/* Bilan : trois compteurs qui filtrent la liste. */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STYLE) as TypeAjustement[]).map((type) => {
          const actif = filtre === type;
          const s = STYLE[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => setFiltre(actif ? null : type)}
              aria-pressed={actif}
              className={cn(
                "biseau-sm flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors",
                actif ? `${s.fond} bg-nuit-850` : "border-nuit-700 hover:border-nuit-600",
              )}
            >
              <span className={s.couleur}>{s.icone}</span>
              <span className="font-semibold text-craie-100">{bilan[type] ?? 0}</span>
              <span className="text-craie-500">{s.libelle}s</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-5 space-y-2">
        {visibles.map((a) => (
          <LigneHeros key={a.slug + a.nom} ajustement={a} portrait={a.portrait} fiche={a.fiche} />
        ))}
      </ul>
    </div>
  );
}

function LigneHeros({
  ajustement,
  portrait,
  fiche,
}: {
  ajustement: AjustementHeros;
  portrait: string | null;
  fiche: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const s = ajustement.type ? STYLE[ajustement.type] : null;
  const detaille = ajustement.sections.length > 0 || ajustement.intro.length > 0;

  return (
    <li className={cn("biseau border bg-nuit-900/60", s?.fond ?? "border-nuit-700/70")}>
      <button
        type="button"
        onClick={() => detaille && setOuvert((o) => !o)}
        aria-expanded={detaille ? ouvert : undefined}
        className={cn(
          "flex w-full items-center gap-3 p-3 text-left",
          detaille ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span className="biseau-sm relative flex size-11 shrink-0 items-center justify-center overflow-hidden bg-nuit-800">
          {portrait ? (
            <Image src={portrait} alt="" fill sizes="44px" className="object-cover" />
          ) : (
            <span className="font-titre text-lg font-bold text-craie-500">
              {ajustement.nom.charAt(0)}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="font-titre font-bold text-craie-100">{ajustement.nom}</span>
          {s && (
            <span className={cn("mt-0.5 flex items-center gap-1 text-xs font-semibold", s.couleur)}>
              {s.icone}
              {s.libelle}
            </span>
          )}
        </span>

        {detaille ? (
          <ChevronDown
            size={18}
            aria-hidden
            className={cn("shrink-0 text-craie-500 transition-transform", ouvert && "rotate-180")}
          />
        ) : (
          <span className="shrink-0 text-xs text-craie-500">details a venir</span>
        )}
      </button>

      {ouvert && detaille && (
        <div className="border-t border-nuit-800 p-4">
          {ajustement.intro && (
            <p className="mb-4 text-sm leading-relaxed text-craie-300">{ajustement.intro}</p>
          )}

          <div className="space-y-4">
            {ajustement.sections.map((section, i) => (
              <div key={i}>
                <h4 className="flex flex-wrap items-baseline gap-2 font-titre text-sm font-bold text-or-400">
                  {section.nom}
                  {section.categorie && (
                    <span className="text-xs font-medium text-craie-500">{section.categorie}</span>
                  )}
                </h4>
                <ul className="mt-2 space-y-1">
                  {section.changements.map((c, j) => (
                    <li key={j} className="text-sm">
                      {"apres" in c ? (
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {c.libelle && <span className="text-craie-500">{c.libelle} :</span>}
                          <span className="text-craie-500 line-through decoration-sang-500/50">
                            {c.avant}
                          </span>
                          <ArrowRight size={12} aria-hidden className="text-craie-500" />
                          <span className="font-medium text-craie-100">{c.apres}</span>
                        </div>
                      ) : (
                        <span className="text-craie-300">{c.texte}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {fiche && (
            <Link
              href={`/heros/${ajustement.slug}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-or-400 hover:text-or-500"
            >
              Voir la fiche de {ajustement.nom}
              <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

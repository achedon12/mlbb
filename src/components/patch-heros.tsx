"use client";

import { useState } from "react";
import { PortraitHeros } from "@/components/portrait-heros";
import Link from "@/components/lien";
import { ArrowRight, ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { AjustementHeros, TypeAjustement } from "@/lib/types";
import { useT } from "@/i18n/fournisseur";

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
  { couleur: string; fond: string; icone: React.ReactNode }
> = {
  amelioration: {
    couleur: "text-emerald-400",
    fond: "border-emerald-500/30",
    icone: <TrendingUp size={14} aria-hidden />,
  },
  affaiblissement: {
    couleur: "text-blood-500",
    fond: "border-blood-500/30",
    icone: <TrendingDown size={14} aria-hidden />,
  },
  ajustement: {
    couleur: "text-azure-400",
    fond: "border-azure-500/30",
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
  const t = useT();
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
                "bevel-sm flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors",
                actif ? `${s.fond} bg-night-850` : "border-night-700 hover:border-night-600",
              )}
            >
              <span className={s.couleur}>{s.icone}</span>
              <span className="font-semibold text-chalk-100">{bilan[type] ?? 0}</span>
              <span className="text-chalk-500">{t(`patchHeros.pluriel.${type}`)}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-5 space-y-2">
        {visibles.map((a) => (
          <LigneHeros key={a.slug + a.name} ajustement={a} portrait={a.portrait} fiche={a.fiche} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Ajustements d'un heros au fil des patchs, du plus recent au plus ancien :
 * la meme ligne que dans les notes de patch, titree par la version.
 */
export function AjustementsDuHeros({
  entrees,
  portrait,
}: {
  entrees: { version: string; ajustement: AjustementHeros }[];
  portrait: string | null;
}) {
  const t = useT();
  return (
    <ul className="space-y-2">
      {entrees.map((e) => (
        <LigneHeros
          key={e.version}
          ajustement={e.ajustement}
          portrait={portrait}
          titre={`Patch ${e.version}`}
          lien={{ href: `/patch-notes/${e.version}`, libelle: t("patchHeros.voirPatch", { version: e.version }) }}
        />
      ))}
    </ul>
  );
}

function LigneHeros({
  ajustement,
  portrait,
  fiche = false,
  titre,
  lien,
}: {
  ajustement: AjustementHeros;
  portrait: string | null;
  fiche?: boolean;
  /** Remplace le nom du heros, quand la liste est celle d'un seul heros. */
  titre?: string;
  lien?: { href: string; libelle: string };
}) {
  const t = useT();
  const cible =
    lien ?? (fiche ? { href: `/heroes/${ajustement.slug}`, libelle: t("patchHeros.voirFiche", { nom: ajustement.name }) } : null);
  const [ouvert, setOuvert] = useState(false);
  const s = ajustement.type ? STYLE[ajustement.type] : null;
  const detaille = ajustement.sections.length > 0 || ajustement.intro.length > 0;

  return (
    <li className={cn("bevel border bg-night-900/60", s?.fond ?? "border-night-700/70")}>
      <button
        type="button"
        onClick={() => detaille && setOuvert((o) => !o)}
        aria-expanded={detaille ? ouvert : undefined}
        className={cn(
          "flex w-full items-center gap-3 p-3 text-left",
          detaille ? "cursor-pointer" : "cursor-default",
        )}
      >
        <PortraitHeros source={portrait} nom={ajustement.name} taille="moyenne" decoratif />

        <span className="min-w-0 flex-1">
          <span className="font-heading font-bold text-chalk-100">{titre ?? ajustement.name}</span>
          {s && (
            <span className={cn("mt-0.5 flex items-center gap-1 text-xs font-semibold", s.couleur)}>
              {s.icone}
              {t(`patchHeros.${ajustement.type}`)}
            </span>
          )}
        </span>

        {detaille ? (
          <ChevronDown
            size={18}
            aria-hidden
            className={cn("shrink-0 text-chalk-500 transition-transform", ouvert && "rotate-180")}
          />
        ) : (
          <span className="shrink-0 text-xs text-chalk-500">{t("patchHeros.detailsAVenir")}</span>
        )}
      </button>

      {ouvert && detaille && (
        <div className="border-t border-night-800 p-4">
          {ajustement.intro && (
            <p className="mb-4 text-sm leading-relaxed text-chalk-300">{ajustement.intro}</p>
          )}

          <div className="space-y-4">
            {ajustement.sections.map((section, i) => (
              <div key={i}>
                <h4 className="flex flex-wrap items-baseline gap-2 font-heading text-sm font-bold text-gold-400">
                  {section.name}
                  {section.category && (
                    <span className="text-xs font-medium text-chalk-500">{section.category}</span>
                  )}
                </h4>
                <ul className="mt-2 space-y-1">
                  {section.changes.map((c, j) => (
                    <li key={j} className="text-sm">
                      {"after" in c ? (
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {c.label && (
                            <span className="text-chalk-500">{t("patchHeros.libelle", { libelle: c.label })}</span>
                          )}
                          <span className="text-chalk-500 line-through decoration-blood-500/50">
                            {c.before}
                          </span>
                          <ArrowRight size={12} aria-hidden className="text-chalk-500" />
                          <span className="font-medium text-chalk-100">{c.after}</span>
                        </div>
                      ) : (
                        <span className="text-chalk-300">{c.text}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {cible && (
            <Link
              href={cible.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-500"
            >
              {cible.libelle}
              <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

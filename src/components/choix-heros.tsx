"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ChampRecherche } from "@/components/champ-recherche";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { GroupeFiltres, Puce } from "@/components/puce";
import { useT } from "@/i18n/fournisseur";
import { LANES, ROLES, type Suggestion } from "@/lib/draft";
import type { Lane, Role } from "@/lib/types";
import { cleRecherche, cn } from "@/lib/utils";

/**
 * Pieces communes a l'aide au draft et a l'analyse d'equipe : la vignette d'un
 * heros, la fenetre de choix dans le roster et la carte d'une suggestion.
 */

/** Ce qu'il faut d'un heros pour le montrer et le filtrer. */
export interface HerosChoisissable {
  slug: string;
  nom: string;
  lanes: Lane[];
  roles: Role[];
  icone: string | null;
}

export function VignetteHeros({
  heros,
  petite = false,
}: {
  heros: Pick<HerosChoisissable, "nom" | "icone">;
  petite?: boolean;
}) {
  return <PortraitHeros source={heros.icone} nom={heros.nom} taille={petite ? "mini" : "icone"} decoratif />;
}

/**
 * Choix d'un heros dans le roster.
 *
 * Tout le roster est proposable. La liste s'ouvre sur les heros de la lane
 * demandee (ou sur tous), « Toutes » l'elargit aux 133, et le filtre de role
 * la resserre. Taper un nom cherche dans tout le roster : la lane se relache
 * d'elle-meme.
 */
export function SelecteurHeros({
  heros,
  exclus,
  lane,
  titre,
  onChoisir,
  onFermer,
}: {
  heros: HerosChoisissable[];
  exclus: Set<string>;
  /** Lane sur laquelle la liste s'ouvre ; null pour tout le roster. */
  lane: Lane | null;
  /** Nom de la fenetre pour les lecteurs d'ecran. */
  titre: string;
  onChoisir: (slug: string) => void;
  onFermer: () => void;
}) {
  const t = useT();
  const [recherche, setRecherche] = useState("");
  const [laneFiltre, setLaneFiltre] = useState<Lane | null>(lane);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFermer]);

  const resultats = useMemo(() => {
    const terme = cleRecherche(recherche.trim());
    return heros
      .filter((h) => !exclus.has(h.slug))
      .filter((h) => !laneFiltre || h.lanes.includes(laneFiltre))
      .filter((h) => !role || h.roles.includes(role))
      .filter((h) => !terme || cleRecherche(h.nom).includes(terme))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [heros, exclus, laneFiltre, role, recherche]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 p-4"
      onClick={onFermer}
    >
      <div
        className="bevel flex max-h-[85vh] w-full max-w-3xl flex-col border border-night-700 bg-night-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <ChampRecherche
            dense
            autoFocus
            valeur={recherche}
            onChange={(valeur) => {
              setRecherche(valeur);
              if (valeur.trim()) setLaneFiltre(null);
            }}
            libelle={t("draftUI.rechercher")}
            className="flex-1"
          />
          <button
            type="button"
            onClick={onFermer}
            aria-label={t("draftUI.fermer")}
            className="grid size-9 place-items-center text-chalk-500 hover:text-chalk-100"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <GroupeFiltres legende={t("draftUI.filtreLane")} largeurLegende="w-16" className="gap-1.5">
            <Puce dense actif={laneFiltre === null} onClick={() => setLaneFiltre(null)}>
              {t("draftUI.toutesLanes")}
            </Puce>
            {LANES.map((l) => (
              <Puce dense key={l} actif={laneFiltre === l} onClick={() => setLaneFiltre(l)}>
                {t(`lanes.${l}`)}
              </Puce>
            ))}
          </GroupeFiltres>
          <GroupeFiltres legende={t("draftUI.filtreRole")} largeurLegende="w-16" className="gap-1.5">
            <Puce dense actif={role === null} onClick={() => setRole(null)}>
              {t("draftUI.tousRoles")}
            </Puce>
            {ROLES.map((r) => (
              <Puce dense key={r} actif={role === r} onClick={() => setRole(role === r ? null : r)}>
                {t(`roles.${r}`)}
              </Puce>
            ))}
          </GroupeFiltres>
        </div>

        <p aria-live="polite" className="mt-3 text-xs text-chalk-500">
          {t("draftUI.compte", { n: resultats.length })}
        </p>

        <ul className="mt-2 grid grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
          {resultats.map((h) => (
            <li key={h.slug}>
              <button
                type="button"
                onClick={() => onChoisir(h.slug)}
                title={h.nom}
                className="bevel-sm flex w-full flex-col items-center gap-1 border border-night-700/70 p-2 text-center transition-colors hover:border-gold-500/60 hover:bg-night-850"
              >
                <VignetteHeros heros={h} />
                <span className="w-full truncate text-xs text-chalk-100">{h.nom}</span>
              </button>
            </li>
          ))}
          {resultats.length === 0 && (
            <li className="col-span-full py-6 text-center text-sm text-chalk-500">{t("draftUI.aucunHeros")}</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** Un heros propose, ses arguments et le bouton qui le prend. */
export function CarteSuggestion({
  suggestion: s,
  premiere,
  titrePrendre,
  onPrendre,
  vide,
}: {
  suggestion: Suggestion;
  /** La meilleure de sa lane, soulignee. */
  premiere: boolean;
  titrePrendre: string;
  onPrendre: () => void;
  /** Ligne affichee quand aucun argument ne ressort ; par defaut, celle du draft. */
  vide?: string;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "bevel flex h-full gap-3 border bg-night-900/60 p-3",
        premiere ? "border-gold-500/50" : "border-night-700/70",
      )}
    >
      <VignetteHeros heros={s.heros} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/heroes/${s.heros.slug}`}
          className="font-heading font-bold text-chalk-100 transition-colors hover:text-gold-400"
        >
          {s.heros.nom}
        </Link>
        <ul className="mt-1 space-y-0.5">
          {s.raisons.map((r) => (
            <li
              key={r.type}
              className={cn("text-xs leading-snug", r.favorable ? "text-emerald-400" : "text-blood-500")}
            >
              {r.favorable ? "+ " : "− "}
              {t(`draftUI.raisons.${r.type}`, { detail: r.detail })}
            </li>
          ))}
          {s.raisons.length === 0 && <li className="text-xs text-chalk-500">{vide ?? t("draftUI.aucunContre")}</li>}
        </ul>
      </div>
      <button
        type="button"
        onClick={onPrendre}
        title={titrePrendre}
        className="bevel-sm self-start border border-night-600 px-2 py-1 text-xs text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400"
      >
        {t("draftUI.prendre")}
      </button>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CarteHeros, type ApercuHeros } from "@/components/carte-heros";
import type { Lane, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
const LANES: Lane[] = ["Or", "Experience", "Milieu", "Jungle", "Roam"];

type Tri = "nom" | "victoire" | "palier";
const TRIS: { cle: Tri; label: string }[] = [
  { cle: "nom", label: "A → Z" },
  { cle: "victoire", label: "Taux de victoire" },
  { cle: "palier", label: "Tier list" },
];
const RANG_PALIER: Record<string, number> = { "S+": 0, S: 1, A: 2, B: 3, C: 4 };

/**
 * Catalogue filtrable.
 *
 * Le filtrage se fait sur le client a partir des donnees deja presentes dans
 * la page : pas d'aller-retour reseau a chaque clic, pour un volume qui reste
 * petit une fois les champs inutiles ecartes.
 */
export function ListeHeros({ heros }: { heros: ApercuHeros[] }) {
  const [recherche, setRecherche] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [tri, setTri] = useState<Tri>("nom");

  const resultats = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const filtres = heros.filter((h) => {
      if (terme && !h.nom.toLowerCase().includes(terme)) return false;
      if (role && !h.roles.includes(role)) return false;
      if (lane && !h.lanes.includes(lane)) return false;
      return true;
    });

    const ordonnes = [...filtres];
    if (tri === "victoire") {
      // Les heros non mesures passent en fin de liste.
      ordonnes.sort((a, b) => (b.victoire ?? -1) - (a.victoire ?? -1));
    } else if (tri === "palier") {
      ordonnes.sort(
        (a, b) =>
          (RANG_PALIER[a.palier ?? ""] ?? 99) - (RANG_PALIER[b.palier ?? ""] ?? 99) ||
          (b.victoire ?? -1) - (a.victoire ?? -1),
      );
    } else {
      ordonnes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    }
    return ordonnes;
  }, [heros, recherche, role, lane, tri]);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-craie-500"
          />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un heros"
            aria-label="Rechercher un heros"
            className="biseau-sm w-full border border-nuit-700 bg-nuit-900 py-2.5 pl-10 pr-4 text-craie-100 outline-none transition-colors placeholder:text-craie-500 focus:border-or-500"
          />
        </div>

        <Filtres legende="Role" valeurs={ROLES} actif={role} onChange={setRole} />
        <Filtres legende="Position" valeurs={LANES} actif={lane} onChange={setLane} />

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Tri</legend>
          <span aria-hidden className="mr-1 w-20 text-xs uppercase tracking-wide text-craie-500">
            Trier
          </span>
          {TRIS.map((t) => {
            const actif = tri === t.cle;
            return (
              <button
                key={t.cle}
                type="button"
                aria-pressed={actif}
                onClick={() => setTri(t.cle)}
                className={cn(
                  "biseau-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  actif
                    ? "bg-or-500 text-nuit-950"
                    : "border border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </fieldset>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-craie-500">
        {resultats.length} heros
        {resultats.length !== heros.length && ` sur ${heros.length}`}
      </p>

      {resultats.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resultats.map((h) => (
            <CarteHeros key={h.slug} heros={h} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-craie-500">Aucun heros ne correspond a ces filtres.</p>
      )}
    </div>
  );
}

function Filtres<T extends string>({
  legende,
  valeurs,
  actif,
  onChange,
}: {
  legende: string;
  valeurs: readonly T[];
  actif: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{legende}</legend>
      <span aria-hidden className="mr-1 w-20 text-xs uppercase tracking-wide text-craie-500">
        {legende}
      </span>
      {valeurs.map((v) => {
        const selectionne = actif === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={selectionne}
            onClick={() => onChange(selectionne ? null : v)}
            className={cn(
              "biseau-sm px-3 py-1.5 text-sm font-medium transition-colors",
              selectionne
                ? "bg-or-500 text-nuit-950"
                : "border border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
            )}
          >
            {v}
          </button>
        );
      })}
    </fieldset>
  );
}

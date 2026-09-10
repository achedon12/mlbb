"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CarteHeros, type ApercuHeros } from "@/components/carte-heros";
import type { Lane, Role } from "@/lib/types";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
const LANES: Lane[] = ["Or", "Experience", "Milieu", "Jungle", "Roam"];

type Tri = "nom" | "victoire" | "palier";
const TRIS: { cle: Tri; cleI18n: string }[] = [
  { cle: "nom", cleI18n: "triNom" },
  { cle: "victoire", cleI18n: "triVictoire" },
  { cle: "palier", cleI18n: "triPalier" },
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
  const t = useT();
  const [recherche, setRecherche] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [tri, setTri] = useState<Tri>("nom");

  // La recherche passe par l'URL cote client, ce qui garde la page statique et
  // rend la recherche partageable — et joignable via l'action de recherche du
  // moteur. Serveur et premiere hydratation partent de vide (identiques, donc
  // sans desaccord) ; apres le montage seulement, on adopte ?q=, puis chaque
  // frappe se reporte dans l'URL.
  const monte = useRef(false);
  useEffect(() => {
    if (!monte.current) {
      monte.current = true;
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de l'URL apres montage
        setRecherche(q);
        return;
      }
    }
    const terme = recherche.trim();
    const params = new URLSearchParams(window.location.search);
    if (terme) params.set("q", terme);
    else params.delete("q");
    const suffixe = params.toString();
    window.history.replaceState(null, "", suffixe ? `?${suffixe}` : window.location.pathname);
  }, [recherche]);

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
            placeholder={t("pages.heroesListe.rechercher")}
            aria-label={t("pages.heroesListe.rechercher")}
            className="biseau-sm w-full border border-nuit-700 bg-nuit-900 py-2.5 pl-10 pr-4 text-craie-100 outline-none transition-colors placeholder:text-craie-500 focus:border-or-500"
          />
        </div>

        <Filtres legende={t("pages.heroesListe.role")} valeurs={ROLES} actif={role} onChange={setRole} libelle={(r) => t(`roles.${r}`)} />
        <Filtres legende={t("pages.heroesListe.position")} valeurs={LANES} actif={lane} onChange={setLane} libelle={(l) => t(`lanes.${l}`)} />

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">{t("pages.heroesListe.trier")}</legend>
          <span aria-hidden className="mr-1 w-20 text-xs uppercase tracking-wide text-craie-500">
            {t("pages.heroesListe.trier")}
          </span>
          {TRIS.map((tri_) => {
            const actif = tri === tri_.cle;
            return (
              <button
                key={tri_.cle}
                type="button"
                aria-pressed={actif}
                onClick={() => setTri(tri_.cle)}
                className={cn(
                  "biseau-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  actif
                    ? "bg-or-500 text-nuit-950"
                    : "border border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
                )}
              >
                {t(`pages.heroesListe.${tri_.cleI18n}`)}
              </button>
            );
          })}
        </fieldset>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-craie-500">
        {t("pages.heroesListe.compte", { n: resultats.length })}
        {resultats.length !== heros.length && ` ${t("pages.heroesListe.compteSur", { total: heros.length })}`}
      </p>

      {resultats.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resultats.map((h) => (
            <CarteHeros key={h.slug} heros={h} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-craie-500">{t("pages.heroesListe.aucun")}</p>
      )}
    </div>
  );
}

function Filtres<T extends string>({
  legende,
  valeurs,
  actif,
  onChange,
  libelle,
}: {
  legende: string;
  valeurs: readonly T[];
  actif: T | null;
  onChange: (v: T | null) => void;
  libelle: (v: T) => string;
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
            {libelle(v)}
          </button>
        );
      })}
    </fieldset>
  );
}

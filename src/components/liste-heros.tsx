"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CarteHeros, type ApercuHeros } from "@/components/carte-heros";
import type { Lane, Role } from "@/lib/types";
import { useT } from "@/i18n/fournisseur";
import { ChampRecherche } from "@/components/champ-recherche";
import { GroupeFiltres, Puce } from "@/components/puce";
import { cleRecherche } from "@/lib/utils";

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
    const terme = cleRecherche(recherche.trim());
    const filtres = heros.filter((h) => {
      if (terme && !cleRecherche(h.nom).includes(terme)) return false;
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
        <ChampRecherche
          valeur={recherche}
          onChange={setRecherche}
          libelle={t("pages.heroesListe.rechercher")}
          className="max-w-md"
        />

        <Filtres legende={t("pages.heroesListe.role")} valeurs={ROLES} actif={role} onChange={setRole} libelle={(r) => t(`roles.${r}`)} />
        <Filtres legende={t("pages.heroesListe.position")} valeurs={LANES} actif={lane} onChange={setLane} libelle={(l) => t(`lanes.${l}`)} />

        <GroupeFiltres legende={t("pages.heroesListe.trier")}>
          {TRIS.map((tri_) => (
            <Puce key={tri_.cle} actif={tri === tri_.cle} onClick={() => setTri(tri_.cle)}>
              {t(`pages.heroesListe.${tri_.cleI18n}`)}
            </Puce>
          ))}
        </GroupeFiltres>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-craie-500">
        {t("pages.heroesListe.compte", { n: resultats.length })}
        {resultats.length !== heros.length && ` ${t("pages.heroesListe.compteSur", { total: heros.length })}`}
      </p>

      {/* Titre de la grille pour les lecteurs d'ecran : les cartes portent des h3. */}
      <h2 className="sr-only">{t("pages.heroesListe.liste")}</h2>
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
    <GroupeFiltres legende={legende}>
      {valeurs.map((v) => (
        <Puce key={v} actif={actif === v} onClick={() => onChange(actif === v ? null : v)}>
          {libelle(v)}
        </Puce>
      ))}
    </GroupeFiltres>
  );
}

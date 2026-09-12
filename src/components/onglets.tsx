"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/**
 * Onglets.
 *
 * La fiche d'un heros empile analyse, competences, contres, builds et parfois
 * quatorze skins : d'un seul tenant, elle devient impraticable. Les onglets
 * decoupent sans rien cacher.
 *
 * Les panneaux sont rendus par le serveur et restent dans le document — seul
 * l'affichage change. Le contenu masque reste donc indexable, et la navigation
 * ne declenche aucune requete. Exception : un panneau `differe` (graphiques,
 * galerie) n'est monte qu'a sa premiere ouverture : le monter d'emblee
 * alourdissait l'hydratation de toute la page. Son `apercu`, un resume leger
 * rendu par le serveur, tient sa place jusque-la : les moteurs et le lecteur
 * sans script y trouvent l'essentiel en texte.
 *
 * Les images d'un panneau masque restent en chargement differe : le navigateur
 * ne les demande qu'a l'ouverture du panneau (verifie dans Chromium).
 *
 * L'onglet ouvert se lit et s'ecrit dans l'ancre de l'adresse (#skins,
 * #builds…) : un lien peut mener droit a un onglet, et l'adresse partagee
 * rouvre le meme.
 */
export interface Onglet {
  id: string;
  label: string;
  /** Compteur affiche a cote du libelle, quand il apporte quelque chose. */
  compteur?: number;
  contenu: React.ReactNode;
  /** Monte le contenu a la premiere ouverture seulement. */
  differe?: boolean;
  /** Resume rendu par le serveur, affiche tant qu'un panneau differe n'est pas monte. */
  apercu?: React.ReactNode;
}

export function Onglets({ onglets }: { onglets: Onglet[] }) {
  const t = useT();
  const [actif, setActif] = useState(onglets[0]?.id);
  const [ouverts, setOuverts] = useState(() => new Set(onglets[0] ? [onglets[0].id] : []));
  const base = useId();
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);
  const liste = useRef<HTMLDivElement>(null);

  // Un onglet sans contenu n'a pas de raison d'apparaitre : un heros sans
  // skin ni analyse ne doit pas afficher des sections vides.
  const visibles = onglets.filter((o) => o.contenu);

  const ouvrir = (id: string) => {
    setActif(id);
    setOuverts((o) => (o.has(id) ? o : new Set(o).add(id)));
  };

  // L'ancre choisit l'onglet a l'arrivee, puis a chaque lien interne vers
  // une autre ancre de la meme fiche.
  useEffect(() => {
    const suivreAncre = (defiler: boolean) => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!visibles.some((o) => o.id === id)) return;
      ouvrir(id);
      if (defiler) liste.current?.scrollIntoView({ block: "start" });
    };
    suivreAncre(true);
    const auChangement = () => suivreAncre(true);
    window.addEventListener("hashchange", auChangement);
    return () => window.removeEventListener("hashchange", auChangement);
    // Les onglets d'une fiche ne changent pas apres le rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choisir = (id: string) => {
    ouvrir(id);
    // replaceState : changer d'onglet ne remplit pas l'historique du navigateur.
    window.history.replaceState(null, "", `#${id}`);
  };

  /** Fleches et Debut/Fin, comme l'attend un lecteur d'ecran sur des onglets. */
  function auClavier(evenement: React.KeyboardEvent, index: number) {
    const touches: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: visibles.length - 1,
    };
    const cible = touches[evenement.key];
    if (cible === undefined) return;

    evenement.preventDefault();
    const suivant = (cible + visibles.length) % visibles.length;
    choisir(visibles[suivant].id);
    boutons.current[suivant]?.focus();
  }

  return (
    <div>
      <div
        ref={liste}
        role="tablist"
        aria-label={t("common.sections")}
        className="flex scroll-mt-20 flex-wrap gap-1 border-b border-night-700/70"
      >
        {visibles.map((o, i) => {
          const selectionne = o.id === actif;
          return (
            <button
              key={o.id}
              ref={(el) => {
                boutons.current[i] = el;
              }}
              role="tab"
              id={`${base}-${o.id}`}
              aria-selected={selectionne}
              aria-controls={`${base}-${o.id}-panneau`}
              tabIndex={selectionne ? 0 : -1}
              onClick={() => choisir(o.id)}
              onKeyDown={(e) => auClavier(e, i)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 font-heading text-sm font-semibold transition-colors",
                selectionne
                  ? "border-gold-500 text-gold-400"
                  : "border-transparent text-chalk-500 hover:text-chalk-100",
              )}
            >
              {o.label}
              {o.compteur !== undefined && (
                <span className="ml-1.5 text-xs font-medium text-chalk-500">
                  {o.compteur}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visibles.map((o) => (
        <div
          key={o.id}
          role="tabpanel"
          id={`${base}-${o.id}-panneau`}
          aria-labelledby={`${base}-${o.id}`}
          hidden={o.id !== actif}
          tabIndex={0}
          className="pt-8 outline-none"
        >
          {!o.differe || ouverts.has(o.id) ? o.contenu : (o.apercu ?? null)}
        </div>
      ))}
    </div>
  );
}

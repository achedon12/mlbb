"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
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
export interface Tab {
  id: string;
  label: string;
  /** Compteur affiche a cote du libelle, quand il apporte quelque chose. */
  counter?: number;
  content: React.ReactNode;
  /** Monte le contenu a la premiere ouverture seulement. */
  deferred?: boolean;
  /** Resume rendu par le serveur, affiche tant qu'un panneau differe n'est pas monte. */
  preview?: React.ReactNode;
}

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const t = useT();
  const [active, setActive] = useState(tabs[0]?.id);
  const [openTabs, setOpen] = useState(() => new Set(tabs[0] ? [tabs[0].id] : []));
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);

  // Un onglet sans contenu n'a pas de raison d'apparaitre : un heros sans
  // skin ni analyse ne doit pas afficher des sections vides.
  const visible = tabs.filter((o) => o.content);

  const openTab = (id: string) => {
    setActive(id);
    setOpen((o) => (o.has(id) ? o : new Set(o).add(id)));
  };

  // L'ancre choisit l'onglet a l'arrivee, puis a chaque lien interne vers
  // une autre ancre de la meme fiche.
  useEffect(() => {
    const followAnchor = (scroll: boolean) => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!visible.some((o) => o.id === id)) return;
      openTab(id);
      if (scroll) list.current?.scrollIntoView({ block: "start" });
    };
    followAnchor(true);
    const onChange = () => followAnchor(true);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
    // Les onglets d'une fiche ne changent pas apres le rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (id: string) => {
    openTab(id);
    // replaceState : changer d'onglet ne remplit pas l'historique du navigateur.
    window.history.replaceState(null, "", `#${id}`);
  };

  /** Fleches et Debut/Fin, comme l'attend un lecteur d'ecran sur des onglets. */
  function byKeyboard(event: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: visible.length - 1,
    };
    const target = keys[event.key];
    if (target === undefined) return;

    event.preventDefault();
    const next = (target + visible.length) % visible.length;
    choose(visible[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div
        ref={list}
        role="tablist"
        aria-label={t("common.sections")}
        className="flex scroll-mt-20 flex-wrap gap-1 border-b border-night-700/70"
      >
        {visible.map((o, i) => {
          const selected = o.id === active;
          return (
            <button
              key={o.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              role="tab"
              id={`${base}-${o.id}`}
              aria-selected={selected}
              aria-controls={`${base}-${o.id}-panneau`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(o.id)}
              onKeyDown={(e) => byKeyboard(e, i)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 font-heading text-sm font-semibold transition-colors",
                selected
                  ? "border-gold-500 text-gold-400"
                  : "border-transparent text-chalk-500 hover:text-chalk-100",
              )}
            >
              {o.label}
              {o.counter !== undefined && (
                <span className="ml-1.5 text-xs font-medium text-chalk-500">
                  {o.counter}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visible.map((o) => (
        <div
          key={o.id}
          role="tabpanel"
          id={`${base}-${o.id}-panneau`}
          aria-labelledby={`${base}-${o.id}`}
          hidden={o.id !== active}
          tabIndex={0}
          className="pt-8 outline-none"
        >
          {!o.deferred || openTabs.has(o.id) ? o.content : (o.preview ?? null)}
        </div>
      ))}
    </div>
  );
}

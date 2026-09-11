"use client";

import { useId, useMemo, useRef, useState } from "react";
import { PortraitHeros } from "@/components/portrait-heros";
import { chercherOptions } from "@/lib/quiz";
import { cn } from "@/lib/utils";

export interface OptionDevinette {
  slug: string;
  nom: string;
  icone: string | null;
}

/**
 * Champ de reponse du quiz : une liste deroulante qui se resserre a la frappe
 * (motif « combobox » de l'ARIA). Fleches pour parcourir, Entree pour valider
 * la proposition en surbrillance, Echap pour fermer. Choisir une proposition
 * vaut reponse : pas de faute de frappe possible.
 */
export function ChampDevinette({
  options,
  exclus,
  libelle,
  aucun,
  onChoisir,
  desactive = false,
}: {
  options: OptionDevinette[];
  /** Deja proposes : ils ne reviennent pas dans la liste. */
  exclus: Set<string>;
  /** Texte d'exemple, et nom du champ pour les lecteurs d'ecran. */
  libelle: string;
  /** Ligne affichee quand rien ne correspond. */
  aucun: string;
  onChoisir: (slug: string) => void;
  desactive?: boolean;
}) {
  const id = useId();
  const champ = useRef<HTMLInputElement>(null);
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  // La liste s'ouvre sous le champ, ou au-dessus quand la place manque en bas
  // de l'ecran (champ en bas de page, clavier ouvert sur mobile).
  const [versLeHaut, setVersLeHaut] = useState(false);
  const resultats = useMemo(() => chercherOptions(options, texte, exclus), [options, texte, exclus]);
  const visible = ouvert && texte.trim().length > 0;
  const courant = Math.min(actif, Math.max(0, resultats.length - 1));

  function placer() {
    const r = champ.current?.getBoundingClientRect();
    if (!r) return;
    const vue = window.visualViewport;
    const dessous = (vue ? vue.offsetTop + vue.height : window.innerHeight) - r.bottom;
    setVersLeHaut(dessous < 240 && r.top > dessous);
  }

  function choisir(o: OptionDevinette) {
    onChoisir(o.slug);
    setTexte("");
    setActif(0);
    setOuvert(false);
  }

  function touche(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setActif(Math.min(courant + 1, resultats.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif(Math.max(courant - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visible && resultats[courant]) choisir(resultats[courant]);
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={champ}
        type="text"
        role="combobox"
        aria-expanded={visible && resultats.length > 0}
        aria-controls={`${id}-liste`}
        aria-autocomplete="list"
        aria-activedescendant={visible && resultats[courant] ? `${id}-${courant}` : undefined}
        aria-label={libelle}
        placeholder={libelle}
        value={texte}
        disabled={desactive}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        onChange={(e) => {
          setTexte(e.target.value);
          setOuvert(true);
          setActif(0);
          placer();
        }}
        onFocus={() => {
          setOuvert(true);
          placer();
        }}
        onBlur={() => setOuvert(false)}
        onKeyDown={touche}
        className="biseau-sm w-full border border-nuit-600 bg-nuit-950 px-3 py-2.5 text-base text-craie-100 outline-none transition-colors placeholder:text-craie-400 focus:border-or-500 disabled:opacity-50 sm:text-sm"
      />
      <ul
        id={`${id}-liste`}
        role="listbox"
        aria-label={libelle}
        hidden={!visible}
        className={cn(
          "absolute inset-x-0 z-30 max-h-72 overflow-y-auto border border-or-500/40 bg-nuit-950 py-1 shadow-2xl shadow-black/70",
          versLeHaut ? "bottom-full mb-1" : "top-full mt-1",
        )}
      >
        {resultats.map((o, i) => (
          <li
            key={o.slug}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === courant}
            // Le champ garde le focus : la liste ne se ferme pas avant le clic.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choisir(o)}
            onMouseMove={() => setActif(i)}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 border-l-2 px-3 py-2 text-sm",
              i === courant ? "border-or-400 bg-or-500/15 text-or-400" : "border-transparent text-craie-100",
            )}
          >
            <PortraitHeros source={o.icone} nom={o.nom} taille="mini" decoratif />
            <span className="truncate">{o.nom}</span>
          </li>
        ))}
        {resultats.length === 0 && (
          <li role="presentation" className="px-3 py-2 text-sm text-craie-500">
            {aucun}
          </li>
        )}
      </ul>
    </div>
  );
}

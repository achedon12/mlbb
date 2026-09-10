"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useT } from "@/i18n/fournisseur";
import { ACTUALITE, BASE, estActif, LienMenu, type Entree } from "./menu-bureau";

/**
 * Menu de navigation en petite largeur : meme decoupage que le bureau, deplie
 * verticalement, chaque rubrique accompagnee de son icone et d'un mot
 * d'explication tires du catalogue de traductions.
 */

function Section({
  titre,
  entrees,
  chemin,
  onNaviguer,
}: {
  titre: string;
  entrees: Entree[];
  chemin: string;
  onNaviguer: () => void;
}) {
  return (
    <div>
      <p className="px-2 pb-1 pt-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-craie-500">
        {titre}
      </p>
      <ul>
        {entrees.map((entree) => (
          <li key={entree.href}>
            <LienMenu entree={entree} actif={estActif(chemin, entree.href)} onClick={onNaviguer} className="items-center" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MenuMobile() {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();

  const fermer = () => setOuvert(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        aria-label={ouvert ? t("nav.fermer") : t("nav.ouvrir")}
        className="grid size-9 place-items-center text-craie-300 transition-colors hover:text-or-400"
      >
        {ouvert ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>

      <div
        hidden={!ouvert}
        onClick={fermer}
        className="fixed inset-0 top-16 z-30 bg-nuit-950/60 backdrop-blur-sm"
        aria-hidden
      />

      <div
        id="menu-mobile"
        hidden={!ouvert}
        className="absolute inset-x-0 top-16 z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-nuit-700 bg-nuit-950 px-3 pb-4 shadow-2xl shadow-nuit-950/60"
      >
        <Section titre={t("nav.baseDeDonnees")} entrees={BASE} chemin={chemin} onNaviguer={fermer} />
        <Section titre={t("nav.actualite")} entrees={ACTUALITE} chemin={chemin} onNaviguer={fermer} />
      </div>
    </div>
  );
}

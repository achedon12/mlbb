"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";
import { ACTUALITE, BASE, type Entree } from "./menu-bureau";

/**
 * Menu de navigation en petite largeur : meme decoupage que le bureau, deplie
 * verticalement, chaque rubrique accompagnee de son icone et d'un mot
 * d'explication tires du catalogue de traductions.
 */

function estActif(chemin: string, href: string) {
  return chemin.endsWith(href) || chemin.includes(`${href}/`);
}

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
  const t = useT();
  return (
    <div>
      <p className="px-2 pb-1 pt-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-craie-500">
        {titre}
      </p>
      <ul>
        {entrees.map(({ href, cle, icone: Ic }) => {
          const actif = estActif(chemin, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNaviguer}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md p-2.5 transition-colors",
                  actif ? "bg-nuit-800/80" : "hover:bg-nuit-800/60",
                )}
              >
                <span
                  className={cn(
                    "biseau-sm grid size-9 shrink-0 place-items-center transition-colors",
                    actif ? "bg-or-500 text-nuit-950" : "bg-nuit-800 text-craie-300",
                  )}
                >
                  <Ic size={17} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-semibold", actif ? "text-or-400" : "text-craie-100")}>
                    {t(`nav.${cle}.label`)}
                  </span>
                  <span className="block text-xs text-craie-400">{t(`nav.${cle}.desc`)}</span>
                </span>
              </Link>
            </li>
          );
        })}
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

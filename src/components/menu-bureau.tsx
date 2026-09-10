"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Database,
  Gamepad2,
  Gem,
  Newspaper,
  Package,
  Radar,
  Scale,
  ScrollText,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/**
 * Navigation de bureau.
 *
 * Les dix rubriques sont rangees en deux menus deroulants — la base de
 * donnees et l'actualite. Chaque entree porte une icone et, via le catalogue
 * de traductions, un libelle et une courte description dans la langue courante.
 */

export type Entree = { href: string; cle: string; icone: LucideIcon };

export const BASE: Entree[] = [
  { href: "/heroes", cle: "heroes", icone: Users },
  { href: "/tier-list", cle: "tierList", icone: Trophy },
  { href: "/compare", cle: "compare", icone: Scale },
  { href: "/draft", cle: "draft", icone: Swords },
  { href: "/game-modes", cle: "gameModes", icone: Gamepad2 },
  { href: "/items", cle: "items", icone: Package },
  { href: "/emblems", cle: "emblems", icone: Gem },
];

export const ACTUALITE: Entree[] = [
  { href: "/news", cle: "news", icone: Newspaper },
  { href: "/watch", cle: "watch", icone: Radar },
  { href: "/patch-notes", cle: "patchNotes", icone: ScrollText },
];

function estActif(chemin: string, href: string) {
  // Le chemin porte un prefixe de langue (/fr/heroes) : on compare la fin.
  return chemin.endsWith(href) || chemin.includes(`${href}/`);
}

function Deroulant({
  titre,
  icone: Icone,
  entrees,
  ouvert,
  onOuvrir,
  onFermer,
}: {
  titre: string;
  icone: LucideIcon;
  entrees: Entree[];
  ouvert: boolean;
  onOuvrir: () => void;
  onFermer: () => void;
}) {
  const t = useT();
  const chemin = usePathname();
  const panneauId = useId();
  const groupeActif = entrees.some((e) => estActif(chemin, e.href));

  return (
    <div className="relative" onMouseEnter={onOuvrir} onMouseLeave={onFermer}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={panneauId}
        onClick={() => (ouvert ? onFermer() : onOuvrir())}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          groupeActif || ouvert ? "text-craie-100" : "text-craie-300 hover:text-craie-100",
        )}
      >
        <Icone size={16} aria-hidden className={groupeActif ? "text-or-400" : ""} />
        {titre}
        <ChevronDown size={14} aria-hidden className={cn("transition-transform duration-200", ouvert && "rotate-180")} />
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-3 -bottom-px h-0.5 bg-or-500 transition-opacity",
            groupeActif ? "opacity-100" : "opacity-0",
          )}
        />
      </button>

      <div id={panneauId} hidden={!ouvert} className="absolute left-0 top-full z-50 pt-2">
        <div className="biseau w-80 border border-nuit-700/80 bg-nuit-900/98 p-2 shadow-2xl shadow-nuit-950/60 backdrop-blur">
          <ul className="grid gap-0.5">
            {entrees.map(({ href, cle, icone: Ic }) => {
              const actif = estActif(chemin, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onFermer}
                    aria-current={actif ? "page" : undefined}
                    className={cn(
                      "group flex items-start gap-3 rounded-md p-2.5 transition-colors",
                      actif ? "bg-nuit-800/80" : "hover:bg-nuit-800/60",
                    )}
                  >
                    <span
                      className={cn(
                        "biseau-sm grid size-9 shrink-0 place-items-center transition-colors",
                        actif ? "bg-or-500 text-nuit-950" : "bg-nuit-800 text-craie-300 group-hover:text-or-400",
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
      </div>
    </div>
  );
}

export function MenuBureau() {
  const t = useT();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const conteneur = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(null);
    const surClic = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(null);
    };
    document.addEventListener("keydown", surTouche);
    document.addEventListener("mousedown", surClic);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("mousedown", surClic);
    };
  }, [ouvert]);

  return (
    <nav ref={conteneur} aria-label={t("nav.baseDeDonnees")} className="hidden items-center gap-1 lg:flex">
      <Deroulant
        titre={t("nav.baseDeDonnees")}
        icone={Database}
        entrees={BASE}
        ouvert={ouvert === "base"}
        onOuvrir={() => setOuvert("base")}
        onFermer={() => setOuvert((o) => (o === "base" ? null : o))}
      />
      <Deroulant
        titre={t("nav.actualite")}
        icone={Newspaper}
        entrees={ACTUALITE}
        ouvert={ouvert === "actu"}
        onOuvrir={() => setOuvert("actu")}
        onFermer={() => setOuvert((o) => (o === "actu" ? null : o))}
      />
    </nav>
  );
}

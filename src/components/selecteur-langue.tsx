"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LANGUES, NOM_LANGUE, estLangue, type Langue } from "@/i18n/config";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de langue.
 *
 * Change le préfixe de langue du chemin courant et mémorise le choix dans un
 * cookie, si bien que les liens non préfixés du site ramènent ensuite vers la
 * bonne langue (la redirection est faite côté serveur, à partir de ce cookie).
 */
export function SelecteurLangue({ langue }: { langue: Langue }) {
  const t = useT();
  const router = useRouter();
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  /** Remplace le préfixe de langue du chemin courant. */
  function cheminVers(cible: Langue): string {
    const parts = chemin.split("/").filter(Boolean);
    const reste = estLangue(parts[0]) ? parts.slice(1) : parts;
    return `/${[cible, ...reste].join("/")}`;
  }

  function choisir(cible: Langue) {
    // La navigation vers le chemin prefixe suffit : le proxy pose alors le
    // cookie de langue, qui conservera le choix pour les liens non prefixes.
    setOuvert(false);
    router.push(cheminVers(cible));
  }

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-label={t("langue.changer")}
        onClick={() => setOuvert((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-craie-300 transition-colors hover:text-craie-100"
      >
        <Globe size={16} aria-hidden />
        <span className="hidden sm:inline uppercase">{langue}</span>
        <ChevronDown size={14} aria-hidden className={cn("transition-transform", ouvert && "rotate-180")} />
      </button>

      <div hidden={!ouvert} className="absolute right-0 top-full z-50 pt-2">
        <ul className="biseau w-40 border border-nuit-700/80 bg-nuit-900/98 p-1.5 shadow-2xl shadow-nuit-950/60 backdrop-blur">
          {LANGUES.map((l) => {
            const actif = l === langue;
            return (
              <li key={l}>
                <button
                  type="button"
                  onClick={() => choisir(l)}
                  aria-current={actif ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                    actif ? "text-or-400" : "text-craie-200 hover:bg-nuit-800/60",
                  )}
                >
                  {NOM_LANGUE[l]}
                  {actif && <Check size={15} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

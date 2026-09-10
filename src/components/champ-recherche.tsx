import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Champ de recherche a loupe, commun au catalogue des heros, aux objets et au
 * draft. La loupe passe au-dessus du champ : sans cela, le fond du champ, qui
 * forme son propre plan d'empilement, la recouvrait.
 */
export function ChampRecherche({
  valeur,
  onChange,
  libelle,
  dense = false,
  autoFocus,
  className,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  /** Texte d'exemple, et nom du champ pour les lecteurs d'ecran. */
  libelle: string;
  dense?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={dense ? 16 : 18}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-craie-500"
      />
      <input
        type="search"
        autoFocus={autoFocus}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={libelle}
        aria-label={libelle}
        className={cn(
          "biseau-sm w-full border border-nuit-700 text-craie-100 outline-none transition-colors placeholder:text-craie-500 focus:border-or-500",
          dense ? "bg-nuit-950 py-2 pl-9 pr-3" : "bg-nuit-900 py-2.5 pl-10 pr-4",
        )}
      />
    </div>
  );
}

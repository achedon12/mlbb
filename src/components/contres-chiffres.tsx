import Link from "next/link";
import Image from "next/image";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ContreChiffre } from "@/lib/donnees";
import { cn } from "@/lib/utils";

/**
 * Contres etablis sur les taux de victoire du jeu.
 *
 * Chaque ligne porte l'ecart en points, sa vraie information : « fort contre
 * Wanwan » ne dit rien, « +3,3 points contre Wanwan » situe l'avantage. Les
 * portraits rendent la lecture immediate — on reconnait un heros a sa tete
 * avant son nom.
 */
export function ContresChiffres({
  fort,
  faible,
  portraitParSlug,
  nomParSlug,
}: {
  fort: ContreChiffre[];
  faible: ContreChiffre[];
  portraitParSlug: (slug: string) => string | null;
  nomParSlug: (slug: string) => string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Colonne
        titre="Fort contre"
        icone={<TrendingUp size={17} aria-hidden />}
        ton="bon"
        entrees={fort}
        portraitParSlug={portraitParSlug}
        nomParSlug={nomParSlug}
      />
      <Colonne
        titre="En difficulte contre"
        icone={<TrendingDown size={17} aria-hidden />}
        ton="mauvais"
        entrees={faible}
        portraitParSlug={portraitParSlug}
        nomParSlug={nomParSlug}
      />
    </div>
  );
}

function Colonne({
  titre,
  icone,
  ton,
  entrees,
  portraitParSlug,
  nomParSlug,
}: {
  titre: string;
  icone: React.ReactNode;
  ton: "bon" | "mauvais";
  entrees: ContreChiffre[];
  portraitParSlug: (slug: string) => string | null;
  nomParSlug: (slug: string) => string;
}) {
  const couleur = ton === "bon" ? "text-emerald-400" : "text-sang-500";

  return (
    <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
      <h3 className={cn("flex items-center gap-2 font-titre font-bold", couleur)}>
        {icone}
        {titre}
      </h3>
      <ul className="mt-3 space-y-1.5">
        {entrees.map((e) => {
          const portrait = portraitParSlug(e.slug);
          return (
            <li key={e.slug}>
              <Link
                href={`/heros/${e.slug}`}
                className="flex items-center gap-2.5 rounded-sm px-1 py-1 transition-colors hover:bg-nuit-850"
              >
                <span className="biseau-sm relative size-8 shrink-0 overflow-hidden bg-nuit-800">
                  {portrait && (
                    <Image src={portrait} alt="" fill sizes="32px" className="object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-craie-100">
                  {nomParSlug(e.slug)}
                </span>
                <span className={cn("shrink-0 text-xs font-semibold tabular-nums", couleur)}>
                  {e.avantage > 0 ? "+" : ""}
                  {e.avantage.toFixed(1)} pts
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

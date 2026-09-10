import { FilAriane, type Miette } from "@/components/fil-ariane";
import Link from "@/components/lien";
import type { Palier } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Titre de section, avec le filet dore repris de l'interface du jeu. */
export function TitreSection({
  children,
  chapeau,
  action,
}: {
  children: React.ReactNode;
  chapeau?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-titre text-2xl font-bold text-craie-100 sm:text-3xl">{children}</h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
        {chapeau && <p className="mt-3 max-w-2xl text-sm text-craie-500">{chapeau}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-semibold text-or-400 transition-colors hover:text-or-500"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}


const COULEUR_PALIER: Record<Palier, string> = {
  "S+": "bg-sang-500 text-nuit-950",
  S: "bg-or-500 text-nuit-950",
  A: "bg-azur-500 text-nuit-950",
  B: "bg-nuit-600 text-craie-100",
  C: "bg-nuit-700 text-craie-300",
};

export function BadgePalier({ palier }: { palier: Palier }) {
  return (
    <span
      className={cn(
        "biseau-sm grid size-9 shrink-0 place-items-center font-titre text-base font-bold",
        COULEUR_PALIER[palier],
      )}
    >
      {palier}
    </span>
  );
}

/** Carte generique : surface biseautee sombre, utilisee partout. */
export function Carte({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "biseau border border-nuit-700/70 bg-nuit-900/60 p-5 transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Bandeau d'en-tete de page, commun a toutes les sections. */
export function EnTetePage({
  titre,
  chapeau,
  miettes,
  children,
}: {
  titre: string;
  chapeau: string;
  /** Fil d'Ariane ; par defaut, la page seule sous l'accueil. */
  miettes?: Miette[];
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-nuit-700/70 bg-nuit-900/30">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8">
        <FilAriane miettes={miettes ?? [{ nom: titre }]} className="mb-6" />
        <h1 className="font-titre text-3xl font-bold text-craie-100 sm:text-4xl">{titre}</h1>
        <div aria-hidden className="filet-or mt-3 h-0.5 w-20" />
        <p className="mt-4 max-w-2xl leading-relaxed text-craie-300">{chapeau}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * Note du jeu, affichee en barre plutot qu'en chiffre nu : on compare deux
 * heros d'un coup d'oeil, ce qu'une valeur seule ne permet pas.
 */
export function Jauge({ valeur, max = 10 }: { valeur: number; max?: number }) {
  const part = Math.max(0, Math.min(1, valeur / max));

  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-1.5 flex-1 bg-nuit-700">
        <span
          className={cn("block h-full", part >= 0.8 ? "bg-or-400" : "bg-azur-500")}
          style={{ width: `${part * 100}%` }}
        />
      </span>
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-craie-300">
        {valeur}
      </span>
      <span className="sr-only">sur {max}</span>
    </span>
  );
}

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
        <h2 className="font-heading text-2xl font-bold text-chalk-100 sm:text-3xl">{children}</h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        {chapeau && <p className="mt-3 max-w-2xl text-sm text-chalk-500">{chapeau}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}


/** Couleurs d'un palier, reprises par le tableau des statistiques. */
export const COULEUR_PALIER: Record<Palier, string> = {
  "S+": "bg-blood-500 text-night-950",
  S: "bg-gold-500 text-night-950",
  A: "bg-azure-500 text-night-950",
  B: "bg-night-600 text-chalk-100",
  C: "bg-night-700 text-chalk-300",
};

export function BadgePalier({ palier }: { palier: Palier }) {
  return (
    <span
      className={cn(
        "bevel-sm grid size-9 shrink-0 place-items-center font-heading text-base font-bold",
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
        "bevel border border-night-700/70 bg-night-900/60 p-5 transition-colors",
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
  icone,
  children,
}: {
  titre: string;
  chapeau: string;
  /** Fil d'Ariane ; par defaut, la page seule sous l'accueil. */
  miettes?: Miette[];
  /** Visuel pose devant le titre (icone d'objet, d'embleme, de sort). */
  icone?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const h1 = <h1 className="font-heading text-3xl font-bold text-chalk-100 sm:text-4xl">{titre}</h1>;
  return (
    <div className="border-b border-night-700/70 bg-night-900/30">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8">
        <FilAriane miettes={miettes ?? [{ nom: titre }]} className="mb-6" />
        {icone ? (
          <div className="flex items-center gap-4">
            {icone}
            <div className="min-w-0">{h1}</div>
          </div>
        ) : (
          h1
        )}
        <div aria-hidden className="gold-rule mt-3 h-0.5 w-20" />
        <p className="mt-4 max-w-2xl leading-relaxed text-chalk-300">{chapeau}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * Note du jeu, affichee en barre plutot qu'en chiffre nu : on compare deux
 * heros d'un coup d'oeil, ce qu'une valeur seule ne permet pas.
 */
export function Jauge({
  valeur,
  max = 10,
  texte,
}: {
  valeur: number;
  max?: number;
  /** Valeur affichee, deja formatee pour la langue (une moyenne a decimale). */
  texte?: string;
}) {
  const part = Math.max(0, Math.min(1, valeur / max));

  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-1.5 flex-1 bg-night-700">
        <span
          className={cn("block h-full", part >= 0.8 ? "bg-gold-400" : "bg-azure-500")}
          style={{ width: `${part * 100}%` }}
        />
      </span>
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-chalk-300">
        {texte ?? valeur}
      </span>
      {/* « / 10 » se lit dans toutes les langues : la jauge sert aussi hors d'un composant client. */}
      <span className="sr-only">/ {max}</span>
    </span>
  );
}

import Link from "next/link";
import type { Palier, Role } from "@/lib/types";
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

/** Couleurs par role, reprises de la charte du jeu. */
const COULEUR_ROLE: Record<Role, string> = {
  Tank: "bg-azur-500/15 text-azur-400 ring-azur-500/30",
  Fighter: "bg-sang-500/15 text-sang-500 ring-sang-500/30",
  Assassin: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  Mage: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/30",
  Marksman: "bg-or-500/15 text-or-400 ring-or-500/30",
  Support: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
};

export function BadgeRole({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "biseau-sm px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ring-1 ring-inset",
        COULEUR_ROLE[role],
      )}
    >
      {role}
    </span>
  );
}

const COULEUR_PALIER: Record<Palier, string> = {
  "S+": "bg-sang-500 text-white",
  S: "bg-or-500 text-nuit-950",
  A: "bg-azur-500 text-white",
  B: "bg-nuit-600 text-craie-100",
  C: "bg-nuit-700 text-craie-500",
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
  children,
}: {
  titre: string;
  chapeau: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-nuit-700/70 bg-nuit-900/30">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <h1 className="font-titre text-3xl font-bold text-craie-100 sm:text-4xl">{titre}</h1>
        <div aria-hidden className="filet-or mt-3 h-0.5 w-20" />
        <p className="mt-4 max-w-2xl leading-relaxed text-craie-300">{chapeau}</p>
        {children}
      </div>
    </div>
  );
}

/** Indicateur de difficulte, en barres plutot qu'en chiffre nu. */
export function Difficulte({ valeur }: { valeur: number }) {
  return (
    <span className="flex items-center gap-1" title={`Difficulte ${valeur} sur 10`}>
      <span className="sr-only">Difficulte {valeur} sur 10</span>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "h-3 w-0.5",
            i < valeur ? (valeur >= 8 ? "bg-sang-500" : "bg-or-500") : "bg-nuit-700",
          )}
        />
      ))}
    </span>
  );
}

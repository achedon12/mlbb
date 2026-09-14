import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import Link from "@/components/link";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Titre de section, avec le filet dore repris de l'interface du jeu. */
export function SectionTitle({
  children,
  lead,
  action,
}: {
  children: React.ReactNode;
  lead?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-heading text-2xl font-bold text-chalk-100 sm:text-3xl">{children}</h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        {lead && <p className="mt-3 max-w-2xl text-sm text-chalk-500">{lead}</p>}
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
export const COLOR_TIER: Record<Tier, string> = {
  "S+": "bg-blood-500 text-night-950",
  S: "bg-gold-500 text-night-950",
  A: "bg-azure-500 text-night-950",
  B: "bg-night-600 text-chalk-100",
  C: "bg-night-700 text-chalk-300",
};

export function BadgeTier({ tier }: { tier: Tier }) {
  return (
    <span
      className={cn(
        "bevel-sm grid size-9 shrink-0 place-items-center font-heading text-base font-bold",
        COLOR_TIER[tier],
      )}
    >
      {tier}
    </span>
  );
}

/** Carte generique : surface biseautee sombre, utilisee partout. */
export function Card({
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
export function PageHeader({
  title,
  lead,
  crumbs,
  icon,
  children,
}: {
  title: string;
  lead: string;
  /** Fil d'Ariane ; par defaut, la page seule sous l'accueil. */
  crumbs?: Crumb[];
  /** Visuel pose devant le titre (icone d'objet, d'embleme, de sort). */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const h1 = <h1 className="font-heading text-3xl font-bold text-chalk-100 sm:text-4xl">{title}</h1>;
  return (
    <div className="border-b border-night-700/70 bg-night-900/30">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8">
        <Breadcrumb crumbs={crumbs ?? [{ name: title }]} className="mb-6" />
        {icon ? (
          <div className="flex items-center gap-4">
            {icon}
            <div className="min-w-0">{h1}</div>
          </div>
        ) : (
          h1
        )}
        <div aria-hidden className="gold-rule mt-3 h-0.5 w-20" />
        <p className="mt-4 max-w-2xl leading-relaxed text-chalk-300">{lead}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * Note du jeu, affichee en barre plutot qu'en chiffre nu : on compare deux
 * heros d'un coup d'oeil, ce qu'une valeur seule ne permet pas.
 */
export function Gauge({
  value,
  max = 10,
  text,
}: {
  value: number;
  max?: number;
  /** Valeur affichee, deja formatee pour la langue (une moyenne a decimale). */
  text?: string;
}) {
  const part = Math.max(0, Math.min(1, value / max));

  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-1.5 flex-1 bg-night-700">
        <span
          className={cn("block h-full", part >= 0.8 ? "bg-gold-400" : "bg-azure-500")}
          style={{ width: `${part * 100}%` }}
        />
      </span>
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-chalk-300">
        {text ?? value}
      </span>
      {/* « / 10 » se lit dans toutes les langues : la jauge sert aussi hors d'un composant client. */}
      <span className="sr-only">/ {max}</span>
    </span>
  );
}

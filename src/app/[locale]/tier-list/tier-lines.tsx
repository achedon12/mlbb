"use client";

import Link from "@/components/link";
import { usualIcon } from "@/lib/tier-list-filters";
import { cn } from "@/lib/utils";

/**
 * Lignes d'un palier de la tier list.
 *
 * Composant client pour une raison de poids : rendue par le serveur, chaque
 * ligne etait ecrite deux fois dans la page, en HTML puis dans les donnees
 * React qui l'accompagnent (plus de 300 Ko pour 132 heros). Ici seules les
 * valeurs voyagent, une ligne compacte par heros, et le balisage n'est ecrit
 * qu'une fois, sans classe repetee : les styles vivent dans `globals.css`.
 * Textes et nombres arrivent formates, rien a traduire ici.
 */
export interface RowTier {
  slug: string;
  name: string;
  /** Icone ailleurs qu'a son emplacement habituel ; null quand il n'y en a pas. */
  icon?: string | null;
  /** Lanes du heros, deja traduites et jointes. */
  lanes: string;
  win: string;
  ban: string;
  pick: string;
  /** Evolution sur sept jours : fleche et ecart, et sa description pour les lecteurs d'ecran. */
  trend?: { rise: boolean; text: string; description: string };
  /** Trop peu joue pour que ses taux soient stables. */
  weak?: boolean;
  note?: string;
}

export interface LabelsTier {
  win: string;
  ban: string;
  pick: string;
  tooFew: string;
}

export function TierLines({ rows, labels }: { rows: RowTier[]; labels: LabelsTier }) {
  return (
    <ul className="tier-rows mt-4 space-y-1.5">
      {rows.map((l) => {
        const icon = l.icon === undefined ? usualIcon(l.slug) : l.icon;
        return (
          <li key={l.slug}>
            <Link href={`/heroes/${l.slug}`} className="tier-row">
              {icon ? (
                // Icone deja reduite a la synchronisation (webp de 4 a 10 Ko),
                // servie telle quelle : next/image y ajoutait ses attributs sur
                // chaque ligne sans rien gagner. Le nom suit, d'ou l'alt vide.
                // eslint-disable-next-line @next/next/no-img-element -- fichier deja reduit, servi tel quel (voir plus haut)
                <img src={icon} alt="" width={40} height={40} loading="lazy" className="tier-row-icon" />
              ) : (
                <span aria-hidden className="tier-row-icon grid place-items-center font-heading text-sm font-bold text-chalk-500">
                  {initials(l.name)}
                </span>
              )}

              <div className="tier-row-identity">
                <span className="tier-row-name">{l.name}</span>
                {l.weak && (
                  <span className="ml-1 text-gold-400" title={labels.tooFew}>
                    *
                  </span>
                )}
                <span className="tier-row-lanes">{l.lanes}</span>
              </div>

              {/* Le taux de victoire, premier, est mis en avant par la feuille de style. */}
              <dl className="tier-row-rates">
                <Rate label={labels.win} value={l.win} trend={l.trend} />
                <Rate label={labels.ban} value={l.ban} />
                <Rate label={labels.pick} value={l.pick} />
              </dl>

              {l.note && <p className="tier-row-note">{l.note}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Rate({ label, value, trend }: { label: string; value: string; trend?: RowTier["trend"] }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {trend && (
          <span className={cn("tier-rate-trend", trend.rise ? "text-emerald-400" : "text-blood-500")}>
            <span aria-hidden>
              {trend.rise ? "↑" : "↓"}
              {trend.text}
            </span>
            <span className="sr-only"> {trend.description}</span>
          </span>
        )}
      </dd>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/[\s'-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}

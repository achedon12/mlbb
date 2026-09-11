"use client";

import Link from "@/components/lien";
import { iconeHabituelle } from "@/lib/filtres-tier-list";
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
export interface LigneTier {
  slug: string;
  nom: string;
  /** Icone ailleurs qu'a son emplacement habituel ; null quand il n'y en a pas. */
  icone?: string | null;
  /** Lanes du heros, deja traduites et jointes. */
  lanes: string;
  victoire: string;
  ban: string;
  pick: string;
  /** Evolution sur sept jours : fleche et ecart, et sa description pour les lecteurs d'ecran. */
  tendance?: { hausse: boolean; texte: string; description: string };
  /** Trop peu joue pour que ses taux soient stables. */
  faible?: boolean;
  note?: string;
}

export interface LibellesTier {
  victoire: string;
  ban: string;
  pick: string;
  tropPeu: string;
}

export function LignesTier({ lignes, libelles }: { lignes: LigneTier[]; libelles: LibellesTier }) {
  return (
    <ul className="liste-tier mt-4 space-y-1.5">
      {lignes.map((l) => {
        const icone = l.icone === undefined ? iconeHabituelle(l.slug) : l.icone;
        return (
          <li key={l.slug}>
            <Link href={`/heroes/${l.slug}`} className="ligne-tier">
              {icone ? (
                // Icone deja reduite a la synchronisation (webp de 4 a 10 Ko),
                // servie telle quelle : next/image y ajoutait ses attributs sur
                // chaque ligne sans rien gagner. Le nom suit, d'ou l'alt vide.
                // eslint-disable-next-line @next/next/no-img-element -- fichier deja reduit, servi tel quel (voir plus haut)
                <img src={icone} alt="" width={40} height={40} loading="lazy" className="ligne-tier-icone" />
              ) : (
                <span aria-hidden className="ligne-tier-icone grid place-items-center font-titre text-sm font-bold text-craie-500">
                  {initiales(l.nom)}
                </span>
              )}

              <div className="ligne-tier-identite">
                <span className="ligne-tier-nom">{l.nom}</span>
                {l.faible && (
                  <span className="ml-1 text-or-400" title={libelles.tropPeu}>
                    *
                  </span>
                )}
                <span className="ligne-tier-lanes">{l.lanes}</span>
              </div>

              {/* Le taux de victoire, premier, est mis en avant par la feuille de style. */}
              <dl className="ligne-tier-taux">
                <Taux libelle={libelles.victoire} valeur={l.victoire} tendance={l.tendance} />
                <Taux libelle={libelles.ban} valeur={l.ban} />
                <Taux libelle={libelles.pick} valeur={l.pick} />
              </dl>

              {l.note && <p className="ligne-tier-note">{l.note}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Taux({ libelle, valeur, tendance }: { libelle: string; valeur: string; tendance?: LigneTier["tendance"] }) {
  return (
    <div>
      <dt>{libelle}</dt>
      <dd>
        {valeur}
        {tendance && (
          <span className={cn("taux-tier-tendance", tendance.hausse ? "text-emerald-400" : "text-sang-500")}>
            <span aria-hidden>
              {tendance.hausse ? "↑" : "↓"}
              {tendance.texte}
            </span>
            <span className="sr-only"> {tendance.description}</span>
          </span>
        )}
      </dd>
    </div>
  );
}

function initiales(nom: string): string {
  return nom
    .split(/[\s'-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}

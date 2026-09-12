import duosGenere from "@/data/jeu/duos.json";
import type { RangMesure } from "./rangs-mesure";

/**
 * Duos mesures par le jeu (`/heroes/{h}/compatibility`), par heros puis par
 * rang : les partenaires qui font le plus monter son taux de victoire, ceux
 * qui le font le plus baisser, et le taux du duo par tranche de duree de
 * partie. Lu par les seules pages duos et face-a-face : le fichier reste hors
 * des pages qui n'en ont pas besoin.
 */

export interface Duo {
  slug: string;
  /** Variation du taux de victoire du heros avec ce partenaire, en points. */
  advantage: number;
  /**
   * Taux de victoire du duo par tranche de duree, en %, aligne sur
   * DEBUTS_TRANCHES_DUO (src/lib/paires.ts) ; null pour une tranche vide.
   */
  phases?: (number | null)[];
}

export interface DuosRang {
  /** Taux de victoire du heros dans ce rang, en %. */
  winRate: number | null;
  best: Duo[];
  worst: Duo[];
}

/** Un rang absent n'a pas ete mesure pour ce heros. */
export type DuosParRang = Partial<Record<RangMesure, DuosRang>>;

const D = duosGenere as unknown as { days?: number; heroes?: Record<string, DuosParRang> };

/** Fenetre de mesure des duos, en jours. */
export const JOURS_DUOS = D.days ?? 30;

export const duos: Record<string, DuosParRang> = D.heroes ?? {};

export const duosDe = (slug: string): DuosParRang => duos[slug] ?? {};

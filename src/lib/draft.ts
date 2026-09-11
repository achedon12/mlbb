import type { Role } from "./types";
import type { Lane } from "./types";

/**
 * Suggestion de picks.
 *
 * Le principe : un heros vaut d'etre pris s'il gene ceux d'en face, s'il ne
 * leur est pas vulnerable, s'il se combine avec ce que son equipe a deja
 * choisi, et s'il tient la route dans l'absolu. Ces quatre signaux n'ont pas
 * le meme poids — contrer un adversaire precis compte plus qu'un demi-point de
 * taux de victoire.
 */

export const LANES: Lane[] = ["Or", "Jungle", "Milieu", "Experience", "Roam"];
export const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];

/** Ce dont l'outil a besoin pour chaque heros ; le reste alourdirait la page. */
export interface HerosDraft {
  slug: string;
  nom: string;
  lanes: Lane[];
  roles: Role[];
  icone: string | null;
  victoire: number | null;
  fortContre: string[];
  faibleContre: string[];
  synergies: string[];
}

export interface Raison {
  /** Nature de l'argument ; la phrase se compose dans la langue de la page. */
  type: "contre" | "subi" | "combine" | "victoire";
  /** Heros en cause, ou taux de victoire. */
  detail: string;
  /** Positif quand l'argument joue en faveur du heros. */
  favorable: boolean;
}

export interface Suggestion {
  heros: HerosDraft;
  score: number;
  raisons: Raison[];
}

/**
 * Poids des signaux.
 *
 * Contrer un adversaire vaut trois points ; en subir un en coute autant. La
 * synergie compte moitie moins : elle aide, mais ne decide pas d'un duel de
 * lane. Le taux de victoire n'intervient qu'en depart d'egalite — d'ou son
 * echelle volontairement reduite.
 */
const POIDS = {
  contre: 3,
  contre_par: -3,
  synergie: 1.5,
  /** Ecart au taux d'equilibre (50 %), divise pour rester un simple arbitre. */
  victoire: 0.4,
};

export function suggerer({
  candidats,
  lane,
  ennemis,
  allies,
  limite = 3,
}: {
  candidats: HerosDraft[];
  lane: Lane;
  /** Slugs adverses, toutes lanes confondues. */
  ennemis: string[];
  /** Slugs deja choisis par l'equipe. */
  allies: string[];
  limite?: number;
}): Suggestion[] {
  const pris = new Set([...ennemis, ...allies]);

  return candidats
    .filter((h) => h.lanes.includes(lane) && !pris.has(h.slug))
    .map((h) => {
      const raisons: Raison[] = [];
      let score = 0;

      // Une relation de contre est declaree d'un seul cote : « A est fort
      // contre B » n'implique pas que la fiche de B mentionne A. On lit donc
      // les deux sens, sans quoi la moitie des contres resterait invisible.
      const parEnnemi = new Map(
        candidats.filter((c) => ennemis.includes(c.slug)).map((c) => [c.slug, c]),
      );

      const contres = ennemis.filter(
        (e) => h.fortContre.includes(e) || parEnnemi.get(e)?.faibleContre.includes(h.slug),
      );
      if (contres.length > 0) {
        score += contres.length * POIDS.contre;
        const noms = contres.map((e) => parEnnemi.get(e)?.nom ?? e).join(", ");
        raisons.push({ type: "contre", detail: noms, favorable: true });
      }

      const subis = ennemis.filter(
        (e) => h.faibleContre.includes(e) || parEnnemi.get(e)?.fortContre.includes(h.slug),
      );
      if (subis.length > 0) {
        score += subis.length * POIDS.contre_par;
        const noms = subis.map((e) => parEnnemi.get(e)?.nom ?? e).join(", ");
        raisons.push({ type: "subi", detail: noms, favorable: false });
      }

      const parAllie = new Map(
        candidats.filter((c) => allies.includes(c.slug)).map((c) => [c.slug, c]),
      );
      const combine = allies.filter(
        (a) => h.synergies.includes(a) || parAllie.get(a)?.synergies.includes(h.slug),
      );
      if (combine.length > 0) {
        score += combine.length * POIDS.synergie;
        const noms = combine.map((a) => parAllie.get(a)?.nom ?? a).join(", ");
        raisons.push({ type: "combine", detail: noms, favorable: true });
      }

      if (h.victoire !== null) {
        score += (h.victoire - 50) * POIDS.victoire;
        if (h.victoire >= 53) {
          raisons.push({ type: "victoire", detail: h.victoire.toFixed(1), favorable: true });
        } else if (h.victoire <= 47) {
          raisons.push({ type: "victoire", detail: h.victoire.toFixed(1), favorable: false });
        }
      }

      return { heros: h, score, raisons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}

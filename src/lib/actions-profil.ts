"use server";

import { IDENTIFIANT } from "./joueur-api";
import { pageParties } from "./mlbb-auth";
import { afficherPartie, type PartieAffichee } from "./profil-joueur";
import { fermerSession, jetonCourant } from "./session";

/**
 * Parties suivantes du profil de joueur.
 *
 * Le navigateur ne transmet que la saison et le curseur de pagination ; le
 * jeton reste dans son cookie httpOnly, lu ici, cote serveur. Les parties
 * repartent deja mises en forme — fiche du site, portrait — et rien de plus
 * que ce que la page affiche.
 */
export type SuiteParties =
  | { etat: "ok"; parties: PartieAffichee[]; suivant: string | null }
  | { etat: "expire" }
  | { etat: "indisponible" };

export async function partiesSuivantes(saison: number, curseur: string): Promise<SuiteParties> {
  // Entrees venues du navigateur : rien ne part vers le service sans controle.
  const valide =
    Number.isInteger(saison) && saison > 0 && saison < 1000 && typeof curseur === "string" && IDENTIFIANT.test(curseur);
  if (!valide) return { etat: "indisponible" };

  const jeton = await jetonCourant();
  if (!jeton) return { etat: "expire" };

  const page = await pageParties(jeton, saison, curseur);
  if (page.etat === "expire") {
    await fermerSession();
    return { etat: "expire" };
  }
  if (page.etat !== "ok") return { etat: "indisponible" };

  return { etat: "ok", parties: page.donnees.entrees.map(afficherPartie), suivant: page.donnees.suivant };
}

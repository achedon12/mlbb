"use server";

import { ID } from "./player-api";
import { pageMatches } from "./mlbb-auth";
import { showMatch, type MatchShown } from "./player-profile";
import { closeSession, tokenCurrent } from "./session";

/**
 * Parties suivantes du profil de joueur.
 *
 * Le navigateur ne transmet que la saison et le curseur de pagination ; le
 * jeton reste dans son cookie httpOnly, lu ici, cote serveur. Les parties
 * repartent deja mises en forme — fiche du site, portrait — et rien de plus
 * que ce que la page affiche.
 */
export type RunMatches =
  | { state: "ok"; matches: MatchShown[]; next: string | null }
  | { state: "expired" }
  | { state: "unavailable" };

export async function nextMatches(season: number, cursor: string): Promise<RunMatches> {
  // Entrees venues du navigateur : rien ne part vers le service sans controle.
  const valid =
    Number.isInteger(season) && season > 0 && season < 1000 && typeof cursor === "string" && ID.test(cursor);
  if (!valid) return { state: "unavailable" };

  const token = await tokenCurrent();
  if (!token) return { state: "expired" };

  const page = await pageMatches(token, season, cursor);
  if (page.etat === "expired") {
    await closeSession();
    return { state: "expired" };
  }
  if (page.etat !== "ok") return { state: "unavailable" };

  return { state: "ok", matches: page.donnees.entries.map(showMatch), next: page.donnees.next };
}

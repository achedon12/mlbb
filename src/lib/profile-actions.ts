"use server";

import { ID } from "./player-api";
import { pageMatches } from "./mlbb-auth";
import { showMatch, type MatchShown } from "./player-profile";
import { closeSession, tokenCurrent } from "./session";

/**
 * Next matches of the player profile.
 *
 * The browser only sends the season and the pagination cursor; the token
 * stays in its httpOnly cookie, read here, server-side. Matches are sent back
 * already formatted — site sheet, portrait — and nothing more than what the
 * page displays.
 */
export type RunMatches =
  | { state: "ok"; matches: MatchShown[]; next: string | null }
  | { state: "expired" }
  | { state: "unavailable" };

export async function nextMatches(season: number, cursor: string): Promise<RunMatches> {
  // Inputs from the browser: nothing goes to the service unchecked.
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

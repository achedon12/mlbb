import { profile, seasonHeroes, seasons, statistics, type Result } from "@/lib/mlbb-auth";
import { buildSnapshot, keepFigures, type ProfileSnapshot } from "./snapshot";

/**
 * Reads the signed-in player's card figures from the game's services, with
 * the token of this request: the profile (always online), then the latest
 * season's heroes and the all-seasons statistics (often down: the card then
 * keeps what was readable, and the figures of `previous` when none was).
 */
export async function readCardFigures(token: string, previous: ProfileSnapshot | null = null): Promise<Result<ProfileSnapshot>> {
  const [me, list, stats] = await Promise.all([profile(token), seasons(token), statistics(token)]);
  if (me.status !== "ok") return me;
  if (list.status === "expired" || stats.status === "expired") return { status: "expired" };

  const sids = list.status === "ok" && list.data.length ? list.data : stats.status === "ok" ? stats.data.seasons : [];
  const season = sids[0] ?? null;
  const heroes = season !== null ? await seasonHeroes(token, season) : null;
  if (heroes?.status === "expired") return { status: "expired" };

  const snapshot = buildSnapshot({
    profile: me.data,
    season,
    heroes: heroes?.status === "ok" ? heroes.data : null,
    stats: stats.status === "ok" ? stats.data : null,
  });
  if (!snapshot) return { status: "unavailable" };
  // Statistics often down: the figures last read stand, rather than zeros.
  const figuresRead = heroes?.status === "ok" || stats.status === "ok";
  return { status: "ok", data: figuresRead || !previous ? snapshot : keepFigures(snapshot, previous) };
}

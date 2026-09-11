import { NextResponse } from "next/server";
import { codeCatalog } from "@/lib/build-catalog";
import { SORT_ORDERS, sortBuilds, toPublic, validatePublication, type SortOrder } from "@/lib/community-builds";
import { NO_STORE, allowPublish, currentPlayer, guardMutation, refuse, viewerId } from "@/lib/community-builds-server";
import { StorageError, listBuilds, publishBuild } from "@/lib/community-builds-store";
import { journaliser, journaliserErreur } from "@/lib/journal";

/**
 * Community builds.
 *
 * - GET, anyone: `?hero=<slug>` (optional), `sort=votes|recent|week`
 *   (default `votes`), `limit` 1-50 (default 20), `offset` (default 0).
 *   Answers `{ builds: PublicBuild[], total }`; `voted` and `own` are only
 *   true for a signed-in viewer.
 * - POST, signed-in players: `{ title, notes?, build: { hero, level, items,
 *   emblem, talents, spell } }`. Answers 201 `{ id, hero }`.
 *
 * Refusals: 400 invalid query or body (`error` says which field), 401 not
 * signed in, 403 other origin, 413/415 body, 429 rate or daily cap, 503
 * storage or login service unavailable.
 */
export const dynamic = "force-dynamic";

const intParam = (value: string | null, fallback: number, min: number, max: number): number | null => {
  if (value === null) return fallback;
  if (!/^\d{1,6}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hero = params.get("hero");
  if (hero !== null && !codeCatalog.heroes.has(hero)) return refuse(400, "unknown hero");
  const sort = (params.get("sort") ?? "votes") as SortOrder;
  if (!SORT_ORDERS.includes(sort)) return refuse(400, "unknown sort");
  const limit = intParam(params.get("limit"), 20, 1, 50);
  const offset = intParam(params.get("offset"), 0, 0, 100_000);
  if (limit === null || offset === null) return refuse(400, "invalid paging");

  try {
    const [builds, viewer] = await Promise.all([listBuilds(), viewerId()]);
    const now = Date.now();
    const matching = hero ? builds.filter((b) => b.build.hero === hero) : builds;
    const page = sortBuilds(matching, sort, now).slice(offset, offset + limit);
    return NextResponse.json(
      { builds: page.map((b) => toPublic(b, viewer, now)), total: matching.length },
      { headers: NO_STORE },
    );
  } catch (error) {
    await journaliserErreur("community builds: listing failed", error);
    return refuse(503, "storage unavailable");
  }
}

export async function POST(request: Request) {
  const guarded = await guardMutation(request, true);
  if (guarded instanceof NextResponse) return guarded;

  const player = await currentPlayer().catch(() => ({ status: "unavailable" as const }));
  if (player.status === "none") return refuse(401, "sign in required");
  if (player.status !== "ok") return refuse(503, "login service unavailable");
  if (!allowPublish(player.id)) return refuse(429, "too many requests");

  const publication = validatePublication(guarded.body, codeCatalog);
  if (!publication.ok) return refuse(400, publication.error);

  try {
    const result = await publishBuild(publication.value, { id: player.id, name: player.name });
    if (!result.ok) return refuse(result.reason === "full" ? 503 : 429, result.reason);
    await journaliser("info", "community build published", {
      id: result.build.id,
      hero: result.build.build.hero,
      author: player.id,
    });
    return NextResponse.json({ id: result.build.id, hero: result.build.build.hero }, { status: 201, headers: NO_STORE });
  } catch (error) {
    await journaliserErreur("community builds: publication failed", error, { storage: error instanceof StorageError });
    return refuse(503, "storage unavailable");
  }
}

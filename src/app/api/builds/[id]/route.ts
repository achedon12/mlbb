import { NextResponse } from "next/server";
import { BUILD_ID, toPublic } from "@/lib/community-builds";
import { NO_STORE, currentPlayer, guardMutation, isAdmin, refuse, viewerId } from "@/lib/community-builds-server";
import { deleteBuild, getBuild } from "@/lib/community-builds-store";
import { journaliser, journaliserErreur } from "@/lib/journal";

/**
 * One community build.
 *
 * - GET, anyone: the `PublicBuild`, or 404.
 * - DELETE: by its author (game session), or by the administrator with
 *   `Authorization: Bearer <BUILDS_ADMIN_TOKEN>`. 204 on success, 401 not
 *   signed in, 403 someone else's build or other origin, 404 unknown.
 */
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!BUILD_ID.test(id)) return refuse(404, "unknown build");
  try {
    const [build, viewer] = await Promise.all([getBuild(id), viewerId()]);
    if (!build) return refuse(404, "unknown build");
    return NextResponse.json(toPublic(build, viewer, Date.now()), { headers: NO_STORE });
  } catch (error) {
    await journaliserErreur("community builds: reading failed", error, { id });
    return refuse(503, "storage unavailable");
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const guarded = await guardMutation(request, false);
  if (guarded instanceof NextResponse) return guarded;
  const { id } = await params;
  if (!BUILD_ID.test(id)) return refuse(404, "unknown build");

  const admin = isAdmin(request);
  let authorId: string | null = null;
  if (!admin) {
    if (request.headers.has("authorization")) {
      await journaliser("avertissement", "community builds: admin token refused", { id });
      return refuse(403, "invalid token");
    }
    const player = await currentPlayer().catch(() => ({ status: "unavailable" as const }));
    if (player.status === "none") return refuse(401, "sign in required");
    if (player.status !== "ok") return refuse(503, "login service unavailable");
    authorId = player.id;
  }

  try {
    const result = await deleteBuild(id, { authorId, admin });
    if (result === "unknown") return refuse(404, "unknown build");
    if (result === "forbidden") return refuse(403, "not your build");
    await journaliser("info", "community build deleted", { id, by: admin ? "admin" : authorId });
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    await journaliserErreur("community builds: deletion failed", error, { id });
    return refuse(503, "storage unavailable");
  }
}

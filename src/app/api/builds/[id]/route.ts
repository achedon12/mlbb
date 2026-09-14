import { NextResponse } from "next/server";
import { BUILD_ID, toPublic } from "@/lib/community-builds";
import { NO_STORE, currentPlayer, guardMutation, isAdmin, refused, viewerId } from "@/lib/community-builds-server";
import { deleteBuild, getBuild } from "@/lib/community-builds-store";
import { log, logError } from "@/lib/log";

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
  if (!BUILD_ID.test(id)) return refused(404, "unknown build");
  try {
    const [build, viewer] = await Promise.all([getBuild(id), viewerId()]);
    if (!build) return refused(404, "unknown build");
    return NextResponse.json(toPublic(build, viewer, Date.now()), { headers: NO_STORE });
  } catch (error) {
    await logError("community builds: reading failed", error, { id });
    return refused(503, "storage unavailable");
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const guarded = await guardMutation(request, false);
  if (guarded instanceof NextResponse) return guarded;
  const { id } = await params;
  if (!BUILD_ID.test(id)) return refused(404, "unknown build");

  const admin = isAdmin(request);
  let authorId: string | null = null;
  if (!admin) {
    if (request.headers.has("authorization")) {
      await log("warning", "community builds: admin token refused", { id });
      return refused(403, "invalid token");
    }
    const player = await currentPlayer().catch(() => ({ status: "unavailable" as const }));
    if (player.status === "none") return refused(401, "sign in required");
    if (player.status !== "ok") return refused(503, "login service unavailable");
    authorId = player.id;
  }

  try {
    const result = await deleteBuild(id, { authorId, admin });
    if (result === "unknown") return refused(404, "unknown build");
    if (result === "forbidden") return refused(403, "not your build");
    await log("info", "community build deleted", { id, by: admin ? "admin" : authorId });
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    await logError("community builds: deletion failed", error, { id });
    return refused(503, "storage unavailable");
  }
}

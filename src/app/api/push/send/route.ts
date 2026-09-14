import { NextResponse } from "next/server";
import { patchDetails } from "@/lib/data";
import { log, logError } from "@/lib/log";
import { addressOf, configPush, triggerManually, limitByMinute, sameSecret } from "@/lib/push-server";
import { recentPatches } from "@/lib/patch-tracking";

/**
 * Manual trigger of patch notifications, to try out the pipeline.
 *
 * Protected by the `PUSH_ADMIN_TOKEN` token (`Authorization: Bearer` header);
 * without a configured token, the route does not exist. Optional JSON body:
 *
 * - `version`: target patch (by default, the latest);
 * - `send`: `true` to send — otherwise a mere dry run, which returns the
 *   number of recipients and a preview of the messages;
 * - `target`: subscriber id (read from a dry run) to send to that subscriber
 *   only, without touching the last notified patch;
 * - `force`: send an already notified patch to everyone again.
 *
 * The former French names (`envoyer`, `cible`, `forcer`) are still read, so
 * that existing admin commands keep working.
 */
export const dynamic = "force-dynamic";

const allowed = limitByMinute(10);
const WITHOUT_CACHE = { "Cache-Control": "no-store" };
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: WITHOUT_CACHE });

export async function POST(request: Request) {
  const token = process.env.PUSH_ADMIN_TOKEN?.trim() ?? "";
  if (token.length < 24 || !configPush()) return new NextResponse(null, { status: 404 });
  const address = addressOf(request);
  if (!allowed(address)) return response({ error: "too many requests" }, 429);

  const provided = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!sameSecret(provided, token)) {
    await log("warning", "notifications: admin token refused", { address });
    return response({ error: "invalid token" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.length > 1_000) return response({ error: "body too large" }, 413);
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return response({ error: "invalid JSON" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return response({ error: "object expected" }, 400);

  const { version } = body;
  const send = body.send ?? body.envoyer;
  const target = body.target ?? body.cible;
  const force = body.force ?? body.forcer;
  if (version !== undefined && (typeof version !== "string" || !Object.hasOwn(patchDetails, version))) {
    return response({ error: "unknown version" }, 400);
  }
  if (target !== undefined && (typeof target !== "string" || !/^[0-9a-f]{12}$/.test(target))) {
    return response({ error: "invalid target" }, 400);
  }
  const patch = version ? patchDetails[version] : recentPatches[0];
  if (!patch) return response({ error: "no patch" }, 404);

  try {
    const issue = await triggerManually(patch, {
      send: send === true,
      target: target as string | undefined,
      force: force === true,
    });
    return response(issue, issue.action === "refused" ? 409 : 200);
  } catch (error) {
    await logError("notifications: manual trigger failed", error, { version: patch.version });
    return response({ error: "failed, see the log" }, 500);
  }
}

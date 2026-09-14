import { NextResponse } from "next/server";
import { heroesBySlug } from "@/lib/data-client";
import { logError } from "@/lib/log";
import { SIZE_MAX_BODY, validateRequest, type PushRequest } from "@/lib/push";
import {
  addressOf,
  configPush,
  saveSubscriber,
  limitByMinute,
  majSubscriber,
  deleteSubscriber,
} from "@/lib/push-server";

/**
 * Subscription to patch notifications.
 *
 * - POST: subscribes this browser (subscription, language, favorites);
 * - PATCH: updates its favorites;
 * - DELETE: unsubscribes it.
 *
 * Every request carries the full subscription (`PushSubscription.toJSON()`):
 * changing or deleting it requires its `auth` secret, which only the
 * subscribed browser knows. The route is public: capped body, favorites limited
 * to the catalog, endpoint limited to known push services, and at most twenty
 * requests per minute per IP address.
 */
export const dynamic = "force-dynamic";

const SLUGS = new Set(Object.keys(heroesBySlug));
const allowed = limitByMinute(20);
const WITHOUT_CACHE = { "Cache-Control": "no-store" };

const refusal = (status: number, error: string) => NextResponse.json({ erreur: error }, { status, headers: WITHOUT_CACHE });

async function readRequest<K extends PushRequest["type"]>(
  request: Request,
  type: K,
): Promise<Extract<PushRequest, { type: K }> | NextResponse> {
  if (!configPush()) return refusal(404, "notifications desactivees");
  if (!allowed(addressOf(request))) return refusal(429, "too many requests");
  // A form on another site cannot send JSON without a CORS preflight
  // request, which this route does not accept.
  if (request.headers.get("sec-fetch-site") === "cross-site") return refusal(403, "origine refusee");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return refusal(415, "JSON attendu");
  }
  if (Number(request.headers.get("content-length") ?? 0) > SIZE_MAX_BODY) return refusal(413, "body too large");
  const raw = await request.text();
  if (raw.length > SIZE_MAX_BODY) return refusal(413, "body too large");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refusal(400, "invalid JSON");
  }
  const pushRequest = validateRequest(type, body, SLUGS);
  if (!pushRequest || pushRequest.type !== type) return refusal(400, "invalid request");
  return pushRequest as Extract<PushRequest, { type: K }>;
}

async function storage(action: string, task: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await task();
  } catch (error) {
    await logError(`notifications: ${action} failed`, error);
    return refusal(503, "stockage indisponible");
  }
}

export async function POST(request: Request) {
  const pushRequest = await readRequest(request, "subscribe");
  if (pushRequest instanceof NextResponse) return pushRequest;
  return storage("subscription", async () => {
    const issue = await saveSubscriber(pushRequest.abonnement, pushRequest.langue, pushRequest.favoris);
    if (issue === "full") return refusal(503, "trop d'abonnements");
    return NextResponse.json({ etat: issue }, { status: issue === "created" ? 201 : 200, headers: WITHOUT_CACHE });
  });
}

export async function PATCH(request: Request) {
  const pushRequest = await readRequest(request, "update");
  if (pushRequest instanceof NextResponse) return pushRequest;
  return storage("update", async () => {
    const issue = await majSubscriber(pushRequest.abonnement, pushRequest.favoris, pushRequest.langue);
    // 404: the browser subscribes again (subscription deleted server-side in the meantime).
    return issue === "unknown" ? refusal(404, "unknown subscription") : new NextResponse(null, { status: 204 });
  });
}

export async function DELETE(request: Request) {
  const pushRequest = await readRequest(request, "unsubscribe");
  if (pushRequest instanceof NextResponse) return pushRequest;
  return storage("unsubscription", async () => {
    // Same response whether the subscription existed or not: deletion is idempotent.
    await deleteSubscriber(pushRequest.abonnement);
    return new NextResponse(null, { status: 204 });
  });
}

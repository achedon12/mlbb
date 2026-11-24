import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { logError } from "@/lib/log";
import { SIZE_MAX_BODY, subscriptionValid } from "@/lib/push";
import { addressOf, configPush, limitByMinute } from "@/lib/push-server";
import { deleteReminder, saveReminder } from "@/lib/reminder-server";
import { isRemindable } from "@/lib/reminders";

/**
 * A month reminder by push notification.
 *
 * - POST `{ abonnement, langue, mois }`: this browser is told when the month opens;
 * - DELETE `{ abonnement, mois }`: the reminder is cancelled.
 *
 * Same guards as the patch subscription route: capped body, JSON only (no
 * cross-site form), endpoint limited to known push services, twenty requests
 * per minute per address. On top: five creations a minute per address, and
 * the storage caps of `admitReminder` (per endpoint, per address, per month).
 * Cancelling needs the subscription's `auth` secret.
 */
export const dynamic = "force-dynamic";

const allowed = limitByMinute(20);
/** Creations on their own: a handful a minute is plenty for one person setting reminders. */
const creations = limitByMinute(5);
const WITHOUT_CACHE = { "Cache-Control": "no-store" };
const refusal = (status: number, error: string) => NextResponse.json({ error }, { status, headers: WITHOUT_CACHE });

async function readBody(request: Request) {
  if (!configPush()) return refusal(404, "notifications disabled");
  if (!allowed(addressOf(request))) return refusal(429, "too many requests");
  if (request.headers.get("sec-fetch-site") === "cross-site") return refusal(403, "origin refused");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return refusal(415, "JSON expected");
  const raw = await request.text();
  if (raw.length > SIZE_MAX_BODY) return refusal(413, "body too large");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refusal(400, "invalid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return refusal(400, "invalid request");
  const { abonnement, langue, mois } = body as Record<string, unknown>;
  const subscription = subscriptionValid(abonnement);
  if (!subscription || typeof mois !== "string" || !/^\d{4}-\d{2}$/.test(mois)) return refusal(400, "invalid request");
  return { subscription, langue, mois };
}

export async function POST(request: Request) {
  const read = await readBody(request);
  if (read instanceof NextResponse) return read;
  const { subscription, langue, mois } = read;
  if (typeof langue !== "string" || !isLocale(langue)) return refusal(400, "invalid request");
  if (!isRemindable(mois, Date.now())) return refusal(409, "month already open");
  const address = addressOf(request);
  if (!creations(address)) return refusal(429, "too many reminders from this address");
  try {
    const issue = await saveReminder(subscription, langue, mois, address);
    if (issue === "invalid") return refusal(400, "invalid request");
    if (issue === "limited") return refusal(429, "too many reminders from this address");
    if (issue === "full") return refusal(503, "too many reminders");
    if (issue === "past") return refusal(409, "month already open");
    return NextResponse.json({ state: issue }, { status: issue === "created" ? 201 : 200, headers: WITHOUT_CACHE });
  } catch (error) {
    await logError("notifications: month reminder failed", error);
    return refusal(503, "storage unavailable");
  }
}

export async function DELETE(request: Request) {
  const read = await readBody(request);
  if (read instanceof NextResponse) return read;
  try {
    await deleteReminder(read.subscription, read.mois);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await logError("notifications: month reminder cancel failed", error);
    return refusal(503, "storage unavailable");
  }
}

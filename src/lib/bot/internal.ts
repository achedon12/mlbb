import { NextResponse } from "next/server";
import type { z } from "zod";
import { log, logError } from "@/lib/log";
import { readCapped } from "@/lib/read-body";
import { addressOf, limitByMinute } from "@/lib/push-server";
import { botConfig, type BotConfig } from "./config";
import { HEADER_SIGNATURE, HEADER_TIMESTAMP, ReplayGuard, signedPath, verify } from "./signature";

/**
 * Gate of the internal API (`/api/bot/*`), called by the bot only.
 *
 * In order: 404 when the bot is not configured (the routes do not exist for
 * a site without it), rate limit, body cap (declared length, then the stream
 * itself, before anything is parsed), signature over the raw body, then JSON
 * and zod validation. A route handler only sees a request that went through
 * every step.
 *
 * Every signature failure (missing, malformed, stale, forged, replayed)
 * answers the same 401: a caller without the secret learns nothing about
 * which check it failed. The reason goes to the log, without the headers.
 */

export const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export const refusal = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });
export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

/** The bot batches its calls: a generous ceiling, still a ceiling. */
const allowed = limitByMinute(600);
const guard = new ReplayGuard();

export const MAX_INTERNAL_BODY = 256 * 1024;

type Gate<T> = { config: BotConfig; body: T; url: URL } | NextResponse;

export async function readSigned<S extends z.ZodType>(
  request: Request,
  schema: S | null,
  maxBody = MAX_INTERNAL_BODY,
  config: BotConfig | null = botConfig(),
): Promise<Gate<z.infer<S>>> {
  if (!config) return refusal(404, "not found");
  if (!allowed(addressOf(request))) return refusal(429, "too many requests");
  const raw = request.method === "GET" || request.method === "HEAD" ? "" : await readCapped(request, maxBody);
  if (raw === null) return refusal(413, "body too large");

  const url = new URL(request.url);
  const verdict = verify({
    secret: config.apiSecret,
    method: request.method,
    path: signedPath(url),
    body: raw,
    timestamp: request.headers.get(HEADER_TIMESTAMP),
    signature: request.headers.get(HEADER_SIGNATURE),
    guard,
  });
  if (!verdict.ok) {
    void log("warning", "discord bot: internal call refused", { reason: verdict.reason, path: url.pathname });
    return refusal(401, "unauthorized");
  }

  if (!schema) return { config, body: undefined as z.infer<S>, url };
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    return refusal(400, "invalid request");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return refusal(400, "invalid request");
  return { config, body: parsed.data, url };
}

/** Runs a database task, turning a failure into a logged 503. */
export async function withDatabase(action: string, task: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await task();
  } catch (error) {
    await logError(`discord bot: ${action} failed`, error);
    return refusal(503, "storage unavailable");
  }
}

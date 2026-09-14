import { NextResponse } from "next/server";
import { log } from "@/lib/log";

/**
 * Intake of errors raised in the browser.
 *
 * Error boundaries and the global reporter (src/components/
 * error-reporter.tsx) post the message, the stack and the path to it: client
 * incidents thus land in the same log as server incidents, rather than
 * staying in the visitor's console alone.
 *
 * The route is public: an oversized body is ignored, and a single address
 * cannot send more than thirty reports per minute, so that a malicious
 * script or an error loop does not fill the disk.
 */
const SIZE_MAX = 8_000;
const BY_MINUTE = 30;
const sends = new Map<string, { start: number; count: number }>();

function allowed(address: string): boolean {
  const now = Date.now();
  const tracking = sends.get(address);
  if (!tracking || now - tracking.start > 60_000) {
    // The table only keeps the current minute: it is cleared when it grows.
    if (sends.size > 5_000) sends.clear();
    sends.set(address, { start: now, count: 1 });
    return true;
  }
  tracking.count += 1;
  return tracking.count <= BY_MINUTE;
}

const text = (value: unknown, max: number) => (value == null ? undefined : String(value).slice(0, max));

export async function POST(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowed(address)) return new NextResponse(null, { status: 429 });

  try {
    const raw = await request.text();
    if (raw.length > SIZE_MAX) return new NextResponse(null, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    // `pile`, `chemin` and type "globale" are the former French names: a page
    // loaded before the rename may still send them.
    const type = text(body.type, 20);
    await log("error", "browser error", {
      source: "client",
      type: type === "globale" ? "global" : (type ?? "boundary"),
      message: text(body.message, 500) ?? "",
      path: text(body.path ?? body.chemin, 300) ?? "",
      digest: text(body.digest, 100),
      stack: text(body.stack ?? body.pile, 2000),
      version: text(body.version, 20),
      browser: text(request.headers.get("user-agent"), 200),
    });
  } catch {
    // A malformed report must not break anything.
  }
  return new NextResponse(null, { status: 204 });
}

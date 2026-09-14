import { NextResponse } from "next/server";
import { configPush } from "@/lib/push-server";

/**
 * Public VAPID key for patch notifications.
 *
 * Read at runtime rather than frozen at build time (`NEXT_PUBLIC_…`): the keys
 * are set on the server, without rebuilding the image. `key: null` means the
 * feature is disabled — the interface then hides it.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ key: configPush()?.publicKey ?? null }, { headers: { "Cache-Control": "no-store" } });
}

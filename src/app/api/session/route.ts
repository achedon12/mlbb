import { NextResponse } from "next/server";
import { profileCurrent } from "@/lib/session";

/**
 * Session state for the header.
 *
 * Read after rendering, which leaves content pages generated at build time.
 * Only returns the nickname: the header needs nothing else.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await profileCurrent().catch(() => null);

  return NextResponse.json(
    profile ? { connected: true, pseudo: profile.name } : { connected: false },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

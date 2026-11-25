import { NextResponse } from "next/server";
import { supportLinks } from "@/lib/support";

/**
 * Donation links (`lib/support.ts`), read from the environment at request
 * time: changing `SUPPORT_KOFI_URL` / `SUPPORT_PAYPAL_URL` in the server's
 * `.env` and recreating the container applies it, without a rebuild. The
 * browser keeps the answer five minutes, so a change shows up within that.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ links: supportLinks() }, { headers: { "Cache-Control": "private, max-age=300" } });
}

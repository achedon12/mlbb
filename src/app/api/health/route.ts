import { NextResponse } from "next/server";

/** Health probe called by the container's HEALTHCHECK. */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}

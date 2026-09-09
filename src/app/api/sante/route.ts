import { NextResponse } from "next/server";

/** Sonde de sante appelee par le HEALTHCHECK du conteneur. */
export function GET() {
  return NextResponse.json({ etat: "ok" }, { headers: { "Cache-Control": "no-store" } });
}

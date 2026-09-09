import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Sonde de sante, appelee par le HEALTHCHECK du conteneur.
 *
 * Elle touche reellement la base : un serveur qui repond mais dont le volume
 * n'est pas monte n'est pas en bonne sante, et doit etre signale comme tel.
 */
export const dynamic = "force-dynamic";

export function GET() {
  try {
    db().prepare("SELECT 1").get();
    return NextResponse.json({ etat: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ etat: "degrade" }, { status: 503 });
  }
}

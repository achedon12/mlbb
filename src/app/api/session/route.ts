import { NextResponse } from "next/server";
import { profileCurrent } from "@/lib/session";

/**
 * Etat de session pour l'en-tete.
 *
 * Lu apres l'affichage, ce qui laisse les pages de contenu generees au build.
 * Ne renvoie que le pseudo : l'en-tete n'a besoin de rien d'autre.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await profileCurrent().catch(() => null);

  return NextResponse.json(
    profile ? { connecte: true, pseudo: profile.name } : { connecte: false },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

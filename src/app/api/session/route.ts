import { NextResponse } from "next/server";
import { profilCourant } from "@/lib/session";

/**
 * Etat de session pour l'en-tete.
 *
 * Lu apres l'affichage, ce qui laisse les pages de contenu generees au build.
 * Ne renvoie que le pseudo : l'en-tete n'a besoin de rien d'autre.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const profil = await profilCourant().catch(() => null);

  return NextResponse.json(
    profil ? { connecte: true, pseudo: profil.name } : { connecte: false },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

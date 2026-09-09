import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";

/**
 * Etat de session, consomme par l'en-tete.
 *
 * L'en-tete est present sur toutes les pages. S'il lisait le cookie sur le
 * serveur, plus aucune page du site ne pourrait etre generee au build — ce qui
 * couterait cher sur un site dont l'essentiel du contenu est statique. Le
 * cookie est donc lu ici, apres l'affichage.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const utilisateur = await utilisateurCourant().catch(() => null);

  return NextResponse.json(
    utilisateur ? { connecte: true, pseudo: utilisateur.pseudo } : { connecte: false },
    // Strictement personnel : ne doit jamais etre mis en cache par un
    // intermediaire partage.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

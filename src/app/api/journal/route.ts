import { NextResponse } from "next/server";
import { journaliser } from "@/lib/journal";

/**
 * Reception des erreurs survenues cote navigateur.
 *
 * Les frontieres d'erreur y postent le message et le chemin : les incidents
 * clients rejoignent ainsi le meme journal que les incidents serveur, plutot
 * que de rester dans la seule console du visiteur.
 */
export async function POST(requete: Request) {
  try {
    const corps = (await requete.json()) as {
      message?: unknown;
      chemin?: unknown;
      digest?: unknown;
    };
    await journaliser("erreur", "erreur navigateur", {
      source: "client",
      message: String(corps.message ?? "").slice(0, 500),
      chemin: String(corps.chemin ?? "").slice(0, 300),
      digest: corps.digest ? String(corps.digest).slice(0, 100) : undefined,
    });
  } catch {
    // Un rapport malforme ne doit rien casser.
  }
  return new NextResponse(null, { status: 204 });
}

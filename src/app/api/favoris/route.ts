import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { db } from "@/lib/db";
import { rosterParSlug } from "@/data/roster";

/**
 * Favoris.
 *
 * Les fiches heros sont generees au build : elles ne peuvent donc pas lire la
 * session. Le bouton de favori interroge cette route apres l'affichage, ce qui
 * garde la page statique tout en restant personnalise.
 */
export const dynamic = "force-dynamic";

export async function GET(requete: Request) {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) return NextResponse.json({ connecte: false, favori: false });

  const heros = new URL(requete.url).searchParams.get("heros");
  if (!heros) return NextResponse.json({ connecte: true, favori: false });

  const present = db()
    .prepare("SELECT 1 FROM favoris WHERE utilisateur_id = ? AND heros = ?")
    .get(utilisateur.id, heros);

  return NextResponse.json({ connecte: true, favori: Boolean(present) });
}

export async function POST(requete: Request) {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) {
    return NextResponse.json({ erreur: "Non connecte" }, { status: 401 });
  }

  const { heros } = (await requete.json()) as { heros?: string };
  // On n'accepte qu'un slug present au roster : la table ne doit pas se remplir
  // de valeurs arbitraires envoyees par un client.
  if (!heros || !rosterParSlug.has(heros)) {
    return NextResponse.json({ erreur: "Heros inconnu" }, { status: 400 });
  }

  const base = db();
  const present = base
    .prepare("SELECT 1 FROM favoris WHERE utilisateur_id = ? AND heros = ?")
    .get(utilisateur.id, heros);

  if (present) {
    base.prepare("DELETE FROM favoris WHERE utilisateur_id = ? AND heros = ?").run(utilisateur.id, heros);
  } else {
    base.prepare("INSERT INTO favoris (utilisateur_id, heros) VALUES (?, ?)").run(utilisateur.id, heros);
  }

  return NextResponse.json({ favori: !present });
}

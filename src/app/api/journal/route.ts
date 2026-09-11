import { NextResponse } from "next/server";
import { journaliser } from "@/lib/journal";

/**
 * Reception des erreurs survenues cote navigateur.
 *
 * Les frontieres d'erreur et le rapporteur global (src/components/
 * rapport-erreurs.tsx) y postent le message, la pile et le chemin : les
 * incidents clients rejoignent ainsi le meme journal que les incidents
 * serveur, plutot que de rester dans la seule console du visiteur.
 *
 * La route est publique : un corps trop gros est ignore, et une meme adresse
 * ne peut pas envoyer plus de trente rapports par minute, pour qu'un script
 * malveillant ou une boucle d'erreurs ne remplisse pas le disque.
 */
const TAILLE_MAX = 8_000;
const PAR_MINUTE = 30;
const envois = new Map<string, { debut: number; nombre: number }>();

function autorise(adresse: string): boolean {
  const maintenant = Date.now();
  const suivi = envois.get(adresse);
  if (!suivi || maintenant - suivi.debut > 60_000) {
    // La table ne garde que la minute en cours : on la vide quand elle grossit.
    if (envois.size > 5_000) envois.clear();
    envois.set(adresse, { debut: maintenant, nombre: 1 });
    return true;
  }
  suivi.nombre += 1;
  return suivi.nombre <= PAR_MINUTE;
}

const texte = (valeur: unknown, max: number) => (valeur == null ? undefined : String(valeur).slice(0, max));

export async function POST(requete: Request) {
  const adresse = requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (!autorise(adresse)) return new NextResponse(null, { status: 429 });

  try {
    const brut = await requete.text();
    if (brut.length > TAILLE_MAX) return new NextResponse(null, { status: 413 });
    const corps = JSON.parse(brut) as Record<string, unknown>;
    await journaliser("erreur", "erreur navigateur", {
      source: "client",
      type: texte(corps.type, 20) ?? "frontiere",
      message: texte(corps.message, 500) ?? "",
      chemin: texte(corps.chemin, 300) ?? "",
      digest: texte(corps.digest, 100),
      pile: texte(corps.pile, 2000),
      version: texte(corps.version, 20),
      navigateur: texte(requete.headers.get("user-agent"), 200),
    });
  } catch {
    // Un rapport malforme ne doit rien casser.
  }
  return new NextResponse(null, { status: 204 });
}

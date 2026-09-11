import { NextResponse } from "next/server";
import { herosParSlug } from "@/lib/donnees-client";
import { journaliserErreur } from "@/lib/journal";
import { TAILLE_MAX_CORPS, validerDemande, type DemandePush } from "@/lib/push";
import {
  adresseDe,
  configPush,
  enregistrerAbonne,
  limiteurParMinute,
  majAbonne,
  supprimerAbonne,
} from "@/lib/push-serveur";

/**
 * Abonnement aux notifications de patch.
 *
 * - POST : abonne ce navigateur (abonnement, langue, favoris) ;
 * - PATCH : met a jour ses favoris ;
 * - DELETE : le desabonne.
 *
 * Chaque requete porte l'abonnement complet (`PushSubscription.toJSON()`) :
 * modifier ou supprimer exige son secret `auth`, que seul le navigateur
 * abonne connait. La route est publique : corps plafonne, favoris limites au
 * catalogue, adresse limitee aux services de notification connus, et vingt
 * requetes par minute et par adresse IP au plus.
 */
export const dynamic = "force-dynamic";

const SLUGS = new Set(Object.keys(herosParSlug));
const autorise = limiteurParMinute(20);
const SANS_CACHE = { "Cache-Control": "no-store" };

const refus = (status: number, erreur: string) => NextResponse.json({ erreur }, { status, headers: SANS_CACHE });

async function lireDemande<K extends DemandePush["type"]>(
  requete: Request,
  type: K,
): Promise<Extract<DemandePush, { type: K }> | NextResponse> {
  if (!configPush()) return refus(404, "notifications desactivees");
  if (!autorise(adresseDe(requete))) return refus(429, "trop de requetes");
  // Un formulaire d'un autre site ne peut pas envoyer de JSON sans requete
  // preliminaire CORS, que cette route n'accepte pas.
  if (requete.headers.get("sec-fetch-site") === "cross-site") return refus(403, "origine refusee");
  if (!requete.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return refus(415, "JSON attendu");
  }
  if (Number(requete.headers.get("content-length") ?? 0) > TAILLE_MAX_CORPS) return refus(413, "corps trop gros");
  const brut = await requete.text();
  if (brut.length > TAILLE_MAX_CORPS) return refus(413, "corps trop gros");
  let corps: unknown;
  try {
    corps = JSON.parse(brut);
  } catch {
    return refus(400, "JSON invalide");
  }
  const demande = validerDemande(type, corps, SLUGS);
  if (!demande || demande.type !== type) return refus(400, "demande invalide");
  return demande as Extract<DemandePush, { type: K }>;
}

async function stockage(action: string, tache: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await tache();
  } catch (erreur) {
    await journaliserErreur(`notifications : echec de l'${action}`, erreur);
    return refus(503, "stockage indisponible");
  }
}

export async function POST(requete: Request) {
  const demande = await lireDemande(requete, "abonner");
  if (demande instanceof NextResponse) return demande;
  return stockage("abonnement", async () => {
    const issue = await enregistrerAbonne(demande.abonnement, demande.langue, demande.favoris);
    if (issue === "plein") return refus(503, "trop d'abonnements");
    return NextResponse.json({ etat: issue }, { status: issue === "cree" ? 201 : 200, headers: SANS_CACHE });
  });
}

export async function PATCH(requete: Request) {
  const demande = await lireDemande(requete, "maj");
  if (demande instanceof NextResponse) return demande;
  return stockage("mise a jour", async () => {
    const issue = await majAbonne(demande.abonnement, demande.favoris, demande.langue);
    // 404 : le navigateur se reabonne (abonnement efface cote serveur entre-temps).
    return issue === "inconnu" ? refus(404, "abonnement inconnu") : new NextResponse(null, { status: 204 });
  });
}

export async function DELETE(requete: Request) {
  const demande = await lireDemande(requete, "desabonner");
  if (demande instanceof NextResponse) return demande;
  return stockage("desinscription", async () => {
    // Meme reponse que l'abonnement ait existe ou non : la suppression est idempotente.
    await supprimerAbonne(demande.abonnement);
    return new NextResponse(null, { status: 204 });
  });
}

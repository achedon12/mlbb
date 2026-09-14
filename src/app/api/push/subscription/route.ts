import { NextResponse } from "next/server";
import { heroesBySlug } from "@/lib/data-client";
import { logError } from "@/lib/log";
import { SIZE_MAX_BODY, validateRequest, type PushRequest } from "@/lib/push";
import {
  addressOf,
  configPush,
  saveSubscriber,
  limitByMinute,
  majSubscriber,
  deleteSubscriber,
} from "@/lib/push-server";

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

const SLUGS = new Set(Object.keys(heroesBySlug));
const allowed = limitByMinute(20);
const WITHOUT_CACHE = { "Cache-Control": "no-store" };

const refusal = (status: number, error: string) => NextResponse.json({ erreur: error }, { status, headers: WITHOUT_CACHE });

async function readRequest<K extends PushRequest["type"]>(
  request: Request,
  type: K,
): Promise<Extract<PushRequest, { type: K }> | NextResponse> {
  if (!configPush()) return refusal(404, "notifications desactivees");
  if (!allowed(addressOf(request))) return refusal(429, "trop de requetes");
  // Un formulaire d'un autre site ne peut pas envoyer de JSON sans requete
  // preliminaire CORS, que cette route n'accepte pas.
  if (request.headers.get("sec-fetch-site") === "cross-site") return refusal(403, "origine refusee");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return refusal(415, "JSON attendu");
  }
  if (Number(request.headers.get("content-length") ?? 0) > SIZE_MAX_BODY) return refusal(413, "corps trop gros");
  const raw = await request.text();
  if (raw.length > SIZE_MAX_BODY) return refusal(413, "corps trop gros");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refusal(400, "JSON invalide");
  }
  const pushRequest = validateRequest(type, body, SLUGS);
  if (!pushRequest || pushRequest.type !== type) return refusal(400, "demande invalide");
  return pushRequest as Extract<PushRequest, { type: K }>;
}

async function storage(action: string, task: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await task();
  } catch (error) {
    await logError(`notifications : echec de l'${action}`, error);
    return refusal(503, "stockage indisponible");
  }
}

export async function POST(request: Request) {
  const pushRequest = await readRequest(request, "subscribe");
  if (pushRequest instanceof NextResponse) return pushRequest;
  return storage("abonnement", async () => {
    const issue = await saveSubscriber(pushRequest.abonnement, pushRequest.langue, pushRequest.favoris);
    if (issue === "full") return refusal(503, "trop d'abonnements");
    return NextResponse.json({ etat: issue }, { status: issue === "created" ? 201 : 200, headers: WITHOUT_CACHE });
  });
}

export async function PATCH(request: Request) {
  const pushRequest = await readRequest(request, "update");
  if (pushRequest instanceof NextResponse) return pushRequest;
  return storage("mise a jour", async () => {
    const issue = await majSubscriber(pushRequest.abonnement, pushRequest.favoris, pushRequest.langue);
    // 404 : le navigateur se reabonne (abonnement efface cote serveur entre-temps).
    return issue === "unknown" ? refusal(404, "abonnement inconnu") : new NextResponse(null, { status: 204 });
  });
}

export async function DELETE(request: Request) {
  const pushRequest = await readRequest(request, "unsubscribe");
  if (pushRequest instanceof NextResponse) return pushRequest;
  return storage("desinscription", async () => {
    // Meme reponse que l'abonnement ait existe ou non : la suppression est idempotente.
    await deleteSubscriber(pushRequest.abonnement);
    return new NextResponse(null, { status: 204 });
  });
}

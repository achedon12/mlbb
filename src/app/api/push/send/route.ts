import { NextResponse } from "next/server";
import { patchDetails } from "@/lib/data";
import { log, logError } from "@/lib/log";
import { addressOf, configPush, triggerManually, limitByMinute, sameSecret } from "@/lib/push-server";
import { recentPatches } from "@/lib/patch-tracking";

/**
 * Declenchement manuel des notifications de patch, pour essayer la chaine.
 *
 * Protegee par le jeton `PUSH_ADMIN_TOKEN` (en-tete `Authorization: Bearer`) ;
 * sans jeton configure, la route n'existe pas. Corps JSON facultatif :
 *
 * - `version` : patch vise (par defaut, le plus recent) ;
 * - `envoyer` : `true` pour envoyer — sinon simple simulation, qui renvoie le
 *   nombre de destinataires et un apercu des messages ;
 * - `cible` : identifiant d'abonne (lu dans une simulation) pour n'envoyer
 *   qu'a lui, sans toucher au dernier patch notifie ;
 * - `forcer` : renvoyer a tous un patch deja notifie.
 */
export const dynamic = "force-dynamic";

const allowed = limitByMinute(10);
const WITHOUT_CACHE = { "Cache-Control": "no-store" };
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: WITHOUT_CACHE });

export async function POST(request: Request) {
  const token = process.env.PUSH_ADMIN_TOKEN?.trim() ?? "";
  if (token.length < 24 || !configPush()) return new NextResponse(null, { status: 404 });
  const address = addressOf(request);
  if (!allowed(address)) return response({ erreur: "trop de requetes" }, 429);

  const provided = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!sameSecret(provided, token)) {
    await log("warning", "notifications : jeton d'administration refuse", { adresse: address });
    return response({ erreur: "jeton invalide" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.length > 1_000) return response({ erreur: "corps trop gros" }, 413);
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return response({ erreur: "JSON invalide" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return response({ erreur: "objet attendu" }, 400);

  const { version, envoyer: send, cible: target, forcer: force } = body;
  if (version !== undefined && (typeof version !== "string" || !Object.hasOwn(patchDetails, version))) {
    return response({ erreur: "version inconnue" }, 400);
  }
  if (target !== undefined && (typeof target !== "string" || !/^[0-9a-f]{12}$/.test(target))) {
    return response({ erreur: "cible invalide" }, 400);
  }
  const patch = version ? patchDetails[version] : recentPatches[0];
  if (!patch) return response({ erreur: "aucun patch" }, 404);

  try {
    const issue = await triggerManually(patch, {
      send: send === true,
      target: target as string | undefined,
      force: force === true,
    });
    return response(issue, issue.action === "refused" ? 409 : 200);
  } catch (error) {
    await logError("notifications : echec du declenchement manuel", error, { version: patch.version });
    return response({ erreur: "echec, voir le journal" }, 500);
  }
}

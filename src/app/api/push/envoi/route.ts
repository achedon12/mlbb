import { NextResponse } from "next/server";
import { patchsDetail } from "@/lib/donnees";
import { journaliser, journaliserErreur } from "@/lib/journal";
import { adresseDe, configPush, declencherManuellement, limiteurParMinute, memeSecret } from "@/lib/push-serveur";
import { patchsRecents } from "@/lib/suivi-patchs";

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

const autorise = limiteurParMinute(10);
const SANS_CACHE = { "Cache-Control": "no-store" };
const reponse = (corps: unknown, status = 200) => NextResponse.json(corps, { status, headers: SANS_CACHE });

export async function POST(requete: Request) {
  const jeton = process.env.PUSH_ADMIN_TOKEN?.trim() ?? "";
  if (jeton.length < 24 || !configPush()) return new NextResponse(null, { status: 404 });
  const adresse = adresseDe(requete);
  if (!autorise(adresse)) return reponse({ erreur: "trop de requetes" }, 429);

  const fourni = requete.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!memeSecret(fourni, jeton)) {
    await journaliser("avertissement", "notifications : jeton d'administration refuse", { adresse });
    return reponse({ erreur: "jeton invalide" }, 401);
  }

  let corps: Record<string, unknown> = {};
  try {
    const brut = await requete.text();
    if (brut.length > 1_000) return reponse({ erreur: "corps trop gros" }, 413);
    if (brut.trim()) corps = JSON.parse(brut) as Record<string, unknown>;
  } catch {
    return reponse({ erreur: "JSON invalide" }, 400);
  }
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return reponse({ erreur: "objet attendu" }, 400);

  const { version, envoyer, cible, forcer } = corps;
  if (version !== undefined && (typeof version !== "string" || !Object.hasOwn(patchsDetail, version))) {
    return reponse({ erreur: "version inconnue" }, 400);
  }
  if (cible !== undefined && (typeof cible !== "string" || !/^[0-9a-f]{12}$/.test(cible))) {
    return reponse({ erreur: "cible invalide" }, 400);
  }
  const patch = version ? patchsDetail[version] : patchsRecents[0];
  if (!patch) return reponse({ erreur: "aucun patch" }, 404);

  try {
    const issue = await declencherManuellement(patch, {
      envoyer: envoyer === true,
      cible: cible as string | undefined,
      forcer: forcer === true,
    });
    return reponse(issue, issue.action === "refuse" ? 409 : 200);
  } catch (erreur) {
    await journaliserErreur("notifications : echec du declenchement manuel", erreur, { version: patch.version });
    return reponse({ erreur: "echec, voir le journal" }, 500);
  }
}

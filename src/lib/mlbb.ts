import { randomUUID } from "node:crypto";

/**
 * Verification d'un identifiant de joueur.
 *
 * Moonton ne publie aucune API. Le seul point d'entree public est l'etape de
 * validation d'identifiant des plateformes de recharge : on lui envoie un
 * identifiant et un serveur, elle renvoie le pseudo du compte. C'est tout ce
 * qui est disponible — ni rang, ni statistiques, ni statut de connexion.
 *
 * Aucun paiement n'est declenche : cette route ne fait que valider, et la
 * reponse est jetee des que le pseudo en a ete extrait.
 *
 * La forme de la requete a ete relevee sur le formulaire de la plateforme
 * elle-meme. Elle n'est pas documentee et peut changer sans preavis : le code
 * journalise donc ce qu'il recoit quand une verification echoue, faute de quoi
 * une panne du service serait indiscernable d'un bug du site.
 */
const ENDPOINT = "https://order-sg.codashop.com/validate";

/** Identifiant de produit de la plateforme, prefixe compris. */
const PRODUIT = "9177-MOBILE_LEGENDS";

export type ResultatVerification =
  | { ok: true; pseudo: string }
  | { ok: false; raison: "introuvable" | "indisponible" };

export async function verifierIdentifiant(
  identifiant: string,
  serveur: string,
): Promise<ResultatVerification> {
  // Le jeu affiche l'identifiant sous la forme « 123456789 (2222) », et c'est
  // souvent tel quel qu'il est colle. Retirer tous les caracteres non
  // numeriques collerait les deux nombres bout a bout : on separe d'abord.
  const colle = identifiant.match(/^\s*(\d+)\s*\((\d+)\)\s*$/);
  const id = (colle ? colle[1] : identifiant).replace(/\D/g, "");
  const zone = (colle ? colle[2] : serveur).replace(/\D/g, "");

  if (!/^\d{5,15}$/.test(id) || !/^\d{3,8}$/.test(zone)) {
    return { ok: false, raison: "introuvable" };
  }

  try {
    const reponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Le service refuse les appels sans origine reconnue.
        Origin: "https://www.codashop.com",
        Referer: "https://www.codashop.com/",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      },
      body: JSON.stringify({
        country: "PH",
        voucherTypeName: PRODUIT,
        whiteLabelId: "0",
        // Le champ est attendu mais son contenu n'est pas verifie : on evite
        // d'envoyer un identifiant stable qui pisterait nos utilisateurs.
        deviceId: randomUUID(),
        userId: id,
        zoneId: zone,
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (!reponse.ok) {
      console.warn(`[mlbb] verification : HTTP ${reponse.status}`);
      return { ok: false, raison: "indisponible" };
    }

    const donnees = (await reponse.json()) as {
      result?: { username?: string };
      errorMsg?: string;
    };

    const pseudo = donnees.result?.username;
    if (typeof pseudo !== "string" || pseudo.length === 0) {
      // Un identifiant ou un serveur inconnu revient ici : c'est un refus du
      // service, pas une panne.
      console.warn(`[mlbb] identifiant refuse : ${donnees.errorMsg ?? "sans message"}`);
      return { ok: false, raison: "introuvable" };
    }

    return { ok: true, pseudo: decoder(pseudo) };
  } catch (erreur) {
    console.warn(`[mlbb] verification en echec : ${(erreur as Error).message}`);
    return { ok: false, raison: "indisponible" };
  }
}

/**
 * Decode le pseudo renvoye par le service.
 *
 * Il peut arriver encode — « Leo%20Roi » plutot que « Leo Roi ». Mais un
 * pseudo peut aussi contenir un « % » isole, que `decodeURIComponent` refuse
 * en levant une exception : sans ce garde-fou, un pseudo valide ferait echouer
 * toute la verification, signalee a tort comme une panne du service.
 */
function decoder(brut: string): string {
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}

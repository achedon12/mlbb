/**
 * Verification d'un identifiant de joueur.
 *
 * Moonton ne publie aucune API. Le seul point d'entree public est l'etape de
 * validation d'identifiant des plateformes de recharge : on lui envoie un
 * identifiant et un serveur, elle renvoie le pseudo du compte. C'est tout ce
 * qui est disponible — ni rang, ni statistiques, ni statut de connexion.
 *
 * Aucun paiement n'est declenche : seule l'etape de validation est appelee, et
 * la reponse est jetee des que le pseudo en a ete extrait.
 */
const ENDPOINT = "https://order-sg.codashop.com/initPayment";

export type ResultatVerification =
  | { ok: true; pseudo: string }
  | { ok: false; raison: "introuvable" | "indisponible" };

export async function verifierIdentifiant(
  identifiant: string,
  serveur: string,
): Promise<ResultatVerification> {
  // Un copier-coller depuis le jeu ramene souvent des espaces, et parfois la
  // forme complete « 123456789 (2222) » : on ne garde que les chiffres plutot
  // que de renvoyer l'utilisateur a sa saisie.
  const id = identifiant.replace(/\D/g, "");
  const zone = serveur.replace(/\D/g, "");

  if (!/^\d{5,15}$/.test(id) || !/^\d{3,8}$/.test(zone)) {
    console.warn(`[mlbb] saisie rejetee : identifiant=${id.length} chiffres, serveur=${zone.length} chiffres`);
    return { ok: false, raison: "introuvable" };
  }

  try {
    const reponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Sans agent identifiable, certaines protections rejettent l'appel.
        "User-Agent": "Mozilla/5.0 (compatible; MLBB.fr verification)",
      },
      body: JSON.stringify({
        voucherPricePoint: { id: "8125", price: "0.44", variablePrice: 0, country: "PH" },
        voucherTypeName: "MOBILE_LEGENDS",
        shopLang: "en_PH",
        user: { userId: id, zoneId: zone },
      }),
      // Le service tiers peut etre lent : on ne bloque pas la requete du site
      // plus de quelques secondes.
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (!reponse.ok) {
      console.warn(`[mlbb] verification : HTTP ${reponse.status}`);
      return { ok: false, raison: "indisponible" };
    }

    const donnees = (await reponse.json()) as {
      success?: boolean;
      errorCode?: number;
      errorMsg?: string;
      confirmationFields?: Record<string, unknown>;
    };

    // Le service a plusieurs fois renomme ce champ : on accepte les formes
    // connues plutot que de dependre d'une seule.
    const champs = donnees.confirmationFields ?? {};
    const brut =
      champs.username ?? champs.userName ?? champs.roleName ?? champs.nickname;

    if (!donnees.success || typeof brut !== "string" || brut.length === 0) {
      // Sans cette trace, un refus du service est indiscernable d'un bug du
      // site : les deux se presentent a l'utilisateur comme « introuvable ».
      console.warn(
        `[mlbb] verification refusee : success=${donnees.success} code=${donnees.errorCode} message=${donnees.errorMsg} champs=${Object.keys(champs).join(",") || "aucun"}`,
      );
      return { ok: false, raison: "introuvable" };
    }

    return { ok: true, pseudo: decoder(brut) };
  } catch (erreur) {
    console.warn(`[mlbb] verification en echec : ${(erreur as Error).message}`);
    return { ok: false, raison: "indisponible" };
  }
}

/**
 * Decode le pseudo renvoye par le service.
 *
 * Il arrive encode — « Leo%20Roi » plutot que « Leo Roi ». Mais un pseudo peut
 * contenir un « % » isole, que `decodeURIComponent` refuse en levant une
 * exception : sans ce garde-fou, un pseudo parfaitement valide faisait echouer
 * toute la verification, signalee a tort comme une panne du service.
 */
function decoder(brut: string): string {
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}

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
  // Les deux champs sont numeriques cote jeu : on refuse le reste avant meme
  // de sortir sur le reseau.
  if (!/^\d{5,15}$/.test(identifiant) || !/^\d{3,6}$/.test(serveur)) {
    return { ok: false, raison: "introuvable" };
  }

  try {
    const reponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voucherPricePoint: { id: "8125", price: "0.44", variablePrice: 0, country: "PH" },
        voucherTypeName: "MOBILE_LEGENDS",
        shopLang: "en_PH",
        user: { userId: identifiant, zoneId: serveur },
      }),
      // Le service tiers peut etre lent : on ne bloque pas la requete du site
      // plus de quelques secondes.
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!reponse.ok) return { ok: false, raison: "indisponible" };

    const donnees = (await reponse.json()) as {
      success?: boolean;
      confirmationFields?: { username?: string };
    };

    const pseudo = donnees.confirmationFields?.username;
    if (!donnees.success || !pseudo) return { ok: false, raison: "introuvable" };

    // Le pseudo revient encode : « Leo%20Roi » plutot que « Leo Roi ».
    return { ok: true, pseudo: decodeURIComponent(pseudo) };
  } catch {
    return { ok: false, raison: "indisponible" };
  }
}

import { cookies } from "next/headers";
import { cache } from "react";
import { expiration, profil, type Profil } from "./mlbb-auth";

/**
 * Session de jeu.
 *
 * Le jeton fourni par le service de connexion est range dans un cookie
 * httpOnly : il ne quitte jamais le serveur, et le site n'a aucun etat a
 * conserver de son cote — pas de base, pas de table de sessions. Se
 * deconnecter, c'est effacer le cookie ; expirer, c'est le jeton qui le dit.
 */
const COOKIE = "mlbb_jeu";

export async function ouvrirSession(jeton: string): Promise<void> {
  const exp = expiration(jeton);
  const maxAge = exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 60 * 60 * 24 * 7;

  (await cookies()).set(COOKIE, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function fermerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * Ferme la session quand c'est permis. Pendant le rendu d'une page, les
 * cookies sont en lecture seule et Next refuse d'y toucher : le cookie reste
 * alors en place, et l'appel de l'en-tete a `/api/session` — un gestionnaire
 * de route, lui autorise — le videra au passage.
 */
async function fermerSiPossible(): Promise<void> {
  try {
    await fermerSession();
  } catch {
    // Rendu de page : cookie en lecture seule.
  }
}

/** Jeton courant, ou null. Un jeton expire est traite comme absent. */
export async function jetonCourant(): Promise<string | null> {
  const jeton = (await cookies()).get(COOKIE)?.value;
  if (!jeton) return null;

  const exp = expiration(jeton);
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;

  return jeton;
}

/**
 * Etat de la session.
 *
 * Les pages du compte doivent distinguer une session expiree — il faut se
 * reconnecter — d'une source momentanement coupee — il suffit d'attendre. Le
 * jeton n'est rendu qu'au code serveur qui appelle le service ; il n'a rien a
 * faire dans les proprietes d'un composant client.
 */
export type EtatSession =
  | { etat: "absente" }
  | { etat: "expiree" }
  | { etat: "indisponible"; jeton: string }
  | { etat: "ok"; jeton: string; profil: Profil };

/**
 * Une reponse « expire » du service — jeton revoque avant son echeance —
 * ferme la session au passage quand c'est permis : le prochain rendu la verra
 * vide, sans qu'un jeton mort traine dans le cookie.
 */
async function lireSession(): Promise<EtatSession> {
  const jeton = await jetonCourant();
  if (!jeton) return { etat: "absente" };

  const resultat = await profil(jeton);
  if (resultat.etat === "expire") {
    await fermerSiPossible();
    return { etat: "expiree" };
  }
  // Source indisponible : on garde la session, mais on n'a pas le profil.
  return resultat.etat === "ok" ? { etat: "ok", jeton, profil: resultat.donnees } : { etat: "indisponible", jeton };
}

/** Etat de la session, lu une fois par rendu de page. */
export const sessionJoueur = cache(lireSession);

/** Profil de la session courante, ou null. */
export async function profilCourant(): Promise<Profil | null> {
  const session = await lireSession();
  return session.etat === "ok" ? session.profil : null;
}

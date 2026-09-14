import { cookies } from "next/headers";
import { cache } from "react";
import { expiration, profile, type Profile } from "./mlbb-auth";

/**
 * Session de jeu.
 *
 * Le jeton fourni par le service de connexion est range dans un cookie
 * httpOnly : il ne quitte jamais le serveur, et le site n'a aucun etat a
 * conserver de son cote — pas de base, pas de table de sessions. Se
 * deconnecter, c'est effacer le cookie ; expirer, c'est le jeton qui le dit.
 */
const COOKIE = "mlbb_jeu";

export async function openSession(token: string): Promise<void> {
  const exp = expiration(token);
  const maxAge = exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 60 * 60 * 24 * 7;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function closeSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * Ferme la session quand c'est permis. Pendant le rendu d'une page, les
 * cookies sont en lecture seule et Next refuse d'y toucher : le cookie reste
 * alors en place, et l'appel de l'en-tete a `/api/session` — un gestionnaire
 * de route, lui autorise — le videra au passage.
 */
async function closeIfPossible(): Promise<void> {
  try {
    await closeSession();
  } catch {
    // Rendu de page : cookie en lecture seule.
  }
}

/** Jeton courant, ou null. Un jeton expire est traite comme absent. */
export async function tokenCurrent(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const exp = expiration(token);
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;

  return token;
}

/**
 * Etat de la session.
 *
 * Les pages du compte doivent distinguer une session expiree — il faut se
 * reconnecter — d'une source momentanement coupee — il suffit d'attendre. Le
 * jeton n'est rendu qu'au code serveur qui appelle le service ; il n'a rien a
 * faire dans les proprietes d'un composant client.
 */
export type StateSession =
  | { state: "missing" }
  | { state: "expired" }
  | { state: "unavailable"; token: string }
  | { state: "ok"; token: string; profile: Profile };

/**
 * Une reponse « expire » du service — jeton revoque avant son echeance —
 * ferme la session au passage quand c'est permis : le prochain rendu la verra
 * vide, sans qu'un jeton mort traine dans le cookie.
 */
async function readSession(): Promise<StateSession> {
  const token = await tokenCurrent();
  if (!token) return { state: "missing" };

  const result = await profile(token);
  if (result.etat === "expired") {
    await closeIfPossible();
    return { state: "expired" };
  }
  // Source indisponible : on garde la session, mais on n'a pas le profil.
  return result.etat === "ok" ? { state: "ok", token, profile: result.donnees } : { state: "unavailable", token };
}

/** Etat de la session, lu une fois par rendu de page. */
export const sessionPlayer = cache(readSession);

/** Profil de la session courante, ou null. */
export async function profileCurrent(): Promise<Profile | null> {
  const session = await readSession();
  return session.state === "ok" ? session.profile : null;
}

import { cookies } from "next/headers";
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

/** Jeton courant, ou null. Un jeton expire est traite comme absent. */
export async function jetonCourant(): Promise<string | null> {
  const jeton = (await cookies()).get(COOKIE)?.value;
  if (!jeton) return null;

  const exp = expiration(jeton);
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;

  return jeton;
}

/**
 * Profil de la session courante.
 *
 * Une reponse « expire » du service — jeton revoque avant son echeance —
 * ferme la session au passage : le prochain rendu la verra vide, sans qu'un
 * jeton mort traine dans le cookie.
 */
export async function profilCourant(): Promise<Profil | null> {
  const jeton = await jetonCourant();
  if (!jeton) return null;

  const resultat = await profil(jeton);
  if (resultat.etat === "expire") {
    await fermerSession();
    return null;
  }
  // Source indisponible : on garde la session, mais on n'a pas le profil.
  return resultat.etat === "ok" ? resultat.donnees : null;
}

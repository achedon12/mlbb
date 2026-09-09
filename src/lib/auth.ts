import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { db, type Utilisateur } from "./db";

/**
 * Authentification.
 *
 * Session sans etat : un jeton signe dans un cookie httpOnly. Le site n'a pas
 * besoin de revoquer une session a distance, donc une table de sessions serait
 * du poids inutile.
 *
 * Les mots de passe passent par scrypt, disponible dans Node sans dependance
 * native supplementaire — un module de moins a compiler dans l'image.
 */
const COOKIE = "mlbb_session";
const DUREE = 60 * 60 * 24 * 30; // 30 jours

function cle(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET manquant ou trop court (32 caracteres minimum). Voir .env.example.",
    );
  }
  return new TextEncoder().encode(secret);
}

export function hacherMotDePasse(clair: string): string {
  const sel = randomBytes(16).toString("hex");
  const derive = scryptSync(clair, sel, 64).toString("hex");
  return `${sel}:${derive}`;
}

export function verifierMotDePasse(clair: string, stocke: string): boolean {
  const [sel, derive] = stocke.split(":");
  if (!sel || !derive) return false;

  const attendu = Buffer.from(derive, "hex");
  const calcule = scryptSync(clair, sel, 64);
  // Comparaison a temps constant : la duree de la reponse ne doit rien
  // apprendre sur le mot de passe stocke.
  return attendu.length === calcule.length && timingSafeEqual(attendu, calcule);
}

export async function ouvrirSession(utilisateurId: number): Promise<void> {
  const jeton = await new SignJWT({ uid: utilisateurId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE}s`)
    .sign(cle());

  (await cookies()).set(COOKIE, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE,
  });
}

export async function fermerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Utilisateur de la requete courante, ou null si la session est absente. */
export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const jeton = (await cookies()).get(COOKIE)?.value;
  if (!jeton) return null;

  try {
    const { payload } = await jwtVerify(jeton, cle());
    const uid = payload.uid;
    if (typeof uid !== "number") return null;

    return (
      (db().prepare("SELECT * FROM utilisateurs WHERE id = ?").get(uid) as
        | Utilisateur
        | undefined) ?? null
    );
  } catch {
    // Jeton expire ou signature invalide : on traite comme une absence de
    // session plutot que comme une erreur.
    return null;
  }
}

/** Avatar deterministe derive de l'email, sans appel a un service tiers. */
export function couleurAvatar(email: string): string {
  const teinte = parseInt(createHash("sha256").update(email).digest("hex").slice(0, 4), 16) % 360;
  return `hsl(${teinte} 65% 45%)`;
}

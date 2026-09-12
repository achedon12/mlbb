"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { connecter as connecterJeu, envoyerCode } from "./mlbb-auth";
import { fermerSession, ouvrirSession } from "./session";

/**
 * Actions de connexion.
 *
 * Le parcours tient en deux temps : demander un code, puis l'echanger contre
 * une session. Aucune donnee n'est stockee cote site — l'identite vit dans le
 * jeton, l'authentification chez Moonton.
 */
export interface Etat {
  /** Cle du catalogue (`loginForm.errors.*`) : le formulaire l'affiche dans la langue de la page. */
  erreur?: string;
  /** Passe a vrai une fois le code envoye : le formulaire affiche alors le champ code. */
  codeEnvoye?: boolean;
  roleId?: string;
  zoneId?: string;
}

const identifiants = z.object({
  roleId: z.coerce.number().int().positive("loginForm.errors.playerId"),
  zoneId: z.coerce.number().int().positive("loginForm.errors.server"),
});

/** Sépare « 123456789 (6021) » colle dans le champ identifiant. */
function separer(brut: string): { roleId: string; zoneId: string } | null {
  const colle = brut.match(/^\s*(\d+)\s*\((\d+)\)\s*$/);
  return colle ? { roleId: colle[1], zoneId: colle[2] } : null;
}

export async function demanderCode(_precedent: Etat, donnees: FormData): Promise<Etat> {
  let brutRole = String(donnees.get("roleId") ?? "").trim();
  let brutZone = String(donnees.get("zoneId") ?? "").trim();

  // Identifiant complet colle dans le premier champ : le serveur suit.
  const colle = separer(brutRole);
  if (colle) {
    brutRole = colle.roleId;
    if (!brutZone) brutZone = colle.zoneId;
  }

  const analyse = identifiants.safeParse({ roleId: brutRole, zoneId: brutZone });
  if (!analyse.success) {
    // Un nombre illisible leve l'erreur de type de zod, pas notre message : on retombe alors sur la cle generique.
    const message = analyse.error.issues[0]?.message;
    const erreur = message?.startsWith("loginForm.") ? message : "loginForm.errors.invalidInput";
    return { erreur, roleId: brutRole, zoneId: brutZone };
  }

  const { roleId, zoneId } = analyse.data;
  const resultat = await envoyerCode(roleId, zoneId);

  if (!resultat.ok) {
    return { erreur: resultat.raison, roleId: brutRole, zoneId: brutZone };
  }

  return { codeEnvoye: true, roleId: String(roleId), zoneId: String(zoneId) };
}

export async function verifierCode(_precedent: Etat, donnees: FormData): Promise<Etat> {
  const analyse = identifiants.safeParse({
    roleId: donnees.get("roleId"),
    zoneId: donnees.get("zoneId"),
  });
  const code = Number(String(donnees.get("code") ?? "").replace(/\D/g, ""));

  if (!analyse.success || !/^\d{4}$/.test(String(code))) {
    return {
      erreur: "loginForm.errors.code",
      codeEnvoye: true,
      roleId: String(donnees.get("roleId") ?? ""),
      zoneId: String(donnees.get("zoneId") ?? ""),
    };
  }

  const { roleId, zoneId } = analyse.data;
  const resultat = await connecterJeu(roleId, zoneId, code);

  if (!resultat.ok) {
    return {
      erreur: resultat.raison,
      codeEnvoye: true,
      roleId: String(roleId),
      zoneId: String(zoneId),
    };
  }

  await ouvrirSession(resultat.jeton);
  redirect("/account");
}

export async function deconnecter(): Promise<void> {
  await fermerSession();
  redirect("/");
}

/** Session expiree : on vide le cookie et on repart du formulaire de connexion. */
export async function reconnecter(): Promise<void> {
  await fermerSession();
  redirect("/login");
}

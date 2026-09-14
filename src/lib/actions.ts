"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { connect as connectGame, sendCode } from "./mlbb-auth";
import { closeSession, openSession } from "./session";

/**
 * Actions de connexion.
 *
 * Le parcours tient en deux temps : demander un code, puis l'echanger contre
 * une session. Aucune donnee n'est stockee cote site — l'identite vit dans le
 * jeton, l'authentification chez Moonton.
 */
export interface State {
  /** Cle du catalogue (`loginForm.errors.*`) : le formulaire l'affiche dans la langue de la page. */
  error?: string;
  /** Passe a vrai une fois le code envoye : le formulaire affiche alors le champ code. */
  codeSent?: boolean;
  roleId?: string;
  zoneId?: string;
}

const credentials = z.object({
  roleId: z.coerce.number().int().positive("loginForm.errors.playerId"),
  zoneId: z.coerce.number().int().positive("loginForm.errors.server"),
});

/** Sépare « 123456789 (6021) » colle dans le champ identifiant. */
function split(raw: string): { roleId: string; zoneId: string } | null {
  const glued = raw.match(/^\s*(\d+)\s*\((\d+)\)\s*$/);
  return glued ? { roleId: glued[1], zoneId: glued[2] } : null;
}

export async function requestCode(_previous: State, data: FormData): Promise<State> {
  let rawRole = String(data.get("roleId") ?? "").trim();
  let rawZone = String(data.get("zoneId") ?? "").trim();

  // Identifiant complet colle dans le premier champ : le serveur suit.
  const glued = split(rawRole);
  if (glued) {
    rawRole = glued.roleId;
    if (!rawZone) rawZone = glued.zoneId;
  }

  const analysis = credentials.safeParse({ roleId: rawRole, zoneId: rawZone });
  if (!analysis.success) {
    // Un nombre illisible leve l'erreur de type de zod, pas notre message : on retombe alors sur la cle generique.
    const message = analysis.error.issues[0]?.message;
    const error = message?.startsWith("loginForm.") ? message : "loginForm.errors.invalidInput";
    return { error, roleId: rawRole, zoneId: rawZone };
  }

  const { roleId, zoneId } = analysis.data;
  const result = await sendCode(roleId, zoneId);

  if (!result.ok) {
    return { error: result.raison, roleId: rawRole, zoneId: rawZone };
  }

  return { codeSent: true, roleId: String(roleId), zoneId: String(zoneId) };
}

export async function checkCode(_previous: State, data: FormData): Promise<State> {
  const analysis = credentials.safeParse({
    roleId: data.get("roleId"),
    zoneId: data.get("zoneId"),
  });
  const code = Number(String(data.get("code") ?? "").replace(/\D/g, ""));

  if (!analysis.success || !/^\d{4}$/.test(String(code))) {
    return {
      error: "loginForm.errors.code",
      codeSent: true,
      roleId: String(data.get("roleId") ?? ""),
      zoneId: String(data.get("zoneId") ?? ""),
    };
  }

  const { roleId, zoneId } = analysis.data;
  const result = await connectGame(roleId, zoneId, code);

  if (!result.ok) {
    return {
      error: result.raison,
      codeSent: true,
      roleId: String(roleId),
      zoneId: String(zoneId),
    };
  }

  await openSession(result.jeton);
  redirect("/account");
}

export async function disconnect(): Promise<void> {
  await closeSession();
  redirect("/");
}

/** Session expiree : on vide le cookie et on repart du formulaire de connexion. */
export async function reconnect(): Promise<void> {
  await closeSession();
  redirect("/login");
}

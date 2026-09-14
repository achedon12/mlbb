"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { connect as connectGame, sendCode } from "./mlbb-auth";
import { closeSession, openSession } from "./session";

/**
 * Login actions.
 *
 * The flow has two steps: request a code, then exchange it for a session.
 * No data is stored on the site — identity lives in the token,
 * authentication at Moonton.
 */
export interface State {
  /** Catalogue key (`loginForm.errors.*`): the form displays it in the page's language. */
  error?: string;
  /** Set to true once the code is sent: the form then shows the code field. */
  codeSent?: boolean;
  roleId?: string;
  zoneId?: string;
}

const credentials = z.object({
  roleId: z.coerce.number().int().positive("loginForm.errors.playerId"),
  zoneId: z.coerce.number().int().positive("loginForm.errors.server"),
});

/** Splits "123456789 (6021)" pasted into the ID field. */
function split(raw: string): { roleId: string; zoneId: string } | null {
  const glued = raw.match(/^\s*(\d+)\s*\((\d+)\)\s*$/);
  return glued ? { roleId: glued[1], zoneId: glued[2] } : null;
}

export async function requestCode(_previous: State, data: FormData): Promise<State> {
  let rawRole = String(data.get("roleId") ?? "").trim();
  let rawZone = String(data.get("zoneId") ?? "").trim();

  // Full ID pasted into the first field: the server follows it.
  const glued = split(rawRole);
  if (glued) {
    rawRole = glued.roleId;
    if (!rawZone) rawZone = glued.zoneId;
  }

  const analysis = credentials.safeParse({ roleId: rawRole, zoneId: rawZone });
  if (!analysis.success) {
    // An unreadable number raises zod's type error, not our message: fall back to the generic key.
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

/** Expired session: clear the cookie and start again from the login form. */
export async function reconnect(): Promise<void> {
  await closeSession();
  redirect("/login");
}

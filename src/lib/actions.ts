"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientAddress } from "./client-address";
import { accountId } from "./community-builds-server";
import { databaseConfigured } from "./db";
import { setCardToken } from "./discord-profile/store";
import { sealGameToken } from "./discord-profile/token";
import { logError } from "./log";
import {
  allowAccountCode,
  allowCodeCheck,
  allowCodeRequest,
  clearAccount,
  refundAttempt,
  reserveAttempt,
} from "./login-limits";
import { safeNext } from "./login-next";
import { connect as connectGame, identity, sendCode } from "./mlbb-auth";
import { closeSession, openSession } from "./session";

/**
 * Login actions.
 *
 * The flow has two steps: request a code, then exchange it for a session.
 * Identity lives in the token, authentication at Moonton. The only thing
 * kept is the token renewed for a linked /profile card (`renewCardToken`).
 */
export interface State {
  /** Catalogue key (`loginForm.errors.*`): the form displays it in the page's language. */
  error?: string;
  /** Set to true once the code is sent: the form then shows the code field. */
  codeSent?: boolean;
  roleId?: string;
  zoneId?: string;
}

/** The window key of the rate limits: the trusted address, or one shared window without it. */
async function callerAddress(): Promise<string> {
  return clientAddress(await headers()) ?? "unknown";
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
  // The address first: a refused request must not use up the account's codes.
  const address = await callerAddress();
  if (!allowCodeRequest(address) || !allowAccountCode(roleId, zoneId, address)) {
    return { error: "loginForm.errors.tooMany", roleId: rawRole, zoneId: rawZone };
  }
  const result = await sendCode(roleId, zoneId);

  if (!result.ok) {
    return { error: result.reason, roleId: rawRole, zoneId: rawZone };
  }

  return { codeSent: true, roleId: String(roleId), zoneId: String(zoneId) };
}

export async function checkCode(_previous: State, data: FormData): Promise<State> {
  const analysis = credentials.safeParse({
    roleId: data.get("roleId"),
    zoneId: data.get("zoneId"),
  });
  // Kept as typed: "0123" is a valid code, a number would make it 123.
  const code = String(data.get("code") ?? "").replace(/\s/g, "");

  if (!analysis.success || !/^\d{4}$/.test(code)) {
    return {
      error: "loginForm.errors.code",
      codeSent: true,
      roleId: String(data.get("roleId") ?? ""),
      zoneId: String(data.get("zoneId") ?? ""),
    };
  }

  const { roleId, zoneId } = analysis.data;
  const back = { codeSent: true, roleId: String(roleId), zoneId: String(zoneId) };
  if (!allowCodeCheck(await callerAddress())) return { error: "loginForm.errors.tooMany", ...back };
  // The attempt is taken before the service is asked, so parallel checks
  // cannot all pass. Five used: this code is burnt, the player asks for a new one.
  if (!reserveAttempt(roleId, zoneId)) return { error: "loginForm.errors.tooManyAttempts", ...back };

  const result = await connectGame(roleId, zoneId, code);

  if (!result.ok) {
    // The service was down: the code was not judged, the attempt is given back.
    if (result.reason === "loginForm.errors.unavailable") refundAttempt(roleId, zoneId);
    return {
      error: result.reason,
      codeSent: true,
      roleId: String(roleId),
      zoneId: String(zoneId),
    };
  }

  clearAccount(roleId, zoneId);
  await openSession(result.token);
  await renewCardToken(result.token);
  // Back to the page that sent the visitor here, when it is one of the site's.
  redirect(safeNext(data.get("next")) ?? "/account");
}

/**
 * A new sign-in renews the token kept with the player's /profile card, if
 * they linked one, so the card keeps reading fresh figures. Never blocks the
 * sign-in: without a database or on a failure, the card keeps its old token.
 */
async function renewCardToken(token: string): Promise<void> {
  if (!databaseConfigured()) return;
  const me = identity(token);
  const sealed = sealGameToken(token);
  if (me.roleId <= 0 || !sealed) return;
  await setCardToken(accountId(me.roleId, me.zoneId), sealed).catch((e) => logError("profile card token renewal", e));
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

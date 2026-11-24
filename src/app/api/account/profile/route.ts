import { NextResponse } from "next/server";
import { profileInput, readProfileSettings, saveProfileSettings } from "@/lib/account-sync-server";
import { discordImage } from "@/lib/bot/public";
import { answer, guardOwner, ownerOrRefusal, refused, storageFailed } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { addressOf, limitByMinute } from "@/lib/push-server";
import { profileCurrent } from "@/lib/session";

/**
 * The signed-in player's public progress page settings: off by default.
 * - GET: `{ public, fields, slug }` (slug null until first turned on).
 * - PUT `{ public, fields }`: turns the page on or off and picks what it
 *   shows (`PUBLIC_FIELDS`). Turned on, it shows the name of the login the
 *   player is using (game nickname, or Discord display name), and its
 *   picture when chosen, read here from the session, never from the body.
 * Keyed on the account the request proves; no id is ever read from the request.
 */
export const dynamic = "force-dynamic";

const reads = limitByMinute(30);

export async function GET(request: Request) {
  if (!databaseConfigured()) return refused(404, "not found");
  if (!reads(addressOf(request))) return refused(429, "too many requests");
  const owner = await ownerOrRefusal();
  if (owner instanceof NextResponse) return owner;
  try {
    return answer(await readProfileSettings(owner.id));
  } catch (error) {
    return storageFailed("profile read", error);
  }
}

export async function PUT(request: Request) {
  const guarded = await guardOwner(request, "profile", profileInput);
  if (guarded instanceof NextResponse) return guarded;
  const { owner, body } = guarded;
  let avatar: string | null = null;
  if (body.public && body.fields.includes("avatar")) {
    if (owner.via === "game") avatar = (await profileCurrent().catch(() => null))?.avatar ?? null;
    else if (owner.discord) avatar = discordImage("avatars", owner.discord.id, owner.discord.avatar, 128);
  }
  try {
    return answer(await saveProfileSettings(owner.id, body, { name: owner.name, avatar }));
  } catch (error) {
    return storageFailed("profile save", error);
  }
}

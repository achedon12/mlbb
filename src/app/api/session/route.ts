import { NextResponse } from "next/server";
import { currentDiscordLogin } from "@/lib/community/server";
import { profileCurrent } from "@/lib/session";

/**
 * Session state for the header.
 *
 * Read after rendering, which leaves content pages generated at build time.
 * Only returns the nickname: the header needs nothing else. `connected` is
 * the game account (what the builds and the account page need); without
 * one, `discord` is the Discord login's display name, which the header turns
 * into a link to the progress page.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await profileCurrent().catch(() => null);
  const discord = profile ? null : await currentDiscordLogin().catch(() => null);

  return NextResponse.json(
    profile ? { connected: true, pseudo: profile.name } : discord ? { connected: false, discord: discord.name.slice(0, 40) } : { connected: false },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

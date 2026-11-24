import { NextResponse } from "next/server";
import { currentDiscordLogin } from "@/lib/community/server";
import { sessionPlayer, type StateSession } from "@/lib/session";
import type { Session } from "@/lib/session-client";

/**
 * Session state for the header.
 *
 * Read after rendering, which leaves content pages generated at build time.
 * Only returns names: the header needs nothing else. `connected` is the game
 * account (what the builds and the account page need), even while the
 * login service cannot give its profile (`unavailable`): the nickname is
 * then the last one it gave, when known. Without a game account, `discord`
 * is the Discord login's display name; the header leads both to the
 * account page.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session: StateSession = await sessionPlayer().catch((): StateSession => ({ state: "missing" }));
  const pseudo =
    session.state === "ok" ? session.profile.name : session.state === "unavailable" ? session.lastKnown?.name : undefined;
  const discord = session.state === "ok" || pseudo ? null : await currentDiscordLogin().catch(() => null);

  const body: Session =
    session.state === "ok"
      ? { connected: true, pseudo: session.profile.name }
      : session.state === "unavailable"
        ? { connected: true, unavailable: true, ...(pseudo ? { pseudo } : {}), ...(discord ? { discord: discord.name.slice(0, 40) } : {}) }
        : discord
          ? { connected: false, discord: discord.name.slice(0, 40) }
          : { connected: false };

  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}

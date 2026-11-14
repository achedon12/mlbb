import { db } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { isSnowflake } from "@/lib/bot/public";
import { botRoleMenu } from "@/lib/bot/role-menus";

/**
 * A server's role menus, for the bot: it reads them when a member uses one
 * (cached a couple of minutes, forgotten when the dashboard saves) and
 * gives nothing outside them. A server unknown or left has none.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await readSigned(request, null);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!isSnowflake(id)) return refusal(400, "invalid server id");
  return withDatabase("role menus read", async () => {
    const menus = await db().roleMenu.findMany({ where: { guildId: id, guild: { leftAt: null } }, orderBy: { id: "asc" } });
    return ok({ menus: menus.map(botRoleMenu) });
  });
}

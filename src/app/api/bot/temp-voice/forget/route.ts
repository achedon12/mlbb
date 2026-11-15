import { db } from "@/lib/db";
import { ok, readSigned, withDatabase } from "@/lib/bot/internal";
import { tempVoiceForgetInput } from "@/lib/bot/temp-voice";

/** Temporary voice channels the bot deleted, or found gone: forgotten. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await readSigned(request, tempVoiceForgetInput);
  if (gate instanceof Response) return gate;
  return withDatabase("temp voice forget", async () => {
    const { count } = await db().tempVoiceChannel.deleteMany({ where: { channelId: { in: gate.body.channelIds } } });
    return ok({ ok: true, forgotten: count });
  });
}

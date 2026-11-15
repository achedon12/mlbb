import { z } from "zod";
import { MAX_TEMP_VOICE_HUBS, TEMP_VOICE_MAX_USER_LIMIT, TEMP_VOICE_NAME_MAX } from "./kinds";

/**
 * Temporary voice channels ("join to create"): what the dashboard saves,
 * the check against the voice channels the bot reports for the server, and
 * the shapes served to the dashboard and to the bot. Pure module, no database.
 */

const snowflake = z.string().regex(/^\d{17,20}$/);

/** Control characters: none in a channel name. */
const CONTROL = /\p{Cc}/u;

/** The new channel's name, `{user}` for the member; blank: the bot's default one, in the server's language. */
export const nameTemplate = z
  .string()
  .transform((text) => text.trim())
  .pipe(z.string().max(TEMP_VOICE_NAME_MAX).refine((text) => !CONTROL.test(text), "control characters"))
  .transform((text) => text || null)
  .nullable();

const hubInput = z
  .object({
    channelId: snowflake,
    /** 0: no limit. */
    userLimit: z.number().int().min(0).max(TEMP_VOICE_MAX_USER_LIMIT),
    nameTemplate,
  })
  .strict();

/** What the dashboard sends: every hub of the server at once (an empty list turns the feature off). */
export const tempVoiceInput = z
  .object({
    hubs: z
      .array(hubInput)
      .max(MAX_TEMP_VOICE_HUBS)
      .refine((hubs) => new Set(hubs.map((h) => h.channelId)).size === hubs.length, "duplicate hub"),
  })
  .strict();
export type TempVoiceInput = z.infer<typeof tempVoiceInput>;
export type TempVoiceHubInput = TempVoiceInput["hubs"][number];

/**
 * Every hub must be a voice channel the bot reported for this server, on
 * this request: another server's channel or a text channel is refused,
 * whatever the page sent. A hub kept as it was is let through even when
 * the bot no longer lists it (deleted since): removing another hub must
 * not fail on it.
 */
export function checkTempVoice(
  input: TempVoiceInput,
  voiceChannels: ReadonlySet<string>,
  stored: ReadonlySet<string> = new Set(),
): { ok: true } | { ok: false; field: string } {
  for (const [i, hub] of input.hubs.entries()) {
    if (!voiceChannels.has(hub.channelId) && !stored.has(hub.channelId)) return { ok: false, field: `hubs.${i}.channelId` };
  }
  return { ok: true };
}

/** A hub as stored (only the fields read here). */
export interface TempVoiceHubRow {
  channelId: string;
  userLimit: number;
  nameTemplate: string | null;
}

/** What the dashboard and the bot read of a hub. */
export interface TempVoiceHubView {
  channelId: string;
  userLimit: number;
  nameTemplate: string | null;
}

export const tempVoiceHubView = (row: TempVoiceHubRow): TempVoiceHubView => ({
  channelId: row.channelId,
  userLimit: Math.min(TEMP_VOICE_MAX_USER_LIMIT, Math.max(0, row.userLimit)),
  nameTemplate: row.nameTemplate,
});

/** Rows to write, in the dashboard's order. */
export const tempVoiceRows = (guildId: string, input: TempVoiceInput) =>
  input.hubs.map((h) => ({ guildId, channelId: h.channelId, userLimit: h.userLimit, nameTemplate: h.nameTemplate }));

/** A registered channel, for the bot's sweep after a restart. */
export const tempVoiceChannelInput = z
  .object({ channelId: snowflake, hubChannelId: snowflake, ownerId: snowflake })
  .strict();

export const tempVoiceForgetInput = z.object({ channelIds: z.array(snowflake).min(1).max(500) }).strict();

/** Registered channels per server: far above the bot's own cap (50), a ceiling against a runaway. */
export const MAX_TEMP_VOICE_CHANNELS = 200;

import { RESTJSONErrorCodes, Routes, type REST, type RESTPostAPIChannelMessageJSONBody } from "discord.js";
import { roleMenuMessage } from "../embeds/role-menu.js";
import type { View } from "../embeds/common.js";
import { log } from "../log.js";
import type { RoleMenu } from "../site/schemas.js";
import { classifyError, errorLabel } from "./poster.js";

/**
 * Posts a role menu's message, or edits the one already posted, from the
 * manager process over REST (the dashboard's "publish" button). The menu
 * comes from the site in the signed request; the channel must be one the
 * bot reports for that server.
 *
 * - never posted, or posted in another channel: a new message, and the
 *   old one (if any) deleted, best effort;
 * - posted in this channel: edited in place; if it was deleted meanwhile,
 *   posted again.
 */

export interface MessageRest {
  post(channelId: string, body: RESTPostAPIChannelMessageJSONBody): Promise<{ id: string }>;
  edit(channelId: string, messageId: string, body: RESTPostAPIChannelMessageJSONBody): Promise<{ id: string }>;
  remove(channelId: string, messageId: string): Promise<unknown>;
}

export function messageRest(rest: REST): MessageRest {
  return {
    post: async (channelId, body) => (await rest.post(Routes.channelMessages(channelId), { body })) as { id: string },
    edit: async (channelId, messageId, body) => (await rest.patch(Routes.channelMessage(channelId, messageId), { body })) as { id: string },
    remove: (channelId, messageId) => rest.delete(Routes.channelMessage(channelId, messageId)),
  };
}

export type PublishResult =
  | { ok: true; messageId: string; channelId: string; created: boolean }
  | { ok: false; error: "channel_not_available" | "missing_permissions" | "invalid_menu" | string };

const code = (error: unknown) => (error as { code?: unknown }).code;

export async function publishRoleMenu(
  rest: MessageRest,
  view: View,
  menu: RoleMenu,
  ownsChannel: (channelId: string) => Promise<boolean>,
): Promise<PublishResult> {
  if (!(await ownsChannel(menu.channelId))) return { ok: false, error: "channel_not_available" };
  const body = roleMenuMessage(view, menu);
  const fail = (error: unknown): PublishResult => {
    // Discord refused the message itself: an emoji deleted since the save, most likely.
    if (classifyError(error) === "failed") return { ok: false, error: "invalid_menu" };
    return { ok: false, error: classifyError(error) === "forbidden" ? "missing_permissions" : errorLabel(error) };
  };

  if (menu.messageId && menu.messageChannelId === menu.channelId) {
    try {
      const edited = await rest.edit(menu.channelId, menu.messageId, body);
      return { ok: true, messageId: edited.id, channelId: menu.channelId, created: false };
    } catch (error) {
      if (code(error) !== RESTJSONErrorCodes.UnknownMessage) return fail(error);
      // Deleted by someone in the server: posted again below.
    }
  }

  let posted: { id: string };
  try {
    posted = await rest.post(menu.channelId, body);
  } catch (error) {
    return fail(error);
  }
  // The old copy, in a channel of that server only: the ids come from the site.
  if (menu.messageId && menu.messageChannelId && menu.messageChannelId !== menu.channelId && (await ownsChannel(menu.messageChannelId))) {
    await removeRoleMenuMessage(rest, menu.messageChannelId, menu.messageId);
  }
  return { ok: true, messageId: posted.id, channelId: menu.channelId, created: true };
}

/** Deletes a menu's old message; one already gone, or out of reach, is fine. */
export async function removeRoleMenuMessage(rest: MessageRest, channelId: string, messageId: string): Promise<boolean> {
  try {
    await rest.remove(channelId, messageId);
    return true;
  } catch (error) {
    if (code(error) !== RESTJSONErrorCodes.UnknownMessage) log.info("role menu message not deleted", { error: errorLabel(error) });
    return false;
  }
}

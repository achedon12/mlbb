import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { COMMANDS } from "../src/commands/index.js";
import { answerAtOnce } from "../src/discord/interactions.js";

function fakeInteraction() {
  const state = { replied: false, deferred: false };
  const reply = vi.fn(async () => {
    state.replied = true;
  });
  const editReply = vi.fn(async () => ({ id: "edited" }));
  const fetchReply = vi.fn(async () => ({ id: "reply" }));
  const interaction = {
    get replied() {
      return state.replied;
    },
    get deferred() {
      return state.deferred;
    },
    reply,
    editReply,
    fetchReply,
  };
  return { interaction: interaction as unknown as ChatInputCommandInteraction, reply, editReply };
}

describe("instant commands", () => {
  it("send their first editReply as the reply, ephemeral when asked", async () => {
    const { interaction, reply, editReply } = fakeInteraction();
    answerAtOnce(interaction, true);
    await interaction.editReply({ content: "hi" });
    expect(reply).toHaveBeenCalledWith({ content: "hi", flags: MessageFlags.Ephemeral });
    expect(editReply).not.toHaveBeenCalled();
  });

  it("edit the reply after that", async () => {
    const { interaction, reply, editReply } = fakeInteraction();
    answerAtOnce(interaction, false);
    await interaction.editReply("first");
    await interaction.editReply({ content: "second" });
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith({ content: "first" });
    expect(editReply).toHaveBeenCalledWith({ content: "second" });
  });

  it("are only the ones answered from memory", () => {
    const instant = COMMANDS.filter((c) => c.instant).map((c) => c.key).sort();
    expect(instant).toEqual(["about", "help", "invite", "nickname", "servertime", "setup"]);
  });
});

import { describe, expect, it } from "vitest";
import { momentAllowed } from "@/lib/discord-moment";

const base = { invite: "https://discord.gg/x", memory: {}, session: { shown: false }, now: 1_000 };

describe("momentAllowed", () => {
  it("lets a moment show once in a fresh session", () => {
    expect(momentAllowed(base)).toBe(true);
  });

  it("keeps one invitation per session, all kinds together", () => {
    expect(momentAllowed({ ...base, session: { shown: true } })).toBe(false);
  });

  it("never shows to someone who joined, nor for the month after a dismissal", () => {
    expect(momentAllowed({ ...base, memory: { joined: true } })).toBe(false);
    expect(momentAllowed({ ...base, memory: { dismissedUntil: 2_000 } })).toBe(false);
    expect(momentAllowed({ ...base, memory: { dismissedUntil: 500 } })).toBe(true);
  });

  it("stays away without an invite or a readable storage", () => {
    expect(momentAllowed({ ...base, invite: null })).toBe(false);
    expect(momentAllowed({ ...base, memory: null })).toBe(false);
    expect(momentAllowed({ ...base, session: null })).toBe(false);
  });
});

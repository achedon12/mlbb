import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateSession } from "@/lib/session";
import type { Profile } from "@/lib/mlbb-auth";

/**
 * What the header learns from `/api/session`: a game session, even one whose
 * profile the login service cannot give right now, is `connected` (so the
 * header leads to the account page); a Discord login alone gives its name.
 */

const state = {
  session: { state: "missing" } as StateSession,
  discord: null as { id: string; name: string } | null,
  fails: false,
};

vi.mock("@/lib/session", () => ({
  sessionPlayer: async () => {
    if (state.fails) throw new Error("down");
    return state.session;
  },
}));
vi.mock("@/lib/community/server", () => ({ currentDiscordLogin: async () => state.discord }));

const { GET } = await import("@/app/api/session/route");

const PROFILE: Profile = { roleId: 1, zoneId: 2, name: "Leo", level: 40, rankCurrent: 100, rankMax: 120, country: "FR", avatar: null };

async function answer() {
  const response = await GET();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  return response.json();
}

describe("/api/session", () => {
  beforeEach(() => {
    state.session = { state: "missing" };
    state.discord = null;
    state.fails = false;
  });

  it("names the game account when its profile is there", async () => {
    state.session = { state: "ok", token: "t", profile: PROFILE };
    state.discord = { id: "1", name: "Disc" };
    expect(await answer()).toEqual({ connected: true, pseudo: "Leo" });
  });

  it("keeps a game session connected while the service is unavailable, with the last known nickname", async () => {
    state.session = { state: "unavailable", token: "t", lastKnown: PROFILE };
    expect(await answer()).toEqual({ connected: true, unavailable: true, pseudo: "Leo" });
  });

  it("falls back on the Discord name when no nickname is known", async () => {
    state.session = { state: "unavailable", token: "t", lastKnown: null };
    state.discord = { id: "1", name: "Disc" };
    expect(await answer()).toEqual({ connected: true, unavailable: true, discord: "Disc" });
  });

  it("stays connected with no name at all", async () => {
    state.session = { state: "unavailable", token: "t", lastKnown: null };
    expect(await answer()).toEqual({ connected: true, unavailable: true });
  });

  it("gives a Discord login alone its name", async () => {
    state.discord = { id: "1", name: "x".repeat(60) };
    expect(await answer()).toEqual({ connected: false, discord: "x".repeat(40) });
  });

  it("treats an expired game session as signed out", async () => {
    state.session = { state: "expired" };
    expect(await answer()).toEqual({ connected: false });
  });

  it("answers signed out when nothing is there or the read fails", async () => {
    expect(await answer()).toEqual({ connected: false });
    state.fails = true;
    expect(await answer()).toEqual({ connected: false });
  });
});

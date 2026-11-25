import { describe, expect, it, vi } from "vitest";

/**
 * `checkCode` under a parallel burst: the attempt is reserved before the
 * service is asked, so twenty checks in flight at once (from twenty
 * addresses) reach the service five times, not twenty. An outage gives the
 * attempt back.
 */
let address = 0;
const connect = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": `198.51.100.${++address % 250}` }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/mlbb-auth", () => ({ connect, identity: vi.fn(), sendCode: vi.fn() }));
vi.mock("@/lib/session", () => ({ openSession: vi.fn(), closeSession: vi.fn() }));
vi.mock("@/lib/db", () => ({ databaseConfigured: () => false }));
vi.mock("@/lib/community-builds-server", () => ({ accountId: vi.fn() }));
vi.mock("@/lib/discord-profile/store", () => ({ setCardToken: vi.fn() }));
vi.mock("@/lib/discord-profile/token", () => ({ sealGameToken: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

const { checkCode } = await import("@/lib/actions");

function form(roleId: number) {
  const data = new FormData();
  data.set("roleId", String(roleId));
  data.set("zoneId", "1");
  data.set("code", "1234");
  return data;
}

describe("checkCode", () => {
  it("lets only five checks of one code reach the service, however parallel", async () => {
    connect.mockReset();
    connect.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { ok: false, reason: "loginForm.errors.wrongCode" };
    });
    const results = await Promise.all(Array.from({ length: 20 }, () => checkCode({}, form(900))));
    expect(connect).toHaveBeenCalledTimes(5);
    expect(results.filter((r) => r.error === "loginForm.errors.tooManyAttempts")).toHaveLength(15);
  });

  it("does not count a check the service could not judge", async () => {
    connect.mockReset();
    connect.mockResolvedValue({ ok: false, reason: "loginForm.errors.unavailable" });
    for (let i = 0; i < 6; i++) {
      expect((await checkCode({}, form(901))).error).toBe("loginForm.errors.unavailable");
    }
    expect(connect).toHaveBeenCalledTimes(6);
  });
});

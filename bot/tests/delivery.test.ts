import { describe, expect, it, vi } from "vitest";
import { DailyPoster } from "../src/managers/daily-poster.js";
import { backoffDelay, BACKOFF_BASE_MS, BACKOFF_MAX_MS, DeliveryService, MAX_ATTEMPTS } from "../src/managers/delivery.js";
import { classifyError } from "../src/managers/poster.js";
import type { DeliveryReport } from "../src/site/internal-api.js";
import { DEFAULT_SETTINGS, type Announcement } from "../src/site/schemas.js";

const GUILD = "111111111111111111";
const CHANNEL = "222222222222222222";
const PATCH: Announcement = {
  id: "a1",
  type: "patches",
  key: "2.1.90",
  payload: { version: "2.1.90", url: "/patch-notes/2.1.90", counts: { buff: 1, nerf: 1, adjust: 0 }, heroes: [] },
  targets: [{ guildId: GUILD, channelId: CHANNEL, roleId: null, locale: "en" }],
};

const apiError = (status: number, code?: number) => Object.assign(new Error(`HTTP ${status}`), { status, code });

function setup(post: (channelId: string) => Promise<{ id: string }>, announcements: Announcement[] = [PATCH]) {
  let now = Date.UTC(2026, 10, 14, 12);
  const reports: DeliveryReport[][] = [];
  const site = {
    pendingAnnouncements: vi.fn(async () => announcements),
    reportDeliveries: vi.fn(async (r: DeliveryReport[]) => {
      reports.push(r);
    }),
  };
  const poster = { post: vi.fn(post) };
  const service = new DeliveryService({ site, poster, siteUrl: "https://mlbbdex.com", now: () => now });
  return { service, site, poster, reports, advance: (ms: number) => (now += ms) };
}

describe("backoff", () => {
  it("doubles from 2 minutes and stops at 6 hours", () => {
    expect(backoffDelay(1)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelay(2)).toBe(2 * BACKOFF_BASE_MS);
    expect(backoffDelay(4)).toBe(8 * BACKOFF_BASE_MS);
    expect(backoffDelay(50)).toBe(BACKOFF_MAX_MS);
  });

  it("classifies Discord errors", () => {
    expect(classifyError(apiError(403, 50013))).toBe("forbidden");
    expect(classifyError(apiError(404, 10003))).toBe("forbidden");
    expect(classifyError(apiError(400, 50001))).toBe("forbidden");
    expect(classifyError(apiError(503))).toBe("transient");
    expect(classifyError(apiError(429))).toBe("transient");
    expect(classifyError(new Error("socket hang up"))).toBe("transient");
    expect(classifyError(apiError(400, 50035))).toBe("failed");
  });
});

describe("announcement delivery", () => {
  it("posts and reports the message id", async () => {
    const { service, reports, poster } = setup(async () => ({ id: "999999999999999999" }));
    expect(await service.flush()).toMatchObject({ sent: 1 });
    expect(poster.post).toHaveBeenCalledWith(CHANNEL, expect.objectContaining({ allowed_mentions: expect.objectContaining({ parse: [] }) }));
    expect(reports.flat()).toEqual([{ announcementId: "a1", guildId: GUILD, status: "sent", messageId: "999999999999999999" }]);
  });

  it("never posts twice when the report could not reach the site", async () => {
    const { service, site, poster, reports } = setup(async () => ({ id: "999999999999999999" }));
    site.reportDeliveries.mockRejectedValueOnce(new Error("site down"));
    await service.flush();
    expect(reports).toHaveLength(0);
    // Next round: the site still lists the delivery as pending.
    await service.flush();
    expect(poster.post).toHaveBeenCalledTimes(1);
    expect(reports.flat().map((r) => r.status)).toEqual(["sent", "sent"]);
  });

  it("marks a lost permission as forbidden at once, without retrying", async () => {
    const { service, reports, poster } = setup(async () => {
      throw apiError(403, 50013);
    });
    expect(await service.flush()).toMatchObject({ forbidden: 1 });
    expect(poster.post).toHaveBeenCalledTimes(1);
    expect(reports.flat()[0]).toMatchObject({ status: "forbidden", guildId: GUILD });
  });

  it("retries transient failures with exponential backoff, then gives up", async () => {
    const { service, reports, poster, advance } = setup(async () => {
      throw apiError(503);
    });
    await service.flush();
    expect(poster.post).toHaveBeenCalledTimes(1);
    expect(reports.flat()).toEqual([]);

    // Before the delay: skipped.
    advance(BACKOFF_BASE_MS - 1);
    expect(await service.flush()).toMatchObject({ deferred: 1 });
    expect(poster.post).toHaveBeenCalledTimes(1);

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      advance(backoffDelay(attempt) + 1);
      await service.flush();
      expect(poster.post).toHaveBeenCalledTimes(attempt + 1);
    }
    expect(reports.flat()).toEqual([expect.objectContaining({ status: "failed", guildId: GUILD })]);
  });

  it("recovers when a transient failure clears", async () => {
    let fail = true;
    const { service, reports, advance } = setup(async () => {
      if (fail) throw apiError(500);
      return { id: "999999999999999999" };
    });
    await service.flush();
    fail = false;
    advance(backoffDelay(1) + 1);
    await service.flush();
    expect(reports.flat()).toEqual([expect.objectContaining({ status: "sent" })]);
  });

  it("reports an invalid payload as failed without posting", async () => {
    const { service, reports, poster } = setup(async () => ({ id: "1" }), [{ ...PATCH, payload: { nope: true } }]);
    await service.flush();
    expect(poster.post).not.toHaveBeenCalled();
    expect(reports.flat()[0]).toMatchObject({ status: "failed", error: "invalid payload" });
  });

  it("refuses a channel that does not belong to the server", async () => {
    const site = { pendingAnnouncements: async () => [PATCH], reportDeliveries: vi.fn(async () => undefined) };
    const poster = { post: vi.fn(async () => ({ id: "1" })) };
    const service = new DeliveryService({ site, poster, siteUrl: "https://mlbbdex.com", ownsChannel: async () => false });
    await service.flush();
    expect(poster.post).not.toHaveBeenCalled();
    expect(site.reportDeliveries).toHaveBeenCalledWith([expect.objectContaining({ status: "forbidden" })]);
  });

  it("shares a running round between concurrent flushes", async () => {
    const { service, site } = setup(async () => ({ id: "1" }));
    await Promise.all([service.flush(), service.flush(), service.flush()]);
    // One round, plus one follow-up for the calls that arrived during it.
    await new Promise((r) => setTimeout(r, 10));
    expect(site.pendingAnnouncements).toHaveBeenCalledTimes(2);
  });
});

describe("daily posts", () => {
  const settings = { ...DEFAULT_SETTINGS, locale: "fr" as const, dailyMlbbdleChannelId: CHANNEL, dailyHourUtc: 12 };

  function poster(recent: string[] = []) {
    return { post: vi.fn(async () => ({ id: "1" })), recentCustomIds: vi.fn(async () => recent) };
  }
  // The site lists the servers of the hour asked: this one posts at 12.
  const site = {
    dailyGuilds: vi.fn(async (hour: number) =>
      hour === settings.dailyHourUtc
        ? [{ guildId: GUILD, locale: settings.locale, dailyMlbbdleChannelId: settings.dailyMlbbdleChannelId, dailyQuizChannelId: null }]
        : [],
    ),
    daily: vi.fn(async () => ({ number: 65, quiz: { numero: 65, manches: [] } }) as never),
  };

  it("posts at the server's hour only, with the Play marker", async () => {
    const p = poster();
    const daily = new DailyPoster({ site, poster: p, siteUrl: "https://mlbbdex.com", botId: "1" });
    expect(await daily.run(11, "2026-11-14")).toBe(0);
    expect(await daily.run(12, "2026-11-14")).toBe(1);
    expect(site.dailyGuilds).toHaveBeenCalledWith(12);
    expect(JSON.stringify(p.post.mock.calls[0])).toContain("daily:mlbbdle:2026-11-14");
    // Same hour again (restart, second tick): nothing more.
    expect(await daily.run(12, "2026-11-14")).toBe(0);
  });

  it("does not post again when today's message is already in the channel", async () => {
    const p = poster(["daily:mlbbdle:2026-11-14"]);
    const daily = new DailyPoster({ site, poster: p, siteUrl: "https://mlbbdex.com", botId: "1" });
    expect(await daily.run(12, "2026-11-14")).toBe(0);
    expect(p.post).not.toHaveBeenCalled();
  });
});

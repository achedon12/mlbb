import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_TYPES,
  checkAgainstGuild,
  DEFAULT_DAILY_HOUR,
  settingsInput,
  settingsRow,
  settingsView,
  type SettingsInput,
} from "@/lib/bot/settings";
import { siteLocaleOf } from "@/lib/bot/guild-store";

const CHANNEL = "111111111111111111";
const OTHER_CHANNEL = "222222222222222222";
const ROLE = "333333333333333333";

function input(): SettingsInput {
  return {
    locale: "fr",
    announcements: Object.fromEntries(ANNOUNCEMENT_TYPES.map((t) => [t, { channelId: null, roleId: null }])) as SettingsInput["announcements"],
    dailyMlbbdleChannelId: null,
    dailyQuizChannelId: null,
    dailyHourUtc: 12,
  };
}

describe("bot settings", () => {
  it("gives the defaults to a server that never saved anything", () => {
    const view = settingsView("123456789012345678", "id", null);
    expect(view.locale).toBe("id");
    expect(view.dailyHourUtc).toBe(DEFAULT_DAILY_HOUR);
    for (const t of ANNOUNCEMENT_TYPES) expect(view[t]).toEqual({ channelId: null, roleId: null, failing: false });
    expect(settingsView("123456789012345678", "xx", null).locale).toBe("en");
  });

  it("accepts a complete, valid form", () => {
    const value = input();
    value.announcements.patches = { channelId: CHANNEL, roleId: ROLE };
    expect(settingsInput.safeParse(value).success).toBe(true);
  });

  it("refuses bad ids, hours out of range, unknown languages and extra fields", () => {
    const cases: ((v: SettingsInput & Record<string, unknown>) => void)[] = [
      (v) => (v.announcements.skins.channelId = "12345"),
      (v) => (v.announcements.skins.channelId = "1".repeat(21)),
      (v) => (v.announcements.skins.roleId = "@everyone"),
      (v) => (v.dailyHourUtc = 24),
      (v) => (v.dailyHourUtc = -1),
      (v) => (v.dailyHourUtc = 1.5),
      (v) => ((v as { locale: string }).locale = "de"),
      (v) => (v.extra = true),
      (v) => ((v.announcements.events as Record<string, unknown>).mention = "everyone"),
    ];
    for (const change of cases) {
      const value = input() as SettingsInput & Record<string, unknown>;
      change(value);
      expect(settingsInput.safeParse(value).success).toBe(false);
    }
  });

  it("only points the bot at channels and roles the bot reported", () => {
    const channels = new Set([CHANNEL]);
    const roles = new Set([ROLE]);
    const value = input();
    value.announcements.patches = { channelId: OTHER_CHANNEL, roleId: null };
    expect(checkAgainstGuild(value, channels, roles)).toEqual({ ok: false, field: "patches.channelId" });

    const role = input();
    role.announcements.esports = { channelId: CHANNEL, roleId: "444444444444444444" };
    expect(checkAgainstGuild(role, channels, roles)).toEqual({ ok: false, field: "esports.roleId" });

    const daily = input();
    daily.dailyQuizChannelId = OTHER_CHANNEL;
    expect(checkAgainstGuild(daily, channels, roles)).toEqual({ ok: false, field: "dailyQuizChannelId" });
  });

  it("drops a role mention without a channel", () => {
    const value = input();
    value.announcements.skins = { channelId: null, roleId: ROLE };
    const checked = checkAgainstGuild(value, new Set([CHANNEL]), new Set([ROLE]));
    expect(checked.ok && checked.value.announcements.skins.roleId).toBeNull();
    // The input itself is left alone.
    expect(value.announcements.skins.roleId).toBe(ROLE);
  });

  it("clears every failing flag on save", () => {
    const value = input();
    value.announcements.patches = { channelId: CHANNEL, roleId: ROLE };
    const row = settingsRow(value);
    expect(row.patchesChannelId).toBe(CHANNEL);
    expect(row.patchesRoleId).toBe(ROLE);
    for (const t of ANNOUNCEMENT_TYPES) expect(row[`${t}Failing`]).toBe(false);
    expect(settingsView("123456789012345678", "fr", row).patches).toEqual({ channelId: CHANNEL, roleId: ROLE, failing: false });
  });

  it("maps Discord's preferred locale to a site language", () => {
    expect(siteLocaleOf("es-ES")).toBe("es");
    expect(siteLocaleOf("fr")).toBe("fr");
    expect(siteLocaleOf("id")).toBe("id");
    expect(siteLocaleOf("pt-BR")).toBe("en");
    expect(siteLocaleOf("en-US")).toBe("en");
  });
});

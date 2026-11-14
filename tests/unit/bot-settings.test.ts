import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_TYPES,
  autoRoleNeedsGrantable,
  autoRoleWrite,
  checkAgainstGuild,
  DEFAULT_DAILY_HOUR,
  GREETING_KINDS,
  GREETING_MAX_LENGTH,
  greetingText,
  settingsInput,
  settingsRow,
  settingsView,
  type AutoRoleSetting,
  type SettingsInput,
} from "@/lib/bot/settings";
import { siteLocaleOf } from "@/lib/bot/guild-store";

const CHANNEL = "111111111111111111";
const OTHER_CHANNEL = "222222222222222222";
const ROLE = "333333333333333333";
const ROLE_2 = "333333333333333334";
const ROLE_3 = "333333333333333335";
const ROLE_4 = "333333333333333336";
const ADMIN = "444444444444444441";
const OTHER_ADMIN = "444444444444444442";

function input(): SettingsInput {
  return {
    locale: "fr",
    announcements: Object.fromEntries(ANNOUNCEMENT_TYPES.map((t) => [t, { channelId: null, roleId: null }])) as SettingsInput["announcements"],
    dailyMlbbdleChannelId: null,
    dailyQuizChannelId: null,
    dailyHourUtc: 12,
    welcome: { channelId: null, message: null },
    goodbye: { channelId: null, message: null },
    autoRoles: { roleIds: [], botRoleIds: [] },
  };
}

describe("bot settings", () => {
  it("gives the defaults to a server that never saved anything", () => {
    const view = settingsView("123456789012345678", "id", null);
    expect(view.locale).toBe("id");
    expect(view.dailyHourUtc).toBe(DEFAULT_DAILY_HOUR);
    for (const t of ANNOUNCEMENT_TYPES) expect(view[t]).toEqual({ channelId: null, roleId: null, failing: false });
    // Welcome and goodbye messages are off until the owner picks a channel.
    for (const k of GREETING_KINDS) expect(view[k]).toEqual({ channelId: null, message: null, failing: false });
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
      (v) => (v.welcome.channelId = "#general"),
      (v) => (v.goodbye.message = "x".repeat(GREETING_MAX_LENGTH + 1)),
      (v) => (v.welcome.message = "Hi\u0000there"),
      (v) => ((v.welcome as Record<string, unknown>).allowedMentions = ["everyone"]),
      (v) => delete (v as Partial<SettingsInput>).goodbye,
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

  it("normalises a welcome text, and treats a blank one as the default", () => {
    expect(greetingText.parse("  Welcome {user}!\r\nPick roles.  ")).toBe("Welcome {user}!\nPick roles.");
    expect(greetingText.parse("   \n ")).toBeNull();
    expect(greetingText.parse(null)).toBeNull();
    expect(greetingText.parse("x".repeat(GREETING_MAX_LENGTH))).toHaveLength(GREETING_MAX_LENGTH);
    // Stored as typed: the bot neutralises mentions when it posts.
    expect(greetingText.parse("@everyone hi {user}")).toBe("@everyone hi {user}");

    const value = input();
    value.welcome = { channelId: CHANNEL, message: "Hello {user}, welcome to {server}!" };
    expect(settingsInput.parse(value).welcome.message).toBe("Hello {user}, welcome to {server}!");
  });

  it("only posts welcome and goodbye messages in channels the bot reported", () => {
    const value = input();
    value.goodbye = { channelId: OTHER_CHANNEL, message: null };
    expect(checkAgainstGuild(value, new Set([CHANNEL]), new Set())).toEqual({ ok: false, field: "goodbye.channelId" });
    value.goodbye.channelId = CHANNEL;
    expect(checkAgainstGuild(value, new Set([CHANNEL]), new Set()).ok).toBe(true);
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
    for (const k of GREETING_KINDS) expect(row[`${k}Failing`]).toBe(false);
    expect(settingsView("123456789012345678", "fr", row).patches).toEqual({ channelId: CHANNEL, roleId: ROLE, failing: false });
  });

  it("keeps a turned-off message's text, so turning it back on finds it", () => {
    const value = input();
    value.welcome = { channelId: null, message: "Hi {user}" };
    const row = settingsRow(value);
    expect(row).toMatchObject({ welcomeChannelId: null, welcomeMessage: "Hi {user}", goodbyeChannelId: null, goodbyeMessage: null });
    expect(settingsView("123456789012345678", "fr", row).welcome).toEqual({ channelId: null, message: "Hi {user}", failing: false });
  });

  it("has auto-roles off by default, for people and bots", () => {
    expect(settingsView("123456789012345678", "fr", null).autoRoles).toEqual({
      roleIds: [],
      botRoleIds: [],
      failing: false,
      failReason: null,
      configuredBy: null,
    });
  });

  it("takes up to 3 distinct role ids per auto-role list", () => {
    const value = input();
    value.autoRoles = { roleIds: [ROLE, ROLE_2, ROLE_3], botRoleIds: [ROLE_4] };
    expect(settingsInput.safeParse(value).success).toBe(true);
    const bad: ((v: SettingsInput) => void)[] = [
      (v) => (v.autoRoles.roleIds = [ROLE, ROLE_2, ROLE_3, ROLE_4]),
      (v) => (v.autoRoles.botRoleIds = [ROLE, ROLE_2, ROLE_3, ROLE_4]),
      (v) => (v.autoRoles.roleIds = [ROLE, ROLE]),
      (v) => (v.autoRoles.botRoleIds = ["@everyone"]),
      (v) => (v.autoRoles.roleIds = ["<@&333333333333333333>"]),
      (v) => (v.autoRoles.roleIds = [ROLE.slice(0, 10)]),
      (v) => ((v.autoRoles as Record<string, unknown>).failing = false),
      (v) => delete (v.autoRoles as Partial<SettingsInput["autoRoles"]>).botRoleIds,
      (v) => delete (v as Partial<SettingsInput>).autoRoles,
    ];
    for (const change of bad) {
      const v = input();
      change(v);
      expect(settingsInput.safeParse(v).success).toBe(false);
    }
  });

  it("only gives roles the bot reported as assignable on this server", () => {
    const value = input();
    value.autoRoles = { roleIds: [ROLE], botRoleIds: [ROLE_2] };
    // Not assignable (above the bot, managed, dangerous) or another server's: refused.
    expect(checkAgainstGuild(value, new Set(), new Set([ROLE, ROLE_2]), new Set([ROLE]))).toEqual({ ok: false, field: "autoRoles.botRoleIds" });
    expect(checkAgainstGuild(value, new Set(), new Set([ROLE, ROLE_2]))).toEqual({ ok: false, field: "autoRoles.roleIds" });
    expect(checkAgainstGuild(value, new Set(), new Set(), new Set([ROLE, ROLE_2])).ok).toBe(true);
  });

  it("stores the auto-roles and clears their failing flag on save", () => {
    const value = input();
    value.autoRoles = { roleIds: [ROLE], botRoleIds: [ROLE_2] };
    const row = settingsRow(value, { configuredBy: ADMIN, failing: false, failReason: null });
    expect(row).toMatchObject({ autoRoleIds: [ROLE], botAutoRoleIds: [ROLE_2], autoRoleFailing: false, autoRolesConfiguredBy: ADMIN });
    expect(settingsView("123456789012345678", "fr", { ...row, autoRoleFailing: true, autoRoleFailReason: "granter" }).autoRoles).toEqual({
      roleIds: [ROLE],
      botRoleIds: [ROLE_2],
      failing: true,
      failReason: "granter",
      configuredBy: ADMIN,
    });
  });

  describe("who may set the auto-roles (never a role the manager could not give)", () => {
    const stored = (extra: Partial<AutoRoleSetting> = {}): AutoRoleSetting => ({
      roleIds: [ROLE],
      botRoleIds: [],
      failing: false,
      failReason: null,
      configuredBy: ADMIN,
      ...extra,
    });
    const off = stored({ roleIds: [], configuredBy: null });

    it("asks the bot only when the lists change, or are failing or unowned", () => {
      expect(autoRoleNeedsGrantable(off, { roleIds: [ROLE], botRoleIds: [] })).toBe(true);
      expect(autoRoleNeedsGrantable(stored(), { roleIds: [ROLE], botRoleIds: [] })).toBe(false);
      expect(autoRoleNeedsGrantable(stored(), { roleIds: [ROLE], botRoleIds: [ROLE_2] })).toBe(true);
      expect(autoRoleNeedsGrantable(stored({ roleIds: [ROLE, ROLE_2] }), { roleIds: [ROLE_2, ROLE], botRoleIds: [] })).toBe(false);
      expect(autoRoleNeedsGrantable(stored({ failing: true, failReason: "granter" }), { roleIds: [ROLE], botRoleIds: [] })).toBe(true);
      expect(autoRoleNeedsGrantable(stored({ configuredBy: null }), { roleIds: [ROLE], botRoleIds: [] })).toBe(true);
      expect(autoRoleNeedsGrantable(stored(), { roleIds: [], botRoleIds: [] })).toBe(false);
    });

    it("refuses a new role the manager cannot give (no Manage Roles, above them), in either list", () => {
      expect(autoRoleWrite(off, { roleIds: [ROLE], botRoleIds: [] }, OTHER_ADMIN, new Set())).toEqual({ ok: false, field: "autoRoles.roleIds" });
      expect(autoRoleWrite(off, { roleIds: [ROLE], botRoleIds: [ROLE_2] }, OTHER_ADMIN, new Set([ROLE]))).toEqual({
        ok: false,
        field: "autoRoles.botRoleIds",
      });
      expect(autoRoleWrite(off, { roleIds: [ROLE], botRoleIds: [] }, OTHER_ADMIN, null)).toMatchObject({ ok: false });
    });

    it("makes the manager who set them the one the bot checks", () => {
      expect(autoRoleWrite(off, { roleIds: [ROLE], botRoleIds: [ROLE_2] }, OTHER_ADMIN, new Set([ROLE, ROLE_2]))).toEqual({
        ok: true,
        write: { configuredBy: OTHER_ADMIN, failing: false, failReason: null },
      });
    });

    it("leaves unchanged lists to their owner when another manager saves something else", () => {
      expect(autoRoleWrite(stored(), { roleIds: [ROLE], botRoleIds: [] }, OTHER_ADMIN, null)).toEqual({
        ok: true,
        write: { configuredBy: ADMIN, failing: false, failReason: null },
      });
    });

    it("lets a manager who can give them take failing auto-roles over; leaves them failing otherwise", () => {
      const failing = stored({ failing: true, failReason: "granter" });
      expect(autoRoleWrite(failing, { roleIds: [ROLE], botRoleIds: [] }, OTHER_ADMIN, new Set([ROLE]))).toEqual({
        ok: true,
        write: { configuredBy: OTHER_ADMIN, failing: false, failReason: null },
      });
      // Not refused (the rest of the save goes through), but still failing, still theirs.
      expect(autoRoleWrite(failing, { roleIds: [ROLE], botRoleIds: [] }, OTHER_ADMIN, new Set())).toEqual({
        ok: true,
        write: { configuredBy: ADMIN, failing: true, failReason: "granter" },
      });
    });

    it("turns them off, owned by nobody, when both lists are emptied", () => {
      expect(autoRoleWrite(stored(), { roleIds: [], botRoleIds: [] }, OTHER_ADMIN, null)).toEqual({
        ok: true,
        write: { configuredBy: null, failing: false, failReason: null },
      });
    });
  });

  it("maps Discord's preferred locale to a site language", () => {
    expect(siteLocaleOf("es-ES")).toBe("es");
    expect(siteLocaleOf("fr")).toBe("fr");
    expect(siteLocaleOf("id")).toBe("id");
    expect(siteLocaleOf("pt-BR")).toBe("en");
    expect(siteLocaleOf("en-US")).toBe("en");
  });
});

import { PermissionFlagsBits, RESTJSONErrorCodes } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import {
  AUTO_ROLE_REASON,
  checkRoles,
  DANGEROUS_PERMISSIONS,
  hasDangerousPermission,
  roleRefusal,
  type AutoRoleCheck,
  type RoleFacts,
} from "../src/discord/auto-roles.js";
import {
  AUTO_ROLE_CONCURRENCY,
  AUTO_ROLE_QUEUE_MAX,
  AutoRoler,
  SCREENING_TTL_MS,
  type JoinedMember,
} from "../src/managers/auto-roler.js";
import { DEFAULT_SETTINGS, guildSettings, type GuildSettings } from "../src/site/schemas.js";

const GUILD = "123456789012345678";
const ROLE = "223456789012345678";
const ROLE_2 = "223456789012345679";
const BOT_ROLE = "223456789012345670";
const USER = "323456789012345678";

const facts = (extra: Partial<RoleFacts> = {}): RoleFacts => ({
  id: ROLE,
  guildId: GUILD,
  managed: false,
  permissions: PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages,
  belowBot: true,
  ...extra,
});

describe("which roles the bot may give", () => {
  it("refuses every moderation and administration permission", () => {
    const dangerous = [
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageWebhooks,
      PermissionFlagsBits.MentionEveryone,
    ];
    for (const permission of dangerous) {
      expect(hasDangerousPermission(permission | PermissionFlagsBits.SendMessages)).toBe(true);
      expect(roleRefusal(facts({ permissions: permission }))).toBe("dangerous");
    }
    expect(DANGEROUS_PERMISSIONS).toBe(dangerous.reduce((a, b) => a | b, 0n));
    // A plain member role passes.
    const plain = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.AddReactions | PermissionFlagsBits.Connect;
    expect(hasDangerousPermission(plain)).toBe(false);
    expect(roleRefusal(facts({ permissions: plain }))).toBeNull();
  });

  it("refuses @everyone, managed roles and roles at or above the bot's", () => {
    expect(roleRefusal(facts({ id: GUILD }))).toBe("everyone");
    expect(roleRefusal(facts({ managed: true }))).toBe("managed");
    expect(roleRefusal(facts({ belowBot: false }))).toBe("above_bot");
    // Above the bot and dangerous: either reason refuses it.
    expect(roleRefusal(facts({ belowBot: false, permissions: PermissionFlagsBits.Administrator }))).not.toBeNull();
  });

  it("needs Manage Roles, and every role to exist and pass", () => {
    const ok = { id: ROLE, facts: facts() };
    expect(checkRoles(true, [ok])).toEqual({ ok: true });
    expect(checkRoles(false, [ok])).toEqual({ ok: false, reason: "missing_permission" });
    expect(checkRoles(true, [ok, { id: ROLE_2, facts: undefined }])).toEqual({ ok: false, reason: "unknown_role", roleId: ROLE_2 });
    expect(checkRoles(true, [ok, { id: ROLE_2, facts: facts({ id: ROLE_2, permissions: PermissionFlagsBits.BanMembers }) }])).toEqual({
      ok: false,
      reason: "dangerous",
      roleId: ROLE_2,
    });
  });
});

describe("auto-role settings from the site", () => {
  it("are off by default and when absent from an older site", () => {
    expect(DEFAULT_SETTINGS.autoRoles).toEqual({ roleIds: [], botRoleIds: [], failing: false });
    expect(guildSettings.parse({ dailyHourUtc: 12 }).autoRoles).toEqual({ roleIds: [], botRoleIds: [], failing: false });
  });

  it("keep at most 3 distinct snowflakes per list, and turn off when unreadable", () => {
    const parsed = guildSettings.parse({ autoRoles: { roleIds: [ROLE, ROLE, "@everyone", 5, ROLE_2, "323456789012345671", "323456789012345672"], botRoleIds: [BOT_ROLE], failing: true } });
    expect(parsed.autoRoles).toEqual({ roleIds: [ROLE, ROLE_2, "323456789012345671"], botRoleIds: [BOT_ROLE], failing: true });
    expect(guildSettings.parse({ autoRoles: "admin" }).autoRoles).toEqual({ roleIds: [], botRoleIds: [], failing: false });
    expect(guildSettings.parse({ autoRoles: { roleIds: [ROLE] } }).autoRoles).toEqual({ roleIds: [ROLE], botRoleIds: [], failing: false });
  });
});

function setup(autoRoles: Partial<GuildSettings["autoRoles"]> = {}, check: AutoRoleCheck = { ok: true }) {
  let settings: GuildSettings = { ...DEFAULT_SETTINGS, autoRoles: { roleIds: [ROLE], botRoleIds: [BOT_ROLE], failing: false, ...autoRoles } };
  const markFailing = vi.fn(async () => {
    settings = { ...settings, autoRoles: { ...settings.autoRoles, failing: true } };
  });
  const checkFn = vi.fn((_guild: string, _roles: readonly string[]) => check);
  let clock = 0;
  const roler = new AutoRoler({ settings: async () => settings, check: checkFn, markFailing, now: () => clock });
  const member = (extra: Partial<JoinedMember> = {}): JoinedMember & { addRoles: ReturnType<typeof vi.fn> } => ({
    guildId: GUILD,
    id: USER,
    bot: false,
    pending: false,
    addRoles: vi.fn(async () => undefined),
    ...extra,
  }) as JoinedMember & { addRoles: ReturnType<typeof vi.fn> };
  return { roler, member, markFailing, checkFn, tick: (ms: number) => (clock += ms) };
}

describe("auto-roles on join", () => {
  it("gives a person the people's roles, in one call with the audit reason", async () => {
    const { roler, member, checkFn } = setup({ roleIds: [ROLE, ROLE_2] });
    const m = member();
    await roler.joined(m);
    await roler.drained();
    expect(m.addRoles).toHaveBeenCalledTimes(1);
    expect(m.addRoles).toHaveBeenCalledWith([ROLE, ROLE_2], AUTO_ROLE_REASON);
    expect(checkFn).toHaveBeenCalledWith(GUILD, [ROLE, ROLE_2]);
  });

  it("gives a bot the bots' roles only, at once, never the people's", async () => {
    const { roler, member } = setup();
    const bot = member({ bot: true, pending: true });
    await roler.joined(bot);
    await roler.drained();
    expect(bot.addRoles).toHaveBeenCalledWith([BOT_ROLE], AUTO_ROLE_REASON);

    const onlyPeople = setup({ botRoleIds: [] });
    const other = onlyPeople.member({ bot: true });
    await onlyPeople.roler.joined(other);
    await onlyPeople.roler.drained();
    expect(other.addRoles).not.toHaveBeenCalled();
  });

  it("does nothing when off or failing", async () => {
    for (const autoRoles of [{ roleIds: [], botRoleIds: [] }, { failing: true }]) {
      const { roler, member, checkFn } = setup(autoRoles);
      const m = member();
      await roler.joined(m);
      await roler.drained();
      expect(m.addRoles).not.toHaveBeenCalled();
      expect(checkFn).not.toHaveBeenCalled();
      expect(roler.waiting).toEqual({ screening: 0, queued: 0, running: 0 });
    }
  });

  it("refuses a role the bot may not give, and marks auto-roles failing", async () => {
    const { roler, member, markFailing } = setup({}, { ok: false, reason: "above_bot", roleId: ROLE });
    const first = member();
    const second = member({ id: "323456789012345679" });
    await roler.joined(first);
    await roler.joined(second);
    await roler.drained();
    expect(first.addRoles).not.toHaveBeenCalled();
    expect(second.addRoles).not.toHaveBeenCalled();
    // The second member found the settings marked failing.
    expect(markFailing).toHaveBeenCalledTimes(1);
    expect(markFailing).toHaveBeenCalledWith(GUILD);
  });

  it("does not mark failing for a server out of the cache, a member gone or a hiccup", async () => {
    const outage = setup({}, { ok: false, reason: "unknown_guild" });
    await outage.roler.joined(outage.member());
    await outage.roler.drained();
    expect(outage.markFailing).not.toHaveBeenCalled();

    const { roler, member, markFailing } = setup();
    const gone = member({ addRoles: vi.fn(async () => Promise.reject(Object.assign(new Error("x"), { code: RESTJSONErrorCodes.UnknownMember, status: 404 }))) });
    const hiccup = member({ addRoles: vi.fn(async () => Promise.reject(Object.assign(new Error("x"), { status: 503 }))) });
    await roler.joined(gone);
    await roler.joined(hiccup);
    await roler.drained();
    expect(markFailing).not.toHaveBeenCalled();

    const forbidden = member({ addRoles: vi.fn(async () => Promise.reject(Object.assign(new Error("x"), { code: RESTJSONErrorCodes.MissingPermissions, status: 403 }))) });
    await roler.joined(forbidden);
    await roler.drained();
    expect(markFailing).toHaveBeenCalledTimes(1);
  });
});

describe("members in membership screening", () => {
  it("get their roles only once Discord says they are no longer pending", async () => {
    const { roler, member } = setup();
    const joined = member({ pending: true });
    await roler.joined(joined);
    await roler.drained();
    expect(joined.addRoles).not.toHaveBeenCalled();
    expect(roler.waiting.screening).toBe(1);

    // Still pending (another update): nothing yet.
    roler.screened(member({ pending: true }));
    expect(roler.waiting.screening).toBe(1);

    const passed = member({ pending: false });
    roler.screened(passed);
    await roler.drained();
    expect(passed.addRoles).toHaveBeenCalledWith([ROLE], AUTO_ROLE_REASON);
    expect(roler.waiting.screening).toBe(0);

    // A later update (a nickname, a role an admin removed) gives nothing again.
    const later = member();
    roler.screened(later);
    await roler.drained();
    expect(later.addRoles).not.toHaveBeenCalled();
  });

  it("gives nothing to a member updated without having joined in screening", async () => {
    const { roler, member } = setup();
    const m = member();
    roler.screened(m);
    await roler.drained();
    expect(m.addRoles).not.toHaveBeenCalled();
  });

  it("forgets a member still in screening after a day", async () => {
    const { roler, member, tick } = setup();
    await roler.joined(member({ pending: true }));
    tick(SCREENING_TTL_MS + 1);
    const late = member();
    roler.screened(late);
    await roler.drained();
    expect(late.addRoles).not.toHaveBeenCalled();
    expect(roler.waiting.screening).toBe(0);
  });
});

describe("auto-roles during a raid", () => {
  it("gives roles a few at a time, and caps the queue", async () => {
    const { roler, member } = setup();
    let running = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    const addRoles = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          running++;
          peak = Math.max(peak, running);
          release.push(() => {
            running--;
            resolve();
          });
        }),
    );
    const total = AUTO_ROLE_QUEUE_MAX + AUTO_ROLE_CONCURRENCY + 50;
    for (let i = 0; i < total; i++) await roler.joined(member({ id: String(323456789012345678n + BigInt(i)), addRoles }));
    // Let the first workers reach the call.
    await new Promise((r) => setTimeout(r, 0));
    expect(roler.waiting.running).toBe(AUTO_ROLE_CONCURRENCY);
    expect(roler.waiting.queued).toBe(AUTO_ROLE_QUEUE_MAX);

    const drained = roler.drained();
    while (release.length || roler.waiting.running) {
      release.shift()?.();
      await new Promise((r) => setTimeout(r, 0));
    }
    await drained;
    expect(peak).toBe(AUTO_ROLE_CONCURRENCY);
    // The 50 past the cap were skipped, not held.
    expect(addRoles).toHaveBeenCalledTimes(AUTO_ROLE_QUEUE_MAX + AUTO_ROLE_CONCURRENCY);
  });
});

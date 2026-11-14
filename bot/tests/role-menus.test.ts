import { ComponentType, PermissionFlagsBits, RESTJSONErrorCodes } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { checkRoles, granterAllows, NOT_A_MEMBER, type GranterFacts, type RoleFacts } from "../src/discord/auto-roles.js";
import {
  componentEmoji,
  MemberRateLimit,
  planRoleChange,
  ROLE_MENU_RATE_MAX,
  ROLE_MENU_RATE_WINDOW_MS,
  ROLE_MENU_REASON,
  RoleMenus,
  type RoleMenuRequest,
} from "../src/discord/role-menus.js";
import { makeView } from "../src/embeds/common.js";
import { roleMenuMessage, roleMenuReply } from "../src/embeds/role-menu.js";
import { publishRoleMenu, type MessageRest } from "../src/managers/role-menu-publisher.js";
import { roleMenuList, type RoleMenu } from "../src/site/schemas.js";

const GUILD = "123456789012345678";
const OTHER_GUILD = "123456789012345679";
const CHANNEL = "523456789012345678";
const OLD_CHANNEL = "523456789012345679";
const MESSAGE = "623456789012345678";
const USER = "323456789012345678";
const MANAGER = "423456789012345678";

/** The community server's ranks, lowest first, with their emojis. */
const RANKS = ["Warrior", "Elite", "Master", "Grandmaster", "Epic", "Legend", "Mythic", "Mythical Honor", "Mythical Glory", "Mythical Immortal"];
const rankRole = (i: number) => `72345678901234${String(5000 + i)}`;
const WARRIOR = rankRole(0);
const EPIC = rankRole(4);
const LEGEND = rankRole(5);
const MYTHIC = rankRole(6);
/** A role in no menu. */
const MOD = "823456789012345678";

const ranks: RoleMenu = {
  id: "1",
  channelId: CHANNEL,
  title: "Your rank",
  description: null,
  mode: "single",
  options: RANKS.map((name, i) => ({ roleId: rankRole(i), label: name, emoji: `<:rank_${name.toLowerCase().replace(/ /g, "_")}:9${rankRole(i).slice(1)}>` })),
  configuredBy: MANAGER,
  messageId: MESSAGE,
  messageChannelId: CHANNEL,
};
const games: RoleMenu = { ...ranks, id: "2", mode: "multiple", title: "Games", options: ranks.options.slice(0, 3), messageId: "623456789012345679" };

const safe = (id: string, extra: Partial<RoleFacts> = {}): RoleFacts => ({
  id,
  guildId: GUILD,
  managed: false,
  permissions: PermissionFlagsBits.ViewChannel,
  belowBot: true,
  ...extra,
});

/** The server as the shard's cache sees it: every rank fine unless a test changes it. */
function world() {
  const roles = new Map<string, RoleFacts>(ranks.options.map((o) => [o.roleId, safe(o.roleId)]));
  const state = {
    roles,
    manageRoles: true,
    menus: [ranks, games] as RoleMenu[],
    granter: { member: true, owner: false, manageRoles: true, below: () => true } as GranterFacts,
    granterVerdict: null as "unknown" | null,
  };
  const deps = {
    menus: vi.fn(async (guildId: string, _fresh?: boolean) => (guildId === GUILD ? state.menus : [])),
    check: (_guildId: string, ids: readonly string[]) => checkRoles(state.manageRoles, ids.map((id) => ({ id, facts: state.roles.get(id) }))),
    granter: vi.fn(async (_guildId: string, userId: string, ids: readonly string[]) =>
      state.granterVerdict ?? (userId === MANAGER && granterAllows(state.granter, ids) ? ("ok" as const) : ("refused" as const)),
    ),
  };
  return { state, deps };
}

function request(extra: Partial<RoleMenuRequest> & { roles?: string[] } = {}): RoleMenuRequest & { given: string[]; taken: string[] } {
  const given: string[] = [];
  const taken: string[] = [];
  return {
    guildId: GUILD,
    userId: USER,
    menuId: ranks.id,
    messageId: MESSAGE,
    action: { type: "select", values: [LEGEND] },
    memberRoles: new Set(extra.roles ?? []),
    addRole: vi.fn(async (id: string, reason: string) => {
      expect(reason).toBe(ROLE_MENU_REASON);
      given.push(id);
    }),
    removeRole: vi.fn(async (id: string) => {
      taken.push(id);
    }),
    given,
    taken,
    ...extra,
  };
}

describe("what a pick does", () => {
  it("swaps the rank in single mode: the new one given, the other ranks removed", () => {
    expect(planRoleChange(ranks, new Set([EPIC, MOD]), { type: "select", values: [LEGEND] })).toEqual({ add: [LEGEND], remove: [EPIC] });
    expect(planRoleChange(ranks, new Set([LEGEND]), { type: "select", values: [LEGEND] })).toEqual({ add: [], remove: [] });
    // Two ranks held (given by hand): picking one keeps it alone.
    expect(planRoleChange(ranks, new Set([EPIC, LEGEND]), { type: "select", values: [LEGEND] })).toEqual({ add: [], remove: [EPIC] });
  });

  it("toggles in multiple mode", () => {
    const [a, b, c] = games.options.map((o) => o.roleId);
    expect(planRoleChange(games, new Set([a!]), { type: "select", values: [a!, b!] })).toEqual({ add: [b], remove: [a] });
    expect(planRoleChange(games, new Set([c!]), { type: "clear" })).toEqual({ add: [], remove: [c] });
  });

  it("refuses any value the stored menu does not hold, and several in single mode", () => {
    expect(planRoleChange(ranks, new Set(), { type: "select", values: [MOD] })).toBeNull();
    expect(planRoleChange(ranks, new Set(), { type: "select", values: [LEGEND, MOD] })).toBeNull();
    expect(planRoleChange(ranks, new Set(), { type: "select", values: [LEGEND, EPIC] })).toBeNull();
    expect(planRoleChange(games, new Set(), { type: "select", values: [WARRIOR, WARRIOR] })).toBeNull();
    expect(planRoleChange(ranks, new Set(), { type: "select", values: [] })).toBeNull();
  });

  it("clear removes only the menu's roles", () => {
    expect(planRoleChange(ranks, new Set([MYTHIC, MOD]), { type: "clear" })).toEqual({ add: [], remove: [MYTHIC] });
  });
});

describe("role menu clicks", () => {
  it("gives the rank and removes the previous one, new one first", async () => {
    const { deps } = world();
    const req = request({ roles: [EPIC] });
    const order: string[] = [];
    req.addRole = vi.fn(async (id) => void order.push(`+${id}`));
    req.removeRole = vi.fn(async (id) => void order.push(`-${id}`));
    expect(await new RoleMenus(deps).handle(req)).toEqual({ kind: "changed", added: [LEGEND], removed: [EPIC] });
    expect(order).toEqual([`+${LEGEND}`, `-${EPIC}`]);
    expect(deps.granter).toHaveBeenCalledWith(GUILD, MANAGER, [LEGEND, EPIC]);
  });

  it("says so when nothing changes, without touching Discord", async () => {
    const { deps } = world();
    const held = request({ roles: [LEGEND] });
    expect(await new RoleMenus(deps).handle(held)).toEqual({ kind: "unchanged", action: "select" });
    const none = request({ action: { type: "clear" } });
    expect(await new RoleMenus(deps).handle(none)).toEqual({ kind: "unchanged", action: "clear" });
    expect(held.given).toEqual([]);
    expect(none.taken).toEqual([]);
  });

  it("refuses an option outside the stored menu, whatever the interaction says", async () => {
    const { deps } = world();
    const req = request({ action: { type: "select", values: [MOD] } });
    expect(await new RoleMenus(deps).handle(req)).toEqual({ kind: "unknown_option" });
    expect(req.given).toEqual([]);
  });

  it("finds a menu only in the server clicked, and only on its recorded message", async () => {
    const { deps } = world();
    const service = new RoleMenus(deps);
    expect(await service.handle(request({ guildId: OTHER_GUILD }))).toEqual({ kind: "unknown_menu" });
    expect(await service.handle(request({ menuId: "99" }))).toEqual({ kind: "unknown_menu" });
    // An old copy of the message (republished elsewhere since).
    expect(await service.handle(request({ messageId: "623456789012345670", userId: "323456789012345670" }))).toEqual({ kind: "unknown_menu" });
    // A miss asks the site once more, fresh, but once per server in a window.
    expect(deps.menus.mock.calls.filter(([guild, fresh]) => guild === GUILD && fresh === true)).toHaveLength(1);
  });

  it("refuses a role deleted, made dangerous or moved above the bot, and without Manage Roles", async () => {
    const cases: [(s: ReturnType<typeof world>["state"]) => void, string][] = [
      [(s) => s.roles.delete(LEGEND), "role"],
      [(s) => s.roles.set(LEGEND, safe(LEGEND, { permissions: PermissionFlagsBits.BanMembers })), "bot"],
      [(s) => s.roles.set(LEGEND, safe(LEGEND, { belowBot: false })), "bot"],
      [(s) => s.roles.set(LEGEND, safe(LEGEND, { managed: true })), "bot"],
      [(s) => (s.manageRoles = false), "bot"],
      // Removing is checked too: a rank turned into a moderator role is not taken through the menu either.
      [(s) => s.roles.set(EPIC, safe(EPIC, { permissions: PermissionFlagsBits.Administrator })), "bot"],
    ];
    for (const [change, reason] of cases) {
      const { state, deps } = world();
      change(state);
      const req = request({ roles: [EPIC] });
      expect(await new RoleMenus(deps).handle(req)).toEqual({ kind: "refused", reason });
      expect(req.given).toEqual([]);
      expect(req.taken).toEqual([]);
    }
  });

  it("stops when the manager who set the menu up lost the permission, left, or is unknown", async () => {
    const lost: Partial<GranterFacts>[] = [{ manageRoles: false }, { below: () => false }, NOT_A_MEMBER];
    for (const facts of lost) {
      const { state, deps } = world();
      state.granter = { ...state.granter, ...facts };
      const req = request();
      expect(await new RoleMenus(deps).handle(req)).toEqual({ kind: "refused", reason: "granter" });
      expect(req.given).toEqual([]);
    }
    const { state, deps } = world();
    state.menus = [{ ...ranks, configuredBy: null }];
    expect(await new RoleMenus(deps).handle(request())).toEqual({ kind: "refused", reason: "granter" });
    // Discord could not be asked: nothing given, try later.
    const outage = world();
    outage.state.granterVerdict = "unknown";
    expect(await new RoleMenus(outage.deps).handle(request())).toEqual({ kind: "failed" });
  });

  it("limits each member to a few changes in a window, and one at a time", async () => {
    let now = 1_000;
    const { deps } = world();
    const service = new RoleMenus({ ...deps, now: () => now });
    for (let i = 0; i < ROLE_MENU_RATE_MAX; i++) expect((await service.handle(request())).kind).toBe("changed");
    expect(await service.handle(request())).toEqual({ kind: "rate_limited" });
    // Another member is not affected.
    expect((await service.handle(request({ userId: "323456789012345670" }))).kind).toBe("changed");
    now += ROLE_MENU_RATE_WINDOW_MS;
    expect((await service.handle(request())).kind).toBe("changed");

    let release: () => void = () => undefined;
    const slow = request({ userId: "323456789012345671" });
    slow.addRole = () => new Promise<void>((resolve) => (release = resolve));
    const first = service.handle(slow);
    await new Promise((r) => setTimeout(r, 0));
    expect(await service.handle(request({ userId: "323456789012345671" }))).toEqual({ kind: "rate_limited" });
    release();
    expect((await first).kind).toBe("changed");
  });

  it("forgets the oldest members past its cap", () => {
    const limit = new MemberRateLimit(1, 1_000, 3);
    for (const key of ["a", "b", "c", "d"]) limit.allow(key, 0);
    expect(limit.size).toBe(3);
    expect(limit.allow("a", 1)).toBe(true);
    expect(limit.allow("d", 1)).toBe(false);
  });

  it("maps Discord's refusals", async () => {
    const forbidden = Object.assign(new Error("Missing Permissions"), { code: RESTJSONErrorCodes.MissingPermissions, status: 403 });
    const gone = Object.assign(new Error("Unknown Role"), { code: RESTJSONErrorCodes.UnknownRole, status: 404 });
    const down = Object.assign(new Error("Server Error"), { status: 503 });
    for (const [error, outcome] of [
      [forbidden, { kind: "refused", reason: "bot" }],
      [gone, { kind: "refused", reason: "role" }],
      [down, { kind: "failed" }],
    ] as const) {
      const { deps } = world();
      const req = request();
      req.addRole = vi.fn(async () => {
        throw error;
      });
      expect(await new RoleMenus(deps).handle(req)).toEqual(outcome);
    }
    // Half done: the member is told what changed.
    const { deps } = world();
    const req = request({ roles: [EPIC] });
    req.removeRole = vi.fn(async () => {
      throw forbidden;
    });
    expect(await new RoleMenus(deps).handle(req)).toEqual({ kind: "changed", added: [LEGEND], removed: [] });
  });
});

describe("the site's menus, as the bot reads them", () => {
  it("drops an unreadable menu instead of half using it", () => {
    const { menus } = roleMenuList.parse({
      menus: [
        { ...ranks, id: 1 },
        { ...ranks, id: 2, options: [] },
        { ...ranks, id: 3, mode: "everything" },
        { ...ranks, id: 4, options: [ranks.options[0], ranks.options[0]] },
        { ...ranks, id: 5, options: [{ roleId: "@everyone", label: "x" }] },
      ],
    });
    expect(menus.map((m) => m.id)).toEqual(["1"]);
  });
});

describe("the menu's message", () => {
  const view = makeView("fr", "https://mlbbdex.com");

  it("has the server's title, a select of its roles with their emojis, and a remove button", () => {
    const body = roleMenuMessage(view, ranks);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.embeds?.[0]).toMatchObject({ title: "Your rank" });
    const [selectRow, buttonRow] = body.components as unknown as { components: Record<string, unknown>[] }[];
    const select = selectRow!.components[0]!;
    expect(select).toMatchObject({ type: ComponentType.StringSelect, custom_id: "rolemenu:1", min_values: 1, max_values: 1 });
    const options = select.options as { label: string; value: string; emoji?: unknown }[];
    expect(options).toHaveLength(10);
    expect(options[9]).toEqual({ label: "Mythical Immortal", value: rankRole(9), emoji: { id: `9${rankRole(9).slice(1)}`, name: "rank_mythical_immortal", animated: false } });
    expect(buttonRow!.components[0]).toMatchObject({ custom_id: "rolemenu:1:clear", label: "Retirer mon rôle" });
    expect(roleMenuMessage(view, games).components?.[0]).toMatchObject({ components: [{ max_values: 3 }] });
  });

  it("reads custom and unicode emojis, and drops anything else", () => {
    expect(componentEmoji("<a:dance:123456789012345678>")).toEqual({ id: "123456789012345678", name: "dance", animated: true });
    expect(componentEmoji("🔥")).toEqual({ name: "🔥" });
    expect(componentEmoji("🇫🇷")).toEqual({ name: "🇫🇷" });
    for (const bad of ["fire", "12", "<:x:1>", "<@123456789012345678>", "", null]) expect(componentEmoji(bad)).toBeUndefined();
  });

  it("answers the member in the server's language, roles as mentions", () => {
    expect(roleMenuReply(view, { kind: "changed", added: [LEGEND], removed: [EPIC] })).toBe(`Ajouté : <@&${LEGEND}>\nRetiré : <@&${EPIC}>`);
    expect(roleMenuReply(view, { kind: "refused", reason: "granter" })).toContain("en pause");
  });
});

describe("publishing", () => {
  const view = makeView("en", "https://mlbbdex.com");
  const fakeRest = () => {
    const calls: string[] = [];
    const rest: MessageRest & { calls: string[] } = {
      calls,
      post: vi.fn(async (channelId: string) => {
        calls.push(`post ${channelId}`);
        return { id: "623456789012345600" };
      }),
      edit: vi.fn(async (channelId: string, messageId: string) => {
        calls.push(`edit ${channelId} ${messageId}`);
        return { id: messageId };
      }),
      remove: vi.fn(async (channelId: string, messageId: string) => void calls.push(`remove ${channelId} ${messageId}`)),
    };
    return rest;
  };
  const owns = async (id: string) => id === CHANNEL || id === OLD_CHANNEL;

  it("edits the message already posted", async () => {
    const rest = fakeRest();
    expect(await publishRoleMenu(rest, view, ranks, owns)).toEqual({ ok: true, messageId: MESSAGE, channelId: CHANNEL, created: false });
    expect(rest.calls).toEqual([`edit ${CHANNEL} ${MESSAGE}`]);
  });

  it("posts again when the message was deleted, and moves it when the channel changed", async () => {
    const rest = fakeRest();
    rest.edit = vi.fn(async () => {
      throw Object.assign(new Error("Unknown Message"), { code: RESTJSONErrorCodes.UnknownMessage, status: 404 });
    });
    expect(await publishRoleMenu(rest, view, ranks, owns)).toMatchObject({ ok: true, created: true });
    const moved = fakeRest();
    await publishRoleMenu(moved, view, { ...ranks, messageChannelId: OLD_CHANNEL }, owns);
    expect(moved.calls).toEqual([`post ${CHANNEL}`, `remove ${OLD_CHANNEL} ${MESSAGE}`]);
    // Never in a channel the bot does not report for the server.
    const foreign = fakeRest();
    expect(await publishRoleMenu(foreign, view, { ...ranks, channelId: "523456789012345670" }, owns)).toEqual({ ok: false, error: "channel_not_available" });
    expect(foreign.calls).toEqual([]);
  });

  it("says why Discord refused", async () => {
    const rest = fakeRest();
    rest.post = vi.fn(async () => {
      throw Object.assign(new Error("Missing Permissions"), { code: RESTJSONErrorCodes.MissingPermissions, status: 403 });
    });
    expect(await publishRoleMenu(rest, view, { ...ranks, messageId: null }, owns)).toEqual({ ok: false, error: "missing_permissions" });
    rest.post = vi.fn(async () => {
      throw Object.assign(new Error("Invalid Form Body"), { code: 50035, status: 400 });
    });
    expect(await publishRoleMenu(rest, view, { ...ranks, messageId: null }, owns)).toEqual({ ok: false, error: "invalid_menu" });
  });
});

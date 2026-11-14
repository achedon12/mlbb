import { RESTJSONErrorCodes, type APIMessageComponentEmoji } from "discord.js";
import { log } from "../log.js";
import { classifyError, errorLabel } from "../managers/poster.js";
import type { RoleMenu } from "../site/schemas.js";
import type { AutoRoleCheck } from "./auto-roles.js";
import type { GranterVerdict } from "./granters.js";

/**
 * Self-assign role menus: a message the bot posted for a server (an embed,
 * a select menu of up to 25 roles, a "remove my roles" button), used by its
 * members to give themselves a role, or swap it in "single" mode (ranks).
 *
 * Nothing in the interaction is trusted beyond which menu and which of its
 * options were picked: the menu is read from the site (by the server the
 * interaction comes from, so another server's menu id finds nothing), the
 * message must be the one the site recorded for it, and every value must
 * be one of its options. Before each change, the same rules as the
 * auto-roles apply to every role touched, added or removed: the bot holds
 * Manage Roles, the role is below its own, not managed, without any
 * moderation or administration permission (`checkGuildRoles`), and the
 * manager who configured the menu could still give it themselves
 * (`granterVerdict`, cached a few minutes). A member is also limited to a
 * few changes in a short window, and to one at a time.
 *
 * Nothing is stored about the member: the counters of the rate limit stay
 * in memory, for the window only.
 */

export const ROLE_MENU_PREFIX = "rolemenu";
/** Reason in the server's audit log. */
export const ROLE_MENU_REASON = "MLBBDex role menu";
/** Changes per member and server in the window. */
export const ROLE_MENU_RATE_MAX = 5;
export const ROLE_MENU_RATE_WINDOW_MS = 30_000;
/** Members tracked per shard by the rate limit; past this, the oldest are forgotten. */
export const ROLE_MENU_RATE_ENTRIES = 10_000;

/** A miss reads the server's menus fresh at most this often. */
export const FRESH_READ_INTERVAL_MS = 10_000;

export const selectId = (menuId: string) => `${ROLE_MENU_PREFIX}:${menuId}`;
export const clearId = (menuId: string) => `${ROLE_MENU_PREFIX}:${menuId}:clear`;

const CUSTOM_EMOJI = /^<(a?):([A-Za-z0-9_]{2,32}):(\d{17,20})>$/;
const UNICODE_EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Component}]{1,16}$/u;
const PICTOGRAPH = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Me}]/u;

/**
 * The emoji of an option for Discord's component: a custom emoji `<:name:id>`
 * (`<a:name:id>` animated), or a unicode one. Anything else: none, rather
 * than a message Discord refuses.
 */
export function componentEmoji(text: string | null): APIMessageComponentEmoji | undefined {
  if (!text) return undefined;
  const custom = CUSTOM_EMOJI.exec(text);
  if (custom) return { id: custom[3]!, name: custom[2]!, animated: custom[1] === "a" };
  if (UNICODE_EMOJI.test(text) && PICTOGRAPH.test(text)) return { name: text };
  return undefined;
}

export type RoleMenuAction = { type: "select"; values: readonly string[] } | { type: "clear" };

export interface RoleChange {
  add: string[];
  remove: string[];
}

/**
 * What a pick does to a member's roles, from the menu as stored. `null`:
 * a value the menu does not hold (or more than one in single mode).
 *
 * - single: the role picked is given, the menu's other roles the member
 *   has are removed (one rank at a time);
 * - multiple: each role picked is toggled, given if missing, removed if held;
 * - clear: every role of the menu the member has is removed.
 */
export function planRoleChange(menu: RoleMenu, memberRoles: ReadonlySet<string>, action: RoleMenuAction): RoleChange | null {
  const menuRoles = menu.options.map((o) => o.roleId);
  if (action.type === "clear") return { add: [], remove: menuRoles.filter((id) => memberRoles.has(id)) };
  const values = action.values;
  if (!values.length || new Set(values).size !== values.length) return null;
  if (values.some((v) => !menuRoles.includes(v))) return null;
  if (menu.mode === "single") {
    if (values.length !== 1) return null;
    const picked = values[0]!;
    return {
      add: memberRoles.has(picked) ? [] : [picked],
      remove: menuRoles.filter((id) => id !== picked && memberRoles.has(id)),
    };
  }
  return { add: values.filter((v) => !memberRoles.has(v)), remove: values.filter((v) => memberRoles.has(v)) };
}

export type RoleMenuOutcome =
  | { kind: "changed"; added: string[]; removed: string[] }
  /** Nothing to do: the role is already there, or none to remove. */
  | { kind: "unchanged"; action: RoleMenuAction["type"] }
  /** No such menu in this server, or not this message (an old copy). */
  | { kind: "unknown_menu" }
  | { kind: "unknown_option" }
  | { kind: "rate_limited" }
  /** `role`: a role is gone; `bot`: the bot may not give it; `granter`: the manager who set it up may not. */
  | { kind: "refused"; reason: "role" | "bot" | "granter" }
  /** An outage (the server out of the cache, Discord unreachable): try again later. */
  | { kind: "failed" };

export interface RoleMenuRequest {
  guildId: string;
  userId: string;
  menuId: string;
  /** The message clicked: it must be the one the site recorded for the menu. */
  messageId: string;
  action: RoleMenuAction;
  /** The member's roles, as the interaction carries them (fresh at the click). */
  memberRoles: ReadonlySet<string>;
  addRole(roleId: string, reason: string): Promise<unknown>;
  removeRole(roleId: string, reason: string): Promise<unknown>;
}

export interface RoleMenuDeps {
  /** The server's menus, from the site (cached; `fresh` skips the cache). */
  menus(guildId: string, fresh?: boolean): Promise<RoleMenu[]>;
  /** May the bot give (or take) these roles in this server, now? */
  check(guildId: string, roleIds: readonly string[]): AutoRoleCheck;
  /** Could the manager who configured the menu give these roles, now? */
  granter(guildId: string, userId: string, roleIds: readonly string[]): Promise<GranterVerdict>;
  now?: () => number;
}

/** A few changes per member in a window, counted in memory only. */
export class MemberRateLimit {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max = ROLE_MENU_RATE_MAX,
    private readonly windowMs = ROLE_MENU_RATE_WINDOW_MS,
    private readonly maxEntries = ROLE_MENU_RATE_ENTRIES,
  ) {}

  allow(key: string, now: number): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.delete(key);
      while (this.hits.size >= this.maxEntries) {
        const oldest = this.hits.keys().next().value;
        if (oldest === undefined) break;
        this.hits.delete(oldest);
      }
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.max;
  }

  get size(): number {
    return this.hits.size;
  }
}

export class RoleMenus {
  private readonly limit = new MemberRateLimit();
  /** `guild:member` with a change running: a second click waits for nothing, it is refused. */
  private readonly running = new Set<string>();
  /** Server → when its menus were last read fresh after a miss. */
  private readonly freshReads = new Map<string, number>();
  private readonly now: () => number;

  constructor(private readonly deps: RoleMenuDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** Never throws: the answer to the member is built from the outcome. */
  async handle(request: RoleMenuRequest): Promise<RoleMenuOutcome> {
    const key = `${request.guildId}:${request.userId}`;
    if (this.running.has(key) || !this.limit.allow(key, this.now())) return { kind: "rate_limited" };
    this.running.add(key);
    try {
      return await this.run(request);
    } catch (error) {
      log.warn("role menu failed", { guild: request.guildId, error });
      return { kind: "failed" };
    } finally {
      this.running.delete(key);
    }
  }

  private async find(request: RoleMenuRequest): Promise<RoleMenu | null> {
    const match = (menus: RoleMenu[]) => menus.find((m) => m.id === request.menuId && m.messageId === request.messageId) ?? null;
    const cached = match(await this.deps.menus(request.guildId));
    if (cached) return cached;
    // The cached copy may predate the menu or its last publication: once
    // more, fresh, at most once per server in a window (an old copy of a
    // message, clicked by many, must not turn into one site call per click).
    const now = this.now();
    const last = this.freshReads.get(request.guildId);
    if (last !== undefined && now - last < FRESH_READ_INTERVAL_MS) return null;
    this.freshReads.delete(request.guildId);
    if (this.freshReads.size >= ROLE_MENU_RATE_ENTRIES) this.freshReads.clear();
    this.freshReads.set(request.guildId, now);
    return match(await this.deps.menus(request.guildId, true));
  }

  private async run(request: RoleMenuRequest): Promise<RoleMenuOutcome> {
    const menu = await this.find(request);
    if (!menu) return { kind: "unknown_menu" };
    const change = planRoleChange(menu, request.memberRoles, request.action);
    if (!change) return { kind: "unknown_option" };
    const touched = [...change.add, ...change.remove];
    if (!touched.length) return { kind: "unchanged", action: request.action.type };

    const check = this.deps.check(request.guildId, touched);
    if (!check.ok) {
      if (check.reason === "unknown_guild") return { kind: "failed" };
      log.warn("role menu refused", { guild: request.guildId, menu: menu.id, reason: check.reason, role: check.roleId });
      return { kind: "refused", reason: check.reason === "unknown_role" ? "role" : "bot" };
    }
    // The bot gives only what the manager who set the menu up could give themselves.
    const granter = menu.configuredBy ? await this.deps.granter(request.guildId, menu.configuredBy, touched) : "refused";
    if (granter === "unknown") return { kind: "failed" };
    if (granter === "refused") {
      log.warn("role menu refused", { guild: request.guildId, menu: menu.id, reason: "granter" });
      return { kind: "refused", reason: "granter" };
    }

    // One role per call (PUT / DELETE of that role alone): a change made
    // meanwhile to the member's other roles is never overwritten. The new
    // role first: a swap cut short leaves two ranks, never none.
    const added: string[] = [];
    const removed: string[] = [];
    try {
      for (const id of change.add) {
        await request.addRole(id, ROLE_MENU_REASON);
        added.push(id);
      }
      for (const id of change.remove) {
        await request.removeRole(id, ROLE_MENU_REASON);
        removed.push(id);
      }
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      const forbidden = classifyError(error) === "forbidden" && code !== RESTJSONErrorCodes.UnknownMember;
      log.warn(forbidden ? "role menu forbidden" : "role menu change failed", { guild: request.guildId, error: errorLabel(error) });
      if (added.length || removed.length) return { kind: "changed", added, removed };
      return forbidden ? { kind: "refused", reason: code === RESTJSONErrorCodes.UnknownRole ? "role" : "bot" } : { kind: "failed" };
    }
    return { kind: "changed", added, removed };
  }
}

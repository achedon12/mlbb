import { RESTJSONErrorCodes } from "discord.js";
import { AUTO_ROLE_REASON, type AutoRoleCheck } from "../discord/auto-roles.js";
import { log } from "../log.js";
import type { AutoRoleFailure, AutoRoleSetting, GuildSettings } from "../site/schemas.js";
import { classifyError, errorLabel } from "./poster.js";

/**
 * Auto-roles: the roles a server chose for the people who join, and the
 * ones for the bots added to it, given by the shard that received the
 * member event, in one `member.roles.add([...])` call per member.
 *
 * Membership screening: a member who has not yet accepted the server's
 * rules (`member.pending`) cannot be given a role, Discord refuses it. Such
 * a member is remembered (server and member id only, in memory) and given
 * the roles when Discord reports them no longer pending. That report comes
 * as `guildMemberUpdate`, or as `guildMemberAvailable` when the member is
 * no longer in the shard's (deliberately tiny) member cache, which is why
 * the bot cannot just compare the old and new member. Bots never go
 * through screening: they get theirs at once.
 *
 * Raids: assignments go through one queue per shard, a few at a time
 * (@discordjs/rest also waits out Discord's rate limits per route), and the
 * queue is capped: past it, a member is skipped and logged rather than
 * held in memory without bound.
 *
 * Every assignment checks again, against the cache at that moment, that
 * the bot has Manage Roles and each role is one it may give (see
 * `discord/auto-roles.ts`), and that the manager who chose the roles is
 * still a member who could give them (Manage Roles, roles below theirs, or
 * owner), so a manager cannot have the bot give a role they could not. When
 * either fails, or Discord answers that the bot lacks the permission, the
 * server's auto-roles are marked failing on the site, with the reason, and
 * skipped until the settings are saved again.
 */

/** Assignments running at once, per shard. */
export const AUTO_ROLE_CONCURRENCY = 2;
/** Members waiting for their roles, per shard; past this, skipped. */
export const AUTO_ROLE_QUEUE_MAX = 2_000;
/** Members in screening remembered at most this long, and this many per shard. */
export const SCREENING_TTL_MS = 24 * 60 * 60 * 1000;
export const SCREENING_MAX = 10_000;

/** What the roler reads of a member, and the one call it makes. */
export interface JoinedMember {
  guildId: string;
  id: string;
  bot: boolean;
  /** Still in the server's membership screening. */
  pending: boolean;
  addRoles(roleIds: string[], reason: string): Promise<unknown>;
}

export interface AutoRolerDeps {
  /** The server's settings, cached by the site client. */
  settings: (guildId: string) => Promise<GuildSettings>;
  /** May the bot give these roles in this server, now? */
  check: (guildId: string, roleIds: readonly string[]) => AutoRoleCheck;
  /**
   * Could the manager who chose them give these roles, now? `unknown`:
   * Discord could not be asked (an outage), nothing is marked.
   */
  granter: (guildId: string, userId: string, roleIds: readonly string[]) => Promise<"ok" | "refused" | "unknown">;
  markFailing: (guildId: string, reason: AutoRoleFailure) => Promise<unknown>;
  now?: () => number;
}

const rolesFor = (setting: AutoRoleSetting, member: Pick<JoinedMember, "bot">): string[] =>
  setting.failing ? [] : member.bot ? setting.botRoleIds : setting.roleIds;

export class AutoRoler {
  private readonly queue: JoinedMember[] = [];
  private running = 0;
  /** `guild:member` → when they joined, for members still in screening. */
  private readonly screening = new Map<string, number>();
  private readonly idle: (() => void)[] = [];
  private readonly now: () => number;

  constructor(private readonly deps: AutoRolerDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** `guildMemberAdd`. Never throws: a member event must not crash the shard. */
  async joined(member: JoinedMember): Promise<void> {
    try {
      if (!rolesFor((await this.deps.settings(member.guildId)).autoRoles, member).length) return;
      if (member.pending && !member.bot) {
        this.remember(member);
        return;
      }
      this.enqueue(member);
    } catch (error) {
      log.warn("auto-role failed", { guild: member.guildId, error });
    }
  }

  /**
   * `guildMemberUpdate` / `guildMemberAvailable`: a member remembered at
   * their join who is no longer pending gets their roles now. Any other
   * update (a nickname, a role an admin removed) gives nothing.
   */
  screened(member: JoinedMember): void {
    if (member.pending) return;
    const key = `${member.guildId}:${member.id}`;
    const since = this.screening.get(key);
    if (since === undefined) return;
    this.screening.delete(key);
    if (this.now() - since > SCREENING_TTL_MS) return;
    this.enqueue(member);
  }

  /** Members waiting in screening and in the queue, for the tests. */
  get waiting(): { screening: number; queued: number; running: number } {
    return { screening: this.screening.size, queued: this.queue.length, running: this.running };
  }

  /** Resolves once the queue is empty and nothing runs (tests, shutdown). */
  drained(): Promise<void> {
    if (!this.running && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => this.idle.push(resolve));
  }

  /** Drops every waiting member (shutdown). */
  stop(): void {
    this.queue.length = 0;
    this.screening.clear();
  }

  private remember(member: JoinedMember): void {
    const key = `${member.guildId}:${member.id}`;
    const now = this.now();
    this.screening.delete(key);
    while (this.screening.size >= SCREENING_MAX) {
      const oldest = this.screening.keys().next().value;
      if (oldest === undefined) break;
      this.screening.delete(oldest);
    }
    // Oldest first, so expired entries are at the front.
    for (const [k, since] of this.screening) {
      if (now - since <= SCREENING_TTL_MS) break;
      this.screening.delete(k);
    }
    this.screening.set(key, now);
  }

  private enqueue(member: JoinedMember): void {
    if (this.queue.length >= AUTO_ROLE_QUEUE_MAX) {
      log.warn("auto-role queue full, member skipped", { guild: member.guildId });
      return;
    }
    this.queue.push(member);
    this.pump();
  }

  private pump(): void {
    while (this.running < AUTO_ROLE_CONCURRENCY && this.queue.length) {
      const member = this.queue.shift()!;
      this.running++;
      void this.assign(member)
        .catch((error: unknown) => log.warn("auto-role failed", { guild: member.guildId, error }))
        .finally(() => {
          this.running--;
          this.pump();
          if (!this.running && !this.queue.length) for (const resolve of this.idle.splice(0)) resolve();
        });
    }
  }

  private async assign(member: JoinedMember): Promise<void> {
    // Read again: auto-roles turned off, or marked failing by a member
    // ahead in the queue, are not given.
    const setting = (await this.deps.settings(member.guildId)).autoRoles;
    const roleIds = rolesFor(setting, member);
    if (!roleIds.length) return;
    const check = this.deps.check(member.guildId, roleIds);
    if (!check.ok) {
      // The server is not in the cache (an outage): nothing the owner can fix.
      if (check.reason === "unknown_guild") return;
      log.warn("auto-role refused", { guild: member.guildId, reason: check.reason, role: check.roleId });
      await this.fail(member.guildId, "bot");
      return;
    }
    // The bot gives only what the manager who chose the roles could give
    // themselves, now: still a member, Manage Roles, roles below theirs.
    const granter = setting.configuredBy ? await this.deps.granter(member.guildId, setting.configuredBy, roleIds) : "refused";
    if (granter === "unknown") {
      log.warn("auto-role granter not checked", { guild: member.guildId });
      return;
    }
    if (granter === "refused") {
      log.warn("auto-role refused", { guild: member.guildId, reason: "granter" });
      await this.fail(member.guildId, "granter");
      return;
    }
    try {
      await member.addRoles(roleIds, AUTO_ROLE_REASON);
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      // Gone already (a raid account kicked, someone who left at once).
      if (code === RESTJSONErrorCodes.UnknownMember) return;
      if (classifyError(error) !== "forbidden") {
        log.warn("auto-role not given", { guild: member.guildId, error: errorLabel(error) });
        return;
      }
      log.warn("auto-role forbidden", { guild: member.guildId, error: errorLabel(error) });
      await this.fail(member.guildId, "bot");
    }
  }

  private async fail(guildId: string, reason: AutoRoleFailure): Promise<void> {
    await this.deps.markFailing(guildId, reason).catch((error: unknown) => log.warn("auto-role failure not recorded", { guild: guildId, error }));
  }
}

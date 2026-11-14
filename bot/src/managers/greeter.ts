import { greetingMessage, greetingSummary, type GreetedMember } from "../embeds/greetings.js";
import { makeView, type View } from "../embeds/common.js";
import { resolveLocale } from "../i18n/index.js";
import { log } from "../log.js";
import type { GreetingKind, GuildSettings } from "../site/schemas.js";
import { classifyError, errorLabel, type Poster } from "./poster.js";

/**
 * Welcome and goodbye messages, posted by the shard that received the
 * member event (a server's events always reach the same shard, so its
 * bursts are counted in one place).
 *
 * Raid safety: the first member of a burst is greeted at once; the members
 * after it, within the same 10 s window, are held. When the window closes,
 * up to 5 members in it get their own message each; more than that and the
 * held members get one summary instead ("Welcome to the N new members!"),
 * and the next window holds every member too, so a raid that goes on keeps
 * posting one summary every 10 s at most. Goodbyes follow the same rule
 * (a mass kick must not flood a channel either).
 *
 * Nothing about members is kept: a held member lives in memory until its
 * window closes, a few seconds, and at most the first few of a burst are
 * held at all (a summary only needs the count).
 */

export const BURST_WINDOW_MS = 10_000;
/** More joins than this in one window: one summary instead. */
export const BURST_MAX = 5;

export interface MemberEvent {
  guildId: string;
  guildName: string;
  /** Discord's preferred locale of the server, the fallback language. */
  guildLocale: string | null;
  memberCount: number;
  member: GreetedMember;
}

export interface GreeterDeps {
  /** The server's settings, cached by the site client. */
  settings: (guildId: string) => Promise<GuildSettings>;
  poster: Pick<Poster, "post">;
  /**
   * Is this channel one of this server's, and may the bot post embeds in
   * it? The setting comes from the dashboard: a channel the bot cannot use
   * is skipped (and marked failing), never tried blind.
   */
  canPost: (guildId: string, channelId: string) => boolean;
  markFailing: (guildId: string, kind: GreetingKind) => Promise<unknown>;
  siteUrl: string;
}

interface Window {
  /** Members seen in this window, the one greeted at once included. */
  seen: number;
  /** Members not greeted yet: the summary counts them all... */
  held: number;
  /** ...but only the first few are kept, to greet them one by one. */
  queue: MemberEvent[];
  /** Last event, for the server's name and language in a summary. */
  last: MemberEvent;
  timer: NodeJS.Timeout;
}

export class Greeter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly deps: GreeterDeps) {}

  /** A member joined or left. Never throws: a member event must not crash the shard. */
  async handle(kind: GreetingKind, event: MemberEvent): Promise<void> {
    try {
      // Off, or known to be failing: nothing to count either.
      if (!(await this.target(kind, event.guildId))) return;
      const key = `${kind}:${event.guildId}`;
      const window = this.windows.get(key);
      if (window) {
        window.seen++;
        window.held++;
        window.last = event;
        if (window.queue.length < BURST_MAX) window.queue.push(event);
        return;
      }
      this.open(kind, key, event, 1);
      await this.greet(kind, event);
    } catch (error) {
      log.warn("greeting failed", { kind, guild: event.guildId, error });
    }
  }

  /** Windows still open, for the tests. */
  get pending(): number {
    return this.windows.size;
  }

  /** Drops every held member without posting (shutdown). */
  stop(): void {
    for (const w of this.windows.values()) clearTimeout(w.timer);
    this.windows.clear();
  }

  private open(kind: GreetingKind, key: string, event: MemberEvent, seen: number): Window {
    const window: Window = {
      seen,
      held: 0,
      queue: [],
      last: event,
      timer: setTimeout(() => void this.close(kind, key), BURST_WINDOW_MS),
    };
    window.timer.unref?.();
    this.windows.set(key, window);
    return window;
  }

  private async close(kind: GreetingKind, key: string): Promise<void> {
    const window = this.windows.get(key);
    this.windows.delete(key);
    if (!window?.held) return;
    try {
      if (window.seen > BURST_MAX) {
        // Still raiding, most likely: the next window greets nobody at once.
        this.open(kind, key, window.last, 0);
        log.info("greeting burst summarised", { kind, guild: window.last.guildId, members: window.held });
        await this.post(kind, window.last, (view) => greetingSummary(view, kind, window.held));
        return;
      }
      for (const event of window.queue) await this.greet(kind, event);
    } catch (error) {
      log.warn("greeting failed", { kind, guild: window.last.guildId, error });
    }
  }

  /** Channel to post in, or null when the message is off or failing. */
  private async target(kind: GreetingKind, guildId: string): Promise<{ channelId: string; settings: GuildSettings } | null> {
    const settings = await this.deps.settings(guildId);
    const setting = settings[kind];
    return setting.channelId && !setting.failing ? { channelId: setting.channelId, settings } : null;
  }

  private greet(kind: GreetingKind, event: MemberEvent): Promise<void> {
    return this.post(kind, event, (view, settings) =>
      greetingMessage(
        view,
        kind,
        { member: event.member, guildName: event.guildName, memberCount: event.memberCount, custom: settings[kind].message },
        { ping: true },
      ),
    );
  }

  /**
   * Posts in the server's current channel for this message: settings are
   * read again (they are cached), so a message turned off or marked failing
   * while members were held is not posted.
   */
  private async post(
    kind: GreetingKind,
    event: MemberEvent,
    build: (view: View, settings: GuildSettings) => Parameters<Poster["post"]>[1],
  ): Promise<void> {
    const target = await this.target(kind, event.guildId);
    if (!target) return;
    const { channelId, settings } = target;
    if (!this.deps.canPost(event.guildId, channelId)) {
      log.warn("greeting channel unavailable", { kind, guild: event.guildId, channel: channelId });
      await this.fail(kind, event.guildId);
      return;
    }
    const view = makeView(resolveLocale(settings.locale, event.guildLocale), this.deps.siteUrl, `greeting-${kind}`);
    try {
      await this.deps.poster.post(channelId, build(view, settings));
    } catch (error) {
      if (classifyError(error) !== "forbidden") {
        // A hiccup: this one greeting is lost, the next member is tried again.
        log.warn("greeting not posted", { kind, guild: event.guildId, error: errorLabel(error) });
        return;
      }
      log.warn("greeting channel forbidden", { kind, guild: event.guildId, channel: channelId, error: errorLabel(error) });
      await this.fail(kind, event.guildId);
    }
  }

  private async fail(kind: GreetingKind, guildId: string): Promise<void> {
    await this.deps.markFailing(guildId, kind).catch((error: unknown) => log.warn("greeting failure not recorded", { kind, guild: guildId, error }));
  }
}

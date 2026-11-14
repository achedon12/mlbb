import type { z } from "zod";
import { TtlCache } from "../cache.js";
import type { Locale } from "../i18n/index.js";
import { signedHeaders } from "../security/signing.js";
import { NotFoundError, requestJson, SiteUnavailableError, type FetchLike } from "./http.js";
import {
  anyBody,
  daily,
  DEFAULT_SETTINGS,
  guildSettings,
  leaderboard,
  pendingAnnouncements,
  type Announcement,
  type Daily,
  type Game,
  type GuildSettings,
  type Leaderboard,
  type Period,
} from "./schemas.js";

/**
 * Client of the site's internal API (`/api/bot/*`), every call HMAC-signed.
 * The bot has no database: everything stateful (settings, deliveries,
 * results, logs) lives on the site, reached through here.
 */

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  locale: Locale;
}

export interface DeliveryReport {
  announcementId: string;
  guildId: string;
  status: "sent" | "failed" | "forbidden";
  messageId?: string;
  error?: string;
}

export interface CommandLogEntry {
  command: string;
  guildId: string | null;
  locale: Locale;
  durationMs: number;
  ok: boolean;
}

export interface DailyResult {
  guildId: string;
  day: string;
  game: Game;
  discordUserId: string;
  discordUserName: string;
  guesses?: number;
  points?: number;
}

/** Settings change from the dashboard: a short cache keeps that delay small. */
const SETTINGS_TTL_MS = 2 * 60 * 1000;
/** The daily puzzle is fixed for the day; ten minutes covers a deploy changing the roster. */
const DAILY_TTL_MS = 10 * 60 * 1000;

export class SiteClient {
  private readonly settingsCache = new TtlCache<GuildSettings>(SETTINGS_TTL_MS, 2000);
  private readonly dailyCache = new TtlCache<Daily>(DAILY_TTL_MS, 12);

  constructor(
    private readonly baseUrl: string,
    private readonly secret: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly retryDelayMs = 1100,
  ) {}

  async request<T>(method: "GET" | "POST", path: string, schema: z.ZodType<T>, body?: unknown, timeoutMs?: number): Promise<T> {
    try {
      return await this.send(method, path, schema, body, timeoutMs);
    } catch (error) {
      // The site refuses a signature it has already seen. Two identical calls
      // in the same second (two members opening the same leaderboard) sign the
      // same bytes: the second one is retried once, a second later, with a
      // fresh timestamp and therefore a fresh signature.
      if (!(error instanceof SiteUnavailableError) || error.status !== 401) throw error;
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      return this.send(method, path, schema, body, timeoutMs);
    }
  }

  private send<T>(method: "GET" | "POST", path: string, schema: z.ZodType<T>, body?: unknown, timeoutMs?: number): Promise<T> {
    const raw = body === undefined ? "" : JSON.stringify(body);
    return requestJson(
      this.fetchImpl,
      `${this.baseUrl}${path}`,
      schema,
      {
        method,
        headers: {
          accept: "application/json",
          ...(raw ? { "content-type": "application/json" } : {}),
          ...signedHeaders(this.secret, method, path, raw),
        },
        ...(raw ? { body: raw } : {}),
      },
      timeoutMs,
    );
  }

  syncGuilds(full: boolean, guilds: GuildSummary[]): Promise<unknown> {
    return this.request("POST", "/api/bot/guilds/sync", anyBody, { full, guilds }, 30_000);
  }

  joinGuild(guild: GuildSummary): Promise<unknown> {
    const { id, ...rest } = guild;
    return this.request("POST", `/api/bot/guilds/${id}/join`, anyBody, rest);
  }

  leaveGuild(id: string): Promise<unknown> {
    this.settingsCache.delete(id);
    return this.request("POST", `/api/bot/guilds/${id}/leave`, anyBody, {});
  }

  /** Settings of a server, defaults when the site has none (or answers 404). */
  settings(guildId: string): Promise<GuildSettings> {
    return this.settingsCache.getOrLoad(guildId, async () => {
      try {
        return await this.request("GET", `/api/bot/guilds/${guildId}/settings`, guildSettings);
      } catch (error) {
        if (error instanceof NotFoundError) return DEFAULT_SETTINGS;
        throw error;
      }
    });
  }

  /** Locale setting of a server, or null; never throws (replies must not depend on it). */
  async guildLocale(guildId: string | null): Promise<string | null> {
    if (!guildId) return null;
    try {
      return (await this.settings(guildId)).locale;
    } catch {
      return null;
    }
  }

  async pendingAnnouncements(): Promise<Announcement[]> {
    return (await this.request("GET", "/api/bot/announcements/pending", pendingAnnouncements, undefined, 15_000)).announcements;
  }

  reportDeliveries(reports: DeliveryReport[]): Promise<unknown> {
    return this.request("POST", "/api/bot/deliveries", anyBody, reports);
  }

  logCommands(entries: CommandLogEntry[]): Promise<unknown> {
    return this.request("POST", "/api/bot/commands/log", anyBody, entries);
  }

  daily(day: string, locale: Locale): Promise<Daily> {
    return this.dailyCache.getOrLoad(`${day}:${locale}`, () =>
      this.request("GET", `/api/bot/daily?day=${day}&locale=${locale}`, daily),
    );
  }

  submitResults(results: DailyResult[]): Promise<unknown> {
    return this.request("POST", "/api/bot/daily/results", anyBody, results);
  }

  leaderboard(guildId: string, game: Game, period: Period): Promise<Leaderboard> {
    return this.request("GET", `/api/bot/daily/leaderboard?guild=${guildId}&game=${game}&period=${period}`, leaderboard);
  }
}

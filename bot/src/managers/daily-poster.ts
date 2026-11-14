import { makeView } from "../embeds/common.js";
import { dailyPost } from "../embeds/daily.js";
import { dayUtc } from "../games/state.js";
import { isLocale } from "../i18n/index.js";
import { log } from "../log.js";
import type { SiteClient } from "../site/internal-api.js";
import { runLimited } from "./delivery.js";
import { classifyError, type Poster } from "./poster.js";

/**
 * The daily MLBBdle and quiz posts, at each server's chosen UTC hour.
 *
 * Checked every minute; the work runs once per hour. Before posting, the
 * bot looks at its own recent messages in the channel for today's Play
 * button: a restart in the middle of the hour never posts twice.
 */

const CHECK_INTERVAL_MS = 60 * 1000;
const SETTINGS_CONCURRENCY = 4;

export interface DailyPosterDeps {
  site: Pick<SiteClient, "settings" | "daily">;
  poster: Poster;
  guildIds: () => Promise<string[]>;
  siteUrl: string;
  botId: string;
  /** See `DeliveryDeps.ownsChannel`. */
  ownsChannel?: (guildId: string, channelId: string) => Promise<boolean>;
  now?: () => number;
}

export class DailyPoster {
  private lastHour: string | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly posted = new Set<string>();
  private readonly now: () => number;

  constructor(private readonly deps: DailyPosterDeps) {
    this.now = deps.now ?? Date.now;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), CHECK_INTERVAL_MS);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Runs the hour's posts once per UTC hour. */
  async tick(): Promise<void> {
    const now = new Date(this.now());
    const hourKey = now.toISOString().slice(0, 13);
    if (hourKey === this.lastHour) return;
    this.lastHour = hourKey;
    try {
      await this.run(now.getUTCHours(), dayUtc(now.getTime()));
    } catch (error) {
      log.warn("daily posts failed", { error });
    }
  }

  async run(hour: number, day: string): Promise<number> {
    for (const key of this.posted) if (!key.startsWith(day)) this.posted.delete(key);
    const guildIds = await this.deps.guildIds();
    let count = 0;
    let number: { mlbbdle: number; quiz: number } | null = null;
    const numbers = async () => {
      if (!number) {
        const d = await this.deps.site.daily(day, "en");
        number = { mlbbdle: d.number, quiz: d.quiz?.numero ?? d.number };
      }
      return number;
    };

    await runLimited(
      guildIds.map((guildId) => async () => {
        const settings = await this.deps.site.settings(guildId).catch(() => null);
        if (!settings || settings.dailyHourUtc !== hour) return;
        const locale = isLocale(settings.locale) ? settings.locale : "en";
        for (const [game, channelId] of [
          ["mlbbdle", settings.dailyMlbbdleChannelId],
          ["quiz", settings.dailyQuizChannelId],
        ] as const) {
          if (!channelId) continue;
          if (this.deps.ownsChannel && !(await this.deps.ownsChannel(guildId, channelId).catch(() => false))) continue;
          if (await this.postOnce(game, day, channelId, locale, numbers)) count++;
        }
      }),
      SETTINGS_CONCURRENCY,
    );
    if (count) log.info("daily posts sent", { count, hour });
    return count;
  }

  private async postOnce(
    game: "mlbbdle" | "quiz",
    day: string,
    channelId: string,
    locale: Parameters<typeof makeView>[0],
    numbers: () => Promise<{ mlbbdle: number; quiz: number }>,
  ): Promise<boolean> {
    const key = `${day}:${game}:${channelId}`;
    if (this.posted.has(key)) return false;
    const marker = `daily:${game}:${day}`;
    try {
      const recent = await this.deps.poster.recentCustomIds(channelId, this.deps.botId);
      if (recent.includes(marker)) {
        this.posted.add(key);
        return false;
      }
      const n = await numbers();
      await this.deps.poster.post(channelId, dailyPost(makeView(locale, this.deps.siteUrl, `daily-${game}`), game, day, n[game]));
      this.posted.add(key);
      return true;
    } catch (error) {
      // A channel the bot can no longer use is skipped for the day rather than retried every hour.
      if (classifyError(error) === "forbidden") this.posted.add(key);
      log.warn("daily post failed", { game, error });
      return false;
    }
  }
}

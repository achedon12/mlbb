import { announcementMessage } from "../embeds/announcements.js";
import { log } from "../log.js";
import type { DeliveryReport, SiteClient } from "../site/internal-api.js";
import type { Announcement } from "../site/schemas.js";
import { classifyError, errorLabel, type Poster } from "./poster.js";

/**
 * Announcement delivery.
 *
 * The site decides what is pending (it holds the `Delivery` table); the bot
 * posts and reports. Two rules make it safe to run again at any time:
 *
 * - a post that succeeded is remembered until its report reached the site,
 *   so a site that is down at report time never causes a second post;
 * - a transient failure is retried on later rounds with exponential backoff
 *   (2 min, 4, 8... capped at 6 h), and reported as failed after a few tries;
 *   a lost permission is reported at once as `forbidden`, never retried.
 */

export const POLL_INTERVAL_MS = 2 * 60 * 1000;
export const BACKOFF_BASE_MS = 2 * 60 * 1000;
export const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 6;
const REPORT_BATCH = 500;
const POST_CONCURRENCY = 5;
/** Sent posts are remembered this long, comfortably past any site outage worth surviving. */
const SENT_MEMORY_MS = 24 * 60 * 60 * 1000;

export function backoffDelay(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

interface Retry {
  attempts: number;
  nextAt: number;
}

export interface DeliveryDeps {
  site: Pick<SiteClient, "pendingAnnouncements" | "reportDeliveries">;
  poster: Pick<Poster, "post">;
  siteUrl: string;
  /**
   * Does this channel belong to this server? Settings come from the
   * dashboard: a channel id from another server must never be posted to.
   * Absent in tests, where every channel belongs.
   */
  ownsChannel?: (guildId: string, channelId: string) => Promise<boolean>;
  now?: () => number;
}

export interface FlushSummary {
  sent: number;
  forbidden: number;
  failed: number;
  deferred: number;
}

export class DeliveryService {
  private readonly retries = new Map<string, Retry>();
  private readonly sent = new Map<string, { messageId: string; at: number }>();
  private unreported: DeliveryReport[] = [];
  private running: Promise<FlushSummary> | null = null;
  private again = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly now: () => number;

  constructor(private readonly deps: DeliveryDeps) {
    this.now = deps.now ?? Date.now;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush().catch(() => undefined), POLL_INTERVAL_MS);
    this.timer.unref();
    void this.flush().catch(() => undefined);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * One delivery round. Concurrent calls (the timer and a flush request from
   * the site) share the running round, plus one more right after it, so an
   * announcement created mid-round is not left waiting two minutes.
   */
  flush(): Promise<FlushSummary> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.round()
      .catch((error: unknown) => {
        log.warn("delivery round failed", { error });
        return { sent: 0, forbidden: 0, failed: 0, deferred: 0 };
      })
      .finally(() => {
        this.running = null;
        if (this.again) {
          this.again = false;
          void this.flush();
        }
      });
    return this.running;
  }

  private async report(reports: DeliveryReport[]): Promise<void> {
    this.unreported.push(...reports);
    while (this.unreported.length) {
      const batch = this.unreported.slice(0, REPORT_BATCH);
      await this.deps.site.reportDeliveries(batch); // Throws: the rest stays queued for the next round.
      this.unreported.splice(0, batch.length);
    }
  }

  private async round(): Promise<FlushSummary> {
    const now = this.now();
    for (const [key, s] of this.sent) if (now - s.at > SENT_MEMORY_MS) this.sent.delete(key);
    // Reports owed from an earlier round go first: until the site knows, it
    // still lists those deliveries as pending.
    await this.report([]);

    const announcements = await this.deps.site.pendingAnnouncements();
    const summary: FlushSummary = { sent: 0, forbidden: 0, failed: 0, deferred: 0 };
    const reports: DeliveryReport[] = [];
    const jobs: (() => Promise<void>)[] = [];

    for (const a of announcements) {
      for (const target of a.targets) {
        const key = `${a.id}:${target.guildId}`;
        const already = this.sent.get(key);
        if (already) {
          reports.push({ announcementId: a.id, guildId: target.guildId, status: "sent", messageId: already.messageId });
          continue;
        }
        const retry = this.retries.get(key);
        if (retry && retry.nextAt > now) {
          summary.deferred++;
          continue;
        }
        jobs.push(() => this.deliver(a, target, key, reports, summary));
      }
    }

    await runLimited(jobs, POST_CONCURRENCY);
    await this.report(reports);
    if (summary.sent || summary.forbidden || summary.failed) log.info("announcements delivered", { ...summary });
    return summary;
  }

  private async deliver(
    a: Announcement,
    target: Announcement["targets"][number],
    key: string,
    reports: DeliveryReport[],
    summary: FlushSummary,
  ): Promise<void> {
    const base = { announcementId: a.id, guildId: target.guildId };
    const message = announcementMessage(a.type, a.payload, target.locale, target.roleId, this.deps.siteUrl);
    if (!message) {
      summary.failed++;
      reports.push({ ...base, status: "failed", error: "invalid payload" });
      return;
    }
    try {
      if (this.deps.ownsChannel && !(await this.deps.ownsChannel(target.guildId, target.channelId))) {
        this.retries.delete(key);
        summary.forbidden++;
        reports.push({ ...base, status: "forbidden", error: "channel not in this server" });
        return;
      }
      const { id } = await this.deps.poster.post(target.channelId, message);
      this.sent.set(key, { messageId: id, at: this.now() });
      this.retries.delete(key);
      summary.sent++;
      reports.push({ ...base, status: "sent", messageId: id });
    } catch (error) {
      const kind = classifyError(error);
      if (kind === "transient") {
        const attempts = (this.retries.get(key)?.attempts ?? 0) + 1;
        if (attempts < MAX_ATTEMPTS) {
          this.retries.set(key, { attempts, nextAt: this.now() + backoffDelay(attempts) });
          summary.deferred++;
          return;
        }
      }
      this.retries.delete(key);
      if (kind === "forbidden") summary.forbidden++;
      else summary.failed++;
      reports.push({ ...base, status: kind === "forbidden" ? "forbidden" : "failed", error: errorLabel(error) });
    }
  }
}

export async function runLimited(jobs: (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) await jobs[next++]!();
    }),
  );
}

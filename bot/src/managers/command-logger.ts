import { log } from "../log.js";
import type { CommandLogEntry, SiteClient } from "../site/internal-api.js";

/**
 * Command usage, counted for the admin panel: which commands, how fast, how
 * often they fail. No user id is recorded, only counts.
 *
 * Entries are buffered and sent every 30 s in one request, instead of one
 * request per command. If the site is down the buffer keeps growing up to a
 * cap, then drops the oldest entries: statistics are not worth the memory.
 */

export const FLUSH_INTERVAL_MS = 30_000;
const MAX_BATCH = 500;
const MAX_BUFFER = 5000;

export class CommandLogger {
  private buffer: CommandLogEntry[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;

  constructor(private readonly site: Pick<SiteClient, "logCommands"> | null) {}

  record(entry: CommandLogEntry): void {
    if (!this.site) return;
    this.buffer.push({ ...entry, durationMs: Math.max(0, Math.round(entry.durationMs)) });
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
  }

  get pending(): number {
    return this.buffer.length;
  }

  start(): void {
    if (this.timer || !this.site) return;
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }

  /** Sends the buffer in batches; a failed batch goes back to the front for the next flush. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      while (this.site && this.buffer.length) {
        const batch = this.buffer.splice(0, MAX_BATCH);
        try {
          await this.site.logCommands(batch);
        } catch (error) {
          this.buffer.unshift(...batch);
          if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
          log.warn("command log flush failed", { error, pending: this.buffer.length });
          return;
        }
      }
    })().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }
}

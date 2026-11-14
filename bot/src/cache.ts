/**
 * Small in-memory cache with a time to live and a size cap.
 *
 * The bot runs one process per shard, each with its own copy: entries must
 * stay few and small (lists of a hundred heroes, a few settings), never one
 * per user. When a reload fails, the last value is served past its expiry:
 * a site that is down for a minute must not turn every command into an error.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>();
  private readonly inflight = new Map<string, Promise<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    return entry && entry.expires > this.now() ? entry.value : undefined;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Fresh value, or the result of `load`. Concurrent callers share one load;
   * a failed load falls back to the stale value when there is one.
   */
  async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
    const fresh = this.get(key);
    if (fresh !== undefined) return fresh;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const promise = load()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .catch((error: unknown) => {
        const stale = this.entries.get(key);
        if (stale) return stale.value;
        throw error;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}

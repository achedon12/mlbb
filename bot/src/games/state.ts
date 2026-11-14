/**
 * Progress of a player in today's games, kept in the shard's memory.
 *
 * The site stores results, not progress: a restart loses half-played games,
 * which costs a player a few guesses at worst, and spares a database on the
 * bot. Only today's entries are kept (a new day empties the store), and the
 * count is capped so a raid of players cannot exhaust the process.
 */
export class DayStore<T> {
  private day = "";
  private readonly entries = new Map<string, T>();

  constructor(private readonly maxEntries = 50_000) {}

  private roll(day: string): void {
    if (day !== this.day) {
      this.day = day;
      this.entries.clear();
    }
  }

  get(day: string, key: string): T | undefined {
    this.roll(day);
    return this.entries.get(key);
  }

  set(day: string, key: string, value: T): void {
    this.roll(day);
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, value);
  }

  get size(): number {
    return this.entries.size;
  }
}

/** UTC date of an instant, the day boundary of the site's daily games. */
export function dayUtc(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

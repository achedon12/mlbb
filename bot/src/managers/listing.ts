import { log } from "../log.js";
import type { FetchLike } from "../site/http.js";

/**
 * Server count posted to the bot lists every 30 minutes, so their pages show
 * a live figure. Each list is optional: without its token, nothing is sent.
 * Tokens only travel in the Authorization header and are never logged.
 */

export const LISTING_INTERVAL_MS = 30 * 60 * 1000;

export interface ListingTokens {
  topgg?: string | undefined;
  dbl?: string | undefined;
  dbotsgg?: string | undefined;
}

export interface Counts {
  guilds: number;
  shards: number;
}

interface Target {
  name: string;
  token: string;
  url: string;
  body: Record<string, number>;
}

export function listingTargets(botId: string, tokens: ListingTokens, counts: Counts): Target[] {
  const targets: Target[] = [];
  if (tokens.topgg) {
    targets.push({
      name: "top.gg",
      token: tokens.topgg,
      url: `https://top.gg/api/bots/${botId}/stats`,
      body: { server_count: counts.guilds, shard_count: counts.shards },
    });
  }
  if (tokens.dbl) {
    targets.push({
      name: "discordbotlist.com",
      token: tokens.dbl,
      url: `https://discordbotlist.com/api/v1/bots/${botId}/stats`,
      body: { guilds: counts.guilds },
    });
  }
  if (tokens.dbotsgg) {
    targets.push({
      name: "discord.bots.gg",
      token: tokens.dbotsgg,
      url: `https://discord.bots.gg/api/v1/bots/${botId}/stats`,
      body: { guildCount: counts.guilds, shardCount: counts.shards },
    });
  }
  return targets;
}

/** Posts to every configured list; returns the names that accepted the figures. */
export async function postListings(
  botId: string,
  tokens: ListingTokens,
  counts: Counts,
  fetchImpl: FetchLike = fetch,
): Promise<string[]> {
  const ok: string[] = [];
  await Promise.all(
    listingTargets(botId, tokens, counts).map(async (target) => {
      try {
        const response = await fetchImpl(target.url, {
          method: "POST",
          headers: { Authorization: target.token, "Content-Type": "application/json" },
          body: JSON.stringify(target.body),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) ok.push(target.name);
        else log.warn("bot list refused the stats", { list: target.name, status: response.status });
      } catch (error) {
        log.warn("bot list unreachable", { list: target.name, error });
      }
    }),
  );
  return ok;
}

/**
 * discordbotlist.com shows a bot's commands only once they were sent to it:
 * the very body registered with Discord, as a JSON array. Its documentation
 * asks for `Bot <token>` on this route (the stats route takes the bare
 * token); a token already written with the prefix is sent as it is.
 */
export function dblAuthorization(token: string): string {
  return /^Bot /i.test(token) ? token : `Bot ${token}`;
}

/** Sends the command list to discordbotlist.com; true when it accepted it. Never throws. */
export async function postCommandsToDbl(
  botId: string,
  token: string,
  commands: unknown[],
  fetchImpl: FetchLike = fetch,
  timeoutMs = 10_000,
): Promise<boolean> {
  try {
    const response = await fetchImpl(`https://discordbotlist.com/api/v1/bots/${botId}/commands`, {
      method: "POST",
      headers: { Authorization: dblAuthorization(token), "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) {
      log.info("command list posted to discordbotlist.com", { count: commands.length });
      return true;
    }
    log.warn("discordbotlist.com refused the command list", { status: response.status });
  } catch (error) {
    log.warn("discordbotlist.com unreachable for the command list", { error });
  }
  return false;
}

export class ListingPoster {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly botId: string,
    private readonly tokens: ListingTokens,
    private readonly counts: () => Promise<Counts>,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  get enabled(): boolean {
    return Boolean(this.tokens.topgg || this.tokens.dbl || this.tokens.dbotsgg);
  }

  start(): void {
    if (this.timer || !this.enabled) return;
    const run = async () => {
      try {
        const counts = await this.counts();
        const ok = await postListings(this.botId, this.tokens, counts, this.fetchImpl);
        log.info("bot list stats posted", { lists: ok, guilds: counts.guilds });
      } catch (error) {
        log.warn("bot list stats skipped", { error });
      }
    };
    this.timer = setInterval(() => void run(), LISTING_INTERVAL_MS);
    this.timer.unref();
    void run();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

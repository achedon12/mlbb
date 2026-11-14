import { ActivityType, type Client } from "discord.js";
import { log } from "../log.js";

/**
 * The bot's status line, under its name in the member list and on its
 * profile: the first thing a curious member reads. It rotates between a
 * few lines, all in English (a presence is the same for every server):
 * where to start, the daily game, and how many servers use the bot.
 */

export const PRESENCE_INTERVAL_MS = 5 * 60 * 1000;

/** Below this, "Watching 3 servers" says less about the bot than nothing at all. */
export const SERVER_COUNT_SHOWN_FROM = 25;

export interface Activity {
  type: ActivityType.Watching | ActivityType.Playing;
  name: string;
}

/** The lines the status rotates through, the server count only once it is worth showing. */
export function presenceLines(servers: number | null): Activity[] {
  const lines: Activity[] = [
    { type: ActivityType.Watching, name: "/help · mlbbdex.com" },
    { type: ActivityType.Playing, name: "/mlbbdle daily" },
  ];
  if (servers !== null && servers >= SERVER_COUNT_SHOWN_FROM) {
    lines.push({ type: ActivityType.Watching, name: `${new Intl.NumberFormat("en").format(servers)} servers · /help` });
  }
  return lines;
}

/** The line shown at a given turn of the rotation. */
export function presenceAt(turn: number, servers: number | null): Activity {
  const lines = presenceLines(servers);
  return lines[((turn % lines.length) + lines.length) % lines.length]!;
}

/**
 * Sets the status now and at every interval. Discord forgets a presence when
 * a session is replaced, so `refresh` is also called after a reconnect.
 */
export class PresenceRotator {
  private turn = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly client: Client,
    private readonly servers: () => Promise<number | null>,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => {
      this.turn++;
      void this.refresh();
    }, PRESENCE_INTERVAL_MS);
    this.timer.unref();
  }

  async refresh(): Promise<void> {
    if (!this.client.user) return;
    try {
      const activity = presenceAt(this.turn, await this.servers());
      this.client.user.setPresence({ activities: [activity], status: "online" });
    } catch (error) {
      log.warn("presence not set", { error });
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

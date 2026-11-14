import type { AnnouncementType } from "./settings";

/**
 * Announcements: what the bot posts, detected in the site's own data. Pure
 * module: the sources come in as plain values (built from the data files by
 * `announcement-sources.ts`), the detection and the insertion plan are
 * tested without data files nor database.
 *
 * A candidate is identified by (type, key): detecting it again, at every
 * start, inserts nothing. The first time a type is seen at all (a fresh
 * database), its candidates are recorded as `silent`, a baseline that is
 * never posted: a server does not get a patch from three weeks ago on the
 * day the bot is deployed.
 */

export interface Candidate {
  type: AnnouncementType;
  key: string;
  payload: Record<string, unknown>;
}

export interface Sources {
  /** Newest live patch first. */
  patches: { version: string; title: string; date: string | null; balance: Record<string, number>; heroes: string[] }[];
  skins: { hero: string; heroName: string; id: string; name: string; release: string | null; image: string | null; anchor: string }[];
  /** Skin calendar months, newest first. */
  months: { month: string; total: number; starlight: string[] }[];
  /** Advance Server versions, newest first. */
  advance: { version: string; title: string; date: string | null }[];
  tournaments: { slug: string; name: string; champion: string | null; endDate: string | null; lastMatch: string | null }[];
}

/** Window in which a dated item is still news. */
export const NEWS_DAYS = 30;
/** At most this many skins in one detection: a skin wave, not the whole catalogue. */
export const MAX_SKINS = 12;

const day = (iso: string) => iso.slice(0, 10);
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Live version comparison, numeric part by part (1.8.100 after 1.8.92). */
export function compareVersions(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

/** Every candidate in the data, as of `today` (YYYY-MM-DD). */
export function detect(sources: Sources, today: string): Candidate[] {
  const since = shift(today, -NEWS_DAYS);
  const out: Candidate[] = [];

  const patch = sources.patches[0];
  if (patch) {
    out.push({
      type: "patches",
      key: patch.version,
      payload: {
        version: patch.version,
        title: patch.title,
        date: patch.date,
        url: `/patch-notes/${patch.version}`,
        counts: { buff: patch.balance.buff ?? 0, nerf: patch.balance.nerf ?? 0, adjust: patch.balance.adjust ?? 0 },
        heroes: patch.heroes.slice(0, 40),
      },
    });
  }

  // Skins dated to the day or the month, released in the window and not
  // after today. A month-only date may be any day of that month: it counts
  // from its first day for "not after today", up to its last for "in the window".
  const recent = sources.skins
    .filter((s) => s.release && /^\d{4}-\d{2}(-\d{2})?$/.test(s.release))
    .filter((s) => {
      const first = s.release!.length === 7 ? `${s.release}-01` : s.release!;
      const last = s.release!.length === 7 ? `${s.release}-31` : s.release!;
      return first <= today && last >= since;
    })
    .sort((a, b) => b.release!.localeCompare(a.release!) || a.name.localeCompare(b.name))
    .slice(0, MAX_SKINS);
  for (const s of recent) {
    out.push({
      type: "skins",
      key: `${s.hero}:${s.id || s.name}`.slice(0, 120),
      payload: { hero: s.hero, heroName: s.heroName, name: s.name, release: s.release, image: s.image, url: `/heroes/${s.hero}/skins${s.anchor ? `#${s.anchor}` : ""}` },
    });
  }

  // The skin calendar month in progress, or announced ahead.
  const currentMonth = today.slice(0, 7);
  for (const m of sources.months.filter((m) => m.month >= currentMonth).slice(0, 2)) {
    out.push({
      type: "events",
      key: m.month,
      payload: { month: m.month, url: `/events/${m.month}`, count: m.total, starlight: m.starlight.slice(0, 5) },
    });
  }

  // An Advance Server build ahead of the live patch: once live, it is a patch.
  const advance = sources.advance[0];
  if (advance && patch && compareVersions(advance.version, patch.version) > 0) {
    out.push({
      type: "advanceServer",
      key: advance.version,
      payload: { version: advance.version, title: advance.title, date: advance.date, url: `/patch-notes/advance-server/${advance.version}` },
    });
  }

  // Esports: a tournament that crowned its champion in the window.
  for (const t of sources.tournaments) {
    const ended = t.lastMatch ?? t.endDate;
    if (!t.champion || !ended || day(ended) < since) continue;
    out.push({
      type: "esports",
      key: `${t.slug}:champion`.slice(0, 120),
      payload: { slug: t.slug, name: t.name, status: "finished", winner: t.champion, url: `/esports/${t.slug}` },
    });
  }
  return out;
}

/**
 * Rows to insert: the candidates, flagged `silent` for the types the
 * database has never seen. The insertion itself skips (type, key) pairs
 * already there, which is what makes the whole run idempotent.
 */
export function plan(candidates: Candidate[], knownTypes: ReadonlySet<string>): (Candidate & { silent: boolean })[] {
  const seen = new Set<string>();
  return candidates.flatMap((c) => {
    const id = `${c.type}|${c.key}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ ...c, silent: !knownTypes.has(c.type) }];
  });
}

// ── Pending deliveries ─────────────────────────────────────────────

/** An announcement stops being news for the servers after this. */
export const PENDING_DAYS = 7;

export interface StoredAnnouncement {
  id: number;
  type: string;
  key: string;
  payload: unknown;
  createdAt: Date;
}

export interface GuildTarget {
  guildId: string;
  locale: string;
  joinedAt: Date;
  /** Channel, role and failing flag of each type, as stored. */
  settings: Record<string, string | null | boolean | number | Date>;
}

export interface Target {
  guildId: string;
  channelId: string;
  roleId: string | null;
  locale: string;
}

/**
 * Servers still to receive each announcement: the type has a channel, the
 * channel is not marked failing, the bot was already there when the
 * announcement was made (a new server does not get last week's news), and
 * no delivery is recorded yet. `limit` caps the targets of one answer: the
 * bot asks again after delivering them.
 */
export function pendingTargets(
  announcements: StoredAnnouncement[],
  guilds: GuildTarget[],
  delivered: ReadonlySet<string>,
  limit = 500,
): { announcement: StoredAnnouncement; targets: Target[] }[] {
  let left = limit;
  const out: { announcement: StoredAnnouncement; targets: Target[] }[] = [];
  for (const announcement of announcements) {
    if (left <= 0) break;
    const targets: Target[] = [];
    for (const g of guilds) {
      if (left <= 0) break;
      const channelId = g.settings[`${announcement.type}ChannelId`];
      if (typeof channelId !== "string" || !channelId) continue;
      if (g.settings[`${announcement.type}Failing`] === true) continue;
      if (g.joinedAt > announcement.createdAt) continue;
      if (delivered.has(`${announcement.id}|${g.guildId}`)) continue;
      const roleId = g.settings[`${announcement.type}RoleId`];
      targets.push({ guildId: g.guildId, channelId, roleId: typeof roleId === "string" && roleId ? roleId : null, locale: g.locale });
      left -= 1;
    }
    if (targets.length) out.push({ announcement, targets });
  }
  return out;
}

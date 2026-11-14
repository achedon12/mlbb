import { advanceVersions } from "@/lib/advance-server";
import { heroesBySlug } from "@/lib/data";
import { db } from "@/lib/db";
import { tournaments } from "@/lib/esports";
import { eventMonths } from "@/lib/events-server";
import { recentPatches } from "@/lib/patch-tracking";
import { releasedSkins } from "@/lib/skin-catalog-server";
import { dayUtc } from "@/lib/quiz";
import { Prisma } from "@/generated/prisma/client";
import { detect, pendingTargets, plan, PENDING_DAYS, type GuildTarget, type Sources } from "./announcements";
import { ANNOUNCEMENT_TYPES, type AnnouncementType } from "./kinds";

/**
 * Announcements against the database: the sources read from the site's data
 * files, the idempotent recording, and the pending list the bot delivers.
 */

export function announcementSources(): Sources {
  return {
    patches: recentPatches.map((p) => ({
      version: p.version,
      title: p.title,
      date: p.date ?? null,
      balance: p.balance,
      // A hero adjusted in several sections of the notes appears once.
      heroes: [...new Set(p.adjustments.flatMap((a) => (a.slug ? [a.slug] : [])))],
    })),
    skins: releasedSkins().map((s) => ({
      hero: s.hero,
      heroName: heroesBySlug.get(s.hero)?.name ?? s.hero,
      id: s.id,
      name: s.name,
      release: s.release,
      image: s.image,
      anchor: s.anchor,
    })),
    months: eventMonths().map((m) => ({
      month: m.month,
      total: m.total,
      starlight: m.starlight.map((s) => `${heroesBySlug.get(s.hero)?.name ?? s.hero} — ${s.name}`),
    })),
    advance: advanceVersions("en").map((v) => ({ version: v.version, title: v.title, date: v.date })),
    tournaments: tournaments.map((t) => ({
      slug: t.slug,
      name: t.name,
      champion: t.champion,
      endDate: t.endDate,
      lastMatch: t.lastMatch,
    })),
  };
}

/**
 * Records the announcements found in the data. Safe to run at every start
 * and as often as wanted: (type, key) is unique and existing pairs are
 * skipped. Returns how many new, deliverable announcements were created.
 */
export async function recordAnnouncements(now = new Date()): Promise<number> {
  const candidates = detect(announcementSources(), dayUtc(now));
  const known = await db().announcement.findMany({ distinct: ["type"], select: { type: true } });
  const rows = plan(candidates, new Set(known.map((k) => k.type)));
  if (!rows.length) return 0;
  const before = await db().announcement.count({ where: { silent: false } });
  await db().announcement.createMany({
    data: rows.map((r) => ({ type: r.type, key: r.key, payload: r.payload as Prisma.InputJsonValue, silent: r.silent })),
    skipDuplicates: true,
  });
  const after = await db().announcement.count({ where: { silent: false } });
  return after - before;
}

/** Settings columns `pendingTargets` reads: channel, role and failing flag of each type. */
const TARGET_COLUMNS = Object.fromEntries(
  ANNOUNCEMENT_TYPES.flatMap((t) => [`${t}ChannelId`, `${t}RoleId`, `${t}Failing`].map((c) => [c, true])),
) as Prisma.GuildSettingsSelect;

/**
 * What `GET /api/bot/announcements/pending` answers.
 *
 * Only the servers that can receive one of these announcements are read:
 * present, already there when the newest one was made, and with a working
 * channel for at least one of their types; only the columns the targets
 * need. The recorded deliveries are read for those servers only.
 */
export async function pendingAnnouncements(now = new Date()) {
  const since = new Date(now.getTime() - PENDING_DAYS * 86_400_000);
  const announcements = await db().announcement.findMany({
    where: { silent: false, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, type: true, key: true, payload: true, createdAt: true },
  });
  if (!announcements.length) return [];
  const types = [...new Set(announcements.map((a) => a.type))].filter((t): t is AnnouncementType =>
    (ANNOUNCEMENT_TYPES as readonly string[]).includes(t),
  );
  if (!types.length) return [];
  const newest = announcements[announcements.length - 1].createdAt;
  const guilds = await db().guild.findMany({
    where: {
      leftAt: null,
      joinedAt: { lte: newest },
      settings: { is: { OR: types.map((t) => ({ [`${t}ChannelId`]: { not: null }, [`${t}Failing`]: false })) } },
    },
    select: { id: true, locale: true, joinedAt: true, settings: { select: TARGET_COLUMNS } },
  });
  if (!guilds.length) return [];
  const deliveries = await db().delivery.findMany({
    where: { announcementId: { in: announcements.map((a) => a.id) }, guildId: { in: guilds.map((g) => g.id) } },
    select: { announcementId: true, guildId: true },
  });
  const delivered = new Set(deliveries.map((d) => `${d.announcementId}|${d.guildId}`));
  return pendingTargets(
    announcements,
    guilds.map((g) => ({ guildId: g.id, locale: g.locale, joinedAt: g.joinedAt, settings: (g.settings ?? {}) as GuildTarget["settings"] })),
    delivered,
  ).map(({ announcement: a, targets }) => ({
    id: a.id,
    type: a.type,
    key: a.key,
    payload: a.payload,
    createdAt: a.createdAt.toISOString(),
    targets,
  }));
}

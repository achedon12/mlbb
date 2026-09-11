import advanceEn from "@/data/jeu/advance-server.json";
import advanceFr from "@/data/jeu/advance-server/fr.json";
import advanceIt from "@/data/jeu/advance-server/it.json";
import advanceEs from "@/data/jeu/advance-server/es.json";
import type { Langue } from "@/i18n/config";
import type { TypeAjustement } from "./types";

/**
 * Advance Server patch notes, produced by `node scripts/advance-server.mjs`
 * from the community wiki. English is the source; other languages are
 * translated ahead of time, and a version not translated yet keeps its
 * English text rather than disappearing.
 */

export type ChangeDirection = "buff" | "nerf" | "adjust";
export type ChangeTag = "new" | "removed" | "rework" | "merge" | "fix" | "split";

/** A change: either before/after values, or a plain sentence. */
export type AdvanceChange = { label: string | null; before: string; after: string } | { text: string };

/** Changes of one skill, attribute or passive of an entry. */
export interface AdvanceChangeGroup {
  /** Null when the source lists the changes with no heading. */
  name: string | null;
  /** Skill slot ("Skill 2", "Ultimate"), when the group is a skill. */
  slot: string | null;
  type: ChangeDirection | null;
  tag: ChangeTag | null;
  generic: boolean;
  changes: AdvanceChange[];
}

/** A changed hero, item, emblem or spell. */
export interface AdvanceEntry {
  name: string;
  /** Hero or item slug; null when the site has no page for it. */
  slug: string | null;
  type: ChangeDirection | null;
  tag: ChangeTag | null;
  intro: string;
  sections: AdvanceChangeGroup[];
}

export interface AdvanceHeroChange extends AdvanceEntry {
  slug: string;
}

export type AdvanceLine = AdvanceChange & { level: number; type: ChangeDirection | null };

export type AdvanceCategory = "items" | "emblems" | "spells" | "system";

export interface AdvanceSection {
  category: AdvanceCategory;
  title: string;
  entries: AdvanceEntry[];
  lines: AdvanceLine[];
}

export interface AdvanceNewHero {
  title: string;
  slug: string | null;
  kind: "new" | "revamp";
}

export interface AdvanceVersion {
  version: string;
  title: string;
  url: string;
  date: string | null;
  /** "notes": date announced by the notes; "wiki": day the wiki published them. */
  dateSource: "notes" | "wiki" | null;
  summary: string | null;
  designerNotes: string[];
  newHeroes: AdvanceNewHero[];
  heroes: AdvanceHeroChange[];
  sections: AdvanceSection[];
  balance: Record<ChangeDirection, number>;
}

export interface AdvanceArchiveEntry {
  version: string;
  title: string;
  url: string;
}

interface AdvanceData {
  source: string;
  syncedAt: string;
  versions: AdvanceVersion[];
  archive: AdvanceArchiveEntry[];
}

const data = advanceEn as unknown as AdvanceData;
const TRANSLATIONS = { fr: advanceFr, it: advanceIt, es: advanceEs } as unknown as Record<
  Exclude<Langue, "en">,
  Record<string, AdvanceVersion>
>;

/** Sorts 1.8.100 after 1.8.92, which an alphabetical sort does not. */
export function compareVersions(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

/**
 * A test build is still ahead of the live game only while its number is
 * higher than the latest Official Server patch; below that, its changes have
 * shipped, been reworked or been dropped.
 */
export function isUnderTest(version: string, liveVersion: string): boolean {
  return compareVersions(version, liveVersion) > 0;
}

const sorted = [...data.versions].sort((a, b) => compareVersions(b.version, a.version));

export const advanceSource = data.source;
export const advanceSyncedAt = data.syncedAt;
export const advanceArchive = data.archive;
/** Versions with content, newest first, independent of the language. */
export const advanceVersionNumbers = sorted.map((v) => v.version);

const cache = new Map<Langue, AdvanceVersion[]>();

/** Versions with content, newest first, in the requested language. */
export function advanceVersions(locale: Langue): AdvanceVersion[] {
  if (locale === "en") return sorted;
  let list = cache.get(locale);
  if (!list) {
    const translated = TRANSLATIONS[locale];
    list = sorted.map((v) => translated[v.version] ?? v);
    cache.set(locale, list);
  }
  return list;
}

export function advanceVersion(locale: Langue, version: string): AdvanceVersion | undefined {
  return advanceVersions(locale).find((v) => v.version === version);
}

/** Whether the version is served in the requested language rather than in English. */
export function isTranslated(locale: Langue, version: string): boolean {
  return locale !== "en" && version in TRANSLATIONS[locale];
}

/** The live patch notes type of a direction, to reuse their labels and grouping. */
export const LIVE_TYPE: Record<ChangeDirection, TypeAjustement> = {
  buff: "amelioration",
  nerf: "affaiblissement",
  adjust: "ajustement",
};

export interface UpcomingForHero {
  version: string;
  date: string | null;
  dateSource: AdvanceVersion["dateSource"];
  url: string;
  changes: AdvanceHeroChange[];
  announcements: AdvanceNewHero[];
}

/**
 * Changes of one hero in the versions still under test, newest first. Empty
 * when no test build is ahead of the live patch, or none touches the hero.
 */
export function upcomingForHero(
  versions: AdvanceVersion[],
  slug: string,
  liveVersion: string,
): UpcomingForHero[] {
  return versions
    .filter((v) => isUnderTest(v.version, liveVersion))
    .map((v) => ({
      version: v.version,
      date: v.date,
      dateSource: v.dateSource,
      url: v.url,
      changes: v.heroes.filter((h) => h.slug === slug),
      announcements: v.newHeroes.filter((n) => n.slug === slug),
    }))
    .filter((u) => u.changes.length > 0 || u.announcements.length > 0);
}

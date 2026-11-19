import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { cleanText, hasLink, textLength } from "@/lib/community-builds";
import { db } from "@/lib/db";
import {
  DATA_REPORT_CORRECTION_MAX,
  DATA_REPORT_OPEN_MAX,
  DATA_REPORT_SOURCE_MAX,
  DATA_REPORT_TEXT_MAX,
  DATA_REPORT_TEXT_MIN,
  isReportablePath,
} from "./data-reports";

/**
 * Storage side of the error reports (see `data-reports.ts`). A report keeps
 * the page, its language and what was typed: no account, no address.
 */

/** Optional field: empty means absent. */
const optional = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((s) => cleanText(s, false))
    .refine((s) => textLength(s) <= max)
    .transform((s) => s || undefined)
    .optional();

/** A source is an http(s) address, nothing else (no `javascript:`). */
const isWebAddress = (s: string) => {
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export const dataReportInput = z
  .object({
    path: z.string().refine(isReportablePath),
    locale: z.enum(LOCALES),
    text: z
      .string()
      .max(DATA_REPORT_TEXT_MAX * 4)
      .transform((s) => cleanText(s, true))
      .refine((s) => textLength(s) >= DATA_REPORT_TEXT_MIN && textLength(s) <= DATA_REPORT_TEXT_MAX),
    correction: optional(DATA_REPORT_CORRECTION_MAX),
    source: optional(DATA_REPORT_SOURCE_MAX).refine((s) => s === undefined || isWebAddress(s)),
    /** Honeypot: a field people never see. Filled in, the report is dropped without a word. */
    website: z.string().max(200).optional(),
  })
  .strict();
export type DataReportInput = z.infer<typeof dataReportInput>;

export type SaveResult = "ok" | "links" | "full";

/**
 * Stores a report. Addresses belong in `source`: the text and the correction
 * carry none (`links`). An identical open report on the same page counts as
 * sent and is not stored twice; past `DATA_REPORT_OPEN_MAX` open reports,
 * nothing more is stored (`full`).
 */
export async function saveDataReport(input: DataReportInput): Promise<SaveResult> {
  if (hasLink(input.text) || (input.correction && hasLink(input.correction))) return "links";
  const client = db();
  const open = await client.dataReport.count({ where: { resolvedAt: null } });
  if (open >= DATA_REPORT_OPEN_MAX) return "full";
  const same = await client.dataReport.findFirst({ where: { resolvedAt: null, path: input.path, text: input.text }, select: { id: true } });
  if (same) return "ok";
  await client.dataReport.create({
    data: { path: input.path, locale: input.locale, text: input.text, correction: input.correction ?? null, source: input.source ?? null },
  });
  return "ok";
}

/** The open reports, oldest first: the moderation page's list. */
export async function openDataReports(limit = 100) {
  return db().dataReport.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "asc" }, take: limit });
}

/**
 * Closes a report and logs it with the moderators' decisions. False when
 * there is no such open report.
 */
export async function resolveDataReport(id: number, moderator: { id: string; name: string }, now = new Date()): Promise<boolean> {
  return db().$transaction(async (tx) => {
    const { count } = await tx.dataReport.updateMany({ where: { id, resolvedAt: null }, data: { resolvedAt: now, resolvedBy: moderator.id } });
    if (count === 0) return false;
    await tx.moderationLog.create({
      data: { moderatorId: moderator.id, moderatorName: moderator.name.slice(0, 64), action: "resolve", kind: "data", targetId: id },
    });
    return true;
  });
}

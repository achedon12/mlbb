import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/bot/dashboard-guard";
import { answer, guardModerator, readJsonBody, refused, refusedFor, storageFailed } from "@/lib/community/server";
import { dataReportInput, resolveDataReport, saveDataReport } from "@/lib/data-reports-server";
import { databaseConfigured } from "@/lib/db";
import { log } from "@/lib/log";
import { addressOf, limitByMinute } from "@/lib/push-server";

/**
 * Error reports on the data pages (hero, item, emblem, spell, patch notes).
 *
 * GET: `{ open }`, whether reports are taken (the database is configured);
 * the pages are prerendered, so the form asks before showing its button.
 *
 * POST, anyone, no account: `{ path, locale, text, correction?, source?,
 * website? }` (`website` is a honeypot: filled in, the report is dropped
 * and the answer is the same). Same origin required, a few per minute and
 * address, the address itself never stored. 201 `{ ok }`; 400 the field at
 * fault; 422 `links` (addresses go in `source`); 429 too fast or `full`.
 *
 * PATCH, moderators only (anyone else 404): `{ id }` closes a report, logged
 * with the other decisions.
 */
export const dynamic = "force-dynamic";

const byAddress = limitByMinute(3);

export function GET() {
  return NextResponse.json({ open: databaseConfigured() }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return refused(404, "not found");
  if (!isSameOrigin(request)) return refused(403, "origin refused");
  if (!byAddress(addressOf(request))) return refused(429, "too many requests");
  const body = await readJsonBody(request, dataReportInput);
  if (body instanceof NextResponse) return body;
  const { website, ...report } = body.data;
  if (website) return answer({ ok: true }, 201);
  try {
    const result = await saveDataReport(report);
    if (result === "links") return refusedFor("links");
    if (result === "full") return refused(429, "full");
    await log("info", "data report", { path: report.path, locale: report.locale });
    return answer({ ok: true }, 201);
  } catch (error) {
    return storageFailed("data report", error, { path: report.path });
  }
}

const resolveBody = z.object({ id: z.number().int().positive().max(999_999_999) }).strict();

export async function PATCH(request: Request) {
  const guarded = await guardModerator(request, resolveBody);
  if (guarded instanceof NextResponse) return guarded;
  const { moderator, body } = guarded;
  try {
    if (!(await resolveDataReport(body.id, { id: moderator.id, name: moderator.name }))) return refused(404, "unknown");
    await log("info", "data report resolved", { id: body.id, moderator: moderator.id });
    return answer({ ok: true });
  } catch (error) {
    return storageFailed("data report resolve", error, { id: body.id });
  }
}

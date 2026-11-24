import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { reminderText } from "@/lib/reminder-text";
import { icsCalendar, isRemindable, monthStart } from "@/lib/reminders";
import { site } from "@/lib/site";

/**
 * Calendar file for a month reminder: `/api/calendar/2026-12?lang=fr`.
 *
 * One event on the 1st at 00:00 server time, the instant StarLight resets
 * and the month's events begin, with an alarm at that moment. Written on the
 * fly from the events data, in the visitor's language: opening it adds the
 * reminder to the phone's calendar (iOS asks directly, Android opens it with
 * the calendar app). Works without notifications, an account or the site
 * being installed.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const lang = new URL(request.url).searchParams.get("lang") ?? "";
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const start = monthStart(month);
  if (start === null || !isRemindable(month, Date.now())) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const { title, body } = reminderText(createT(locale), locale, month);
  const ics = icsCalendar({
    uid: `month-${month}@${new URL(site.url).hostname}`,
    start,
    duration: 60,
    title,
    description: body,
    url: `${site.url}/${locale}/events/${month}`,
    stamp: Date.now(),
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="mlbbdex-${month}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

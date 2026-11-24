import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { heroesBySlug } from "@/lib/data";
import { monthByKey } from "@/lib/events-server";
import { monthYear } from "@/lib/freshness";

/**
 * Wording of a month reminder, server side: the pages' "Remind me" band, the
 * calendar file and the push notification all say the same thing.
 */

/** The month's StarLight skin, when the wiki lists already name it. */
export function monthHeadline(month: string): { skin: string; hero: string } | null {
  const s = monthByKey(month)?.starlight[0];
  return s ? { skin: s.name, hero: heroesBySlug.get(s.hero)?.name ?? s.hero } : null;
}

/** Title and text of a month reminder, shared by the notification and the calendar file. */
export function reminderText(t: T, locale: Locale, month: string): { title: string; body: string } {
  const label = monthYear(locale, `${month}-01`);
  const headline = monthHeadline(month);
  return {
    title: t("pushNotif.reminder.title", { month: label }),
    body: headline ? t("pushNotif.reminder.bodySkin", headline) : t("pushNotif.reminder.body"),
  };
}

import Link from "@/components/link";
import { RemindButton } from "@/components/remind-button";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { shiftMonth } from "@/lib/events";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { monthYear } from "@/lib/freshness";
import { monthHeadline } from "@/lib/reminder-text";
import { cn } from "@/lib/utils";

/**
 * Months a reminder can be set for: the next one (StarLight resets every
 * month, announced or not) and any later month the wiki lists already announce.
 */
export function reminderMonths(): string[] {
  const current = referenceDate.slice(0, 7);
  const announced = eventMonths()
    .map((m) => m.month)
    .filter((m) => m > current);
  return [...new Set([shiftMonth(current, 1), ...announced])].sort();
}

/**
 * The next month to come, as a compact band with its "Remind me" button:
 * on the skins and events pages, where people look for what is coming.
 */
export function UpcomingReminder({ locale, month, className }: { locale: Locale; month?: string; className?: string }) {
  const t = createT(locale);
  const target = month ?? reminderMonths()[0];
  if (!target) return null;
  const label = monthYear(locale, `${target}-01`);
  const headline = monthHeadline(target);
  return (
    <aside
      aria-label={t("reminder.bandLabel", { month: label })}
      className={cn("bevel flex flex-col gap-4 border border-night-700/70 bg-night-900/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5", className)}
    >
      <div className="min-w-0">
        <p className="font-heading text-xs font-bold uppercase tracking-wide text-gold-400">{t("reminder.kicker")}</p>
        <p className="mt-1 font-heading text-lg font-bold text-chalk-100">
          <Link href={`/events/${target}`} className="transition-colors hover:text-gold-300">
            {t("reminder.bandTitle", { month: label })}
          </Link>
        </p>
        <p className="mt-1 text-sm text-chalk-400">
          {headline ? t("reminder.bandSkin", headline) : t("reminder.bandGeneric")}
        </p>
      </div>
      <RemindButton month={target} label={label} className="shrink-0" />
    </aside>
  );
}

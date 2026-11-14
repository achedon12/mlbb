import { absoluteImage, localeParam, responseApi } from "@/lib/api";
import { heroesBySlug } from "@/lib/data";
import { shiftMonth, type EventSkin } from "@/lib/events";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { site } from "@/lib/site";
import { createT } from "@/i18n/translations";

/**
 * The month's events and the ones announced after it, oldest first: the
 * StarLight skin and the Collector skins of each month, as the events page
 * lists them. A month runs from its first day to its last (UTC): the
 * StarLight renews on the 1st, and the wiki dates the Collector draw to the
 * month only. `?locale=` picks the language of the names.
 */
// Reads `?locale=`: a static response would ignore it.
export const dynamic = "force-dynamic";

const firstDay = (month: string) => `${month}-01T00:00:00.000Z`;
/** Last millisecond of the month: the first of the next one, minus one. */
const lastDay = (month: string) => new Date(Date.parse(firstDay(shiftMonth(month, 1))) - 1).toISOString();

export function GET(request: Request) {
  const locale = localeParam(new URL(request.url).searchParams);
  const t = createT(locale);
  const current = referenceDate.slice(0, 7);
  const entry = (kind: "starlight" | "collector", month: string, s: EventSkin) => ({
    name: t(`pages.events.entry.${kind}`, {
      skin: s.name,
      hero: heroesBySlug.get(s.hero)?.name ?? s.hero,
    }),
    kind,
    hero: s.hero,
    skin: s.name,
    start: firstDay(month),
    end: lastDay(month),
    image: absoluteImage(s.image),
    link: `${site.url}/${locale}/events/${month}`,
  });
  const results = eventMonths()
    .filter((m) => m.month >= current)
    .reverse()
    .flatMap((m) => [
      ...m.starlight.map((s) => entry("starlight", m.month, s)),
      ...m.collector.map((s) => entry("collector", m.month, s)),
    ]);
  return responseApi(results, { total: results.length });
}

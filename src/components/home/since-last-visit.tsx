"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Layers, Sparkles, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { MAX_AWAY_DAYS, isEmpty, sinceVisit, touchVisit, type SinceDigest, type SinceItems } from "@/lib/since-visit";

/**
 * "Since your last visit", on the home page: a returning visitor sees, in one
 * strip, the patch, skins, tier changes and event months that came out since
 * they last came. The date lives in the browser only; a first visit, a
 * visit too long ago, nothing new, or no storage: nothing is shown.
 */

const DAY = 86_400_000;

export function SinceLastVisit({ digest }: { digest: SinceDigest }) {
  const t = useT();
  const locale = useLocale();
  const [view, setView] = useState<{ items: SinceItems; since: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const last = touchVisit();
      if (!last) return;
      const away = Math.floor((Date.now() - Date.parse(last)) / DAY);
      if (away > MAX_AWAY_DAYS) return;
      const items = sinceVisit(digest, last.slice(0, 10));
      if (isEmpty(items)) return;
      const since = new Intl.DateTimeFormat(LOCALE_INTL[locale], { day: "numeric", month: "long" }).format(new Date(last));
      setView({ items, since });
      trackEvent("Return", "Since shown", undefined, away);
    }, 0);
    return () => clearTimeout(timer);
  }, [digest, locale]);

  if (!view) return null;
  const { items, since } = view;
  const month = (m: string) =>
    new Intl.DateTimeFormat(LOCALE_INTL[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const open = (kind: string) => () => trackEvent("Return", "Since open", kind);
  const chip =
    "inline-flex min-h-11 items-center gap-2 text-sm text-chalk-200 underline decoration-night-600 decoration-1 underline-offset-4 transition-colors hover:text-gold-300 hover:decoration-current";

  return (
    <section aria-labelledby="since-visit" className="page-wrap pt-6">
      <h2 id="since-visit" className="font-heading text-xs font-bold uppercase tracking-wide text-gold-400">
        {t("comeback.title", { date: since })}
      </h2>
      <ul className="mt-1 flex flex-wrap gap-x-6">
        {items.patch && (
          <li>
            <Link href={`/patch-notes/${items.patch.version}`} onClick={open("patch")} className={chip}>
              <Layers size={14} aria-hidden className="text-gold-400" />
              {t("comeback.patch", { version: items.patch.version })}
            </Link>
          </li>
        )}
        {items.skins && (
          <li>
            <Link href={items.skins.n === 1 ? items.skins.latest.href : "/skins/calendar#latest"} onClick={open("skins")} className={chip}>
              <Sparkles size={14} aria-hidden className="text-gold-400" />
              {items.skins.n === 1
                ? t("comeback.skin1", { name: items.skins.latest.name, hero: items.skins.latest.hero })
                : t("comeback.skins", { n: items.skins.n, name: items.skins.latest.name })}
            </Link>
          </li>
        )}
        {items.tiers && (
          <li>
            <Link href="/tier-list" onClick={open("tiers")} className={chip}>
              <TrendingUp size={14} aria-hidden className="text-gold-400" />
              {t(items.tiers.n === 1 ? "comeback.tiers1" : "comeback.tiers", { n: items.tiers.n })}
              {items.tiers.top[0] && (
                <span className="text-chalk-400">
                  · {items.tiers.top[0].name} {items.tiers.top[0].before} → {items.tiers.top[0].after}
                </span>
              )}
            </Link>
          </li>
        )}
        {items.events && (
          <li>
            <Link href={`/events/${items.events.month}`} onClick={open("events")} className={chip}>
              <CalendarDays size={14} aria-hidden className="text-gold-400" />
              {t(items.events.announced ? "comeback.eventsAnnounced" : "comeback.eventsOpened", { month: month(items.events.month) })}
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

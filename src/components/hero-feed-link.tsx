import { Rss } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * Link to a hero's RSS feed of adjustments. A plain `<a>`: the Next router
 * has no business with an XML file, and must not prefetch it.
 */
export function HeroFeedLink({ locale, slug }: { locale: Locale; slug: string }) {
  const t = createT(locale);
  return (
    <a
      href={`/${locale}/heroes/${slug}/feed.xml`}
      type="application/rss+xml"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
    >
      <Rss size={15} aria-hidden />
      {t("pages.heroDetail.statistics.feed")}
    </a>
  );
}

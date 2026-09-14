import { Rss } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * Lien vers le flux RSS des ajustements d'un heros. Un `<a>` simple : le
 * routeur de Next n'a rien a faire d'un fichier XML, et ne doit pas le
 * precharger.
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

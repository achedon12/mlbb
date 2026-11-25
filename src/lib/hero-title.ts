import { TITLE_MAX } from "@/i18n/seo";
import type { T } from "@/i18n/translations";

/**
 * A hero page's title, modeled on searches ("aamon build mlbb", "aamon
 * counter"), with the tier and the patch: the results carrying a freshness
 * marker are the ones that get clicked. The longest version that fits in
 * `TITLE_MAX` wins: with "MLBB" and the tier, then without the tier, then
 * without "MLBB" either — a long name ("Popol and Kupa") loses the extras
 * rather than have the patch cut off in the results.
 */
export function titleHero(t: T, name: string, tier: string | undefined, v: string): string {
  const candidates = [
    ...(tier ? [t("pages.seo.hero.title", { name, tier, v })] : []),
    t("pages.seo.hero.titleNoTier", { name, v }),
  ];
  return candidates.find((c) => c.length <= TITLE_MAX) ?? t("pages.seo.hero.titleShort", { name, v });
}

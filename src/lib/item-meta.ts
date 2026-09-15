import type { Locale } from "@/i18n/config";
import { brandedTitle, DESCRIPTION_MAX, TITLE_MAX } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { heroesBySlug } from "./data";
import { listNames, longDate, patchCurrent, percentage } from "./freshness";
import type { GeneratedItem } from "./types";
import type { UsageHero } from "./usage-builds";
import { BUILDER_RULE } from "./usage-sheets";

const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
/** An effect already ends with a period: the sentence does not add a second one. */
const withoutPoint = (text: string) => text.replace(/[.\s]+$/, "");

/** The first candidate that fits, or the last one, the shortest, when none does. */
const fitting = (candidates: string[], fits: (text: string) => boolean) =>
  candidates.find(fits) ?? candidates[candidates.length - 1];

/**
 * Title and description for search results, named after the heroes who build
 * the item the most at high ranks (`topBuilders`): searches read "item + hero
 * + build". Three heroes, then fewer while the title followed by the site name
 * or the description runs past what results show. Without such heroes, a
 * generic title and the page's lead as description, shortened when too long.
 */
export function metaItem(
  locale: Locale,
  {
    item: o,
    details,
    effect,
    lead,
    builders,
  }: {
    item: GeneratedItem;
    /** Category and price, "Defense, 2,100 gold". */
    details: string;
    /** Stats or summary shown in the lead. */
    effect: string | null;
    /** The page's lead: effect, then the heroes taking the item across all ranks. */
    lead: string;
    /** Heroes who build the item the most at high ranks (`topBuilders`). */
    builders: UsageHero[];
  },
): { title: string; description: string } {
  const t = createT(locale);
  const update = t("pages.sheets.updateDesc", { date: longDate(locale) });
  const counts = [3, 2, 1].filter((n) => n <= builders.length);

  if (counts.length === 0) {
    const title = t("pages.itemDetail.title", { name: o.name, v: patchCurrent?.version ?? "" });
    const alone = t("pages.itemDetail.itemDescAlone", { name: o.name, details });
    const withEffect = (text: string | null) =>
      text ? t("pages.itemDetail.itemDesc", { name: o.name, details, effect: withoutPoint(text) }) : alone;
    const description = fitting(
      [
        `${lead} ${update}`,
        lead,
        `${withEffect(effect)} ${update}`,
        withEffect(effect),
        `${withEffect(o.summary)} ${update}`,
        withEffect(o.summary),
        alone,
      ],
      (d) => d.length <= DESCRIPTION_MAX,
    );
    return { title, description };
  }

  const names = (n: number) => listNames(locale, builders.slice(0, n).map((h) => heroName(h.slug)));
  const titles = counts.map((n) => t("pages.itemDetail.titleBuild", { name: o.name, heroes: names(n) }));
  // With the site name first; failing that, alone (`metaPage` then drops the brand).
  const title =
    titles.find((x) => brandedTitle(x).length <= TITLE_MAX) ?? fitting(titles, (x) => x.length <= TITLE_MAX);
  // The lowest of the rule's ranks, "and above" in the sentence.
  const rank = t(`measuredRanks.${BUILDER_RULE.ranks[0]}`);
  const clause = (n: number) =>
    o.summary
      ? t("pages.itemDetail.descBuild", { name: o.name, effect: withoutPoint(o.summary), heroes: names(n), rank })
      : t("pages.itemDetail.descBuildAlone", { name: o.name, heroes: names(n), rank });
  const first = builders[0];
  const share = t("pages.itemDetail.descShare", {
    first: heroName(first.slug),
    share: percentage(locale, first.selection),
  });
  const description = fitting(
    counts.flatMap((n) => [`${clause(n)} ${share} ${update}`, `${clause(n)} ${share}`, clause(n)]),
    (d) => d.length <= DESCRIPTION_MAX,
  );
  return { title, description };
}

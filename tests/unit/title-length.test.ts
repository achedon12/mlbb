import { describe, expect, it } from "vitest";
import { TITLE_MAX } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { frenchOf } from "@/lib/counters";
import { titleHero } from "@/lib/hero-title";
import { allHeroes, counters, heroesBySlug } from "@/lib/data";
import { ROLES } from "@/lib/draft";
import { monthYear, patchCurrent } from "@/lib/freshness";
import { MEASURED_RANKS } from "@/lib/measured-ranks";
import { pairsSitemap } from "@/lib/pairs";
import { FILTERS_LANE, FILTERS_ROLE } from "@/lib/tier-list-filters";

/**
 * Titles of the main page types, built from the French source messages with
 * the real data (every hero, every rank, lane and role, the current patch and
 * month), the way the pages' `generateMetadata` build them.
 *
 * A search result shows about 60 characters: past `TITLE_MAX`, the end of the
 * title (the patch, the month) is cut. French is the source the other
 * languages are translated from, so it is the one held to the limit here.
 */
const t = createT("fr");
const v = patchCurrent.version;
const month = monthYear("fr");
const names = (name: string) => ({ name, ofName: frenchOf(name) });

function titles(): { page: string; title: string }[] {
  const out: { page: string; title: string }[] = [];
  const add = (page: string, title: string) => out.push({ page, title });

  for (const h of allHeroes) {
    // Same switches as the hero and counters pages: a long name takes the
    // shorter title, which must fit in turn.
    add(`hero ${h.slug}`, titleHero(t, h.name, "S", v));
    const full = t("pages.heroCounters.metaTitle", { ...names(h.name), v });
    add(
      `counters ${h.slug}`,
      full.length > TITLE_MAX ? t("pages.heroCounters.metaTitleShort", { ...names(h.name), v }) : full,
    );
    add(`duos ${h.slug}`, t("pages.duos.metaTitle", { ...names(h.name), v }));
  }

  for (const segment of pairsSitemap(counters, (s) => heroesBySlug.has(s))) {
    const [a, b] = segment.split("-vs-").map((s) => heroesBySlug.get(s)!.name);
    add(`compare ${segment}`, t("pages.versus.metaTitle", { a, b, v }));
  }

  for (const rank of MEASURED_RANKS) {
    const markers = { month, v, rank: t(`measuredRanks.${rank}`) };
    add(`tier-list ${rank}`, t(rank === "all" ? "pages.seo.tierList.title" : "pages.seo.tierList.titleRank", markers));
    add(
      `statistics ${rank}`,
      t(rank === "all" ? "pages.statistics.metaTitle" : "pages.statistics.metaTitleRank", markers),
    );
  }
  const markers = { month, v };
  for (const f of FILTERS_LANE) {
    add(`tier-list lane ${f.value}`, t("pages.seo.tierLane.title", { ...markers, lane: t(`pages.tierList.laneSeo.${f.value}`) }));
  }
  for (const f of FILTERS_ROLE) {
    add(
      `tier-list role ${f.value}`,
      t("pages.seo.tierRole.title", {
        ...markers,
        role: t(`roles.${f.value}`),
        plural: t(`pages.tierList.rolePlural.${f.value}`),
      }),
    );
  }
  for (const role of ROLES) {
    add(
      `heroes role ${role}`,
      t("pages.seo.heroesRole.title", {
        role: t(`roles.${role}`),
        plural: t(`pages.tierList.rolePlural.${role}`),
        n: allHeroes.filter((h) => h.roles.includes(role)).length,
        v,
      }),
    );
  }
  add("heroes", t("pages.seo.heroes.title", { n: allHeroes.length, v }));
  add("patch notes", t("pages.seo.patchNotes.title", { v }));
  add("patch", t("pages.seo.patch.title", { v }));
  add("map", t("pages.seo.map.title"));
  add("events", t("pages.seo.events.title"));
  add("events month", t("pages.events.month.title", { month }));
  add("advance server", t("pages.advanceServer.seo.titleHub", { v }));
  add("advance server version", t("pages.advanceServer.seo.title", { v }));
  add("advance server archive", t("pages.advanceServer.archived.seoTitle", { v }));
  return out;
}

describe("page titles", () => {
  it(`keep the main page types under ${TITLE_MAX} characters`, () => {
    const long = titles().filter((x) => x.title.length > TITLE_MAX);
    expect(long.map((x) => `${x.page} (${x.title.length}): ${x.title}`)).toEqual([]);
  });
});

import { NextResponse } from "next/server";
import visuals from "@/data/game/visuals.json";
import { LOCALES, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { article, articles } from "@/lib/content";
import { skills, counters, allHeroes, itemsFor, patchDetails } from "@/lib/data";
import { duos } from "@/lib/duos";
import { regionsLore } from "@/lib/lore";
import { emblemsSheets, spellSheets } from "@/lib/usage-sheets";
import type { EntrySearch } from "@/lib/search";
import { NEWS, BASE } from "@/lib/sections";

/**
 * Global search index, one static file per language. The browser
 * only requests it the first time the search is opened.
 */
export const dynamic = "force-static";
// One file per language, all generated at build time: any other language is
// a 404, not an index built on demand for a made-up locale (the dotted address
// bypasses the proxy, which would otherwise reject it).
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const t = createT(locale);
  const images = (visuals as unknown as { items: Record<string, string> }).items;
  const skillsLocale = skills(locale);

  const entries: EntrySearch[] = [
    ...allHeroes.map((h) => ({
      type: "hero" as const,
      title: h.name,
      detail: [h.title, h.roles.map((r) => t(`roles.${r}`)).join(" / ")].filter(Boolean).join(" · "),
      href: `/heroes/${h.slug}`,
      image: h.images.icon ?? h.images.portrait,
    })),
    // One "counters" entry per measured hero: the "{hero} counter" query is the most searched.
    ...allHeroes
      .filter((h) => counters[h.slug])
      .map((h) => ({
        type: "hero" as const,
        title: `${h.name} · ${t("pages.heroDetail.tab.counters")}`,
        href: `/heroes/${h.slug}/counters`,
        image: h.images.icon ?? h.images.portrait,
      })),
    ...allHeroes
      .filter((h) => duos[h.slug])
      .map((h) => ({
        type: "hero" as const,
        title: `${h.name} · ${t("pages.heroDetail.duosShort")}`,
        href: `/heroes/${h.slug}/duos`,
        image: h.images.icon ?? h.images.portrait,
      })),
    // Lore regions: each region's page gathers its heroes and their stories.
    ...regionsLore.map((r) => ({ type: "page" as const, title: r.name, detail: t("nav.lore.label"), href: `/lore/${r.key}` })),
    ...itemsFor(locale).map((o) => ({
      type: "item" as const,
      title: o.name,
      detail: t(`categories.${o.category}`),
      href: `/items/${o.slug}`,
      image: images[o.slug] ?? null,
    })),
    ...emblemsSheets.map((f) => {
      const key = `emblemData.${f.emblem.key}.name`;
      const name = t(key);
      return {
        type: "emblem" as const,
        title: name === key ? f.emblem.name : name,
        href: `/emblems/${f.slug}`,
        image: (visuals as unknown as { emblems: Record<string, string> }).emblems[f.emblem.key] ?? null,
      };
    }),
    ...spellSheets.map((s) => ({ type: "spell" as const, title: s.name, href: `/spells/${s.slug}`, image: s.image })),
    // Skins and skills lead to the hero page tab, opened by the anchor.
    // No image: 1,600 visual paths made the index eight times larger. The
    // search lends them their hero's icon, already in the index.
    ...allHeroes.flatMap((h) =>
      (skillsLocale[h.slug] ?? []).flatMap((c) =>
        c ? [{ type: "skill" as const, title: c.name, detail: h.name, href: `/heroes/${h.slug}#skills` }] : [],
      ),
    ),
    ...allHeroes.flatMap((h) =>
      h.skins.map((s) => ({ type: "skin" as const, title: s.name, detail: h.name, href: `/heroes/${h.slug}#skins` })),
    ),
    ...Object.values(patchDetails).map((p) => ({
      type: "patch" as const,
      title: `Patch ${p.version}`,
      detail: p.title,
      href: `/patch-notes/${p.version}`,
    })),
    ...articles("patch-notes").map((a) => ({
      type: "patch" as const,
      title: article("patch-notes", a.slug, locale)?.title ?? a.title,
      href: `/patch-notes/${a.slug}`,
    })),
    ...articles("news").map((a) => ({
      type: "page" as const,
      title: article("news", a.slug, locale)?.title ?? a.title,
      href: `/news/${a.slug}`,
    })),
    ...[...BASE, ...NEWS].map((e) => ({
      type: "page" as const,
      title: t(`nav.${e.key}.label`),
      detail: t(`nav.${e.key}.desc`),
      href: e.href,
    })),
    { type: "page" as const, title: t("pages.contribute.title"), detail: t("pages.contribute.summary"), href: "/contribute" },
  ];

  return NextResponse.json(entries, { headers: { "Cache-Control": "public, max-age=3600" } });
}

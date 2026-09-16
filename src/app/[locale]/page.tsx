import Link from "@/components/link";
import { serializeJsonLd } from "@/lib/html";
import Image from "next/image";
import { ArrowRight, Rss, Swords, TrendingDown, TrendingUp } from "lucide-react";
import { RoleAccess } from "@/components/role-access";
import { HomeFeatured } from "@/components/home-featured";
import { HeroPortrait } from "@/components/hero-portrait";
import { Foldable } from "@/components/foldable";
import { BadgeTier, Card, SectionTitle } from "@/components/ui";
import {
  allHeroes,
  heroAnalyses,
  heroesBySlug,
  illustrations,
  countSkins,
  patches,
  patchDetails,
  sync,
} from "@/lib/data";
import { allArticles } from "@/lib/content";
import { trendsOf } from "@/lib/evolution";
import { describeGap, formatGap, movesWeek, THRESHOLD_NOTABLE, type Motion } from "@/lib/trends";
import { rankingFull } from "@/lib/tier-list";
import { site } from "@/lib/site";
import type { Role } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { LOCALE_HTML, isLocale, languageName } from "@/i18n/config";
import { notFound } from "next/navigation";
import { BASE } from "@/lib/sections";
import { createT, type T } from "@/i18n/translations";

/** Home page structured data, in the page's language. */
const dataHome = (locale: Locale) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#site`,
      url: site.url,
      name: site.name,
      description: site.description,
      inLanguage: LOCALE_HTML[locale],
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${site.url}/${locale}/heroes?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${site.url}/#editeur`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/icon.svg`,
      sameAs: [site.repository],
    },
  ],
});

const detail = patchDetails as unknown as Record<
  string,
  { version: string; toc: { title: string }[] }
>;

/**
 * Featured hero, chosen by the day of the year.
 *
 * A random draw would change the visual on every reload — the home page
 * must stay recognizable from one visit to the next during the day.
 */
/** Interactive tools from the menu, shown as a grid on the home page. */
const TOOLS = BASE.filter((e) => e.href.startsWith("/tools/") || ["/draft", "/compare", "/quiz", "/mlbbdle"].includes(e.href));

function heroOfTheDay() {
  const eligible = allHeroes.filter((h) => illustrations[h.slug]);
  if (eligible.length === 0) return null;

  const day = Math.floor(Date.now() / 86_400_000);
  const chosen = eligible[day % eligible.length];
  return { heroes: chosen, illustration: Object.values(illustrations[chosen.slug])[0] };
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  // /nonexistent.txt arrives here with "nonexistent.txt" as its language: the page
  // renders together with the layout, and its numbers formatted in
  // that invalid language made it fail with a 500 before the 404.
  if (!isLocale(locale)) notFound();
  const t = createT(locale);
  const featured = heroOfTheDay();
  const articles = allArticles(locale).slice(0, 3);
  const top = rankingFull.slice(0, 5);
  const week = movesWeek(allHeroes.map((h) => ({ slug: h.slug, series: trendsOf(h.slug).all })));
  const lastPatch = patches.find((p) => detail[p.version]);

  const rankedEntry = featured
    ? rankingFull.find((e) => e.hero.slug === featured.heroes.slug)
    : null;

  const byRole = Object.fromEntries(
    (["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"] as Role[]).map((r) => [
      r,
      allHeroes.filter((h) => h.roles.includes(r)).length,
    ]),
  ) as Record<Role, number>;

  // A few recent skins, chosen for their illustration: the home page must
  // show what the site contains, not just announce it.
  const featuredSkins = allHeroes
    .filter((h) => illustrations[h.slug] && h.skins.length > 3)
    .slice(0, 6)
    .map((h) => {
      const entries = Object.entries(illustrations[h.slug]);
      const [name, image] = entries[entries.length - 1];
      return { slug: h.slug, heroes: h.name, skin: name, image };
    });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(dataHome(locale)) }}
      />

      {/* ── Hero banner ────────────────────────────────────────────────── */}
      <section className="border-b border-night-700/70">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:py-16">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 sm:text-sm">
            Mobile Legends: Bang Bang
          </p>
          <h1 className="mt-2 max-w-3xl font-heading text-3xl font-bold leading-tight text-chalk-100 sm:mt-4 sm:text-6xl">
            {t("home.title1")}{" "}
            <span className="bg-linear-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent">
              {t("home.titleAccent", { language: languageName(locale) })}
            </span>
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-chalk-300 sm:mt-6 sm:text-lg">
            {t("home.lead", { heroes: allHeroes.length, skins: countSkins })}
          </p>

          <div className="mt-5 flex flex-wrap gap-3 sm:mt-8">
            <Link
              href="/heroes"
              className="bevel-sm flex items-center gap-2 bg-gold-500 px-5 py-2.5 font-semibold text-night-950 transition-colors hover:bg-gold-400 sm:px-6 sm:py-3"
            >
              {t("home.browse")}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              href="/draft"
              className="bevel-sm flex items-center gap-2 border border-night-600 px-5 py-2.5 font-semibold text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400 sm:px-6 sm:py-3"
            >
              <Swords size={17} aria-hidden />
              {t("home.draftHelp")}
            </Link>
          </div>

          <dl className="mt-4 grid max-w-3xl grid-cols-4 gap-2 border-t border-night-800 pt-4 sm:mt-12 sm:gap-6 sm:pt-8">
            {[
              { value: allHeroes.length, label: t("home.statHeroes") },
              { value: countSkins, label: t("home.statSkins") },
              { value: patches.length, label: t("home.statPatches") },
              { value: heroAnalyses.length, label: t("home.statAnalyses") },
            ].map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-heading text-xl font-bold leading-tight text-gold-400 sm:text-3xl">
                    {s.value}
                  </span>
                  <span className="mt-0.5 block text-[0.65rem] uppercase tracking-wide text-chalk-500 sm:mt-1 sm:text-xs">
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Hero of the day ────────────────────────────────────────────── */}
      {featured && (
        <HomeFeatured
          hero={featured.heroes}
          illustration={featured.illustration}
          tier={rankedEntry?.tier ?? null}
          win={rankedEntry?.winRate ?? null}
          locale={locale}
        />
      )}

      {/* ── Browse by role ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-5 sm:py-16">
        <SectionTitle lead={t("home.startLead")}>
          {t("home.startTitle")}
        </SectionTitle>
        <RoleAccess count={byRole} locale={locale} />
      </section>

      {/* ── Tools ──────────────────────────────────────────────────────── */}
      {/*
        Taken from the menu: a tool added to the sections appears here with no other
        change.
      */}
      <section className="mx-auto max-w-6xl px-4 pb-5 sm:pb-16">
        <SectionTitle lead={t("home.toolsLead")}>{t("home.toolsTitle")}</SectionTitle>
        {/* Two columns on a phone: twelve doors read as a keypad, not as a list. */}
        <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {TOOLS.map(({ href, key, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="bevel group flex h-full items-start gap-2 border border-night-700/70 bg-night-900/60 p-2.5 transition-colors hover:border-gold-500/60 sm:gap-3 sm:p-4"
              >
                <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
                <span className="min-w-0">
                  <span className="block font-heading text-sm font-bold leading-tight text-chalk-100 transition-colors group-hover:text-gold-400 sm:text-base sm:leading-normal">
                    {t(`nav.${key}.label`)}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-tight text-chalk-500 sm:mt-1 sm:line-clamp-none sm:leading-relaxed sm:text-sm sm:leading-relaxed">
                    {t(`nav.${key}.desc`)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Top of the ranking ─────────────────────────────────────────── */}
      <section className="border-y border-night-700/70 bg-night-900/30">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:py-16">
          <SectionTitle
            lead={t("home.rankingLead")}
            action={{ href: "/tier-list", label: t("home.fullTierList") }}
          >
            {t("home.rankingTitle")}
          </SectionTitle>

          {/*
            Five stacked cards cost a screen and a half on a phone for five
            names: below `sm` the card lies down into a row — portrait, tier,
            name, rate — and stands back up from `sm`.
          */}
          <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
            {top.map((e) => (
              <li key={e.hero.slug}>
                <Link
                  href={`/heroes/${e.hero.slug}`}
                  className="bevel flex h-full items-center gap-3 border border-night-700/70 bg-night-900/60 p-2 transition-colors hover:border-gold-500/60 sm:flex-col sm:justify-center sm:gap-2 sm:p-4 sm:text-center"
                >
                  <span className="bevel-sm relative size-11 shrink-0 overflow-hidden bg-night-800 sm:size-16">
                    {e.hero.images.portrait && (
                      <Image
                        src={e.hero.images.portrait}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </span>
                  <BadgeTier tier={e.tier} />
                  <span className="min-w-0 flex-1 truncate font-heading font-bold text-chalk-100">{e.hero.name}</span>
                  <span className="shrink-0 text-xs text-chalk-500">
                    {new Intl.NumberFormat(LOCALE_HTML[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(e.winRate)}{" "}
                    {t("home.winPercent")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Trends of the week ─────────────────────────────────────────── */}
      {(week.rises.length > 0 || week.drops.length > 0) && (
        <section className="mx-auto max-w-6xl px-4 py-5 sm:py-16">
          <SectionTitle
            lead={t("home.trends.lead", {
              threshold: new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(THRESHOLD_NOTABLE),
            })}
            action={{ href: "/tier-list", label: t("home.fullTierList") }}
          >
            {t("home.trends.title")}
          </SectionTitle>
          {/*
            The head of the ranking, just above, already answers "who is
            strong": the week's movements are the follow-up question. They
            stay in the document, one line away.
          */}
          <Foldable label={t("home.trends.open", { n: week.rises.length + week.drops.length })}>
            <div className="grid gap-5 md:grid-cols-2 md:gap-8">
              <ListMoves
                title={t("home.trends.rise")}
                empty={t("home.trends.noRise")}
                moves={week.rises}
                rise
                locale={locale}
                t={t}
              />
              <ListMoves
                title={t("home.trends.fall")}
                empty={t("home.trends.noFall")}
                moves={week.drops}
                rise={false}
                locale={locale}
                t={t}
              />
            </div>
          </Foldable>
        </section>
      )}

      {/* ── Skins ──────────────────────────────────────────────────────── */}
      {featuredSkins.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-5 sm:py-16">
          <SectionTitle
            lead={t("home.skinsLead", { skins: countSkins })}
            action={{ href: "/heroes", label: t("home.seeHeroes") }}
          >
            {t("home.skinsTitle")}
          </SectionTitle>

          <ul className="grid grid-cols-3 gap-2 md:grid-cols-3 md:gap-3">
            {featuredSkins.map((s) => (
              <li key={`${s.slug}-${s.skin}`}>
                <Link
                  href={`/heroes/${s.slug}`}
                  className="bevel group relative block aspect-video overflow-hidden border border-night-700/70"
                >
                  <Image
                    src={s.image}
                    alt={`${s.heroes} — ${s.skin}`}
                    fill
                    sizes="(min-width: 768px) 380px, 45vw"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-night-950 to-transparent p-2 sm:p-3">
                    <span className="block truncate font-heading text-xs font-bold text-chalk-100 sm:text-sm">
                      {s.skin}
                    </span>
                    <span className="block truncate text-[0.65rem] text-chalk-500 sm:text-xs">{s.heroes}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Patch and articles ─────────────────────────────────────────── */}
      <section className="border-t border-night-700/70 bg-night-900/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-5 sm:py-16 lg:grid-cols-[1fr_2fr]">
          {lastPatch && (
            <div>
              <SectionTitle lead="">{t("home.lastUpdate")}</SectionTitle>
              <Card className="p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-400">
                  <TrendingUp size={14} aria-hidden />
                  Patch {lastPatch.version}
                </p>
                <ul className="mt-3 space-y-1">
                  {detail[lastPatch.version].toc.slice(0, 5).map((s) => (
                    <li key={s.title} className="text-sm leading-snug text-chalk-300">
                      {s.title}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/patch-notes/${lastPatch.version}`}
                  className="mt-4 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                >
                  {t("home.readNotes")} →
                </Link>
              </Card>
            </div>
          )}

          <div>
            <SectionTitle
              lead=""
              action={{ href: "/news", label: t("home.allNews") }}
            >
              {t("home.latestArticles")}
            </SectionTitle>
            <ul className="space-y-2">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/${a.category === "Patch" ? "patch-notes" : "news"}/${a.slug}`}
                    className="bevel block border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60 sm:p-4"
                  >
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold-400">
                        {t(`articleCategory.${a.category}`)}
                      </span>
                      <time dateTime={a.date} className="text-xs text-chalk-500">
                        {formatShortDate(a.date, LOCALE_HTML[locale])}
                      </time>
                    </span>
                    <span className="mt-1 line-clamp-2 block font-heading font-bold leading-snug text-chalk-100 sm:line-clamp-none sm:text-lg">
                      {a.title}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm leading-snug text-chalk-500 sm:line-clamp-none">
                      {a.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/*
        ── How it works ──────────────────────────────────────────────────
        The last section explains the site rather than showing it: it closes
        the page instead of lengthening it, its three cards folded under a
        summary line. The text stays in the document.
      */}
      <section className="mx-auto max-w-6xl px-4 py-5 sm:py-16">
        <Foldable label={t("home.howItWorks")}>
          <p className="text-sm text-chalk-500">
            {t("home.syncLead", { date: formatShortDate(sync.date, LOCALE_HTML[locale]) })}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { title: t("home.cards.dataTitle"), text: t("home.cards.dataText") },
              { title: t("home.cards.rankingTitle"), text: t("home.cards.rankingText") },
              { title: t("home.cards.writtenTitle"), text: t("home.cards.writtenText") },
            ].map((c) => (
              <Card key={c.title}>
                <h3 className="font-heading text-lg font-bold text-chalk-100">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-chalk-500">{c.text}</p>
              </Card>
            ))}
          </div>
        </Foldable>

        <p className="mt-5 flex items-center gap-2 text-sm text-chalk-500">
          <Rss size={15} aria-hidden className="text-gold-400" />
          <Link href="/feed.xml" className="hover:text-gold-400">
            {t("home.followRss")}
          </Link>
        </p>
      </section>
    </>
  );
}

/**
 * Risers or fallers of the week: portrait, current rate and gap in points.
 * The arrow and the color double the sign; screen readers hear
 * the gap spelled out.
 */
function ListMoves({
  title,
  empty,
  moves,
  rise,
  locale,
  t,
}: {
  title: string;
  empty: string;
  moves: Motion[];
  rise: boolean;
  locale: Locale;
  t: T;
}) {
  const Icon = rise ? TrendingUp : TrendingDown;
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div>
      <h3
        className={cn(
          "mb-2 flex items-center gap-2 font-heading text-lg font-bold",
          rise ? "text-emerald-400" : "text-blood-500",
        )}
      >
        <Icon size={18} aria-hidden />
        {title}
      </h3>
      {moves.length === 0 ? (
        <p className="text-sm text-chalk-500">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {moves.map(({ slug, variation: v }) => {
            const h = heroesBySlug.get(slug);
            if (!h) return null;
            return (
              <li key={slug}>
                <Link
                  href={`/heroes/${slug}`}
                  className="bevel-sm group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2 transition-colors hover:border-gold-500/60"
                >
                  <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="icon" decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                      {h.name}
                    </span>
                    <span className="block text-xs text-chalk-500">
                      {percent.format(v.current)} {t("home.winPercent")}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 font-semibold tabular-nums",
                      rise ? "text-emerald-400" : "text-blood-500",
                    )}
                  >
                    <Icon size={15} aria-hidden />
                    <span aria-hidden>
                      {formatGap(v.gap, locale)} {t("counters.pts")}
                    </span>
                    <span className="sr-only">{describeGap(t, locale, v.gap, v.days)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

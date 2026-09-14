import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import { LOCALE_HTML } from "@/i18n/config";
import { serializeJsonLd } from "@/lib/html";
import Image from "next/image";
import Link from "@/components/link";
import { notFound } from "next/navigation";
import { ShieldAlert, Swords, TriangleAlert } from "lucide-react";
import { FavouriteButton } from "@/components/favourite-button";
import { HeroSkills } from "@/components/hero-skills";
import { HeroCombos } from "@/components/hero-combos";
import { HeroStory } from "@/components/hero-story";
import { Breadcrumb } from "@/components/breadcrumb";

import { TeammatesByRank, MeasuredCounters } from "@/components/measured-counters";
import { RankProvider, RankPicker, ValueByRank } from "@/components/rank-picker";
import { BuildItem } from "@/components/build-item";
import { BuildsByRank } from "@/components/builds-by-rank";
import { BuildPicker } from "@/components/build-picker";
import { resolveBuild, resolveGuide, visualEmblem, visualItem, spellVisual, visualTalent } from "@/lib/build-visuals";
import { HeroStatistics } from "@/components/hero-statistics";
import { heroGallery } from "@/lib/hero-skins";
import { duos } from "@/lib/duos";
import { HeroAdjustments } from "@/components/hero-patch";
import { NextPatch } from "@/components/next-patch";
import { HeroProStats } from "@/components/hero-pro-stats";
import { durationOf, historyOf, trendsOf } from "@/lib/evolution";
import { Tabs } from "@/components/tabs";
import { HeroFeedLink } from "@/components/hero-feed-link";

import {
  ShowcasePortrait,
  ShowcaseProvider,
  SkinShowcase,
  type SkinFull,
} from "@/components/skin-showcase";
import { Card, Gauge } from "@/components/ui";
import { RoleBadge } from "@/components/role-badge";
import {
  buildsPlayed,
  teammates,
  combos,
  skills,
  type CounterFigure,
  counters,
  guidesPlayers,
  allHeroes,
  heroesBySlug,
  stories,
  illustrations,
  itemsFor,
  patchDetails,
  detailedPatches,
  visualsSkills,
} from "@/lib/data";
import { rankingFull, statsByRank, rateBySlug, type StatsRank } from "@/lib/tier-list";
import { MEASURED_RANKS, type MeasuredRank } from "@/lib/measured-ranks";
import { pathRole } from "@/lib/tier-list-filters";
import { site, absoluteUrl } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage } from "@/i18n/translations";
import { releaseDate, heroLabel } from "@/i18n/hero-data";
import { normalizeNameSkin } from "@/lib/utils";
import { metaPage } from "@/i18n/seo";
import { FreshnessLine } from "@/components/freshness";
import { longDate, dateMeasure, listNames, patchCurrent, percentage } from "@/lib/freshness";
import { formatGap } from "@/lib/trends";
import type { BucketDuration } from "@/lib/evolution";
import type { Hero } from "@/lib/types";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/** Une page par heros, generee au build. */
export function generateStaticParams() {
  return allHeroes.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return {};

  const tm = createT(locale);
  const tier = rateBySlug.get(h.slug)?.tier;
  const v = patchCurrent.version;
  return metaPage(locale, {
    // Titre calque sur les recherches (« aamon build », « aamon emblem »,
    // « aamon counter »), avec le palier et le patch : les resultats qui
    // portent un repere de fraicheur sont ceux qu'on clique. L'epithete reste
    // sur la page.
    title: tier
      ? tm("pages.seo.hero.title", { nom: h.name, palier: tier, v })
      : tm("pages.seo.hero.titleNoTier", { nom: h.name, v }),
    description: descriptionHero(locale, h),
    path: `/heroes/${slug}`,
    type: "article",
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
}

/** Build le plus joue sur la position principale du heros, tous rangs. */
function buildMain(h: Hero) {
  const byLane = buildsPlayed[h.slug] ?? {};
  const lane = h.lanes.find((l) => byLane[l]) ?? Object.keys(byLane)[0];
  return lane ? (byLane[lane]?.all?.[0] ?? null) : null;
}

/**
 * Description en phrases de donnees, comme les extraits qui se cliquent : qui
 * contre le heros (en Mythique quand ce rang est mesure), son build le plus
 * joue, son taux de victoire et son palier, puis la date du releve. Sans
 * aucune mesure, la presentation generale.
 */
function descriptionHero(locale: Locale, h: Hero): string {
  const t = createT(locale);
  const sentences: string[] = [];

  const byRank = counters[h.slug] ?? {};
  const rank: MeasuredRank | null = byRank.mythic?.weak.length ? "mythic" : byRank.all?.weak.length ? "all" : null;
  if (rank) {
    const names = listNames(locale, byRank[rank]!.weak.slice(0, 3).map((c) => heroesBySlug.get(c.slug)?.name ?? c.slug));
    sentences.push(
      rank === "all"
        ? t("pages.seo.hero.countersAll", { nom: h.name, contres: names })
        : t("pages.seo.hero.counters", { nom: h.name, contres: names, rang: t(`measuredRanks.${rank}`) }),
    );
  }

  const build = buildMain(h);
  if (build?.items.length) {
    const namesItems = new Map(itemsFor(locale).map((o) => [o.slug, o.name]));
    const list = build.items.map((o) => namesItems.get(visualItem(o).slug ?? "") ?? o).join(", ");
    const role = build.emblem ? t(`roles.${build.emblem}`) : null;
    sentences.push(
      build.emblem
        ? t("pages.seo.hero.buildEmblem", {
            objets: list,
            embleme: role === `roles.${build.emblem}` ? build.emblem : role!,
          })
        : t("pages.seo.hero.build", { objets: list }),
    );
  }

  const rate = rateBySlug.get(h.slug);
  if (rate) sentences.push(t("pages.seo.hero.rate", { victoire: percentage(locale, rate.win), palier: rate.tier }));

  if (sentences.length > 0) return [...sentences, `${t("pages.freshness.updatedOn", { date: longDate(locale) })}.`].join(" ");

  // Le resume redige n'existe qu'en francais : les autres langues prennent la
  // description generee, dans leur langue.
  return (
    (locale === "fr" ? h.analysis?.summary : undefined) ??
    t("pages.heroDetail.metaDescription", {
      nom: h.title ? `${h.name}, ${h.title}` : h.name,
      roles: h.roles.map((r) => t(`roles.${r}`)).join(" / "),
      lanes: h.lanes.map((l) => t(`lanes.${l}`)).join(", ") || "—",
      skins: h.skins.length,
    })
  );
}

export default async function HeroPage({ params }: Params) {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) notFound();

  const rankedEntry = rankingFull.find((e) => e.hero.slug === slug);
  const t = createT(locale);
  const analysis = h.analysis;
  const skillsWiki = skills(locale)[h.slug] ?? [];
  const iconsSkills = visualsSkills[h.slug] ?? {};
  const illustrationsHero = illustrations[h.slug] ?? {};
  // L'illustration du skin d'origine sert de fond : c'est celle qui represente
  // le heros tel qu'on le rencontre par defaut.
  const background = Object.values(illustrationsHero)[0] ?? null;
  const story = stories(locale)[h.slug] ?? null;
  const hasStory =
    !!story && (story.lore.length > 0 || !!story.profile || story.trivia.length > 0);

  // Jointure des trois sources : le skin porte son id, son portrait (par id) et
  // son illustration (par nom). La vitrine s'en sert pour tout synchroniser.
  // L'illustration se retrouve aussi par nom normalise : la legende du wiki
  // n'a pas toujours la casse du module (« Vessel Of Deceit »).
  const illustrationByName = new Map(
    Object.entries(illustrationsHero).map(([name, path]) => [normalizeNameSkin(name), path]),
  );
  const skinsFull: SkinFull[] = h.skins.map((s) => ({
    ...s,
    portrait: h.images.skins[s.id] ?? null,
    illustration:
      illustrationsHero[s.name] ?? illustrationByName.get(normalizeNameSkin(s.name)) ?? null,
  }));
  const portraitOf = (slug: string) =>
    heroesBySlug.get(slug)?.images.icon ?? heroesBySlug.get(slug)?.images.portrait ?? null;
  const nameOf = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;

  // Le selecteur de rang tourne dans le navigateur, qui n'a pas le catalogue :
  // noms et portraits des adversaires sont donc resolus ici, pour chaque rang.
  const resolve = (list: CounterFigure[]) =>
    list.map((e) => ({ ...e, name: nameOf(e.slug), portrait: portraitOf(e.slug) }));
  const countersShown = Object.fromEntries(
    Object.entries(counters[h.slug] ?? {}).map(([rank, c]) => [
      rank,
      { strong: resolve(c.strong), weak: resolve(c.weak), winRate: c.winRate },
    ]),
  );
  const hasCounters = Object.keys(countersShown).length > 0;

  // Taux de l'en-tete, rang par rang : le rang choisi sur la fiche les fait
  // basculer en meme temps que les contres.
  const statsRanks = statsByRank(h.slug);
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const valuesByRank = (format: (s: StatsRank) => string) =>
    Object.fromEntries(Object.entries(statsRanks).map(([r, s]) => [r, format(s)]));
  const ranksAvailable = MEASURED_RANKS.filter((r) => statsRanks[r] || countersShown[r]);

  // Builds joues, resolus ici pour la meme raison : visuels et catalogue
  // restent cote serveur.
  const buildsShown = Object.fromEntries(
    Object.entries(buildsPlayed[h.slug] ?? {}).map(([lane, byRank]) => [
      lane,
      Object.fromEntries(
        Object.entries(byRank).map(([rank, list]) => [rank, (list ?? []).map(resolveBuild)]),
      ),
    ]),
  );
  const guidesShown = Object.fromEntries(
    Object.entries(guidesPlayers[h.slug] ?? {}).map(([lane, byRank]) => [
      lane,
      Object.fromEntries(
        Object.entries(byRank).flatMap(([rank, g]) => (g ? [[rank, resolveGuide(g)]] : [])),
      ),
    ]),
  );
  const hasBuilds = Object.keys(buildsShown).length > 0 || Object.keys(guidesShown).length > 0;

  const teammatesShown = Object.fromEntries(
    Object.entries(teammates[h.slug] ?? {}).map(([rank, list]) => [
      rank,
      (list ?? []).map((c) => ({ ...c, name: nameOf(c.slug), portrait: portraitOf(c.slug) })),
    ]),
  );
  const hasTeammates = Object.keys(teammatesShown).length > 0;

  // Build le plus joue sur la position principale, tous rangs : la reference
  // a laquelle confronter les builds rediges, qui vieillissent d'un patch a
  // l'autre.
  const reference = buildMain(h);
  const namesItems = new Map(itemsFor(locale).map((o) => [o.slug, o.name]));
  const gapOf = (b: { items: string[]; talent: string }) => {
    if (!reference) return null;
    const taken = new Set(b.items.map((o) => visualItem(o).slug ?? o));
    const missing = reference.items
      .filter((o) => !taken.has(visualItem(o).slug ?? o))
      .map((o) => namesItems.get(visualItem(o).slug ?? "") ?? o);
    const sameTalent = reference.talents.some((x) => x.toLowerCase() === b.talent.toLowerCase());
    return { missing, talents: sameTalent ? null : reference.talents.join(", ") };
  };

  // Patchs dates, pour les reperes des courbes, et ajustements du heros.
  const versionsRecent = Object.values(patchDetails).sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );
  const patchsDates = versionsRecent.flatMap((p) => (p.date ? [{ version: p.version, date: p.date }] : []));
  const heroAdjustments = versionsRecent.flatMap((p) =>
    (detailedPatches(locale)[p.version] ?? p).adjustments
      .filter((a) => a.slug === h.slug)
      .map((a) => ({ version: p.version, adjustment: a })),
  );

  const history = historyOf(h.slug);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: h.title ? `${h.name} — ${h.title}` : h.name,
    // La description de la page, dans sa langue : le resume redige n'existe
    // qu'en francais et s'affichait sous un `inLanguage` anglais.
    description: descriptionHero(locale, h),
    image: h.images.portrait ? absoluteUrl(h.images.portrait) : undefined,
    inLanguage: LOCALE_HTML[locale],
    // Premiere mesure conservee pour ce heros : la fiche publie ses chiffres
    // depuis. La modification suit le dernier releve des taux.
    datePublished: history?.start ?? dateMeasure,
    dateModified: dateMeasure,
    author: { "@type": "Person", name: site.author, url: `https://github.com/${site.author}` },
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
      logo: { "@type": "ImageObject", url: absoluteUrl("/apple-icon.png") },
    },
    mainEntityOfPage: `${site.url}/${locale}/heroes/${slug}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroDetail"])}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />

      {/*
        Un seul etat de skin pour toute la fiche : l'en-tete et l'onglet skins
        le partagent, si bien que choisir un skin met a jour le portrait de tete
        comme la grande illustration.
      */}
      <ShowcaseProvider skins={skinsFull} portraitDefault={h.images.portrait}>
      <RankProvider ranks={ranksAvailable}>
      {/* ── En-tete ────────────────────────────────────────────────────── */}
      <div className="relative border-b border-night-700/70 bg-night-900/30">
        {background && (
          <div aria-hidden className="absolute inset-0 overflow-hidden">
            <Image
              src={background}
              alt=""
              fill
              priority
              sizes="100vw"
              // Fond assombri par un voile : une qualite reduite ne se voit pas,
              // et c'est l'element le plus lourd a charger sur mobile.
              quality={50}
              // Le bandeau est bien plus large que l'illustration n'est haute :
              // cadrer en haut ne montrerait que le ciel. On vise le tiers
              // superieur, ou se trouve le personnage.
              className="object-cover object-[50%_30%] brightness-110"
            />
            {/*
              Un voile uniforme plutot qu'un degrade lateral : la zone claire
              d'une illustration n'est pas au meme endroit d'un heros a
              l'autre — celle de Khufra est sombre a droite, celle de Miya au
              centre. Un degrade oriente marchait donc pour les uns et effacait
              les autres.
            */}
            <div className="absolute inset-0 bg-night-950/55" />
            {/*
              Le bas de l'en-tete se referme sur le fond de page : la
              transition vers le contenu reste franche, sans coupure nette.
            */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-night-950 to-transparent" />
          </div>
        )}

        <div className="relative mx-auto max-w-5xl px-4 py-10">
          {/*
            Le fil flotte sur l'illustration avec son propre fond. La miette du
            role mene a la page du role ; celle du heros ouvre les autres.
          */}
          <Breadcrumb
            crumbs={[
              { name: t("nav.heroes.label"), href: "/heroes" },
              ...(h.roles[0] ? [{ name: t(`roles.${h.roles[0]}`), href: pathRole(h.roles[0]) }] : []),
              {
                name: h.name,
                siblings: [...allHeroes]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((x) => ({ name: x.name, href: `/heroes/${x.slug}` })),
              },
            ]}
          />

          <div className="bevel mt-6 flex flex-wrap items-start gap-6 border border-night-700/50 bg-night-950/75 p-5 backdrop-blur-sm">
            <ShowcasePortrait name={h.name} portraitDefault={h.images.portrait} />

            <div className="min-w-0 flex-1 basis-64">
              <h1 className="font-heading text-4xl font-bold text-chalk-100">{h.name}</h1>
              {h.title && <p className="mt-1 text-lg text-gold-400">{h.title}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {h.roles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
                {h.specialties.map((s) => (
                  <span
                    key={s}
                    className="bevel-sm border border-night-600 px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-chalk-500"
                  >
                    {heroLabel(t, "specialty", s)}
                  </span>
                ))}
              </div>

              <FreshnessLine locale={locale} className="mt-4" />

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <FavouriteButton hero={h.slug} />
                <Link
                  href={`/compare?a=${h.slug}`}
                  className="bevel-sm flex items-center gap-2 border border-night-700 px-4 py-2 text-sm font-medium text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                >
                  <Swords size={15} aria-hidden />
                  {t("pages.heroDetail.compare")}
                </Link>
              </div>
            </div>

            {/* Notes du jeu, en jauges plutot qu'en chiffres nus. */}
            <dl className="grid min-w-0 flex-1 basis-56 gap-2.5">
              {[
                [t("pages.heroDetail.ratings.offense"), h.ratings.offense],
                [t("pages.heroDetail.ratings.durability"), h.ratings.durability],
                [t("pages.heroDetail.ratings.effects"), h.ratings.abilityEffects],
                [t("pages.heroDetail.ratings.difficulty"), h.ratings.difficulty],
              ].map(([label, value]) =>
                value === null ? null : (
                  <div key={String(label)} className="flex items-center gap-3">
                    <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-chalk-500">
                      {label}
                    </dt>
                    <dd className="flex-1">
                      <Gauge value={Number(value)} />
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </div>

          {/* ── Faits ────────────────────────────────────────────────── */}
          {/*
            Les informations posent leur propre fond plutot que de compter sur
            l'assombrissement de l'illustration : le contraste ne depend alors
            plus de la luminosite de l'artwork, qui change a chaque heros.
          */}
          <div className="bevel mt-8 border border-night-700/50 bg-night-950/75 p-5 backdrop-blur-sm">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4 lg:grid-cols-6">
            {[
              [t("pages.heroDetail.stat.position"), h.lanes.map((l) => t(`lanes.${l}`)).join(", ")],
              [t("pages.heroDetail.stat.release"), releaseDate(h.release, locale, t)],
              [t("pages.heroDetail.stat.resource"), heroLabel(t, "resource", h.resource)],
              [t("pages.heroDetail.stat.damage"), heroLabel(t, "damage", h.damageType)],
              [t("pages.heroDetail.stat.range"), heroLabel(t, "attack", h.attackType)],
              [t("pages.heroDetail.stat.region"), heroLabel(t, "region", h.region)],
              [t("pages.heroDetail.stat.skins"), h.skins.length || null],
              [t("pages.heroDetail.stat.tierList"), rankedEntry ? <ValueByRank values={valuesByRank((s) => t("pages.heroDetail.tier", { p: s.tier }))} /> : null],
              [t("pages.heroDetail.stat.winRate"), rankedEntry ? <ValueByRank values={valuesByRank((s) => `${percent.format(s.winRate)} %`)} /> : null],
              [t("pages.heroDetail.stat.banRate"), rankedEntry ? <ValueByRank values={valuesByRank((s) => `${percent.format(s.banRate)} %`)} /> : null],
            ].map(([label, value]) =>
              !value ? null : (
                <div key={String(label)}>
                  <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
                  <dd className="mt-1 text-chalk-100">{value}</dd>
                </div>
              ),
            )}
          </dl>
          {/* Rang de toute la fiche : taux, contres et builds le suivent. */}
          <RankPicker className="mt-5 border-t border-night-800 pt-4" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <Tabs
          tabs={[
            {
              id: "analyse",
              label: t("pages.heroDetail.tab.analysis"),
              content: analysis ? (
                <div className="space-y-12">
                  <section>
                    <div className="space-y-4 leading-relaxed text-chalk-300">
                      {analysis.analysis.split("\n\n").map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    <Card className="border-emerald-500/25">
                      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-emerald-400">
                        <Swords size={18} aria-hidden />
                        {t("pages.heroDetail.strengths")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analysis.strengths.map((f) => (
                          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
                            <span aria-hidden className="mt-2 size-1 shrink-0 bg-emerald-400" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </Card>
                    <Card className="border-blood-500/25">
                      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-blood-500">
                        <TriangleAlert size={18} aria-hidden />
                        {t("pages.heroDetail.weaknesses")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analysis.weaknesses.map((f) => (
                          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
                            <span aria-hidden className="mt-2 size-1 shrink-0 bg-blood-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </section>

                </div>
              ) : (
                <Card className="border-gold-500/30">
                  <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-gold-400">
                    <ShieldAlert size={20} aria-hidden />
                    {t("pages.heroDetail.analysisPending")}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-chalk-300">
                    {t("pages.heroDetail.analysisText", { nom: h.name })}
                  </p>
                  <Link
                    href="/contribute"
                    className="mt-5 inline-block text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500"
                  >
                    {t("pages.heroDetail.contribute")}
                  </Link>
                </Card>
              ),
            },
            {
              id: "histoire",
              label: t("pages.heroDetail.tab.story"),
              content: hasStory ? <HeroStory story={story} name={h.name} locale={locale} /> : null,
            },
            {
              id: "competences",
              label: t("pages.heroDetail.tab.skills"),
              counter:
                Math.max(
                  skillsWiki.filter(Boolean).length,
                  analysis?.skills.length ?? 0,
                ) || undefined,
              content: (
                <div className="space-y-10">
                  <HeroSkills
                    wiki={skillsWiki}
                    icons={iconsSkills}
                    writtenSkills={analysis?.skills ?? null}
                  />
                  <HeroCombos combos={combos(locale)[h.slug] ?? []} locale={locale} />
                </div>
              ),
            },
            {
              id: "contres",
              label: t("pages.heroDetail.tab.counters"),
              content:
                hasCounters || hasTeammates || analysis ? (
                  <div className="space-y-8">
                    {hasCounters && (
                      <section>
                        <MeasuredCounters name={h.name} byRank={countersShown} />
                        <Link
                          href={`/heroes/${h.slug}/counters`}
                          className="mt-4 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                        >
                          {t("pages.heroDetail.pageCounters")} →
                        </Link>
                      </section>
                    )}

                    {hasTeammates && (
                      <section>
                        <TeammatesByRank name={h.name} byRank={teammatesShown} />
                        {duos[h.slug] && (
                          <Link
                            href={`/heroes/${h.slug}/duos`}
                            className="mt-4 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                          >
                            {t("pages.heroDetail.pageDuos")} →
                          </Link>
                        )}
                      </section>
                    )}

                    {analysis && (analysis.strongAgainst.length > 0 || analysis.weakAgainst.length > 0) && (
                      <section>
                        <h3 className="font-heading text-lg font-bold text-chalk-100">
                          {t("pages.heroDetail.matchups")}
                        </h3>
                        <p className="mt-1 text-sm text-chalk-500">
                          {t("pages.heroDetail.matchupsIntro")}
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <ListCounters title={t("pages.heroDetail.comfortable", { nom: h.name })} slugs={analysis.strongAgainst} tone="good" />
                          <ListCounters title={t("pages.heroDetail.difficulty2", { nom: h.name })} slugs={analysis.weakAgainst} tone="bad" />
                        </div>
                      </section>
                    )}
                  </div>
                ) : null,
            },
            {
              id: "builds",
              label: t("pages.heroDetail.tab.builds"),
              content: hasBuilds || analysis ? (
                <div className="space-y-10">
                  {hasBuilds && (
                    <section>
                      <BuildsByRank byLane={buildsShown} guides={guidesShown} />
                    </section>
                  )}
                  {analysis && analysis.builds.length > 0 && (
                  <section>
                  {hasBuilds && (
                    <>
                      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("builds.written")}</h3>
                      <p className="mt-1 mb-5 text-sm text-chalk-500">{t("builds.writtenIntro")}</p>
                    </>
                  )}
                  <div className="space-y-4">
                  {analysis.builds.map((b) => (
                    <Card key={b.name}>
                      <h3 className="font-heading text-lg font-bold text-gold-400">{b.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-chalk-500">{b.context}</p>
                      <ol className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {b.items.map((o, i) => (
                          <BuildItem key={o} name={o} rank={i + 1} />
                        ))}
                      </ol>
                      <div className="mt-5 grid gap-3 border-t border-night-800 pt-4 sm:grid-cols-3">
                        <BuildPicker label={t("builds.emblem")} name={b.emblem} image={visualEmblem(b.emblem).image} href={visualEmblem(b.emblem).href} />
                        <BuildPicker label={t("builds.talent")} name={b.talent} image={visualTalent(b.talent).image} />
                        <BuildPicker label={t("builds.spell")} name={b.spell} image={spellVisual(b.spell).image} href={spellVisual(b.spell).href} />
                      </div>
                      {(() => {
                        const gap = gapOf(b);
                        if (!gap) return null;
                        return (
                          <p className="mt-4 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
                            <span className="font-semibold text-chalk-300">{t("builds.gapTitle")} · </span>
                            {gap.missing.length === 0
                              ? t("builds.aligned")
                              : t("builds.gapItems", { objets: gap.missing.join(", ") })}
                            {gap.talents && <> {t("builds.gapTalent", { talent: gap.talents })}</>}
                          </p>
                        );
                      })()}
                    </Card>
                  ))}
                  </div>
                  </section>
                  )}
                </div>
              ) : null,
            },
            {
              id: "stats",
              deferred: true,
              label: t("pages.heroDetail.tab.stats"),
              preview: (
                <PreviewStatistics
                  locale={locale}
                  h={h}
                  statsRanks={statsRanks}
                  adjustments={heroAdjustments.length}
                  patches={versionsRecent.length}
                />
              ),
              content: (
                <div className="space-y-12">
                  <HeroStatistics
                    name={h.name}
                    trends={trendsOf(h.slug)}
                    duration={durationOf(h.slug)}
                    history={history}
                    patches={patchsDates}
                    byRank={Object.fromEntries(
                      Object.entries(statsRanks).map(([r, s]) => [r, { win: s.winRate, ban: s.banRate }]),
                    )}
                    adjustments={heroAdjustments.map((a) => ({ version: a.version, type: a.adjustment.type }))}
                  />
                  <section>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="font-heading text-lg font-bold text-chalk-100">
                        {t("pages.heroDetail.statistics.adjustments")}
                      </h3>
                      <HeroFeedLink locale={locale} slug={h.slug} />
                    </div>
                    <p className="mt-1 mb-4 text-sm text-chalk-500">
                      {heroAdjustments.length > 0
                        ? t("pages.heroDetail.statistics.adjustmentsIntro", { nom: h.name })
                        : t("pages.heroDetail.statistics.noAdjustment", { nom: h.name, n: versionsRecent.length })}
                    </p>
                    {heroAdjustments.length > 0 && (
                      <HeroAdjustments entries={heroAdjustments} portrait={h.images.icon ?? h.images.portrait} />
                    )}
                    {/* Changes being tested on the Advance Server; renders nothing otherwise. */}
                    <NextPatch slug={h.slug} locale={locale} />
                  </section>
                  {/* Pro play presence in recent tournaments; renders nothing for absent heroes. */}
                  <HeroProStats slug={h.slug} locale={locale} />
                </div>
              ),
            },
            {
              id: "skins",
              deferred: true,
              label: t("pages.heroDetail.tab.skins"),
              counter: skinsFull.length || undefined,
              // Les noms des skins, en texte, en attendant la galerie.
              preview:
                skinsFull.length > 0 ? (
                  <div className="text-sm leading-relaxed text-chalk-300">
                    <p>{t("pages.heroPreview.skins", { nom: h.name, n: skinsFull.length })}</p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-chalk-500">
                      {skinsFull.map((s) => (
                        <li key={s.id}>{s.name}</li>
                      ))}
                    </ul>
                    {heroGallery(h).total > 0 && (
                      <Link
                        href={`/heroes/${h.slug}/skins`}
                        className="mt-3 inline-block font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.heroSkins.sheetLink", { n: heroGallery(h).total })} →
                      </Link>
                    )}
                  </div>
                ) : null,
              content:
                skinsFull.length > 0 ? (
                  <div className="space-y-5">
                    {heroGallery(h).total > 0 && (
                      <Link
                        href={`/heroes/${h.slug}/skins`}
                        className="inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.heroSkins.sheetLink", { n: heroGallery(h).total })} →
                      </Link>
                    )}
                    <SkinShowcase skins={skinsFull} />
                  </div>
                ) : null,
            },
          ]}
        />
      </div>
      </RankProvider>
      </ShowcaseProvider>
    </ExtendMessages>
  );
}

function ListCounters({
  title,
  slugs,
  tone,
}: {
  title: string;
  slugs: string[];
  tone: "good" | "bad";
}) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-chalk-100">{title}</h3>
      <ul className="mt-4 flex flex-wrap gap-2">
        {slugs.map((s) => (
          <li key={s}>
            <Link
              href={`/heroes/${s}`}
              className={`bevel-sm border px-2.5 py-1 text-sm transition-colors ${
                tone === "good"
                  ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  : "border-blood-500/30 text-blood-500 hover:bg-blood-500/10"
              }`}
            >
              {heroesBySlug.get(s)?.name ?? s}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Resume des statistiques en phrases, rendu par le serveur dans l'onglet
 * differe : evolution sur trente jours, duree de partie favorable, ecart entre
 * les rangs et ajustements recents. Les graphiques le remplacent a
 * l'ouverture ; d'ici la, moteurs et lecteurs en ont l'essentiel en texte.
 */
function PreviewStatistics({
  locale,
  h,
  statsRanks,
  adjustments,
  patches,
}: {
  locale: Locale;
  h: Hero;
  statsRanks: Partial<Record<MeasuredRank, StatsRank>>;
  adjustments: number;
  patches: number;
}) {
  const t = createT(locale);
  const percent = (v: number) => percentage(locale, v);
  const sentences: string[] = [];

  const measures = (trendsOf(h.slug).all?.winRate ?? []).flatMap((v, k) => (v === null ? [] : [[k, v] as const]));
  if (measures.length > 1) {
    const [k0, start] = measures[0];
    const [k1, end] = measures[measures.length - 1];
    sentences.push(
      t("pages.heroPreview.trend", {
        nom: h.name,
        n: k1 - k0 + 1,
        debut: percent(start),
        fin: percent(end),
        ecart: formatGap(end - start, locale),
        pts: t("counters.pts"),
      }),
    );
  }

  const buckets = [...(durationOf(h.slug).all ?? [])].sort((a, b) => b.winRate - a.winRate);
  if (buckets.length > 1) {
    const label = (x: BucketDuration) =>
      x.to === null
        ? t("pages.heroDetail.statistics.minutesPlus", { de: x.from })
        : t("pages.heroDetail.statistics.minutes", { de: x.from, a: x.to });
    const high = buckets[0];
    const low = buckets[buckets.length - 1];
    sentences.push(
      t("pages.heroPreview.duration", {
        nom: h.name,
        tranche: label(high),
        victoire: percent(high.winRate),
        trancheBas: label(low),
        victoireBas: percent(low.winRate),
      }),
    );
  }

  const ranks = MEASURED_RANKS.filter((r) => r !== "all" && statsRanks[r]).sort(
    (a, b) => statsRanks[a]!.winRate - statsRanks[b]!.winRate,
  );
  if (ranks.length > 1) {
    const bottom = ranks[0];
    const top = ranks[ranks.length - 1];
    sentences.push(
      t("pages.heroPreview.ranks", {
        nom: h.name,
        bas: percent(statsRanks[bottom]!.winRate),
        rangBas: t(`measuredRanks.${bottom}`),
        haut: percent(statsRanks[top]!.winRate),
        rangHaut: t(`measuredRanks.${top}`),
      }),
    );
  }

  if (adjustments > 0) sentences.push(t("pages.heroPreview.adjustments", { nom: h.name, n: adjustments, total: patches }));
  if (sentences.length === 0) return null;

  return (
    <div className="space-y-3 text-sm leading-relaxed text-chalk-300">
      {sentences.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

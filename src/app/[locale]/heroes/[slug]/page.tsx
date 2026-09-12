import type { Metadata } from "next";
import { CompleterMessages } from "@/i18n/fournisseur";
import { LOCALE_HTML } from "@/i18n/config";
import { donneesLd } from "@/lib/html";
import Image from "next/image";
import Link from "@/components/lien";
import { notFound } from "next/navigation";
import { ShieldAlert, Swords, TriangleAlert } from "lucide-react";
import { BoutonFavori } from "@/components/bouton-favori";
import { CompetencesHeros } from "@/components/competences-heros";
import { CombosHeros } from "@/components/combos-heros";
import { HistoireHeros } from "@/components/histoire-heros";
import { FilAriane } from "@/components/fil-ariane";

import { CoequipiersParRang, ContresChiffres } from "@/components/contres-chiffres";
import { RangProvider, SelecteurRang, ValeurParRang } from "@/components/selecteur-rang";
import { ObjetBuild } from "@/components/objet-build";
import { BuildsParRang } from "@/components/builds-par-rang";
import { ChoixBuild } from "@/components/choix-build";
import { resoudreBuild, resoudreGuide, visuelEmbleme, visuelObjet, visuelSort, visuelTalent } from "@/lib/visuels-build";
import { StatistiquesHeros } from "@/components/statistiques-heros";
import { galerieHeros } from "@/lib/skins-heros";
import { duos } from "@/lib/duos";
import { AjustementsDuHeros } from "@/components/patch-heros";
import { NextPatch } from "@/components/next-patch";
import { HeroProStats } from "@/components/hero-pro-stats";
import { dureeDe, historiqueDe, tendancesDe } from "@/lib/evolution";
import { Onglets } from "@/components/onglets";
import { LienFluxHeros } from "@/components/lien-flux-heros";

import {
  PortraitVitrine,
  VitrineProvider,
  VitrineSkins,
  type SkinComplet,
} from "@/components/vitrine-skins";
import { Carte, Jauge } from "@/components/ui";
import { BadgeRole } from "@/components/badge-role";
import {
  buildsJoues,
  coequipiers,
  combos,
  competences,
  type ContreChiffre,
  contres,
  guidesJoueurs,
  heros,
  herosParSlug,
  histoires,
  illustrations,
  objets,
  patchsDetail,
  patchsDetailles,
  visuelsCompetences,
} from "@/lib/donnees";
import { classementComplet, statsParRang, tauxParSlug, type StatsRang } from "@/lib/tier-list";
import { RANGS_MESURE, type RangMesure } from "@/lib/rangs-mesure";
import { cheminRole } from "@/lib/filtres-tier-list";
import { site, urlAbsolue } from "@/lib/site";
import type { Langue } from "@/i18n/config";
import { creerT, messagesPage } from "@/i18n/traductions";
import { dateSortie, libelleHeros } from "@/i18n/donnees-heros";
import { normaliserNomSkin } from "@/lib/utils";
import { metaPage } from "@/i18n/seo";
import { LigneFraicheur } from "@/components/fraicheur";
import { dateLongue, dateMesure, listeNoms, patchActuel, pourcentage } from "@/lib/fraicheur";
import { formaterEcart } from "@/lib/tendances";
import type { TrancheDuree } from "@/lib/evolution";
import type { Heros } from "@/lib/types";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

/** Une page par heros, generee au build. */
export function generateStaticParams() {
  return heros.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) return {};

  const tm = creerT(locale);
  const palier = tauxParSlug.get(h.slug)?.palier;
  const v = patchActuel.version;
  return metaPage(locale, {
    // Titre calque sur les recherches (« aamon build », « aamon emblem »,
    // « aamon counter »), avec le palier et le patch : les resultats qui
    // portent un repere de fraicheur sont ceux qu'on clique. L'epithete reste
    // sur la page.
    titre: palier
      ? tm("pages.seo.hero.title", { nom: h.name, palier, v })
      : tm("pages.seo.hero.titleNoTier", { nom: h.name, v }),
    description: descriptionHeros(locale, h),
    chemin: `/heroes/${slug}`,
    type: "article",
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
}

/** Build le plus joue sur la position principale du heros, tous rangs. */
function buildPrincipal(h: Heros) {
  const parLane = buildsJoues[h.slug] ?? {};
  const lane = h.lanes.find((l) => parLane[l]) ?? Object.keys(parLane)[0];
  return lane ? (parLane[lane]?.all?.[0] ?? null) : null;
}

/**
 * Description en phrases de donnees, comme les extraits qui se cliquent : qui
 * contre le heros (en Mythique quand ce rang est mesure), son build le plus
 * joue, son taux de victoire et son palier, puis la date du releve. Sans
 * aucune mesure, la presentation generale.
 */
function descriptionHeros(locale: Langue, h: Heros): string {
  const t = creerT(locale);
  const phrases: string[] = [];

  const parRang = contres[h.slug] ?? {};
  const rang: RangMesure | null = parRang.mythic?.weak.length ? "mythic" : parRang.all?.weak.length ? "all" : null;
  if (rang) {
    const noms = listeNoms(locale, parRang[rang]!.weak.slice(0, 3).map((c) => herosParSlug.get(c.slug)?.name ?? c.slug));
    phrases.push(
      rang === "all"
        ? t("pages.seo.hero.countersAll", { nom: h.name, contres: noms })
        : t("pages.seo.hero.counters", { nom: h.name, contres: noms, rang: t(`measuredRanks.${rang}`) }),
    );
  }

  const build = buildPrincipal(h);
  if (build?.items.length) {
    const nomsObjets = new Map(objets(locale).map((o) => [o.slug, o.name]));
    const liste = build.items.map((o) => nomsObjets.get(visuelObjet(o).slug ?? "") ?? o).join(", ");
    const role = build.emblem ? t(`roles.${build.emblem}`) : null;
    phrases.push(
      build.emblem
        ? t("pages.seo.hero.buildEmblem", {
            objets: liste,
            embleme: role === `roles.${build.emblem}` ? build.emblem : role!,
          })
        : t("pages.seo.hero.build", { objets: liste }),
    );
  }

  const taux = tauxParSlug.get(h.slug);
  if (taux) phrases.push(t("pages.seo.hero.rate", { victoire: pourcentage(locale, taux.victoire), palier: taux.palier }));

  if (phrases.length > 0) return [...phrases, `${t("pages.freshness.updatedOn", { date: dateLongue(locale) })}.`].join(" ");

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

export default async function PageHeros({ params }: Params) {
  const { locale, slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) notFound();

  const classe = classementComplet.find((e) => e.hero.slug === slug);
  const t = creerT(locale);
  const analyse = h.analysis;
  const competencesWiki = competences(locale)[h.slug] ?? [];
  const iconesCompetences = visuelsCompetences[h.slug] ?? {};
  const illustrationsHeros = illustrations[h.slug] ?? {};
  // L'illustration du skin d'origine sert de fond : c'est celle qui represente
  // le heros tel qu'on le rencontre par defaut.
  const fond = Object.values(illustrationsHeros)[0] ?? null;
  const histoire = histoires(locale)[h.slug] ?? null;
  const aHistoire =
    !!histoire && (histoire.lore.length > 0 || !!histoire.profile || histoire.trivia.length > 0);

  // Jointure des trois sources : le skin porte son id, son portrait (par id) et
  // son illustration (par nom). La vitrine s'en sert pour tout synchroniser.
  // L'illustration se retrouve aussi par nom normalise : la legende du wiki
  // n'a pas toujours la casse du module (« Vessel Of Deceit »).
  const illustrationParNom = new Map(
    Object.entries(illustrationsHeros).map(([nom, chemin]) => [normaliserNomSkin(nom), chemin]),
  );
  const skinsComplets: SkinComplet[] = h.skins.map((s) => ({
    ...s,
    portrait: h.images.skins[s.id] ?? null,
    illustration:
      illustrationsHeros[s.name] ?? illustrationParNom.get(normaliserNomSkin(s.name)) ?? null,
  }));
  const portraitDe = (slug: string) =>
    herosParSlug.get(slug)?.images.icon ?? herosParSlug.get(slug)?.images.portrait ?? null;
  const nomDe = (slug: string) => herosParSlug.get(slug)?.name ?? slug;

  // Le selecteur de rang tourne dans le navigateur, qui n'a pas le catalogue :
  // noms et portraits des adversaires sont donc resolus ici, pour chaque rang.
  const resoudre = (liste: ContreChiffre[]) =>
    liste.map((e) => ({ ...e, nom: nomDe(e.slug), portrait: portraitDe(e.slug) }));
  const contresAffiches = Object.fromEntries(
    Object.entries(contres[h.slug] ?? {}).map(([rang, c]) => [
      rang,
      { strong: resoudre(c.strong), weak: resoudre(c.weak), winRate: c.winRate },
    ]),
  );
  const aContres = Object.keys(contresAffiches).length > 0;

  // Taux de l'en-tete, rang par rang : le rang choisi sur la fiche les fait
  // basculer en meme temps que les contres.
  const statsRangs = statsParRang(h.slug);
  const pourcent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const selonRang = (format: (s: StatsRang) => string) =>
    Object.fromEntries(Object.entries(statsRangs).map(([r, s]) => [r, format(s)]));
  const rangsDisponibles = RANGS_MESURE.filter((r) => statsRangs[r] || contresAffiches[r]);

  // Builds joues, resolus ici pour la meme raison : visuels et catalogue
  // restent cote serveur.
  const buildsAffiches = Object.fromEntries(
    Object.entries(buildsJoues[h.slug] ?? {}).map(([lane, parRang]) => [
      lane,
      Object.fromEntries(
        Object.entries(parRang).map(([rang, liste]) => [rang, (liste ?? []).map(resoudreBuild)]),
      ),
    ]),
  );
  const guidesAffiches = Object.fromEntries(
    Object.entries(guidesJoueurs[h.slug] ?? {}).map(([lane, parRang]) => [
      lane,
      Object.fromEntries(
        Object.entries(parRang).flatMap(([rang, g]) => (g ? [[rang, resoudreGuide(g)]] : [])),
      ),
    ]),
  );
  const aBuilds = Object.keys(buildsAffiches).length > 0 || Object.keys(guidesAffiches).length > 0;

  const coequipiersAffiches = Object.fromEntries(
    Object.entries(coequipiers[h.slug] ?? {}).map(([rang, liste]) => [
      rang,
      (liste ?? []).map((c) => ({ ...c, nom: nomDe(c.slug), portrait: portraitDe(c.slug) })),
    ]),
  );
  const aCoequipiers = Object.keys(coequipiersAffiches).length > 0;

  // Build le plus joue sur la position principale, tous rangs : la reference
  // a laquelle confronter les builds rediges, qui vieillissent d'un patch a
  // l'autre.
  const reference = buildPrincipal(h);
  const nomsObjets = new Map(objets(locale).map((o) => [o.slug, o.name]));
  const ecartDe = (b: { items: string[]; talent: string }) => {
    if (!reference) return null;
    const pris = new Set(b.items.map((o) => visuelObjet(o).slug ?? o));
    const absents = reference.items
      .filter((o) => !pris.has(visuelObjet(o).slug ?? o))
      .map((o) => nomsObjets.get(visuelObjet(o).slug ?? "") ?? o);
    const memeTalent = reference.talents.some((x) => x.toLowerCase() === b.talent.toLowerCase());
    return { absents, talents: memeTalent ? null : reference.talents.join(", ") };
  };

  // Patchs dates, pour les reperes des courbes, et ajustements du heros.
  const versionsRecentes = Object.values(patchsDetail).sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );
  const patchsDates = versionsRecentes.flatMap((p) => (p.date ? [{ version: p.version, date: p.date }] : []));
  const ajustementsHeros = versionsRecentes.flatMap((p) =>
    (patchsDetailles(locale)[p.version] ?? p).adjustments
      .filter((a) => a.slug === h.slug)
      .map((a) => ({ version: p.version, ajustement: a })),
  );

  const historique = historiqueDe(h.slug);
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: h.title ? `${h.name} — ${h.title}` : h.name,
    // La description de la page, dans sa langue : le resume redige n'existe
    // qu'en francais et s'affichait sous un `inLanguage` anglais.
    description: descriptionHeros(locale, h),
    image: h.images.portrait ? urlAbsolue(h.images.portrait) : undefined,
    inLanguage: LOCALE_HTML[locale],
    // Premiere mesure conservee pour ce heros : la fiche publie ses chiffres
    // depuis. La modification suit le dernier releve des taux.
    datePublished: historique?.start ?? dateMesure,
    dateModified: dateMesure,
    author: { "@type": "Person", name: site.auteur, url: `https://github.com/${site.auteur}` },
    publisher: {
      "@type": "Organization",
      name: site.nom,
      url: site.url,
      logo: { "@type": "ImageObject", url: urlAbsolue("/apple-icon.png") },
    },
    mainEntityOfPage: `${site.url}/${locale}/heroes/${slug}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.heroDetail"])}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />

      {/*
        Un seul etat de skin pour toute la fiche : l'en-tete et l'onglet skins
        le partagent, si bien que choisir un skin met a jour le portrait de tete
        comme la grande illustration.
      */}
      <VitrineProvider skins={skinsComplets} portraitDefaut={h.images.portrait}>
      <RangProvider rangs={rangsDisponibles}>
      {/* ── En-tete ────────────────────────────────────────────────────── */}
      <div className="relative border-b border-night-700/70 bg-night-900/30">
        {fond && (
          <div aria-hidden className="absolute inset-0 overflow-hidden">
            <Image
              src={fond}
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
          <FilAriane
            miettes={[
              { nom: t("nav.heroes.label"), href: "/heroes" },
              ...(h.roles[0] ? [{ nom: t(`roles.${h.roles[0]}`), href: cheminRole(h.roles[0]) }] : []),
              {
                nom: h.name,
                freres: [...heros]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((x) => ({ nom: x.name, href: `/heroes/${x.slug}` })),
              },
            ]}
          />

          <div className="bevel mt-6 flex flex-wrap items-start gap-6 border border-night-700/50 bg-night-950/75 p-5 backdrop-blur-sm">
            <PortraitVitrine nom={h.name} portraitDefaut={h.images.portrait} />

            <div className="min-w-0 flex-1 basis-64">
              <h1 className="font-heading text-4xl font-bold text-chalk-100">{h.name}</h1>
              {h.title && <p className="mt-1 text-lg text-gold-400">{h.title}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {h.roles.map((r) => (
                  <BadgeRole key={r} role={r} />
                ))}
                {h.specialties.map((s) => (
                  <span
                    key={s}
                    className="bevel-sm border border-night-600 px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-chalk-500"
                  >
                    {libelleHeros(t, "specialty", s)}
                  </span>
                ))}
              </div>

              <LigneFraicheur langue={locale} className="mt-4" />

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <BoutonFavori heros={h.slug} />
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
              ].map(([label, valeur]) =>
                valeur === null ? null : (
                  <div key={String(label)} className="flex items-center gap-3">
                    <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-chalk-500">
                      {label}
                    </dt>
                    <dd className="flex-1">
                      <Jauge valeur={Number(valeur)} />
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
              [t("pages.heroDetail.stat.release"), dateSortie(h.release, locale, t)],
              [t("pages.heroDetail.stat.resource"), libelleHeros(t, "resource", h.resource)],
              [t("pages.heroDetail.stat.damage"), libelleHeros(t, "damage", h.damageType)],
              [t("pages.heroDetail.stat.range"), libelleHeros(t, "attack", h.attackType)],
              [t("pages.heroDetail.stat.region"), libelleHeros(t, "region", h.region)],
              [t("pages.heroDetail.stat.skins"), h.skins.length || null],
              [t("pages.heroDetail.stat.tierList"), classe ? <ValeurParRang valeurs={selonRang((s) => t("pages.heroDetail.tier", { p: s.tier }))} /> : null],
              [t("pages.heroDetail.stat.winRate"), classe ? <ValeurParRang valeurs={selonRang((s) => `${pourcent.format(s.winRate)} %`)} /> : null],
              [t("pages.heroDetail.stat.banRate"), classe ? <ValeurParRang valeurs={selonRang((s) => `${pourcent.format(s.banRate)} %`)} /> : null],
            ].map(([label, valeur]) =>
              !valeur ? null : (
                <div key={String(label)}>
                  <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
                  <dd className="mt-1 text-chalk-100">{valeur}</dd>
                </div>
              ),
            )}
          </dl>
          {/* Rang de toute la fiche : taux, contres et builds le suivent. */}
          <SelecteurRang className="mt-5 border-t border-night-800 pt-4" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <Onglets
          onglets={[
            {
              id: "analyse",
              label: t("pages.heroDetail.tab.analysis"),
              contenu: analyse ? (
                <div className="space-y-12">
                  <section>
                    <div className="space-y-4 leading-relaxed text-chalk-300">
                      {analyse.analysis.split("\n\n").map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    <Carte className="border-emerald-500/25">
                      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-emerald-400">
                        <Swords size={18} aria-hidden />
                        {t("pages.heroDetail.strengths")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analyse.strengths.map((f) => (
                          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
                            <span aria-hidden className="mt-2 size-1 shrink-0 bg-emerald-400" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </Carte>
                    <Carte className="border-blood-500/25">
                      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-blood-500">
                        <TriangleAlert size={18} aria-hidden />
                        {t("pages.heroDetail.weaknesses")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analyse.weaknesses.map((f) => (
                          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
                            <span aria-hidden className="mt-2 size-1 shrink-0 bg-blood-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </Carte>
                  </section>

                </div>
              ) : (
                <Carte className="border-gold-500/30">
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
                </Carte>
              ),
            },
            {
              id: "histoire",
              label: t("pages.heroDetail.tab.story"),
              contenu: aHistoire ? <HistoireHeros histoire={histoire} nom={h.name} langue={locale} /> : null,
            },
            {
              id: "competences",
              label: t("pages.heroDetail.tab.skills"),
              compteur:
                Math.max(
                  competencesWiki.filter(Boolean).length,
                  analyse?.skills.length ?? 0,
                ) || undefined,
              contenu: (
                <div className="space-y-10">
                  <CompetencesHeros
                    wiki={competencesWiki}
                    icones={iconesCompetences}
                    redigees={analyse?.skills ?? null}
                  />
                  <CombosHeros combos={combos(locale)[h.slug] ?? []} langue={locale} />
                </div>
              ),
            },
            {
              id: "contres",
              label: t("pages.heroDetail.tab.counters"),
              contenu:
                aContres || aCoequipiers || analyse ? (
                  <div className="space-y-8">
                    {aContres && (
                      <section>
                        <ContresChiffres nom={h.name} parRang={contresAffiches} />
                        <Link
                          href={`/heroes/${h.slug}/counters`}
                          className="mt-4 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                        >
                          {t("pages.heroDetail.pageCounters")} →
                        </Link>
                      </section>
                    )}

                    {aCoequipiers && (
                      <section>
                        <CoequipiersParRang nom={h.name} parRang={coequipiersAffiches} />
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

                    {analyse && (analyse.strongAgainst.length > 0 || analyse.weakAgainst.length > 0) && (
                      <section>
                        <h3 className="font-heading text-lg font-bold text-chalk-100">
                          {t("pages.heroDetail.matchups")}
                        </h3>
                        <p className="mt-1 text-sm text-chalk-500">
                          {t("pages.heroDetail.matchupsIntro")}
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <ListeContres titre={t("pages.heroDetail.comfortable", { nom: h.name })} slugs={analyse.strongAgainst} ton="bon" />
                          <ListeContres titre={t("pages.heroDetail.difficulty2", { nom: h.name })} slugs={analyse.weakAgainst} ton="mauvais" />
                        </div>
                      </section>
                    )}
                  </div>
                ) : null,
            },
            {
              id: "builds",
              label: t("pages.heroDetail.tab.builds"),
              contenu: aBuilds || analyse ? (
                <div className="space-y-10">
                  {aBuilds && (
                    <section>
                      <BuildsParRang parLane={buildsAffiches} guides={guidesAffiches} />
                    </section>
                  )}
                  {analyse && analyse.builds.length > 0 && (
                  <section>
                  {aBuilds && (
                    <>
                      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("builds.written")}</h3>
                      <p className="mt-1 mb-5 text-sm text-chalk-500">{t("builds.writtenIntro")}</p>
                    </>
                  )}
                  <div className="space-y-4">
                  {analyse.builds.map((b) => (
                    <Carte key={b.name}>
                      <h3 className="font-heading text-lg font-bold text-gold-400">{b.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-chalk-500">{b.context}</p>
                      <ol className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {b.items.map((o, i) => (
                          <ObjetBuild key={o} nom={o} rang={i + 1} />
                        ))}
                      </ol>
                      <div className="mt-5 grid gap-3 border-t border-night-800 pt-4 sm:grid-cols-3">
                        <ChoixBuild libelle={t("builds.emblem")} nom={b.emblem} image={visuelEmbleme(b.emblem).image} href={visuelEmbleme(b.emblem).href} />
                        <ChoixBuild libelle={t("builds.talent")} nom={b.talent} image={visuelTalent(b.talent).image} />
                        <ChoixBuild libelle={t("builds.spell")} nom={b.spell} image={visuelSort(b.spell).image} href={visuelSort(b.spell).href} />
                      </div>
                      {(() => {
                        const ecart = ecartDe(b);
                        if (!ecart) return null;
                        return (
                          <p className="mt-4 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
                            <span className="font-semibold text-chalk-300">{t("builds.gapTitle")} · </span>
                            {ecart.absents.length === 0
                              ? t("builds.aligned")
                              : t("builds.gapItems", { objets: ecart.absents.join(", ") })}
                            {ecart.talents && <> {t("builds.gapTalent", { talent: ecart.talents })}</>}
                          </p>
                        );
                      })()}
                    </Carte>
                  ))}
                  </div>
                  </section>
                  )}
                </div>
              ) : null,
            },
            {
              id: "stats",
              differe: true,
              label: t("pages.heroDetail.tab.stats"),
              apercu: (
                <ApercuStatistiques
                  langue={locale}
                  h={h}
                  statsRangs={statsRangs}
                  ajustements={ajustementsHeros.length}
                  patchs={versionsRecentes.length}
                />
              ),
              contenu: (
                <div className="space-y-12">
                  <StatistiquesHeros
                    nom={h.name}
                    tendances={tendancesDe(h.slug)}
                    duree={dureeDe(h.slug)}
                    historique={historique}
                    patchs={patchsDates}
                    parRang={Object.fromEntries(
                      Object.entries(statsRangs).map(([r, s]) => [r, { victoire: s.winRate, ban: s.banRate }]),
                    )}
                    ajustements={ajustementsHeros.map((a) => ({ version: a.version, type: a.ajustement.type }))}
                  />
                  <section>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="font-heading text-lg font-bold text-chalk-100">
                        {t("pages.heroDetail.statistics.adjustments")}
                      </h3>
                      <LienFluxHeros langue={locale} slug={h.slug} />
                    </div>
                    <p className="mt-1 mb-4 text-sm text-chalk-500">
                      {ajustementsHeros.length > 0
                        ? t("pages.heroDetail.statistics.adjustmentsIntro", { nom: h.name })
                        : t("pages.heroDetail.statistics.noAdjustment", { nom: h.name, n: versionsRecentes.length })}
                    </p>
                    {ajustementsHeros.length > 0 && (
                      <AjustementsDuHeros entrees={ajustementsHeros} portrait={h.images.icon ?? h.images.portrait} />
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
              differe: true,
              label: t("pages.heroDetail.tab.skins"),
              compteur: skinsComplets.length || undefined,
              // Les noms des skins, en texte, en attendant la galerie.
              apercu:
                skinsComplets.length > 0 ? (
                  <div className="text-sm leading-relaxed text-chalk-300">
                    <p>{t("pages.heroPreview.skins", { nom: h.name, n: skinsComplets.length })}</p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-chalk-500">
                      {skinsComplets.map((s) => (
                        <li key={s.id}>{s.name}</li>
                      ))}
                    </ul>
                    {galerieHeros(h).total > 0 && (
                      <Link
                        href={`/heroes/${h.slug}/skins`}
                        className="mt-3 inline-block font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.heroSkins.sheetLink", { n: galerieHeros(h).total })} →
                      </Link>
                    )}
                  </div>
                ) : null,
              contenu:
                skinsComplets.length > 0 ? (
                  <div className="space-y-5">
                    {galerieHeros(h).total > 0 && (
                      <Link
                        href={`/heroes/${h.slug}/skins`}
                        className="inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.heroSkins.sheetLink", { n: galerieHeros(h).total })} →
                      </Link>
                    )}
                    <VitrineSkins skins={skinsComplets} />
                  </div>
                ) : null,
            },
          ]}
        />
      </div>
      </RangProvider>
      </VitrineProvider>
    </CompleterMessages>
  );
}

function ListeContres({
  titre,
  slugs,
  ton,
}: {
  titre: string;
  slugs: string[];
  ton: "bon" | "mauvais";
}) {
  return (
    <Carte>
      <h3 className="text-sm font-semibold text-chalk-100">{titre}</h3>
      <ul className="mt-4 flex flex-wrap gap-2">
        {slugs.map((s) => (
          <li key={s}>
            <Link
              href={`/heroes/${s}`}
              className={`bevel-sm border px-2.5 py-1 text-sm transition-colors ${
                ton === "bon"
                  ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  : "border-blood-500/30 text-blood-500 hover:bg-blood-500/10"
              }`}
            >
              {herosParSlug.get(s)?.name ?? s}
            </Link>
          </li>
        ))}
      </ul>
    </Carte>
  );
}

/**
 * Resume des statistiques en phrases, rendu par le serveur dans l'onglet
 * differe : evolution sur trente jours, duree de partie favorable, ecart entre
 * les rangs et ajustements recents. Les graphiques le remplacent a
 * l'ouverture ; d'ici la, moteurs et lecteurs en ont l'essentiel en texte.
 */
function ApercuStatistiques({
  langue,
  h,
  statsRangs,
  ajustements,
  patchs,
}: {
  langue: Langue;
  h: Heros;
  statsRangs: Partial<Record<RangMesure, StatsRang>>;
  ajustements: number;
  patchs: number;
}) {
  const t = creerT(langue);
  const pourcent = (v: number) => pourcentage(langue, v);
  const phrases: string[] = [];

  const mesures = (tendancesDe(h.slug).all?.winRate ?? []).flatMap((v, k) => (v === null ? [] : [[k, v] as const]));
  if (mesures.length > 1) {
    const [k0, debut] = mesures[0];
    const [k1, fin] = mesures[mesures.length - 1];
    phrases.push(
      t("pages.heroPreview.trend", {
        nom: h.name,
        n: k1 - k0 + 1,
        debut: pourcent(debut),
        fin: pourcent(fin),
        ecart: formaterEcart(fin - debut, langue),
        pts: t("counters.pts"),
      }),
    );
  }

  const tranches = [...(dureeDe(h.slug).all ?? [])].sort((a, b) => b.winRate - a.winRate);
  if (tranches.length > 1) {
    const libelle = (x: TrancheDuree) =>
      x.to === null
        ? t("pages.heroDetail.statistics.minutesPlus", { de: x.from })
        : t("pages.heroDetail.statistics.minutes", { de: x.from, a: x.to });
    const haute = tranches[0];
    const basse = tranches[tranches.length - 1];
    phrases.push(
      t("pages.heroPreview.duration", {
        nom: h.name,
        tranche: libelle(haute),
        victoire: pourcent(haute.winRate),
        trancheBas: libelle(basse),
        victoireBas: pourcent(basse.winRate),
      }),
    );
  }

  const rangs = RANGS_MESURE.filter((r) => r !== "all" && statsRangs[r]).sort(
    (a, b) => statsRangs[a]!.winRate - statsRangs[b]!.winRate,
  );
  if (rangs.length > 1) {
    const bas = rangs[0];
    const haut = rangs[rangs.length - 1];
    phrases.push(
      t("pages.heroPreview.ranks", {
        nom: h.name,
        bas: pourcent(statsRangs[bas]!.winRate),
        rangBas: t(`measuredRanks.${bas}`),
        haut: pourcent(statsRangs[haut]!.winRate),
        rangHaut: t(`measuredRanks.${haut}`),
      }),
    );
  }

  if (ajustements > 0) phrases.push(t("pages.heroPreview.adjustments", { nom: h.name, n: ajustements, total: patchs }));
  if (phrases.length === 0) return null;

  return (
    <div className="space-y-3 text-sm leading-relaxed text-chalk-300">
      {phrases.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

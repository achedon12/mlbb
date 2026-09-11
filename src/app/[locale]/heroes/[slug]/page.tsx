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
      ? tm("pages.seo.heros.titre", { nom: h.nom, palier, v })
      : tm("pages.seo.heros.titreSansPalier", { nom: h.nom, v }),
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
  const rang: RangMesure | null = parRang.mythic?.faible.length ? "mythic" : parRang.all?.faible.length ? "all" : null;
  if (rang) {
    const noms = listeNoms(locale, parRang[rang]!.faible.slice(0, 3).map((c) => herosParSlug.get(c.slug)?.nom ?? c.slug));
    phrases.push(
      rang === "all"
        ? t("pages.seo.heros.contresTous", { nom: h.nom, contres: noms })
        : t("pages.seo.heros.contres", { nom: h.nom, contres: noms, rang: t(`rangsMesure.${rang}`) }),
    );
  }

  const build = buildPrincipal(h);
  if (build?.objets.length) {
    const nomsObjets = new Map(objets(locale).map((o) => [o.slug, o.nom]));
    const liste = build.objets.map((o) => nomsObjets.get(visuelObjet(o).slug ?? "") ?? o).join(", ");
    const role = build.embleme ? t(`roles.${build.embleme}`) : null;
    phrases.push(
      build.embleme
        ? t("pages.seo.heros.buildEmbleme", {
            objets: liste,
            embleme: role === `roles.${build.embleme}` ? build.embleme : role!,
          })
        : t("pages.seo.heros.build", { objets: liste }),
    );
  }

  const taux = tauxParSlug.get(h.slug);
  if (taux) phrases.push(t("pages.seo.heros.taux", { victoire: pourcentage(locale, taux.victoire), palier: taux.palier }));

  if (phrases.length > 0) return [...phrases, `${t("pages.fraicheur.majLe", { date: dateLongue(locale) })}.`].join(" ");

  // Le resume redige n'existe qu'en francais : les autres langues prennent la
  // description generee, dans leur langue.
  return (
    (locale === "fr" ? h.analyse?.resume : undefined) ??
    t("pages.heroDetail.metaDescription", {
      nom: h.titre ? `${h.nom}, ${h.titre}` : h.nom,
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

  const classe = classementComplet.find((e) => e.heros.slug === slug);
  const t = creerT(locale);
  const analyse = h.analyse;
  const competencesWiki = competences(locale)[h.slug] ?? [];
  const iconesCompetences = visuelsCompetences[h.slug] ?? {};
  const illustrationsHeros = illustrations[h.slug] ?? {};
  // L'illustration du skin d'origine sert de fond : c'est celle qui represente
  // le heros tel qu'on le rencontre par defaut.
  const fond = Object.values(illustrationsHeros)[0] ?? null;
  const histoire = histoires(locale)[h.slug] ?? null;
  const aHistoire =
    !!histoire && (histoire.lore.length > 0 || !!histoire.fiche || histoire.anecdotes.length > 0);

  // Jointure des trois sources : le skin porte son id, son portrait (par id) et
  // son illustration (par nom). La vitrine s'en sert pour tout synchroniser.
  // L'illustration se retrouve aussi par nom normalise : la legende du wiki
  // n'a pas toujours la casse du module (« Vessel Of Deceit »).
  const illustrationParNom = new Map(
    Object.entries(illustrationsHeros).map(([nom, chemin]) => [normaliserNomSkin(nom), chemin]),
  );
  const skinsComplets: SkinComplet[] = h.skins.map((s) => ({
    ...s,
    portrait: h.visuels.skins[s.id] ?? null,
    illustration:
      illustrationsHeros[s.nom] ?? illustrationParNom.get(normaliserNomSkin(s.nom)) ?? null,
  }));
  const portraitDe = (slug: string) =>
    herosParSlug.get(slug)?.visuels.icone ?? herosParSlug.get(slug)?.visuels.portrait ?? null;
  const nomDe = (slug: string) => herosParSlug.get(slug)?.nom ?? slug;

  // Le selecteur de rang tourne dans le navigateur, qui n'a pas le catalogue :
  // noms et portraits des adversaires sont donc resolus ici, pour chaque rang.
  const resoudre = (liste: ContreChiffre[]) =>
    liste.map((e) => ({ ...e, nom: nomDe(e.slug), portrait: portraitDe(e.slug) }));
  const contresAffiches = Object.fromEntries(
    Object.entries(contres[h.slug] ?? {}).map(([rang, c]) => [
      rang,
      { fort: resoudre(c.fort), faible: resoudre(c.faible), mesure: c.mesure },
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
  const nomsObjets = new Map(objets(locale).map((o) => [o.slug, o.nom]));
  const ecartDe = (b: { objets: string[]; talent: string }) => {
    if (!reference) return null;
    const pris = new Set(b.objets.map((o) => visuelObjet(o).slug ?? o));
    const absents = reference.objets
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
    (patchsDetailles(locale)[p.version] ?? p).ajustements
      .filter((a) => a.slug === h.slug)
      .map((a) => ({ version: p.version, ajustement: a })),
  );

  const historique = historiqueDe(h.slug);
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: h.titre ? `${h.nom} — ${h.titre}` : h.nom,
    // La description de la page, dans sa langue : le resume redige n'existe
    // qu'en francais et s'affichait sous un `inLanguage` anglais.
    description: descriptionHeros(locale, h),
    image: h.visuels.portrait ? urlAbsolue(h.visuels.portrait) : undefined,
    inLanguage: LOCALE_HTML[locale],
    // Premiere mesure conservee pour ce heros : la fiche publie ses chiffres
    // depuis. La modification suit le dernier releve des taux.
    datePublished: historique?.debut ?? dateMesure,
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
      <VitrineProvider skins={skinsComplets} portraitDefaut={h.visuels.portrait}>
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
                nom: h.nom,
                freres: [...heros]
                  .sort((a, b) => a.nom.localeCompare(b.nom))
                  .map((x) => ({ nom: x.nom, href: `/heroes/${x.slug}` })),
              },
            ]}
          />

          <div className="bevel mt-6 flex flex-wrap items-start gap-6 border border-night-700/50 bg-night-950/75 p-5 backdrop-blur-sm">
            <PortraitVitrine nom={h.nom} portraitDefaut={h.visuels.portrait} />

            <div className="min-w-0 flex-1 basis-64">
              <h1 className="font-heading text-4xl font-bold text-chalk-100">{h.nom}</h1>
              {h.titre && <p className="mt-1 text-lg text-gold-400">{h.titre}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {h.roles.map((r) => (
                  <BadgeRole key={r} role={r} />
                ))}
                {h.specialites.map((s) => (
                  <span
                    key={s}
                    className="bevel-sm border border-night-600 px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-chalk-500"
                  >
                    {libelleHeros(t, "specialite", s)}
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
                  {t("pages.heroDetail.comparer")}
                </Link>
              </div>
            </div>

            {/* Notes du jeu, en jauges plutot qu'en chiffres nus. */}
            <dl className="grid min-w-0 flex-1 basis-56 gap-2.5">
              {[
                [t("pages.heroDetail.notes.offensive"), h.notes.offensive],
                [t("pages.heroDetail.notes.resistance"), h.notes.resistance],
                [t("pages.heroDetail.notes.effets"), h.notes.effets],
                [t("pages.heroDetail.notes.difficulte"), h.notes.difficulte],
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
              [t("pages.heroDetail.stat.sortie"), dateSortie(h.sortie, locale, t)],
              [t("pages.heroDetail.stat.ressource"), libelleHeros(t, "ressource", h.ressource)],
              [t("pages.heroDetail.stat.degats"), libelleHeros(t, "degats", h.typeDegats)],
              [t("pages.heroDetail.stat.portee"), libelleHeros(t, "attaque", h.typeAttaque)],
              [t("pages.heroDetail.stat.region"), libelleHeros(t, "region", h.region)],
              [t("pages.heroDetail.stat.skins"), h.skins.length || null],
              [t("pages.heroDetail.stat.tierList"), classe ? <ValeurParRang valeurs={selonRang((s) => t("pages.heroDetail.palier", { p: s.palier }))} /> : null],
              [t("pages.heroDetail.stat.tauxVictoire"), classe ? <ValeurParRang valeurs={selonRang((s) => `${pourcent.format(s.victoire)} %`)} /> : null],
              [t("pages.heroDetail.stat.tauxBan"), classe ? <ValeurParRang valeurs={selonRang((s) => `${pourcent.format(s.ban)} %`)} /> : null],
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
              label: t("pages.heroDetail.onglet.analyse"),
              contenu: analyse ? (
                <div className="space-y-12">
                  <section>
                    <div className="space-y-4 leading-relaxed text-chalk-300">
                      {analyse.analyse.split("\n\n").map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    <Carte className="border-emerald-500/25">
                      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-emerald-400">
                        <Swords size={18} aria-hidden />
                        {t("pages.heroDetail.forces")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analyse.forces.map((f) => (
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
                        {t("pages.heroDetail.faiblesses")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analyse.faiblesses.map((f) => (
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
                    {t("pages.heroDetail.analyseEnCours")}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-chalk-300">
                    {t("pages.heroDetail.analyseTexte", { nom: h.nom })}
                  </p>
                  <Link
                    href="/contribute"
                    className="mt-5 inline-block text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500"
                  >
                    {t("pages.heroDetail.contribuer")}
                  </Link>
                </Carte>
              ),
            },
            {
              id: "histoire",
              label: t("pages.heroDetail.onglet.histoire"),
              contenu: aHistoire ? <HistoireHeros histoire={histoire} nom={h.nom} langue={locale} /> : null,
            },
            {
              id: "competences",
              label: t("pages.heroDetail.onglet.competences"),
              compteur:
                Math.max(
                  competencesWiki.filter(Boolean).length,
                  analyse?.competences.length ?? 0,
                ) || undefined,
              contenu: (
                <div className="space-y-10">
                  <CompetencesHeros
                    wiki={competencesWiki}
                    icones={iconesCompetences}
                    redigees={analyse?.competences ?? null}
                  />
                  <CombosHeros combos={combos(locale)[h.slug] ?? []} langue={locale} />
                </div>
              ),
            },
            {
              id: "contres",
              label: t("pages.heroDetail.onglet.contres"),
              contenu:
                aContres || aCoequipiers || analyse ? (
                  <div className="space-y-8">
                    {aContres && (
                      <section>
                        <ContresChiffres nom={h.nom} parRang={contresAffiches} />
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
                        <CoequipiersParRang nom={h.nom} parRang={coequipiersAffiches} />
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

                    {analyse && (analyse.fortContre.length > 0 || analyse.faibleContre.length > 0) && (
                      <section>
                        <h3 className="font-heading text-lg font-bold text-chalk-100">
                          {t("pages.heroDetail.matchups")}
                        </h3>
                        <p className="mt-1 text-sm text-chalk-500">
                          {t("pages.heroDetail.matchupsIntro")}
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <ListeContres titre={t("pages.heroDetail.alaise", { nom: h.nom })} slugs={analyse.fortContre} ton="bon" />
                          <ListeContres titre={t("pages.heroDetail.difficulte2", { nom: h.nom })} slugs={analyse.faibleContre} ton="mauvais" />
                        </div>
                      </section>
                    )}
                  </div>
                ) : null,
            },
            {
              id: "builds",
              label: t("pages.heroDetail.onglet.builds"),
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
                      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("builds.rediges")}</h3>
                      <p className="mt-1 mb-5 text-sm text-chalk-500">{t("builds.redigesIntro")}</p>
                    </>
                  )}
                  <div className="space-y-4">
                  {analyse.builds.map((b) => (
                    <Carte key={b.nom}>
                      <h3 className="font-heading text-lg font-bold text-gold-400">{b.nom}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-chalk-500">{b.contexte}</p>
                      <ol className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {b.objets.map((o, i) => (
                          <ObjetBuild key={o} nom={o} rang={i + 1} />
                        ))}
                      </ol>
                      <div className="mt-5 grid gap-3 border-t border-night-800 pt-4 sm:grid-cols-3">
                        <ChoixBuild libelle={t("builds.embleme")} nom={b.embleme} image={visuelEmbleme(b.embleme).image} href={visuelEmbleme(b.embleme).href} />
                        <ChoixBuild libelle={t("builds.talent")} nom={b.talent} image={visuelTalent(b.talent).image} />
                        <ChoixBuild libelle={t("builds.sort")} nom={b.sort} image={visuelSort(b.sort).image} href={visuelSort(b.sort).href} />
                      </div>
                      {(() => {
                        const ecart = ecartDe(b);
                        if (!ecart) return null;
                        return (
                          <p className="mt-4 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
                            <span className="font-semibold text-chalk-300">{t("builds.ecartTitre")} · </span>
                            {ecart.absents.length === 0
                              ? t("builds.aligne")
                              : t("builds.ecartObjets", { objets: ecart.absents.join(", ") })}
                            {ecart.talents && <> {t("builds.ecartTalent", { talent: ecart.talents })}</>}
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
              label: t("pages.heroDetail.onglet.stats"),
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
                    nom={h.nom}
                    tendances={tendancesDe(h.slug)}
                    duree={dureeDe(h.slug)}
                    historique={historique}
                    patchs={patchsDates}
                    parRang={Object.fromEntries(
                      Object.entries(statsRangs).map(([r, s]) => [r, { victoire: s.victoire, ban: s.ban }]),
                    )}
                    ajustements={ajustementsHeros.map((a) => ({ version: a.version, type: a.ajustement.type }))}
                  />
                  <section>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="font-heading text-lg font-bold text-chalk-100">
                        {t("pages.heroDetail.statistiques.ajustements")}
                      </h3>
                      <LienFluxHeros langue={locale} slug={h.slug} />
                    </div>
                    <p className="mt-1 mb-4 text-sm text-chalk-500">
                      {ajustementsHeros.length > 0
                        ? t("pages.heroDetail.statistiques.ajustementsIntro", { nom: h.nom })
                        : t("pages.heroDetail.statistiques.aucunAjustement", { nom: h.nom, n: versionsRecentes.length })}
                    </p>
                    {ajustementsHeros.length > 0 && (
                      <AjustementsDuHeros entrees={ajustementsHeros} portrait={h.visuels.icone ?? h.visuels.portrait} />
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
              label: t("pages.heroDetail.onglet.skins"),
              compteur: skinsComplets.length || undefined,
              // Les noms des skins, en texte, en attendant la galerie.
              apercu:
                skinsComplets.length > 0 ? (
                  <div className="text-sm leading-relaxed text-chalk-300">
                    <p>{t("pages.apercuHeros.skins", { nom: h.nom, n: skinsComplets.length })}</p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-chalk-500">
                      {skinsComplets.map((s) => (
                        <li key={s.id}>{s.nom}</li>
                      ))}
                    </ul>
                    {galerieHeros(h).total > 0 && (
                      <Link
                        href={`/heroes/${h.slug}/skins`}
                        className="mt-3 inline-block font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.heroSkins.lienFiche", { n: galerieHeros(h).total })} →
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
                        {t("pages.heroSkins.lienFiche", { n: galerieHeros(h).total })} →
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
              {herosParSlug.get(s)?.nom ?? s}
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

  const mesures = (tendancesDe(h.slug).all?.victoire ?? []).flatMap((v, k) => (v === null ? [] : [[k, v] as const]));
  if (mesures.length > 1) {
    const [k0, debut] = mesures[0];
    const [k1, fin] = mesures[mesures.length - 1];
    phrases.push(
      t("pages.apercuHeros.evolution", {
        nom: h.nom,
        n: k1 - k0 + 1,
        debut: pourcent(debut),
        fin: pourcent(fin),
        ecart: formaterEcart(fin - debut, langue),
        pts: t("contres.pts"),
      }),
    );
  }

  const tranches = [...(dureeDe(h.slug).all ?? [])].sort((a, b) => b.victoire - a.victoire);
  if (tranches.length > 1) {
    const libelle = (x: TrancheDuree) =>
      x.a === null
        ? t("pages.heroDetail.statistiques.minutesPlus", { de: x.de })
        : t("pages.heroDetail.statistiques.minutes", { de: x.de, a: x.a });
    const haute = tranches[0];
    const basse = tranches[tranches.length - 1];
    phrases.push(
      t("pages.apercuHeros.duree", {
        nom: h.nom,
        tranche: libelle(haute),
        victoire: pourcent(haute.victoire),
        trancheBas: libelle(basse),
        victoireBas: pourcent(basse.victoire),
      }),
    );
  }

  const rangs = RANGS_MESURE.filter((r) => r !== "all" && statsRangs[r]).sort(
    (a, b) => statsRangs[a]!.victoire - statsRangs[b]!.victoire,
  );
  if (rangs.length > 1) {
    const bas = rangs[0];
    const haut = rangs[rangs.length - 1];
    phrases.push(
      t("pages.apercuHeros.rangs", {
        nom: h.nom,
        bas: pourcent(statsRangs[bas]!.victoire),
        rangBas: t(`rangsMesure.${bas}`),
        haut: pourcent(statsRangs[haut]!.victoire),
        rangHaut: t(`rangsMesure.${haut}`),
      }),
    );
  }

  if (ajustements > 0) phrases.push(t("pages.apercuHeros.ajustements", { nom: h.nom, n: ajustements, total: patchs }));
  if (phrases.length === 0) return null;

  return (
    <div className="space-y-3 text-sm leading-relaxed text-chalk-300">
      {phrases.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

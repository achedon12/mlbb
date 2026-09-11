import type { Metadata } from "next";
import { cheminPaire } from "@/lib/paires";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronDown, TrendingDown, TrendingUp, Users } from "lucide-react";
import Link from "@/components/lien";
import { LigneFraicheur } from "@/components/fraicheur";
import { OuvrirAncre } from "@/components/ouvrir-ancre";
import { PortraitHeros } from "@/components/portrait-heros";
import { Carte, EnTetePage } from "@/components/ui";
import statistiques from "@/data/jeu/statistiques.json";
import visuels from "@/data/jeu/visuels.json";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { libelleHeros } from "@/i18n/donnees-heros";
import { metaPage } from "@/i18n/seo";
import { creerT, type T } from "@/i18n/traductions";
import {
  agregerContres,
  contresParLane,
  deNom,
  formaterEcart,
  momentsPartie,
  objetsContre,
  phraseSynthese,
  porteVolDeVie,
  rangDeSynthese,
  type ContreAgrege,
  type RaisonObjet,
} from "@/lib/contrer";
import { buildsJoues, coequipiers, contres, heros, herosParSlug, objets, type ContreChiffre } from "@/lib/donnees";
import { dureeDe, type TrancheDuree } from "@/lib/evolution";
import { dateLongue, dateMesure, patchActuel, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { RANGS_MESURE } from "@/lib/rangs-mesure";
import { site } from "@/lib/site";
import { classementComplet, RANGS_CLASSES, statsParRang } from "@/lib/tier-list";
import type { Heros } from "@/lib/types";
import { cn } from "@/lib/utils";
import { visuelObjet } from "@/lib/visuels-build";

/**
 * Page « counters » d'un heros : qui prendre contre lui, rang par rang.
 *
 * La requete « {heros} counter » est la plus demandee apres le build, et
 * aucune page ne lui repondait : les contres vivaient dans un onglet de la
 * fiche. Tout est rendu cote serveur — chaque rang dans son `<details>`,
 * ouvert ou non —, si bien que la page porte toutes les mesures sans script.
 */

type Params = { params: Promise<{ locale: Langue; slug: string }> };

interface Relation {
  fortContre: string[];
  faibleContre: string[];
  synergies: string[];
}
const relations = statistiques.relations as unknown as Record<string, Relation>;
const iconesObjets = (visuels as unknown as { objets: Record<string, string> }).objets;

/** Une page par heros ; un slug inconnu tombe sur la 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return heros.map((h) => ({ slug: h.slug }));
}

const nomDe = (slug: string) => herosParSlug.get(slug)?.nom ?? slug;
const portraitDe = (slug: string) => {
  const x = herosParSlug.get(slug);
  return x?.visuels.icone ?? x?.visuels.portrait ?? null;
};
/** Ecarte un adversaire que le catalogue ne connait pas (synchro partielle). */
const connus = <E extends { slug: string }>(liste: E[] = []) => liste.filter((e) => herosParSlug.has(e.slug));
const noms = (nom: string) => ({ nom, deNom: deNom(nom) });

/** Phrase de synthese, commune a la description et au chapeau de la page. */
function synthese(locale: Langue, h: Heros) {
  const t = creerT(locale);
  const parRang = contres[h.slug] ?? {};
  const rang = rangDeSynthese(parRang);
  const mesure = rang ? parRang[rang] : undefined;
  const avecNoms = (liste: ContreChiffre[]) => connus(liste).map((e) => ({ ...e, nom: nomDe(e.slug) }));
  const phrase =
    rang && mesure
      ? phraseSynthese(locale, t, { nom: h.nom, rang, faible: avecNoms(mesure.faible), fort: avecNoms(mesure.fort) })
      : t("pages.heroCounters.aucuneMesure", { nom: h.nom });
  return { rang, phrase };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) return {};
  const t = creerT(locale);
  const { rang, phrase } = synthese(locale, h);
  // Patch dans le titre : les resultats qui menent sur « counter » portent
  // tous une date ou une version, et celle-ci suit les synchros. Un nom long
  // (« Yi Sun-shin ») pousserait le patch au-dela de la coupe des resultats :
  // le titre court le garde visible.
  const variables = { ...noms(h.nom), v: patchActuel?.version ?? "" };
  const complet = t(patchActuel ? "pages.heroCounters.metaTitre" : "pages.heroCounters.metaTitreSansPatch", variables);
  const titre = patchActuel && complet.length > TITRE_LONG ? t("pages.heroCounters.metaTitreCourt", variables) : complet;
  return {
    ...metaPage(locale, {
      titre,
      description: `${phrase} ${t("pages.heroCounters.majLe", { date: dateLongue(locale) })}`,
      chemin: `/heroes/${slug}/counters`,
      type: "article",
      image: `/${locale}/heroes/${slug}/opengraph-image`,
    }),
    // Sans aucune mesure (heros tout juste sorti), la page n'a rien a dire :
    // elle reste accessible mais hors de l'index, comme une page mince.
    ...(rang ? {} : { robots: { index: false, follow: true } }),
  };
}

/** Au-dela, le titre complet est coupe dans les resultats avant le numero de patch. */
const TITRE_LONG = 62;

export default async function PageContres({ params }: Params) {
  const { locale, slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) notFound();

  const t = creerT(locale);
  const n = noms(h.nom);
  const ecart = (v: number) => formaterEcart(locale, t, v);
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const parRang = contres[slug] ?? {};
  const { rang: rangPrincipal, phrase } = synthese(locale, h);
  const stats = statsParRang(slug);
  const rangs = RANGS_MESURE.filter((r) => parRang[r] || coequipiers[slug]?.[r]?.length);
  // Tranches lues pour l'agregat : `all` ne compte qu'a defaut de tranche.
  const tranchesMesurees = RANGS_MESURE.filter((r) => r !== "all" && parRang[r]).length || (parRang.all ? 1 : 0);
  const contresAgreges = connus(agregerContres(parRang, "faible"));
  const victimes = connus(agregerContres(parRang, "fort")).slice(0, 8);
  const meilleurs = contresAgreges.slice(0, 8);
  const premier = meilleurs[0]?.slug;

  // Objets par regle : fiche du heros, et vol de vie lu sur son build le plus
  // joue (bonus du catalogue anglais, ou « Lifesteal » s'ecrit toujours pareil).
  const catalogue = new Map(objets(locale).map((o) => [o.slug, o]));
  const bonusAnglais = new Map(objets("en").map((o) => [o.slug, o.bonus]));
  const parLane = buildsJoues[slug] ?? {};
  const laneReference = h.lanes.find((l) => parLane[l]) ?? Object.keys(parLane)[0];
  const buildReference = laneReference ? parLane[laneReference]?.all?.[0] : undefined;
  const bonusJoues = (buildReference?.objets ?? []).map((o) => bonusAnglais.get(visuelObjet(o).slug ?? "") ?? null);
  const conseils = objetsContre(
    { typeDegats: h.typeDegats, roles: h.roles, specialites: h.specialites, volDeVie: porteVolDeVie(bonusJoues) },
    (s) => catalogue.has(s),
  );
  const groupesObjets = [...new Set(conseils.map((c) => c.raison))].map((raison) => ({
    raison,
    objets: conseils.filter((c) => c.raison === raison).map((c) => catalogue.get(c.slug)!),
  }));

  // Duree de partie, au rang de la synthese quand il est mesure.
  const durees = dureeDe(slug);
  const rangDuree = rangPrincipal && durees[rangPrincipal] ? rangPrincipal : durees.all ? "all" : null;
  const tranches = rangDuree ? durees[rangDuree] : undefined;
  const moments = momentsPartie(tranches);
  const nomTranche = (x: TrancheDuree) =>
    x.a === null
      ? t("pages.heroDetail.statistiques.minutesPlus", { de: x.de })
      : t("pages.heroDetail.statistiques.minutes", { de: x.de, a: x.a });

  const lanesContres = contresParLane(contresAgreges, (s) => herosParSlug.get(s)?.lanes ?? [], h.lanes);
  const relation = relations[slug];
  const wiki = relation
    ? ([
        [t("pages.heroDetail.alaise", n), relation.fortContre, "bon"],
        [t("pages.heroDetail.difficulte2", n), relation.faibleContre, "mauvais"],
        [t("pages.heroCounters.wiki.synergies", n), relation.synergies, "bon"],
      ] as const).map(([titre, slugs, ton]) => ({ titre, ton, slugs: slugs.filter((s) => herosParSlug.has(s)) }))
    : [];
  const aWiki = wiki.some((w) => w.slugs.length > 0);

  // Pages counters des heros de la meme position, les mieux classes d'abord.
  const lanePrincipale = h.lanes[0];
  const voisins = lanePrincipale
    ? classementComplet
        .filter((e) => e.heros.slug !== slug && e.heros.lanes.includes(lanePrincipale))
        .slice(0, 12)
        .map((e) => e.heros)
    : [];

  const rangTierList = rangPrincipal && rangPrincipal !== "all" && RANGS_CLASSES.includes(rangPrincipal) ? rangPrincipal : null;
  const liens = [
    { href: `/heroes/${slug}#contres`, label: t("pages.heroCounters.lienFiche", n) },
    { href: `/heroes/${slug}#builds`, label: t("pages.heroCounters.lienBuilds", n) },
    ...(premier
      ? [{ href: cheminPaire(slug, premier), label: t("pages.heroCounters.lienComparer", { nom: h.nom, autre: nomDe(premier) }) }]
      : []),
    rangTierList
      ? { href: `/tier-list/${rangTierList}`, label: t("pages.tierList.titreRang", { rang: t(`rangsMesure.${rangTierList}`) }) }
      : { href: "/tier-list", label: t("nav.tierList.label") },
  ];

  const titre = t("pages.heroCounters.titre", n);
  const adresse = `${site.url}/${locale}/heroes/${slug}/counters`;
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${adresse}#article`,
        headline: titre,
        description: phrase,
        inLanguage: LOCALE_HTML[locale],
        dateModified: dateMesure,
        image: `${site.url}/${locale}/heroes/${slug}/opengraph-image`,
        author: { "@type": "Person", name: site.auteur },
        publisher: { "@type": "Organization", name: site.nom, url: site.url },
        mainEntityOfPage: adresse,
        about: {
          "@type": "VideoGame",
          name: "Mobile Legends: Bang Bang",
          publisher: { "@type": "Organization", name: "Moonton" },
        },
        ...(meilleurs.length > 0 ? { mainEntity: { "@id": `${adresse}#contres` } } : {}),
      },
      ...(meilleurs.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${adresse}#contres`,
              name: t("pages.heroCounters.meilleursContres", n),
              itemListOrder: "https://schema.org/ItemListOrderDescending",
              numberOfItems: meilleurs.length,
              itemListElement: meilleurs.map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: nomDe(c.slug),
                url: `${site.url}/${locale}/heroes/${c.slug}`,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />

      <EnTetePage
        titre={titre}
        chapeau={phrase}
        miettes={[
          { nom: t("nav.heroes.label"), href: "/heroes" },
          { nom: h.nom, href: `/heroes/${slug}` },
          // Pas de `freres` ici : 133 liens de plus dans la charge RSC de chaque
          // page, quand la section « autres pages » mene deja aux voisins.
          { nom: t("pages.heroDetail.onglet.contres") },
        ]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {liens.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="bevel-sm inline-block border border-night-700 px-3 py-1.5 font-medium text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        {/* ── Synthese, rangs confondus ───────────────────────────────── */}
        {(meilleurs.length > 0 || victimes.length > 0) && (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* min-w-0 : sans lui, la piste de grille s'elargit a la largeur du tableau et deborde a 390 px. */}
            {meilleurs.length > 0 && (
              <section aria-labelledby="meilleurs" className="min-w-0">
                <h2 id="meilleurs" className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.heroCounters.meilleursContres", n)}
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-chalk-500">
                  {t("pages.heroCounters.meilleursContresIntro", n)}
                </p>
                <TableauAgrege t={t} lignes={meilleurs} ton="mauvais" total={tranchesMesurees} slug={slug} ecart={ecart} />
              </section>
            )}
            {victimes.length > 0 && (
              <section aria-labelledby="victimes" className="min-w-0">
                <h2 id="victimes" className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.heroCounters.victimes", n)}
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-chalk-500">{t("pages.heroCounters.victimesIntro", n)}</p>
                <TableauAgrege t={t} lignes={victimes} ton="bon" total={tranchesMesurees} slug={slug} ecart={ecart} />
              </section>
            )}
          </div>
        )}

        {/* Deplie le rang vise par une ancre (« #rang-mythic ») : Chromium ne le fait pas seul. */}
        <OuvrirAncre />

        {/* ── Rang par rang ───────────────────────────────────────────── */}
        {rangs.length > 0 && (
          <section aria-labelledby="par-rang">
            <h2 id="par-rang" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.heroCounters.parRang")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">
              {t("pages.heroDetail.contresIntro", n)} {t("pages.heroCounters.parRangIntro", n)}
            </p>
            <nav aria-label={t("pages.heroCounters.rangsNav")} className="mt-4">
              <ul className="flex flex-wrap gap-2 text-sm">
                {rangs.map((r) => (
                  <li key={r}>
                    <a
                      href={`#rang-${r}`}
                      className="bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 hover:border-gold-500/60 hover:text-gold-400"
                    >
                      {t(`rangsMesure.${r}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-5 space-y-3">
              {rangs.map((r) => {
                const mesure = parRang[r];
                const s = stats[r];
                return (
                  <details
                    key={r}
                    id={`rang-${r}`}
                    open={r === rangPrincipal}
                    className="bevel group scroll-mt-24 border border-night-700/70 bg-night-900/60"
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className="shrink-0 text-chalk-500 transition-transform group-open:rotate-180"
                      />
                      <h3 className="font-heading text-lg font-bold text-chalk-100">{t(`rangsMesure.${r}`)}</h3>
                      {s && (
                        <span className="text-sm text-chalk-500">
                          {t("pages.heroDetail.palier", { p: s.palier })} ·{" "}
                          {t("builds.victoire", { taux: decimal.format(s.victoire) })}
                        </span>
                      )}
                    </summary>
                    <div className="border-t border-night-800 p-4">
                      {mesure?.mesure != null && (
                        <p className="mb-4 text-sm text-chalk-500">
                          {t("pages.heroDetail.contresRef", { taux: decimal.format(mesure.mesure) })}
                        </p>
                      )}
                      <div className={cn("grid gap-6 md:grid-cols-3", STYLE_TABLEAUX_RANG)}>
                        <TableauRang
                          t={t}
                          titre={t("contres.difficulte")}
                          icone={<TrendingDown size={16} aria-hidden />}
                          ton="mauvais"
                          lignes={connus(mesure?.faible)}
                          ecart={ecart}
                        />
                        <TableauRang
                          t={t}
                          titre={t("contres.fort")}
                          icone={<TrendingUp size={16} aria-hidden />}
                          ton="bon"
                          lignes={connus(mesure?.fort)}
                          ecart={ecart}
                        />
                        <TableauRang
                          t={t}
                          titre={t("pages.heroDetail.coequipiers")}
                          icone={<Users size={16} aria-hidden />}
                          ton="bon"
                          lignes={connus(coequipiers[slug]?.[r])}
                          ecart={ecart}
                          pageContres={false}
                        />
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Comment le contrer ──────────────────────────────────────── */}
        <section aria-labelledby="contrer">
          <h2 id="contrer" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.heroCounters.commentContrer", n)}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">
            {t("pages.heroCounters.commentContrerIntro", n)}
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <Carte>
              <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroCounters.objets.titre", n)}</h3>
              <p className="bevel-sm mt-2 inline-block border border-gold-500/40 px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-gold-400">
                {t("pages.heroCounters.objets.regle")}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-chalk-500">
                {t("pages.heroCounters.objets.intro", {
                  ...n,
                  degats: libelleHeros(t, "degats", h.typeDegats)?.toLocaleLowerCase(locale) ?? "—",
                })}
              </p>
              {groupesObjets.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {groupesObjets.map((g) => (
                    <div key={g.raison}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-chalk-400">
                        {t(`pages.heroCounters.objets.raison.${g.raison satisfies RaisonObjet}`)}
                      </h4>
                      <ul className="mt-2 space-y-2">
                        {g.objets.map((o) => (
                          <li key={o.slug}>
                            <Link href={`/items#${o.slug}`} className="group/objet flex items-center gap-2.5">
                              {iconesObjets[o.slug] ? (
                                <Image
                                  src={iconesObjets[o.slug]}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="bevel-sm size-8 shrink-0 bg-night-800"
                                />
                              ) : (
                                <span aria-hidden className="bevel-sm size-8 shrink-0 bg-night-800" />
                              )}
                              <span className="min-w-0">
                                <span className="block text-sm text-chalk-100 group-hover/objet:text-gold-400">{o.nom}</span>
                                {o.resume && <span className="block text-xs text-chalk-500">{o.resume}</span>}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-chalk-400">{t("pages.heroCounters.objets.aucun", n)}</p>
              )}
            </Carte>

            <Carte>
              <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroCounters.duree.titre", n)}</h3>
              {moments && tranches && rangDuree ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-chalk-300">
                    {t("pages.heroCounters.duree.phrase", {
                      nom: h.nom,
                      faible: nomTranche(moments.faible),
                      tauxFaible: pourcentage(locale, moments.faible.victoire),
                      fort: nomTranche(moments.fort),
                      tauxFort: pourcentage(locale, moments.fort.victoire),
                    })}
                  </p>
                  <p className="mt-1 text-xs text-chalk-500">
                    {t(`pages.heroDetail.statistiques.profil.${moments.profil}`)} ·{" "}
                    {t("pages.heroCounters.duree.rang", { rang: t(`rangsMesure.${rangDuree}`) })}
                  </p>
                  <BarresDuree tranches={tranches} moments={moments} nomTranche={nomTranche} locale={locale} />
                </>
              ) : (
                <p className="mt-3 text-sm text-chalk-400">{t("pages.heroCounters.duree.aucune", n)}</p>
              )}
            </Carte>

            <Carte>
              <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroCounters.lanes.titre")}</h3>
              <p className="mt-3 text-xs leading-relaxed text-chalk-500">{t("pages.heroCounters.lanes.intro", n)}</p>
              {lanesContres.length > 0 ? (
                <dl className="mt-4 space-y-3">
                  {lanesContres.map((g) => (
                    <div key={g.lane}>
                      <dt className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-400">
                        {t(`lanes.${g.lane}`)}
                        {h.lanes.includes(g.lane) && (
                          <span className="bevel-sm border border-blood-500/40 px-1.5 py-px text-[0.65rem] text-blood-500">
                            {t("pages.heroCounters.lanes.direct")}
                          </span>
                        )}
                      </dt>
                      <dd className="mt-1.5">
                        <ul className="flex flex-wrap gap-1.5 text-sm">
                          {g.contres.map((c) => (
                            <li key={c.slug}>
                              <Link
                                href={`/heroes/${c.slug}`}
                                className="bevel-sm inline-flex gap-1.5 border border-night-700 px-2 py-0.5 text-chalk-300 hover:border-gold-500/60"
                              >
                                {nomDe(c.slug)}
                                <span className="tabular-nums text-blood-500">{ecart(c.moyenne)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-4 text-sm text-chalk-400">{t("pages.heroCounters.aucuneMesure", n)}</p>
              )}
            </Carte>
          </div>
        </section>

        {/* ── Relations du wiki ───────────────────────────────────────── */}
        {aWiki && (
          <section aria-labelledby="wiki">
            <h2 id="wiki" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.heroCounters.wiki.titre")}
            </h2>
            <p className="mt-2 text-sm text-chalk-500">{t("pages.heroCounters.wiki.intro")}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {wiki
                .filter((w) => w.slugs.length > 0)
                .map((w) => (
                  <Carte key={w.titre}>
                    <h3 className="text-sm font-semibold text-chalk-100">{w.titre}</h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {w.slugs.map((s) => (
                        <li key={s}>
                          <Link
                            href={`/heroes/${s}`}
                            className={cn(
                              "bevel-sm inline-block border px-2.5 py-1 text-sm transition-colors",
                              w.ton === "bon"
                                ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                : "border-blood-500/30 text-blood-500 hover:bg-blood-500/10",
                            )}
                          >
                            {nomDe(s)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Carte>
                ))}
            </div>
          </section>
        )}

        {/* ── Autres pages counters, meme position ────────────────────── */}
        {voisins.length > 0 && lanePrincipale && (
          <section aria-labelledby="autres">
            <h2 id="autres" className="font-heading text-xl font-bold text-chalk-100">
              {t("pages.heroCounters.autres.titre", { lane: t(`lanes.${lanePrincipale}`) })}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {voisins.map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/heroes/${x.slug}/counters`}
                    className="bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                  >
                    {t("pages.heroCounters.titre", noms(x.nom))}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * Contres rangs confondus : ecart moyen, nombre de rangs ou l'adversaire
 * figure, et les deux suites naturelles — le face-a-face au comparateur et sa
 * propre page counters.
 */
function TableauAgrege({
  t,
  lignes,
  ton,
  total,
  slug,
  ecart,
}: {
  t: T;
  lignes: ContreAgrege[];
  ton: "bon" | "mauvais";
  total: number;
  slug: string;
  ecart: (v: number) => string;
}) {
  return (
    // Le defilement vit sur un conteneur a part : `bevel` impose son propre
    // `overflow`, et le tableau debordait alors de la page a 390 px. Sur
    // mobile, la colonne des rangs se masque et les liens s'empilent : la
    // ligne tient sans defiler.
    <div className="bevel border border-night-700/70 bg-night-900/60 p-3">
      <div className="relative overflow-x-auto">
      {/*
        Le nom est l'en-tete de sa ligne : « Comparer » et « Counters » en
        tirent leur contexte, sans aria-label repete sur chaque lien.
      */}
      <table
        className={cn(
          "w-full text-sm [&_tbody_th]:py-1.5 [&_tbody_th]:text-left [&_tbody_th]:font-normal [&_td]:py-1.5 [&_td]:pl-3",
          "[&_td]:whitespace-nowrap [&_td]:text-right [&_td:last-child]:text-xs [&_td:last-child_a]:text-gold-400",
          "[&_td:last-child_a:hover]:text-gold-500",
        )}
      >
        <thead className="text-xs uppercase tracking-wide text-chalk-500 [&_th]:pb-2 [&_th]:font-medium [&_th+th]:pl-3 [&_th+th]:text-right">
          <tr>
            <th scope="col" className="text-left">{t("pages.heroCounters.colHeros")}</th>
            <th scope="col">{t("pages.heroCounters.colEcart")}</th>
            <th scope="col" className="max-sm:hidden">{t("pages.heroCounters.colRangs")}</th>
            <th scope="col"><span className="sr-only">{t("pages.heroCounters.colLiens")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-night-800">
          {lignes.map((c) => (
            <tr key={c.slug}>
              <th scope="row">
                <Link href={`/heroes/${c.slug}`} className="flex min-w-0 items-center gap-2.5 text-chalk-100 hover:text-gold-400">
                  <PortraitHeros source={portraitDe(c.slug)} nom={nomDe(c.slug)} taille="petite" decoratif />
                  <span className="truncate">{nomDe(c.slug)}</span>
                </Link>
              </th>
              <td className={cn("font-semibold tabular-nums", ton === "bon" ? "text-emerald-400" : "text-blood-500")}>
                {ecart(c.moyenne)}
              </td>
              <td className="tabular-nums text-chalk-400 max-sm:hidden">
                {t("pages.heroCounters.rangsCites", { n: c.rangs, total })}
              </td>
              <td>
                <Link href={cheminPaire(slug, c.slug)} className="max-sm:block">
                  {t("pages.heroDetail.comparer")}
                </Link>
                <span aria-hidden className="max-sm:hidden"> · </span>
                <Link href={`/heroes/${c.slug}/counters`} className="max-sm:block">
                  {t("pages.heroCounters.lienCourt")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/**
 * Style des listes de rang, pose une fois sur leur conteneur : cent lignes par
 * page, et pas une classe sur les cellules. La couleur du tableau donne celle
 * de l'ecart ; noms et liens reprennent la leur.
 */
const STYLE_TABLEAUX_RANG = cn(
  "[&_table]:mt-2 [&_table]:w-full [&_table]:text-sm [&_tbody_th]:py-1 [&_tbody_th]:text-left [&_tbody_th]:font-normal",
  "[&_td]:py-1 [&_td]:pl-2 [&_td]:text-right [&_td]:whitespace-nowrap [&_td:nth-of-type(1)]:font-semibold",
  "[&_td:nth-of-type(1)]:tabular-nums [&_th_a]:text-chalk-100 [&_td:nth-of-type(2)_a]:text-xs",
  "[&_td:nth-of-type(2)_a]:text-gold-400 [&_a:hover]:text-gold-400",
);

/**
 * Une liste d'un rang : adversaires ou coequipiers, ecart en points. Sans
 * portrait : six rangs de dix-huit lignes en porteraient plus d'une centaine,
 * soit la moitie du poids de la page. Les portraits restent sur les tableaux
 * de synthese, en tete.
 */
function TableauRang({
  t,
  titre,
  icone,
  ton,
  lignes,
  ecart,
  pageContres = true,
}: {
  t: T;
  titre: string;
  icone: React.ReactNode;
  ton: "bon" | "mauvais";
  lignes: ContreChiffre[];
  ecart: (v: number) => string;
  /** Lien vers la page counters de chaque heros ; sans objet pour des coequipiers. */
  pageContres?: boolean;
}) {
  if (lignes.length === 0) return null;
  const couleur = ton === "bon" ? "text-emerald-400" : "text-blood-500";
  return (
    <div>
      <h4 className={cn("flex items-center gap-2 font-heading font-bold", couleur)}>
        {icone}
        {titre}
      </h4>
      <table className={couleur}>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t("pages.heroCounters.colHeros")}</th>
            <th scope="col">{t("pages.heroCounters.colEcart")}</th>
            {pageContres && <th scope="col">{t("pages.heroCounters.colLiens")}</th>}
          </tr>
        </thead>
        <tbody>
          {lignes.map((e) => {
            const nom = nomDe(e.slug);
            return (
              // Nom en en-tete de ligne : le lien « Counters » y prend son contexte.
              <tr key={e.slug}>
                <th scope="row">
                  <Link href={`/heroes/${e.slug}`}>{nom}</Link>
                </th>
                <td>{ecart(e.avantage)}</td>
                {pageContres && (
                  <td>
                    <Link href={`/heroes/${e.slug}/counters`}>{t("pages.heroCounters.lienCourt")}</Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Taux de victoire par duree de partie, en barres : la tranche la plus faible en rouge, la plus forte en vert. */
function BarresDuree({
  tranches,
  moments,
  nomTranche,
  locale,
}: {
  tranches: TrancheDuree[];
  moments: { faible: TrancheDuree; fort: TrancheDuree };
  nomTranche: (x: TrancheDuree) => string;
  locale: Langue;
}) {
  // Echelle resserree sur l'etendue mesuree : quelques points d'ecart restent
  // visibles, ce qu'une echelle de 0 a 100 % ecraserait.
  const bas = moments.faible.victoire - 0.5;
  const etendue = moments.fort.victoire - bas || 1;
  return (
    <ul className="mt-4 space-y-1.5 text-xs">
      {tranches.map((x) => (
        <li key={x.de} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2">
          <span className="text-chalk-400">{nomTranche(x)}</span>
          <span aria-hidden className="h-2 bg-night-800">
            <span
              className={cn(
                "block h-full",
                x === moments.faible ? "bg-blood-500" : x === moments.fort ? "bg-emerald-400" : "bg-azure-500",
              )}
              style={{ width: `${Math.round(15 + (85 * (x.victoire - bas)) / etendue)}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-chalk-300">{pourcentage(locale, x.victoire)}</span>
        </li>
      ))}
    </ul>
  );
}

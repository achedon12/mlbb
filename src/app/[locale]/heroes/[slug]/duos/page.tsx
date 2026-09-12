import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronDown, ThumbsDown, Users } from "lucide-react";
import Link from "@/components/lien";
import { LigneFraicheur } from "@/components/fraicheur";
import { PortraitHeros } from "@/components/portrait-heros";
import { Carte, EnTetePage } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT, type T } from "@/i18n/traductions";
import { agregerContres, deNom, formaterEcart, listeNoms, rangDeSynthese, type ContreAgrege } from "@/lib/contrer";
import { coequipiers, heros, herosParSlug } from "@/lib/donnees";
import { duosDe, JOURS_DUOS, type Duo } from "@/lib/duos";
import { dureeDe, type TrancheDuree } from "@/lib/evolution";
import { dateLongue, dateMesure, patchActuel, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { duosCommeContres, meilleursParPhase, PHASES, phasesDuo, type PhaseDuo } from "@/lib/paires";
import { RANGS_MESURE, type RangMesure } from "@/lib/rangs-mesure";
import { site } from "@/lib/site";
import { classementComplet, statsParRang } from "@/lib/tier-list";
import type { Heros } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Page « duos » d'un heros : avec qui il gagne, rang par rang et selon la
 * duree de partie.
 *
 * Les mesures viennent de la compatibilite publiee par le jeu : la variation
 * de son taux de victoire avec chaque partenaire, et le taux du duo par
 * tranche de duree, rapporte au taux du heros seul a la meme duree. Tout est
 * rendu cote serveur, chaque rang dans son `<details>`.
 */

type Params = { params: Promise<{ locale: Langue; slug: string }> };

/** Une page par heros ; un slug inconnu tombe sur la 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return heros.map((h) => ({ slug: h.slug }));
}

const nomDe = (slug: string) => herosParSlug.get(slug)?.name ?? slug;
const portraitDe = (slug: string) => {
  const x = herosParSlug.get(slug);
  return x?.images.icon ?? x?.images.portrait ?? null;
};
/** Ecarte un partenaire que le catalogue ne connait pas (synchro partielle). */
const connus = <E extends { slug: string }>(liste: E[] = []) => liste.filter((e) => herosParSlug.has(e.slug));
const noms = (nom: string) => ({ nom, deNom: deNom(nom) });
const contexteDe = (t: T, rang: RangMesure) =>
  rang === "all" ? t("pages.duos.allRanks") : t("pages.duos.atRank", { rang: t(`measuredRanks.${rang}`) });

/** « Marcel (+1,1 pts), Grock et Akai » : le premier porte son ecart, les suivants leur nom. */
function tete(locale: Langue, t: T, liste: Duo[]) {
  const [premier, ...suite] = liste;
  return listeNoms(locale, [
    `${nomDe(premier.slug)} (${formaterEcart(locale, t, premier.advantage)})`,
    ...suite.map((e) => nomDe(e.slug)),
  ]);
}

/** Phrase de synthese, commune a la description et au chapeau de la page. */
function synthese(locale: Langue, h: Heros) {
  const t = creerT(locale);
  const parRang = duosDe(h.slug);
  const rang = rangDeSynthese(duosCommeContres(parRang));
  const meilleurs = connus(rang ? parRang[rang]?.best : []).slice(0, 3);
  if (!rang || meilleurs.length === 0) return { rang, phrase: t("pages.duos.noMeasure", { nom: h.name }) };
  const pires = connus(parRang[rang]?.worst).slice(0, 2);
  const variables = { contexte: contexteDe(t, rang), nom: h.name, meilleurs: tete(locale, t, meilleurs) };
  return {
    rang,
    phrase:
      pires.length > 0
        ? t("pages.duos.overview", { ...variables, pires: tete(locale, t, pires) })
        : t("pages.duos.overviewNoWorst", variables),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) return {};
  const t = creerT(locale);
  const meta = metaPage(locale, {
    // Patch dans le titre, comme les pages counters : les resultats qui menent
    // sur « best duo » portent une date ou une version.
    titre: patchActuel
      ? t("pages.duos.metaTitle", { ...noms(h.name), v: patchActuel.version })
      : t("pages.duos.metaTitleNoPatch", noms(h.name)),
    description: `${synthese(locale, h).phrase} ${t("pages.duos.updatedOn", { date: dateLongue(locale) })}`,
    chemin: `/heroes/${slug}/duos`,
    type: "article",
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
  // Sans duo ni coequipier mesure, la page n'apprend rien : hors de l'index, liens suivis.
  const mesure = Object.keys(duosDe(slug)).length > 0 || Object.keys(coequipiers[slug] ?? {}).length > 0;
  return mesure ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function PageDuos({ params }: Params) {
  const { locale, slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) notFound();

  const t = creerT(locale);
  const n = noms(h.name);
  const ecart = (v: number) => formaterEcart(locale, t, v);

  const parRang = duosDe(slug);
  const { rang: rangPrincipal, phrase } = synthese(locale, h);
  const commeContres = duosCommeContres(parRang);
  const rangs = RANGS_MESURE.filter((r) => parRang[r]);
  // Tranches lues pour l'agregat : `all` ne compte qu'a defaut de tranche.
  const tranchesMesurees = RANGS_MESURE.filter((r) => r !== "all" && parRang[r]).length || (parRang.all ? 1 : 0);
  const meilleurs = connus(agregerContres(commeContres, "strong")).slice(0, 8);
  const pires = connus(agregerContres(commeContres, "weak")).slice(0, 6);
  const premier = meilleurs[0]?.slug;
  const stats = statsParRang(slug);

  // Phases : au rang de la synthese, contre la courbe de duree du heros seul au meme rang.
  const durees = dureeDe(slug);
  const tranchesSeul = rangPrincipal ? durees[rangPrincipal] : undefined;
  const duosPrincipaux = rangPrincipal ? connus(parRang[rangPrincipal]?.best) : [];
  const parPhase = meilleursParPhase(duosPrincipaux, tranchesSeul);
  const avecGain = parPhase.some((p) => p.gain !== null);

  // Repli : sans duo mesure, les coequipiers releves par l'academie.
  const academie = rangs.length === 0 ? RANGS_MESURE.filter((r) => connus(coequipiers[slug]?.[r]).length > 0) : [];

  // Pages duos des heros de la meme position, les mieux classes d'abord.
  const lanePrincipale = h.lanes[0];
  const voisins = lanePrincipale
    ? classementComplet
        .filter((e) => e.hero.slug !== slug && e.hero.lanes.includes(lanePrincipale))
        .slice(0, 12)
        .map((e) => e.hero)
    : [];

  const liens = [
    { href: `/heroes/${slug}`, label: t("pages.duos.sheetLink", n) },
    { href: `/heroes/${slug}/counters`, label: t("pages.duos.countersLink", n) },
    ...(premier
      ? [
          { href: `/compare?a=${slug}&b=${premier}`, label: t("pages.duos.compareLink", { nom: h.name, autre: nomDe(premier) }) },
          { href: `/heroes/${premier}/duos`, label: t("pages.duos.title", noms(nomDe(premier))) },
        ]
      : []),
  ];

  const titre = t("pages.duos.title", n);
  const adresse = `${site.url}/${locale}/heroes/${slug}/duos`;
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
        ...(meilleurs.length > 0 ? { mainEntity: { "@id": `${adresse}#duos` } } : {}),
      },
      ...(meilleurs.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${adresse}#duos`,
              name: t("pages.duos.best", n),
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

  const puce =
    "bevel-sm inline-block border border-night-700 px-3 py-1.5 font-medium text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />

      <EnTetePage
        titre={titre}
        chapeau={phrase}
        miettes={[
          { nom: t("nav.heroes.label"), href: "/heroes" },
          { nom: h.name, href: `/heroes/${slug}` },
          {
            nom: t("pages.duos.crumb"),
            freres: [...heros]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((x) => ({ nom: x.name, href: `/heroes/${x.slug}/duos` })),
          },
        ]}
      >
        <LigneFraicheur langue={locale} avant={t("pages.duos.window", { n: JOURS_DUOS })} className="mt-4" />
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {liens.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={puce}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        {/* ── Synthese, rangs confondus ───────────────────────────────── */}
        {(meilleurs.length > 0 || pires.length > 0) && (
          <div className="grid gap-8 lg:grid-cols-2">
            {meilleurs.length > 0 && (
              <section aria-labelledby="meilleurs" className="min-w-0">
                <h2 id="meilleurs" className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.duos.best", n)}
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-chalk-500">{t("pages.duos.bestIntro", n)}</p>
                <TableauAgrege t={t} lignes={meilleurs} ton="bon" total={tranchesMesurees} slug={slug} ecart={ecart} />
              </section>
            )}
            {pires.length > 0 && (
              <section aria-labelledby="pires" className="min-w-0">
                <h2 id="pires" className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.duos.worst", n)}
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-chalk-500">{t("pages.duos.worstIntro", n)}</p>
                <TableauAgrege t={t} lignes={pires} ton="mauvais" total={tranchesMesurees} slug={slug} ecart={ecart} />
              </section>
            )}
          </div>
        )}

        {/* ── Selon la duree de partie ────────────────────────────────── */}
        {rangPrincipal && parPhase.length > 0 && (
          <section aria-labelledby="phases">
            <h2 id="phases" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.duos.phases.title", n)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">
              {t(avecGain ? "pages.duos.phases.intro" : "pages.duos.phases.introNoGain", {
                ...n,
                rang: t(`measuredRanks.${rangPrincipal}`),
              })}
            </p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-3">
              {parPhase.map((p) => (
                <li key={p.phase}>
                  <Carte className="h-full p-4">
                    <p className="text-xs uppercase tracking-wide text-chalk-500">
                      {t(`pages.duos.phase.${p.phase}`)} · {t(`pages.duos.phaseMinutes.${p.phase}`)}
                    </p>
                    <Link href={`/heroes/${p.slug}`} className="mt-3 flex items-center gap-3 text-chalk-100 hover:text-gold-400">
                      <PortraitHeros source={portraitDe(p.slug)} nom={nomDe(p.slug)} taille="icone" decoratif />
                      <span className="font-heading text-lg font-bold">{nomDe(p.slug)}</span>
                    </Link>
                    <p className="mt-2 text-sm text-chalk-300">
                      {t("pages.duos.phases.duoRate", { taux: pourcentage(locale, p.victoire) })}
                      {p.gain !== null && (
                        <>
                          {" · "}
                          <span className={cn("font-semibold tabular-nums", p.gain >= 0 ? "text-emerald-400" : "text-blood-500")}>
                            {t("pages.duos.phases.gainAlone", { ecart: ecart(p.gain), nom: h.name })}
                          </span>
                        </>
                      )}
                    </p>
                  </Carte>
                </li>
              ))}
            </ul>
            <div className="bevel mt-4 relative overflow-x-auto border border-night-700/70 bg-night-900/60 p-3">
              <TableauPhases t={t} locale={locale} duos={duosPrincipaux} tranches={tranchesSeul} ecart={ecart} />
            </div>
          </section>
        )}

        {/* ── Rang par rang ───────────────────────────────────────────── */}
        {rangs.length > 0 && (
          <section aria-labelledby="par-rang">
            <h2 id="par-rang" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.duos.byRank")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">{t("pages.duos.byRankIntro", n)}</p>
            <div className="mt-5 space-y-3">
              {rangs.map((r) => {
                const d = parRang[r]!;
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
                      <h3 className="font-heading text-lg font-bold text-chalk-100">{t(`measuredRanks.${r}`)}</h3>
                      {(d.winRate ?? s?.winRate) != null && (
                        <span className="text-sm text-chalk-500">
                          {t("pages.duos.rateAlone", { taux: pourcentage(locale, d.winRate ?? s!.winRate) })}
                        </span>
                      )}
                    </summary>
                    <div className="grid gap-6 border-t border-night-800 p-4 md:grid-cols-[3fr_2fr]">
                      <div className="min-w-0">
                        <h4 className="flex items-center gap-2 font-heading font-bold text-emerald-400">
                          <Users size={16} aria-hidden />
                          {t("pages.duos.bestShort")}
                        </h4>
                        <div className="relative overflow-x-auto">
                          <TableauPhases
                            t={t}
                            locale={locale}
                            duos={connus(d.best)}
                            tranches={durees[r]}
                            ecart={ecart}
                            compact
                          />
                        </div>
                      </div>
                      {connus(d.worst).length > 0 && (
                        <div className="min-w-0 relative overflow-x-auto">
                          <h4 className="flex items-center gap-2 font-heading font-bold text-blood-500">
                            <ThumbsDown size={16} aria-hidden />
                            {t("pages.duos.worstShort")}
                          </h4>
                          <ListeEcarts t={t} lignes={connus(d.worst)} ecart={ecart} />
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-chalk-500">{t("pages.duos.source", { n: JOURS_DUOS })}</p>
          </section>
        )}

        {/* ── Repli : coequipiers de l'academie ───────────────────────── */}
        {academie.length > 0 && (
          <section aria-labelledby="academie">
            <h2 id="academie" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.duos.academy.title", n)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">{t("pages.duos.academy.intro", n)}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {academie.map((r) => (
                <Carte key={r} className="min-w-0 relative overflow-x-auto p-4">
                  <h3 className="font-heading font-bold text-chalk-100">{t(`measuredRanks.${r}`)}</h3>
                  <ListeEcarts t={t} lignes={connus(coequipiers[slug]?.[r])} ecart={ecart} />
                </Carte>
              ))}
            </div>
          </section>
        )}

        {rangs.length === 0 && academie.length === 0 && (
          <p className="text-sm text-chalk-400">{t("pages.duos.noMeasure", n)}</p>
        )}

        {/* ── Autres pages duos, meme position ────────────────────────── */}
        {voisins.length > 0 && lanePrincipale && (
          <section aria-labelledby="autres">
            <h2 id="autres" className="font-heading text-xl font-bold text-chalk-100">
              {t("pages.duos.others", { lane: t(`lanes.${lanePrincipale}`) })}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {voisins.map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/heroes/${x.slug}/duos`}
                    className="bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                  >
                    {t("pages.duos.title", noms(x.name))}
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
 * Partenaires rangs confondus : ecart moyen, nombre de rangs ou ils figurent,
 * et les deux suites naturelles — le comparateur et leur propre page duos.
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
  const nom = nomDe(slug);
  return (
    <div className="bevel relative overflow-x-auto border border-night-700/70 bg-night-900/60 p-3">
      <table className="w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-3 [&_td+td]:whitespace-nowrap [&_td+td]:text-right">
        <thead className="text-xs uppercase tracking-wide text-chalk-500 [&_th]:pb-2 [&_th]:font-medium [&_th+th]:pl-3 [&_th+th]:text-right">
          <tr>
            <th scope="col" className="text-left">{t("pages.duos.colPartner")}</th>
            <th scope="col">{t("pages.duos.colGain")}</th>
            <th scope="col">{t("pages.duos.colRanks")}</th>
            <th scope="col"><span className="sr-only">{t("pages.duos.colLinks")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-night-800">
          {lignes.map((c) => (
            <tr key={c.slug}>
              <td>
                <Link href={`/heroes/${c.slug}`} className="flex min-w-0 items-center gap-2.5 text-chalk-100 hover:text-gold-400">
                  <PortraitHeros source={portraitDe(c.slug)} nom={nomDe(c.slug)} taille="petite" decoratif />
                  <span className="truncate">{nomDe(c.slug)}</span>
                </Link>
              </td>
              <td className={cn("font-semibold tabular-nums", ton === "bon" ? "text-emerald-400" : "text-blood-500")}>
                {ecart(c.moyenne)}
              </td>
              <td className="tabular-nums text-chalk-400">{t("pages.duos.ranksListed", { n: c.rangs, total })}</td>
              <td className="text-xs">
                <Link
                  href={`/compare?a=${slug}&b=${c.slug}`}
                  aria-label={t("pages.duos.compareLink", { nom, autre: nomDe(c.slug) })}
                  className="text-gold-400 hover:text-gold-500"
                >
                  {t("pages.duos.compare")}
                </Link>
                {" · "}
                <Link
                  href={`/heroes/${c.slug}/duos`}
                  aria-label={t("pages.duos.title", noms(nomDe(c.slug)))}
                  className="text-gold-400 hover:text-gold-500"
                >
                  {t("pages.duos.shortLink")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Partenaires d'un rang et leur effet selon la duree de partie : gain sur le
 * heros seul a la meme duree quand sa courbe est mesuree, sinon le taux du
 * duo. Le style des cellules est pose sur le tableau : moins de classes a
 * repeter dans le HTML.
 */
function TableauPhases({
  t,
  locale,
  duos,
  tranches,
  ecart,
  compact = false,
}: {
  t: T;
  locale: Langue;
  duos: Duo[];
  tranches: TrancheDuree[] | undefined;
  ecart: (v: number) => string;
  /** Dans un rang : le gain global en tete, sans portrait. */
  compact?: boolean;
}) {
  if (duos.length === 0) return null;
  const lignes = duos.map((d) => ({ d, phases: new Map(phasesDuo(d.phases, tranches).map((p) => [p.phase, p])) }));
  const cellule = (p: PhaseDuo | undefined) => {
    if (!p) return "—";
    if (p.gain === null) return pourcentage(locale, p.victoire);
    return <span className={p.gain >= 0 ? "text-emerald-400" : "text-blood-500"}>{ecart(p.gain)}</span>;
  };
  return (
    <table
      className={cn(
        "mt-2 w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-2 [&_td+td]:text-right [&_td+td]:whitespace-nowrap [&_td+td]:tabular-nums",
        "[&_th]:pb-1.5 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-chalk-500 [&_th+th]:pl-2 [&_th+th]:text-right",
      )}
    >
      <thead>
        <tr>
          <th scope="col" className="text-left">{t("pages.duos.colPartner")}</th>
          {compact && <th scope="col">{t("pages.duos.colGain")}</th>}
          {PHASES.map((p) => (
            <th scope="col" key={p}>
              <abbr title={`${t(`pages.duos.phase.${p}`)} (${t(`pages.duos.phaseMinutes.${p}`)})`} className="no-underline">
                {t(`pages.duos.phaseShort.${p}`)}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-night-800">
        {lignes.map(({ d, phases }) => (
          <tr key={d.slug}>
            <td>
              <Link href={`/heroes/${d.slug}`} className="flex min-w-0 items-center gap-2 text-chalk-100 hover:text-gold-400">
                {!compact && <PortraitHeros source={portraitDe(d.slug)} nom={nomDe(d.slug)} taille="mini" decoratif />}
                <span className="truncate">{nomDe(d.slug)}</span>
              </Link>
            </td>
            {compact && <td className="font-semibold text-emerald-400">{ecart(d.advantage)}</td>}
            {PHASES.map((p) => (
              <td key={p}>{cellule(phases.get(p))}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Liste courte : partenaire et ecart en points, sans phases. */
function ListeEcarts({ t, lignes, ecart }: { t: T; lignes: { slug: string; advantage: number }[]; ecart: (v: number) => string }) {
  if (lignes.length === 0) return null;
  return (
    <table className="mt-2 w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-2 [&_td+td]:text-right [&_td+td]:tabular-nums">
      <thead className="sr-only">
        <tr>
          <th scope="col">{t("pages.duos.colPartner")}</th>
          <th scope="col">{t("pages.duos.colGain")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-night-800">
        {lignes.map((e) => (
          <tr key={e.slug}>
            <td>
              <Link href={`/heroes/${e.slug}`} className="text-chalk-100 hover:text-gold-400">
                {nomDe(e.slug)}
              </Link>
            </td>
            <td className={cn("font-semibold", e.advantage >= 0 ? "text-emerald-400" : "text-blood-500")}>{ecart(e.advantage)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

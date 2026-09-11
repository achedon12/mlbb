import type { Metadata } from "next";
import Image from "next/image";
import { Shield, Star, Swords } from "lucide-react";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { classesPuce } from "@/components/puce";
import { Carte, EnTetePage } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT, type T } from "@/i18n/traductions";
import {
  ECHELLE,
  RECOMPENSES_SAISON,
  REGLES_FAMILLE,
  SOURCES_RANGS,
  apparencePalier,
  palierDeFamille,
  type FamilleRang,
  type PalierEchelle,
} from "@/lib/echelle-rangs";
import { dateLongue, dateMesure, listeNoms, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import type { RangMesure } from "@/lib/rangs-mesure";
import { site } from "@/lib/site";
import { classementDuRang, RANGS_CLASSES } from "@/lib/tier-list";

/**
 * Systeme de rangs : l'echelle de Guerrier a Immortel mythique, ses divisions,
 * ses etoiles et ses points, puis ce que nos mesures disent de chaque tranche
 * de rang (les heros qui y gagnent le plus). La structure vient de
 * `echelle-rangs.ts`, les taux de la tier list : la page suit les
 * synchronisations sans retouche.
 */
type Params = { params: Promise<{ locale: Langue }> };

const CHEMIN = "/ranks";
const TOP = 5;
const FAMILLES: FamilleRang[] = ["guerrier", "elite", "maitre", "grand-maitre", "epique", "legende", "mythique"];
const SECTIONS = [
  ["echelle", "echelleTitre"],
  ["tableau", "tableauTitre"],
  ["mythique", "mythiqueTitre"],
  ["heros", "herosTitre"],
  ["saison", "saisonTitre"],
] as const;

/** Legende n'a pas de nom de rang dans le catalogue : on reprend celui de sa tranche de mesure. */
const nomPalier = (t: T, cle: string) => (cle === "legende" ? t("rangsMesure.legend") : t(`rangsNom.${cle}`));

const cheminTierList = (r: RangMesure) => (r === "all" ? "/tier-list" : `/tier-list/${r}`);

/** Points qui ouvrent un palier mythique, lus dans l'echelle plutot qu'ecrits dans les libelles. */
const seuilMythique = (cle: string) => ECHELLE.find((p) => p.cle === cle)?.points?.min ?? 0;

/** Les heros qui gagnent le plus dans une tranche de rang, hors echantillons trop maigres. */
function meilleurs(rang: RangMesure) {
  return classementDuRang(rang)
    .filter((e) => !e.faibleEchantillon)
    .sort((a, b) => b.victoire - a.victoire)
    .slice(0, TOP);
}

function description(locale: Langue) {
  const t = creerT(locale);
  const top = meilleurs("mythic").slice(0, 3).map((e) => e.heros.nom);
  return top.length
    ? t("pages.seo.rangs.description", { n: ECHELLE.length, top: listeNoms(locale, top), date: dateLongue(locale) })
    : t("pages.seo.rangs.descriptionSimple", { n: ECHELLE.length });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.rangs.titre"),
    description: description(locale),
    chemin: CHEMIN,
    motsCles: ["rank system", "ranks", "Mythical Immortal", "Mythical Glory", "stars", "season rewards", "MLBB"],
  });
}

function Embleme({ palier, taille = 56 }: { palier: PalierEchelle; taille?: number }) {
  const { image, couleur } = apparencePalier(palier);
  // Le nom du rang est ecrit a cote : l'embleme est decoratif.
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={taille}
        height={taille}
        className="shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      />
    );
  }
  return (
    <span aria-hidden className="grid shrink-0 place-items-center" style={{ width: taille, height: taille, color: couleur }}>
      <Shield size={Math.round(taille * 0.8)} strokeWidth={1.5} />
    </span>
  );
}

function TitreBloc({ id, children, intro }: { id: string; children: React.ReactNode; intro?: string }) {
  return (
    <>
      <h2 id={`${id}-titre`} className="font-titre text-2xl font-bold text-craie-100 sm:text-3xl">
        {children}
      </h2>
      <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
      {intro && <p className="mt-3 max-w-3xl leading-relaxed text-craie-300">{intro}</p>}
    </>
  );
}

export default async function PageRangs({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const entier = new Intl.NumberFormat(locale);
  const titre = t("pages.rangs.titre");
  const tetes = meilleurs("all").map((e) => e.heros.slug);
  const auSommet = meilleurs("glory").filter((e) => !tetes.includes(e.heros.slug)).map((e) => e.heros.nom);

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: titre,
    description: description(locale),
    url: `${site.url}/${locale}${CHEMIN}`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: dateMesure,
    isPartOf: { "@type": "WebSite", name: site.nom, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
    mainEntity: {
      "@type": "ItemList",
      name: t("pages.rangs.echelleTitre"),
      numberOfItems: ECHELLE.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: ECHELLE.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: nomPalier(t, p.cle) })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage titre={titre} chapeau={t("pages.rangs.chapeau")}>
        <LigneFraicheur langue={locale} className="mt-6" />
        <nav aria-label={t("pages.rangs.sommaire")} className="mt-6 flex flex-wrap gap-2">
          {SECTIONS.map(([id, cle]) => (
            <a key={id} href={`#${id}`} className={classesPuce(false, true)}>
              {t(`pages.rangs.${cle}`)}
            </a>
          ))}
        </nav>
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="echelle" aria-labelledby="echelle-titre" className="scroll-mt-20">
          <TitreBloc id="echelle" intro={t("pages.rangs.echelleIntro", { n: ECHELLE.length })}>
            {t("pages.rangs.echelleTitre")}
          </TitreBloc>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ECHELLE.map((p, i) => {
              const { couleur } = apparencePalier(p);
              const bans = REGLES_FAMILLE[p.famille].bans;
              return (
                <li key={p.cle}>
                  <Carte className="flex h-full gap-4">
                    <Embleme palier={p} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-craie-500">
                        {t("pages.rangs.position", { n: i + 1, total: ECHELLE.length })}
                      </p>
                      <h3 className="font-titre text-xl font-bold" style={{ color: couleur }}>
                        {nomPalier(t, p.cle)}
                      </h3>
                      <p className="mt-1 text-sm text-craie-300">
                        {p.points === null
                          ? t("pages.rangs.divisions", { n: p.divisions.length, liste: p.divisions.join(" → ") })
                          : p.points.max === null
                            ? t("pages.rangs.pointsPlus", { min: p.points.min })
                            : t("pages.rangs.pointsEntre", { min: p.points.min, max: p.points.max })}
                      </p>
                      {p.etoilesMax !== null && (
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-craie-400">
                          <Star size={12} aria-hidden className="fill-current text-or-400" />
                          {t("pages.rangs.etoilesParDivision", { n: p.etoilesMax })}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                        {bans !== null && (
                          <span className="biseau-sm bg-azur-500/15 px-2 py-0.5 text-azur-400">
                            {t("pages.rangs.draft", { n: bans })}
                          </span>
                        )}
                        {p.mesure && (
                          <Link
                            href={cheminTierList(p.mesure)}
                            className="font-semibold text-or-400 transition-colors hover:text-or-500"
                          >
                            {t("pages.rangs.lienTierList", { rang: t(`rangsMesure.${p.mesure}`) })} →
                          </Link>
                        )}
                      </div>
                    </div>
                  </Carte>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 max-w-3xl text-sm text-craie-500">{t("pages.rangs.echelleNote")}</p>
        </section>

        <section id="tableau" aria-labelledby="tableau-titre" className="scroll-mt-20">
          <TitreBloc id="tableau" intro={t("pages.rangs.tableauIntro")}>
            {t("pages.rangs.tableauTitre")}
          </TitreBloc>
          <div className="mt-6 relative overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-nuit-700 text-xs uppercase tracking-wide text-craie-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colRang")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colDivisions")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colEtoiles")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colDraft")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colMontee")}</th>
                  <th scope="col" className="py-2 font-medium">{t("pages.rangs.colProtection")}</th>
                </tr>
              </thead>
              <tbody>
                {FAMILLES.map((f) => {
                  const p = palierDeFamille(f);
                  const r = REGLES_FAMILLE[f];
                  return (
                    <tr key={f} className="border-b border-nuit-800">
                      <th scope="row" className="py-2.5 pr-4">
                        <span className="flex items-center gap-2">
                          <Embleme palier={p} taille={28} />
                          <span className="font-semibold" style={{ color: apparencePalier(p).couleur }}>
                            {f === "mythique" ? t("pages.rangs.familleMythique") : nomPalier(t, p.cle)}
                          </span>
                        </span>
                      </th>
                      <td className="py-2.5 pr-4 text-craie-200">{p.divisions.length ? p.divisions.join(" · ") : "—"}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-craie-200">
                        {p.etoilesMax ?? t("pages.rangs.pointsAuLieu")}
                      </td>
                      <td className="py-2.5 pr-4 text-craie-200">
                        {r.bans === null ? t("pages.rangs.sansDraft") : t("pages.rangs.bans", { n: r.bans })}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-craie-200">
                        {r.pointsMontee === null ? "—" : entier.format(r.pointsMontee)}
                      </td>
                      <td className="py-2.5 tabular-nums text-craie-200">{entier.format(r.pointsProtection)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-craie-500">{t("pages.rangs.tableauNote")}</p>
        </section>

        <section id="mythique" aria-labelledby="mythique-titre" className="scroll-mt-20">
          <TitreBloc
            id="mythique"
            intro={t("pages.rangs.mythiqueIntro", {
              honneur: seuilMythique("mythique-honneur"),
              gloire: seuilMythique("mythique-gloire"),
              immortel: seuilMythique("mythique-immortel"),
            })}
          >
            {t("pages.rangs.mythiqueTitre")}
          </TitreBloc>
          <ol className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ECHELLE.filter((p) => p.points).map((p) => (
              <li key={p.cle}>
                <Carte className="flex h-full flex-col items-center text-center">
                  <Embleme palier={p} taille={64} />
                  <h3 className="mt-2 font-titre text-lg font-bold" style={{ color: apparencePalier(p).couleur }}>
                    {nomPalier(t, p.cle)}
                  </h3>
                  <p className="text-sm tabular-nums text-craie-300">
                    {p.points!.max === null
                      ? t("pages.rangs.pointsPlus", { min: p.points!.min })
                      : t("pages.rangs.pointsEntre", { min: p.points!.min, max: p.points!.max })}
                  </p>
                </Carte>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-3xl text-sm text-craie-400">{t("pages.rangs.mythiquePieces")}</p>
        </section>

        <section id="heros" aria-labelledby="heros-titre" className="scroll-mt-20">
          <TitreBloc id="heros" intro={t("pages.rangs.herosIntro", { n: TOP })}>
            {t("pages.rangs.herosTitre")}
          </TitreBloc>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RANGS_CLASSES.map((r) => {
              const liste = meilleurs(r);
              if (!liste.length) return null;
              const palier = ECHELLE.find((p) => p.mesure === r);
              return (
                <Carte key={r} className="flex flex-col">
                  <div className="flex items-center gap-3">
                    {palier ? (
                      <Embleme palier={palier} taille={36} />
                    ) : (
                      <span aria-hidden className="grid size-9 place-items-center text-or-400">
                        <Swords size={24} />
                      </span>
                    )}
                    <h3 className="font-titre text-lg font-bold text-craie-100">{t(`rangsMesure.${r}`)}</h3>
                  </div>
                  <ol className="mt-3 flex-1 space-y-1.5">
                    {liste.map((e, i) => (
                      <li key={e.heros.slug}>
                        <Link href={`/heroes/${e.heros.slug}`} className="group flex items-center gap-3">
                          <span className="w-4 text-right text-xs tabular-nums text-craie-500">{i + 1}</span>
                          <PortraitHeros
                            source={e.heros.visuels.icone ?? e.heros.visuels.portrait}
                            nom={e.heros.nom}
                            taille="petite"
                            decoratif
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-craie-200 transition-colors group-hover:text-or-400">
                            {e.heros.nom}
                          </span>
                          <span className="text-sm tabular-nums text-craie-300">
                            <span className="sr-only">{t("pages.rangs.victoire")} </span>
                            {pourcentage(locale, e.victoire)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <Link
                    href={cheminTierList(r)}
                    className="mt-4 text-sm font-semibold text-or-400 transition-colors hover:text-or-500"
                  >
                    {r === "all"
                      ? t("pages.rangs.lienTierListTous")
                      : t("pages.rangs.lienTierList", { rang: t(`rangsMesure.${r}`) })}{" "}
                    →
                  </Link>
                </Carte>
              );
            })}
          </div>
          {auSommet.length > 0 && (
            <p className="mt-4 max-w-3xl leading-relaxed text-craie-300">
              {t("pages.rangs.herosEcart", { noms: listeNoms(locale, auSommet), rang: t("rangsMesure.glory") })}
            </p>
          )}
          <p className="mt-3 max-w-3xl text-sm text-craie-500">{t("pages.rangs.herosNote")}</p>
        </section>

        <section id="saison" aria-labelledby="saison-titre" className="scroll-mt-20">
          <TitreBloc id="saison">{t("pages.rangs.saisonTitre")}</TitreBloc>
          <div className="mt-4 max-w-3xl space-y-3 leading-relaxed text-craie-300">
            <p>{t("pages.rangs.remise1")}</p>
            <p>{t("pages.rangs.remise2")}</p>
            <p>{t("pages.rangs.parcours")}</p>
            <p>
              <Link href="/tools/server-time" className="font-semibold text-or-400 transition-colors hover:text-or-500">
                {t("pages.rangs.lienHeure")} →
              </Link>
            </p>
          </div>

          <h3 className="mt-8 font-titre text-xl font-bold text-craie-100">{t("pages.rangs.recompensesTitre")}</h3>
          <div className="mt-3 relative overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-nuit-700 text-xs uppercase tracking-wide text-craie-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colRangFinal")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colPointsBataille")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colTickets")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.rangs.colFragments")}</th>
                  <th scope="col" className="py-2 font-medium">{t("pages.rangs.colAutres")}</th>
                </tr>
              </thead>
              <tbody>
                {RECOMPENSES_SAISON.map((r) => {
                  const p = palierDeFamille(r.famille);
                  return (
                    <tr key={r.famille} className="border-b border-nuit-800">
                      <th scope="row" className="py-2.5 pr-4">
                        <span className="flex items-center gap-2">
                          <Embleme palier={p} taille={28} />
                          <span className="font-semibold" style={{ color: apparencePalier(p).couleur }}>
                            {r.famille === "mythique" ? t("pages.rangs.familleMythique") : nomPalier(t, p.cle)}
                          </span>
                        </span>
                      </th>
                      <td className="py-2.5 pr-4 tabular-nums text-craie-200">{entier.format(r.pointsBataille)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-craie-200">{entier.format(r.tickets)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-craie-200">
                        {r.fragments === null ? "—" : entier.format(r.fragments)}
                      </td>
                      <td className="py-2.5 text-craie-200">{r.embleme ? t("pages.rangs.emote") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-craie-500">{t("pages.rangs.recompensesNote")}</p>
        </section>

        <section aria-labelledby="sources-titre" className="border-t border-nuit-800 pt-6 text-sm text-craie-500">
          <h2 id="sources-titre" className="font-semibold text-craie-300">{t("pages.rangs.sourcesTitre")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <a href={SOURCES_RANGS.classe} rel="noopener" className="underline transition-colors hover:text-or-400">
                {t("pages.rangs.sourceClasse")}
              </a>
            </li>
            <li>
              <a href={SOURCES_RANGS.recompenses} rel="noopener" className="underline transition-colors hover:text-or-400">
                {t("pages.rangs.sourceRecompenses")}
              </a>
            </li>
            <li>
              <a href={SOURCES_RANGS.table} rel="noopener" className="underline transition-colors hover:text-or-400">
                {t("pages.rangs.sourceTable")}
              </a>
            </li>
            <li>{t("pages.rangs.sourceMesures", { date: dateLongue(locale) })}</li>
          </ul>
        </section>
      </div>
    </>
  );
}

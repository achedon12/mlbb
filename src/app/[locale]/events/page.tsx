import type { Metadata } from "next";
import { CreditWiki } from "@/components/credit-wiki";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { ContenuMois, ListeSources, moisTexte, nomHeros, nomMois } from "@/components/mois-evenements";
import { Carte, EnTetePage, TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { donneesListeSkins } from "@/lib/catalogue-skins-serveur";
import { synchro } from "@/lib/donnees";
import { decalerMois, type MoisEvenements, type StatutMois } from "@/lib/evenements";
import { dateReference, moisDe, moisEvenements, sourcesDuMois, sourcesEvenements } from "@/lib/evenements-serveur";
import { donneesLd } from "@/lib/html";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Langue }> };

const CHEMIN = "/events";
/** Mois detailles dans la frise ; les plus anciens restent a une page de distance, dans l'index. */
const MOIS_FRISE = 12;

const moisCourant = dateReference.slice(0, 7);

function description(locale: Langue): string {
  const t = creerT(locale);
  const tous = moisEvenements();
  const dernier = tous.find((m) => m.mois <= moisCourant && m.starlight.length > 0);
  const s = dernier?.starlight[0];
  return t("pages.seo.evenements.description", {
    n: tous.length,
    debut: tous.length ? moisTexte(locale, tous.at(-1)!.mois) : "—",
    fin: tous.length ? moisTexte(locale, tous[0].mois) : "—",
    dernier: s
      ? `${t("pages.evenements.skinDe", { skin: s.nom, heros: nomHeros(s.heros) })}, ${moisTexte(locale, dernier!.mois)}`
      : "—",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.evenements.titre"),
    description: description(locale),
    chemin: CHEMIN,
    motsCles: ["MLBB events", "MLBB Starlight", "Starlight skin this month", "MLBB Collector skin", "Grand Collection", "Mobile Legends"],
  });
}

export default async function PageEvenements({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const langueHtml = LOCALE_HTML[locale];
  const nombre = new Intl.NumberFormat(langueHtml);
  const tous = moisEvenements();
  const suivant = decalerMois(moisCourant, 1);
  const actuel = moisDe(moisCourant);
  const annonces = tous.filter((m) => m.mois > moisCourant).reverse();
  const passes = tous.filter((m) => m.mois < moisCourant);
  const frise = passes.slice(0, MOIS_FRISE);
  const dernier = passes[0];
  const lien = "font-semibold text-or-400 transition-colors hover:text-or-500";
  const lienExterne = "font-semibold text-or-400 hover:underline";
  const nSkins = (n: number) =>
    t(n === 1 ? "pages.calendrierSkins.nSkins1" : "pages.calendrierSkins.nSkins", { n: nombre.format(n) });

  const parAnnee = new Map<string, MoisEvenements[]>();
  for (const m of tous) parAnnee.set(m.mois.slice(0, 4), [...(parAnnee.get(m.mois.slice(0, 4)) ?? []), m]);
  const formatMois = new Intl.DateTimeFormat(langueHtml, { month: "long", timeZone: "UTC" });
  const seulMois = (mois: string) => {
    const texte = formatMois.format(new Date(`${mois}-01T00:00:00Z`));
    return texte.charAt(0).toLocaleUpperCase(langueHtml) + texte.slice(1);
  };

  const badge = (statut: StatutMois) =>
    statut !== "passe" && (
      <span className="biseau-sm inline-block bg-or-500 px-2 py-0.5 text-xs font-semibold text-nuit-950">
        {t(`pages.evenements.statut.${statut}`)}
      </span>
    );

  const blocMois = (m: MoisEvenements, statut: StatutMois) => (
    <Carte className={cn(statut !== "passe" && "border-or-500/60")}>
      <article aria-labelledby={`m-${m.mois}`}>
        <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 id={`m-${m.mois}`} className="font-titre text-xl font-bold text-craie-100 sm:text-2xl">
            <Link href={`${CHEMIN}/${m.mois}`} className="transition-colors hover:text-or-400">
              {nomMois(locale, m.mois)}
            </Link>
          </h3>
          {badge(statut)}
          <span className="text-sm text-craie-500">{nSkins(m.total)}</span>
        </header>
        <ContenuMois m={m} t={t} locale={locale} niveau="frise" />
        <p className="mt-6 text-sm">
          <Link href={`${CHEMIN}/${m.mois}`} className={lien}>
            {t("pages.evenements.detailsMois", { mois: moisTexte(locale, m.mois) })} →
          </Link>
        </p>
      </article>
    </Carte>
  );

  const donneesStructurees = donneesListeSkins(locale, {
    nom: t("pages.evenements.titre"),
    description: description(locale),
    chemin: CHEMIN,
    elements: tous.map((m) => ({
      nom: t("pages.evenements.mois.titre", { mois: moisTexte(locale, m.mois) }),
      chemin: `${CHEMIN}/${m.mois}`,
    })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={t("pages.evenements.titre")}
        chapeau={t("pages.evenements.chapeau", {
          n: nombre.format(tous.length),
          debut: tous.length ? moisTexte(locale, tous.at(-1)!.mois) : "—",
          fin: tous.length ? moisTexte(locale, tous[0].mois) : "—",
        })}
        miettes={[{ nom: t("pages.evenements.miette") }]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="ce-mois" className="scroll-mt-24">
          <TitreSection>{t("pages.evenements.ceMoisTitre", { mois: moisTexte(locale, moisCourant) })}</TitreSection>
          <Carte className="border-or-500/60">
            <div className="mb-6">{badge("courant")}</div>
            {actuel ? (
              <ContenuMois m={actuel} t={t} locale={locale} niveau="frise" />
            ) : (
              <p className="max-w-2xl leading-relaxed text-craie-300">
                {t("pages.evenements.ceMoisVide", {
                  mois: moisTexte(locale, moisCourant),
                  dernier: dernier ? moisTexte(locale, dernier.mois) : "—",
                })}{" "}
                {dernier && (
                  <Link href={`${CHEMIN}/${dernier.mois}`} className={lien}>
                    {t("pages.evenements.voirMois", { mois: moisTexte(locale, dernier.mois) })} →
                  </Link>
                )}
              </p>
            )}
            <h3 className="mt-8 font-titre text-lg font-semibold text-craie-100">{t("pages.evenements.chaqueMoisTitre")}</h3>
            <ul className="mt-3 list-disc space-y-3 pl-5 leading-relaxed text-craie-300 marker:text-or-400">
              <li>
                {t("pages.evenements.regleStarlight")}{" "}
                <span className="whitespace-nowrap text-sm">
                  <a href={sourcesEvenements.starlight.url} rel="noreferrer nofollow" target="_blank" className={lienExterne}>
                    {t("pages.evenements.sourcePage", { page: sourcesEvenements.starlight.titre })}
                  </a>
                </span>{" "}
                ·{" "}
                <Link href="/tools/server-time" className={cn(lien, "text-sm")}>
                  {t("pages.evenements.lienHeureServeur")} →
                </Link>
              </li>
              <li>
                {t("pages.evenements.regleCollector")}{" "}
                <a href={sourcesEvenements.collector.url} rel="noreferrer nofollow" target="_blank" className={cn(lienExterne, "text-sm")}>
                  {t("pages.evenements.sourcePage", { page: sourcesEvenements.collector.titre })}
                </a>
              </li>
            </ul>
          </Carte>
        </section>

        <section id="a-venir" className="scroll-mt-24">
          <TitreSection>
            {annonces.length > 0
              ? t("pages.evenements.aVenirTitre")
              : t("pages.evenements.moisSuivantTitre", { mois: moisTexte(locale, suivant) })}
          </TitreSection>
          {annonces.length > 0 ? (
            <ol className="space-y-6">
              {annonces.map((m) => (
                <li key={m.mois} className="space-y-3">
                  {blocMois(m, "annonce")}
                  <p className="max-w-3xl text-sm text-craie-400">{t("pages.evenements.mois.annonce")}</p>
                  <ListeSources sources={sourcesDuMois(m.mois)} t={t} locale={locale} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="max-w-2xl leading-relaxed text-craie-300">
              {t("pages.evenements.moisSuivantInconnu", { mois: moisTexte(locale, suivant) })}
            </p>
          )}
        </section>

        {frise.length > 0 && (
          <section id="derniers-mois" className="scroll-mt-24">
            <TitreSection chapeau={t("pages.evenements.historiqueChapeau", { n: frise.length })}>
              {t("pages.evenements.historiqueTitre")}
            </TitreSection>
            <ol className="space-y-6">
              {frise.map((m) => (
                <li key={m.mois}>{blocMois(m, "passe")}</li>
              ))}
            </ol>
          </section>
        )}

        <section id="tous-les-mois" className="scroll-mt-24">
          <TitreSection chapeau={t("pages.evenements.archivesChapeau")}>{t("pages.evenements.archivesTitre")}</TitreSection>
          <div className="space-y-5">
            {[...parAnnee].map(([annee, liste]) => (
              <div key={annee} className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
                <h3 className="w-14 shrink-0 font-titre text-lg font-bold text-craie-100">{annee}</h3>
                <ul className="flex flex-wrap gap-2">
                  {[...liste].reverse().map((m) => (
                    <li key={m.mois}>
                      <Link
                        href={`${CHEMIN}/${m.mois}`}
                        title={t("pages.calendrierSkins.caseMois", { mois: moisTexte(locale, m.mois), n: m.total })}
                        className={cn(
                          "biseau-sm inline-block border px-2.5 py-1 text-xs transition-colors hover:border-or-500/60 hover:text-or-400",
                          m.mois === moisCourant ? "border-or-500/60 text-or-400" : "border-nuit-700 text-craie-300",
                        )}
                      >
                        {seulMois(m.mois)} <span className="text-craie-500">· {m.total}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="sources" className="scroll-mt-24">
          <TitreSection>{t("pages.evenements.aProposTitre")}</TitreSection>
          <div className="max-w-3xl space-y-3 leading-relaxed text-craie-300">
            <p>{t("pages.evenements.aProposListes")}</p>
            <ListeSources sources={[sourcesEvenements.starlight, sourcesEvenements.collector]} t={t} locale={locale} />
            <p>{t("pages.evenements.aProposCatalogue")}</p>
            <p>{t("pages.evenements.aProposFuites")}</p>
            <p>
              <Link href="/skins/calendar" className={lien}>
                {t("pages.evenements.lienCalendrier")} →
              </Link>
            </p>
          </div>
          <CreditWiki t={t} href={synchro.source} cle="pages.evenements.source" />
        </section>
      </div>
    </>
  );
}

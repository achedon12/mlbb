import type { Metadata } from "next";
import { proprietesCarteSkin } from "@/components/carte-skin";
import { CreditWiki } from "@/components/credit-wiki";
import { ExplorateurSkins } from "@/components/explorateur-skins";
import { GrilleSkins } from "@/components/grille-skins";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { EnTetePage, TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import {
  estOrigine,
  grouperParDate,
  libelleSerie,
  lireSortie,
  plusRecents,
  statsSeries,
  type SkinCatalogue,
} from "@/lib/catalogue-skins";
import {
  anneesCalendrier,
  catalogueSkins,
  dateReference,
  donneesListeSkins,
  herosDuCatalogue,
  skinsSortis,
} from "@/lib/catalogue-skins-serveur";
import { synchro } from "@/lib/donnees";
import { formaterSortie } from "@/lib/skins";
import { moisAnnee } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Langue }> };

const CHEMIN = "/skins/calendar";

function description(locale: Langue): string {
  const t = creerT(locale);
  const sortis = skinsSortis();
  const annees = anneesCalendrier();
  const dernier = plusRecents(sortis, 1)[0];
  const heros = herosDuCatalogue();
  return t("pages.seo.calendrierSkins.description", {
    n: new Intl.NumberFormat(LOCALE_HTML[locale]).format(sortis.length),
    debut: annees.at(-1) ?? "",
    fin: annees[0] ?? "",
    dernier: dernier ? `${dernier.nom} (${heros.get(dernier.heros)?.nom ?? dernier.heros})` : "—",
    date: dernier?.sortie ? formaterSortie(dernier.sortie, LOCALE_HTML[locale]) : "—",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.calendrierSkins.titre"),
    description: description(locale),
    chemin: CHEMIN,
    motsCles: ["MLBB skins", "skin release date", "Mobile Legends skins", "Collector", "StarLight", "Epic", "Legend"],
  });
}

/** Intensite d'une case du calendrier, rapportee au mois le plus charge. */
function teinte(n: number, max: number): string {
  if (n === 0) return "bg-nuit-900/40 text-craie-600";
  const part = n / max;
  if (part <= 0.25) return "bg-or-500/15 text-craie-200";
  if (part <= 0.5) return "bg-or-500/30 text-craie-100";
  if (part <= 0.75) return "bg-or-500/55 text-craie-100";
  return "bg-or-500/85 text-nuit-950";
}

export default async function PageCalendrierSkins({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const langueHtml = LOCALE_HTML[locale];
  const nombre = new Intl.NumberFormat(langueHtml);
  const heros = herosDuCatalogue();
  const sortis = skinsSortis();
  const annees = anneesCalendrier();
  const groupes = grouperParDate(sortis, "recent");
  const series = statsSeries(sortis);

  const moisCourant = dateReference.slice(0, 7);
  const ceMois = sortis.filter((s) => s.sortie?.startsWith(moisCourant));
  const recents = plusRecents(sortis, 12);
  const dernierMois = recents[0]?.sortie?.slice(0, 7) ?? null;

  // Ecartes, et comptes pour le dire : skins annonces, ou dates apres le releve.
  const autres = catalogueSkins().skins.filter((s) => !estOrigine(s) && !sortis.includes(s));
  const aVenir = autres.filter((s) => s.dispo === "Upcoming").length;
  const futurs = autres.filter((s) => s.dispo !== "Upcoming" && lireSortie(s.sortie)).length;
  const precision = { jour: 0, mois: 0, annee: 0 };
  for (const s of sortis) {
    const d = lireSortie(s.sortie)!;
    precision[d.jour ? "jour" : d.mois ? "mois" : "annee"] += 1;
  }

  const formatCourt = new Intl.DateTimeFormat(langueHtml, { month: "short", timeZone: "UTC" });
  const formatLong = new Intl.DateTimeFormat(langueHtml, { month: "long", year: "numeric", timeZone: "UTC" });
  const maxMois = Math.max(1, ...groupes.flatMap((a) => a.mois.filter((m) => m.mois).map((m) => m.skins.length)));

  const nSkins = (n: number) =>
    t(n === 1 ? "pages.calendrierSkins.nSkins1" : "pages.calendrierSkins.nSkins", { n: nombre.format(n) });

  const grille = (liste: SkinCatalogue[]) => (
    <GrilleSkins cartes={liste.map((s) => proprietesCarteSkin(s, heros.get(s.heros)?.nom ?? s.heros, t, langueHtml, nombre))} />
  );

  const donneesStructurees = donneesListeSkins(locale, {
    nom: t("pages.calendrierSkins.titre"),
    description: description(locale),
    chemin: CHEMIN,
    elements: annees.map((a) => ({ nom: t("pages.calendrierSkins.annee.titre", { annee: a }), chemin: `${CHEMIN}/${a}` })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={t("pages.calendrierSkins.titre")}
        chapeau={t("pages.calendrierSkins.chapeau", {
          n: nombre.format(sortis.length),
          debut: annees.at(-1) ?? "",
          fin: annees[0] ?? "",
        })}
        miettes={[{ nom: t("pages.calendrierSkins.mietteSkins"), href: "/skins" }, { nom: t("pages.calendrierSkins.miette") }]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="ce-mois" className="scroll-mt-24">
          <TitreSection>{t("pages.calendrierSkins.ceMoisTitre", { mois: moisAnnee(locale, dateReference) })}</TitreSection>
          {ceMois.length > 0 ? (
            grille(ceMois)
          ) : (
            <p className="max-w-2xl leading-relaxed text-craie-300">
              {t("pages.calendrierSkins.ceMoisVide", {
                mois: moisAnnee(locale, dateReference),
                dernier: dernierMois ? moisAnnee(locale, `${dernierMois}-01`) : "—",
              })}{" "}
              <a href="#derniers" className="font-semibold text-or-400 hover:text-or-500">
                {t("pages.calendrierSkins.voirDerniers")}
              </a>
            </p>
          )}
        </section>

        <section id="derniers" className="scroll-mt-24">
          <TitreSection chapeau={t("pages.calendrierSkins.derniersChapeau")}>{t("pages.calendrierSkins.derniersTitre")}</TitreSection>
          {grille(recents)}
        </section>

        <section id="explorateur" className="scroll-mt-24">
          <TitreSection chapeau={t("pages.calendrierSkins.explorerChapeau")}>{t("pages.calendrierSkins.explorerTitre")}</TitreSection>
          <CompleterMessages messages={messagesPage(locale, ["pages.calendrierSkinsUI"])}>
            <ExplorateurSkins
              heros={[...heros.values()].sort((a, b) => a.nom.localeCompare(b.nom, "en")).map((h) => [h.slug, h.nom])}
              series={series.map((s) => s.serie)}
              annees={annees}
              reference={dateReference}
            >
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[30rem] border-separate border-spacing-1 text-center text-xs">
                  <caption className="mb-2 text-left text-sm text-craie-500">{t("pages.calendrierSkins.tableauLegende")}</caption>
                  <thead>
                    <tr className="text-craie-500">
                      <th scope="col" className="text-left font-medium">
                        {t("pages.calendrierSkins.colAnnee")}
                      </th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} scope="col" className="font-medium">
                          <abbr title={formatLong.format(Date.UTC(2024, i, 1)).replace(/\s*\d{4}.*$/, "")} className="no-underline">
                            {formatCourt.format(Date.UTC(2024, i, 1)).replace(".", "")}
                          </abbr>
                        </th>
                      ))}
                      <th scope="col" className="font-medium">
                        <abbr title={t("pages.calendrierSkins.moisInconnu")} className="no-underline">
                          ?
                        </abbr>
                      </th>
                      <th scope="col" className="font-medium">
                        {t("pages.calendrierSkins.colTotal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupes.map((a) => {
                      const parMois = new Map(a.mois.map((m) => [m.mois, m.skins.length]));
                      return (
                        <tr key={a.annee}>
                          <th scope="row" className="pr-1 text-left">
                            <Link href={`${CHEMIN}/${a.annee}`} className="font-titre text-sm font-bold text-craie-100 hover:text-or-400">
                              {a.annee}
                            </Link>
                          </th>
                          {Array.from({ length: 12 }, (_, i) => {
                            const n = parMois.get(i + 1) ?? 0;
                            const libelle = t("pages.calendrierSkins.caseMois", {
                              mois: formatLong.format(Date.UTC(a.annee, i, 1)),
                              n,
                            });
                            return (
                              <td key={i} className="p-0">
                                {n > 0 ? (
                                  <Link
                                    href={`${CHEMIN}/${a.annee}#m-${String(i + 1).padStart(2, "0")}`}
                                    aria-label={libelle}
                                    title={libelle}
                                    className={cn("block min-w-6 py-1.5 tabular-nums hover:outline hover:outline-or-400", teinte(n, maxMois))}
                                  >
                                    {n}
                                  </Link>
                                ) : (
                                  <span className={cn("block min-w-6 py-1.5", teinte(0, maxMois))} aria-label={libelle} />
                                )}
                              </td>
                            );
                          })}
                          <td className="py-1.5 tabular-nums text-craie-400">{parMois.get(null) || ""}</td>
                          <td className="py-1.5 font-semibold tabular-nums text-craie-100">{nombre.format(a.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ExplorateurSkins>
          </CompleterMessages>
        </section>

        <section id="series" className="scroll-mt-24">
          <TitreSection chapeau={t("pages.calendrierSkins.seriesChapeau")}>{t("pages.calendrierSkins.seriesTitre")}</TitreSection>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {series.slice(0, 24).map((s) => {
              const debut = lireSortie(s.premiere)?.annee;
              const fin = lireSortie(s.derniere)?.annee;
              return (
                <li
                  key={s.serie}
                  className="biseau-sm flex items-baseline justify-between gap-3 border border-nuit-700/60 bg-nuit-900/40 px-3 py-2"
                >
                  {/* Lien simple : l'explorateur lit ses filtres dans l'adresse au chargement. */}
                  <a
                    href={`?serie=${encodeURIComponent(s.serie)}#explorateur`}
                    className="truncate font-semibold text-craie-100 hover:text-or-400"
                  >
                    {libelleSerie(t, s.serie)}
                  </a>
                  <span className="shrink-0 text-xs tabular-nums text-craie-500">
                    {t("pages.calendrierSkins.serieDetail", {
                      n: nSkins(s.total),
                      periode: debut && fin && debut !== fin ? `${debut}–${fin}` : String(debut ?? fin ?? "—"),
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="dates" className="scroll-mt-24">
          <TitreSection>{t("pages.calendrierSkins.datesTitre")}</TitreSection>
          <div className="max-w-3xl space-y-3 leading-relaxed text-craie-300">
            <p>
              {t("pages.calendrierSkins.datesPrecision", {
                jour: nombre.format(precision.jour),
                mois: nombre.format(precision.mois),
                annee: nombre.format(precision.annee),
              })}
            </p>
            {aVenir + futurs > 0 && (
              <p>{t("pages.calendrierSkins.datesEcartes", { aVenir: nombre.format(aVenir), futurs: nombre.format(futurs) })}</p>
            )}
            <p>{t("pages.calendrierSkins.datesOrigine")}</p>
            <p>
              <Link href="/tools/collection" className="font-semibold text-or-400 hover:text-or-500">
                {t("pages.calendrierSkins.lienCollection")} →
              </Link>
            </p>
          </div>
          <CreditWiki t={t} href={synchro.source} cle="pages.calendrierSkins.source" />
        </section>
      </div>
    </>
  );
}

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
  return t("pages.seo.skinsCalendar.description", {
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
    titre: t("pages.seo.skinsCalendar.title"),
    description: description(locale),
    chemin: CHEMIN,
    motsCles: ["MLBB skins", "skin release date", "Mobile Legends skins", "Collector", "StarLight", "Epic", "Legend"],
  });
}

/** Intensite d'une case du calendrier, rapportee au mois le plus charge. */
function teinte(n: number, max: number): string {
  if (n === 0) return "bg-night-900/40 text-chalk-600";
  const part = n / max;
  if (part <= 0.25) return "bg-gold-500/15 text-chalk-200";
  if (part <= 0.5) return "bg-gold-500/30 text-chalk-100";
  if (part <= 0.75) return "bg-gold-500/55 text-chalk-100";
  return "bg-gold-500/85 text-night-950";
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
    t(n === 1 ? "pages.skinsCalendar.nSkins1" : "pages.skinsCalendar.nSkins", { n: nombre.format(n) });

  const grille = (liste: SkinCatalogue[]) => (
    <GrilleSkins cartes={liste.map((s) => proprietesCarteSkin(s, heros.get(s.heros)?.nom ?? s.heros, t, langueHtml, nombre))} />
  );

  const donneesStructurees = donneesListeSkins(locale, {
    nom: t("pages.skinsCalendar.title"),
    description: description(locale),
    chemin: CHEMIN,
    elements: annees.map((a) => ({ nom: t("pages.skinsCalendar.year.title", { annee: a }), chemin: `${CHEMIN}/${a}` })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={t("pages.skinsCalendar.title")}
        chapeau={t("pages.skinsCalendar.lead", {
          n: nombre.format(sortis.length),
          debut: annees.at(-1) ?? "",
          fin: annees[0] ?? "",
        })}
        miettes={[{ nom: t("pages.skinsCalendar.crumbSkins"), href: "/skins" }, { nom: t("pages.skinsCalendar.crumb") }]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="ce-mois" className="scroll-mt-24">
          <TitreSection>{t("pages.skinsCalendar.thisMonthTitle", { mois: moisAnnee(locale, dateReference) })}</TitreSection>
          {ceMois.length > 0 ? (
            grille(ceMois)
          ) : (
            <p className="max-w-2xl leading-relaxed text-chalk-300">
              {t("pages.skinsCalendar.thisMonthEmpty", {
                mois: moisAnnee(locale, dateReference),
                dernier: dernierMois ? moisAnnee(locale, `${dernierMois}-01`) : "—",
              })}{" "}
              <a href="#derniers" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.skinsCalendar.seeLatest")}
              </a>
            </p>
          )}
        </section>

        <section id="derniers" className="scroll-mt-24">
          <TitreSection chapeau={t("pages.skinsCalendar.latestLead")}>{t("pages.skinsCalendar.latestTitle")}</TitreSection>
          {grille(recents)}
        </section>

        <section id="explorateur" className="scroll-mt-24">
          <TitreSection chapeau={t("pages.skinsCalendar.exploreLead")}>{t("pages.skinsCalendar.exploreTitle")}</TitreSection>
          <CompleterMessages messages={messagesPage(locale, ["pages.skinsCalendarUI"])}>
            <ExplorateurSkins
              heros={[...heros.values()].sort((a, b) => a.nom.localeCompare(b.nom, "en")).map((h) => [h.slug, h.nom])}
              series={series.map((s) => s.serie)}
              annees={annees}
              reference={dateReference}
            >
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[30rem] border-separate border-spacing-1 text-center text-xs">
                  <caption className="mb-2 text-left text-sm text-chalk-500">{t("pages.skinsCalendar.tableLegend")}</caption>
                  <thead>
                    <tr className="text-chalk-500">
                      <th scope="col" className="text-left font-medium">
                        {t("pages.skinsCalendar.colYear")}
                      </th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} scope="col" className="font-medium">
                          <abbr title={formatLong.format(Date.UTC(2024, i, 1)).replace(/\s*\d{4}.*$/, "")} className="no-underline">
                            {formatCourt.format(Date.UTC(2024, i, 1)).replace(".", "")}
                          </abbr>
                        </th>
                      ))}
                      <th scope="col" className="font-medium">
                        <abbr title={t("pages.skinsCalendar.unknownMonth")} className="no-underline">
                          ?
                        </abbr>
                      </th>
                      <th scope="col" className="font-medium">
                        {t("pages.skinsCalendar.colTotal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupes.map((a) => {
                      const parMois = new Map(a.mois.map((m) => [m.mois, m.skins.length]));
                      return (
                        <tr key={a.annee}>
                          <th scope="row" className="pr-1 text-left">
                            <Link href={`${CHEMIN}/${a.annee}`} className="font-heading text-sm font-bold text-chalk-100 hover:text-gold-400">
                              {a.annee}
                            </Link>
                          </th>
                          {Array.from({ length: 12 }, (_, i) => {
                            const n = parMois.get(i + 1) ?? 0;
                            const libelle = t("pages.skinsCalendar.monthCell", {
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
                                    className={cn("block min-w-6 py-1.5 tabular-nums hover:outline hover:outline-gold-400", teinte(n, maxMois))}
                                  >
                                    {n}
                                  </Link>
                                ) : (
                                  <span className={cn("block min-w-6 py-1.5", teinte(0, maxMois))} aria-label={libelle} />
                                )}
                              </td>
                            );
                          })}
                          <td className="py-1.5 tabular-nums text-chalk-400">{parMois.get(null) || ""}</td>
                          <td className="py-1.5 font-semibold tabular-nums text-chalk-100">{nombre.format(a.total)}</td>
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
          <TitreSection chapeau={t("pages.skinsCalendar.seriesLead")}>{t("pages.skinsCalendar.seriesTitle")}</TitreSection>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {series.slice(0, 24).map((s) => {
              const debut = lireSortie(s.premiere)?.annee;
              const fin = lireSortie(s.derniere)?.annee;
              return (
                <li
                  key={s.serie}
                  className="bevel-sm flex items-baseline justify-between gap-3 border border-night-700/60 bg-night-900/40 px-3 py-2"
                >
                  {/* Lien simple : l'explorateur lit ses filtres dans l'adresse au chargement. */}
                  <a
                    href={`?serie=${encodeURIComponent(s.serie)}#explorateur`}
                    className="truncate font-semibold text-chalk-100 hover:text-gold-400"
                  >
                    {libelleSerie(t, s.serie)}
                  </a>
                  <span className="shrink-0 text-xs tabular-nums text-chalk-500">
                    {t("pages.skinsCalendar.seriesDetail", {
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
          <TitreSection>{t("pages.skinsCalendar.datesTitle")}</TitreSection>
          <div className="max-w-3xl space-y-3 leading-relaxed text-chalk-300">
            <p>
              {t("pages.skinsCalendar.datesPrecision", {
                jour: nombre.format(precision.jour),
                mois: nombre.format(precision.mois),
                annee: nombre.format(precision.annee),
              })}
            </p>
            {aVenir + futurs > 0 && (
              <p>{t("pages.skinsCalendar.datesSkipped", { aVenir: nombre.format(aVenir), futurs: nombre.format(futurs) })}</p>
            )}
            <p>{t("pages.skinsCalendar.datesOrigin")}</p>
            <p>
              <Link href="/tools/collection" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.skinsCalendar.collectionLink")} →
              </Link>
            </p>
          </div>
          <CreditWiki t={t} href={synchro.source} cle="pages.skinsCalendar.source" />
        </section>
      </div>
    </>
  );
}

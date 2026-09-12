import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { proprietesCarteSkin } from "@/components/carte-skin";
import { CreditWiki } from "@/components/credit-wiki";
import { GrilleSkins } from "@/components/grille-skins";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { EnTetePage, TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import {
  grouperParDate,
  libelleRarete,
  libelleSerie,
  lienSkin,
  lireSortie,
  statsSeries,
  type AnneeSkins,
} from "@/lib/catalogue-skins";
import { anneesCalendrier, donneesListeSkins, herosDuCatalogue, skinsSortis } from "@/lib/catalogue-skins-serveur";
import { synchro } from "@/lib/donnees";
import { listeNoms, moisAnnee } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Langue; annee: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return anneesCalendrier().map((a) => ({ annee: String(a) }));
}

function anneeDe(annee: string): AnneeSkins | null {
  const n = Number(annee);
  return grouperParDate(skinsSortis().filter((s) => lireSortie(s.sortie)?.annee === n), "chronologique")[0] ?? null;
}

/** Series et heros qui dominent l'annee, en chiffres. */
function faitsAnnee(a: AnneeSkins) {
  const skins = a.mois.flatMap((m) => m.skins);
  const parHeros = new Map<string, number>();
  for (const s of skins) parHeros.set(s.heros, (parHeros.get(s.heros) ?? 0) + 1);
  const parRarete = new Map<number, number>();
  for (const s of skins) parRarete.set(s.rarete, (parRarete.get(s.rarete) ?? 0) + 1);
  return {
    series: statsSeries(skins),
    heros: [...parHeros].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])),
    raretes: [...parRarete].sort((x, y) => y[0] - x[0]),
  };
}

const majuscule = (s: string, locale: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

function description(locale: Langue, a: AnneeSkins): string {
  const t = creerT(locale);
  const f = faitsAnnee(a);
  const heros = herosDuCatalogue();
  return t("pages.seo.calendarYear.description", {
    annee: a.annee,
    n: a.total,
    series: listeNoms(locale, f.series.slice(0, 3).map((s) => `${libelleSerie(t, s.serie)} (${s.total})`)) || "—",
    heros: f.heros[0] ? `${heros.get(f.heros[0][0])?.nom ?? f.heros[0][0]} (${f.heros[0][1]})` : "—",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, annee } = await params;
  const a = anneeDe(annee);
  if (!a) return {};
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.calendarYear.title", { annee: a.annee }),
    description: description(locale, a),
    chemin: `/skins/calendar/${a.annee}`,
    motsCles: [`MLBB skins ${a.annee}`, `Mobile Legends skins ${a.annee}`, "skin release date"],
  });
}

export default async function PageAnneeSkins({ params }: Params) {
  const { locale, annee } = await params;
  const a = anneeDe(annee);
  if (!a) notFound();

  const t = creerT(locale);
  const langueHtml = LOCALE_HTML[locale];
  const nombre = new Intl.NumberFormat(langueHtml);
  const heros = herosDuCatalogue();
  const annees = anneesCalendrier();
  const f = faitsAnnee(a);
  const i = annees.indexOf(a.annee);
  const [suivante, precedente] = [annees[i - 1], annees[i + 1]];
  const nomMois = (m: number) => majuscule(moisAnnee(locale, `${a.annee}-${String(m).padStart(2, "0")}-01`), langueHtml);
  const ancre = (m: number | null) => (m ? `m-${String(m).padStart(2, "0")}` : "m-inconnu");

  const faits = [
    f.series.length > 0 &&
      t("pages.skinsCalendar.year.factSeries", {
        liste: listeNoms(locale, f.series.slice(0, 5).map((s) => `${libelleSerie(t, s.serie)} (${s.total})`)),
      }),
    f.heros.length > 0 &&
      t("pages.skinsCalendar.year.factHeroes", {
        liste: listeNoms(locale, f.heros.slice(0, 3).map(([s, n]) => `${heros.get(s)?.nom ?? s} (${n})`)),
      }),
    t("pages.skinsCalendar.year.factRarities", {
      liste: listeNoms(locale, f.raretes.map(([r, n]) => `${libelleRarete(t, r)} (${n})`)),
    }),
  ].filter((x): x is string => !!x);

  const donneesStructurees = donneesListeSkins(locale, {
    nom: t("pages.skinsCalendar.year.title", { annee: a.annee }),
    description: description(locale, a),
    chemin: `/skins/calendar/${a.annee}`,
    elements: a.mois.flatMap((m) =>
      m.skins.map((s) => ({ nom: `${s.nom} (${heros.get(s.heros)?.nom ?? s.heros})`, chemin: lienSkin(s) })),
    ),
  });

  const navigation = (
    <nav aria-label={t("pages.skinsCalendar.year.navYears")} className="flex flex-wrap justify-between gap-3 text-sm">
      {precedente ? (
        <Link href={`/skins/calendar/${precedente}`} className="font-semibold text-gold-400 hover:text-gold-500">
          ← {precedente}
        </Link>
      ) : (
        <span />
      )}
      <Link href="/skins/calendar" className="text-chalk-300 hover:text-gold-400">
        {t("pages.skinsCalendar.crumb")}
      </Link>
      {suivante ? (
        <Link href={`/skins/calendar/${suivante}`} className="font-semibold text-gold-400 hover:text-gold-500">
          {suivante} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={t("pages.skinsCalendar.year.title", { annee: a.annee })}
        chapeau={t("pages.skinsCalendar.year.lead", { annee: a.annee, n: nombre.format(a.total) })}
        miettes={[
          { nom: t("pages.skinsCalendar.crumbSkins"), href: "/skins" },
          { nom: t("pages.skinsCalendar.crumb"), href: "/skins/calendar" },
          { nom: String(a.annee), freres: annees.map((x) => ({ nom: String(x), href: `/skins/calendar/${x}` })) },
        ]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        <section>
          <ul className="max-w-3xl list-disc space-y-2 pl-5 leading-relaxed text-chalk-300 marker:text-gold-400">
            {faits.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <nav aria-label={t("pages.skinsCalendar.year.navMonths")} className="mt-6">
            <ul className="flex flex-wrap gap-2">
              {a.mois.map((m) => (
                <li key={ancre(m.mois)}>
                  <a
                    href={`#${ancre(m.mois)}`}
                    className="bevel-sm inline-block border border-night-700 px-2.5 py-1 text-xs text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                  >
                    {m.mois ? nomMois(m.mois) : t("pages.skinsCalendar.unknownMonth")}{" "}
                    <span className="text-chalk-500">· {m.skins.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        {a.mois.map((m) => (
          <section key={ancre(m.mois)} id={ancre(m.mois)} className="scroll-mt-24">
            <TitreSection>
              {m.mois ? nomMois(m.mois) : t("pages.skinsCalendar.unknownMonth")}{" "}
              <span className="text-base font-normal text-chalk-500">
                · {t(m.skins.length === 1 ? "pages.skinsCalendar.nSkins1" : "pages.skinsCalendar.nSkins", {
                  n: nombre.format(m.skins.length),
                })}
              </span>
            </TitreSection>
            <GrilleSkins
              cartes={m.skins.map((s) => proprietesCarteSkin(s, heros.get(s.heros)?.nom ?? s.heros, t, langueHtml, nombre))}
            />
          </section>
        ))}

        {navigation}
        <CreditWiki t={t} href={synchro.source} cle="pages.skinsCalendar.source" />
      </div>
    </>
  );
}

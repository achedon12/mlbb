import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditWiki } from "@/components/credit-wiki";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { ContenuMois, ListeSources, moisTexte, nomHeros, nomMois, resumeMois } from "@/components/mois-evenements";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { lienSkin } from "@/lib/catalogue-skins";
import { anneesCalendrier, donneesListeSkins } from "@/lib/catalogue-skins-serveur";
import { synchro } from "@/lib/donnees";
import { MODES_AUTRES, statutMois, voisins } from "@/lib/evenements";
import { clesMois, dateReference, moisDe, sourcesDuMois } from "@/lib/evenements-serveur";
import { donneesLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Langue; mois: string }> };

export const dynamicParams = false;

/** Seuls les mois qui ont au moins un skin ont une page. */
export function generateStaticParams() {
  return clesMois().map((mois) => ({ mois }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, mois } = await params;
  const m = moisDe(mois);
  if (!m) return {};
  const t = creerT(locale);
  const anglais = nomMois("en", m.mois);
  return metaPage(locale, {
    titre: t("pages.evenements.mois.titre", { mois: moisTexte(locale, m.mois) }),
    description: t("pages.seo.evenementsMois.description", {
      mois: moisTexte(locale, m.mois),
      resume: resumeMois(t, locale, m).join(" "),
    }),
    chemin: `/events/${m.mois}`,
    motsCles: [`MLBB Starlight ${anglais}`, `MLBB events ${anglais}`, `Mobile Legends skins ${anglais}`, "MLBB Collector skin"],
  });
}

export default async function PageMoisEvenements({ params }: Params) {
  const { locale, mois } = await params;
  const m = moisDe(mois);
  if (!m) notFound();

  const t = creerT(locale);
  const cles = clesMois();
  const { precedent, suivant } = voisins(cles, m.mois);
  const statut = statutMois(m.mois, dateReference);
  const annee = m.mois.slice(0, 4);
  const titre = t("pages.evenements.mois.titre", { mois: moisTexte(locale, m.mois) });
  const resume = resumeMois(t, locale, m);
  const lien = "font-semibold text-or-400 transition-colors hover:text-or-500";
  const skins = [...m.starlight, ...m.collector, ...MODES_AUTRES.flatMap((k) => m.autres[k])];

  const donneesStructurees = donneesListeSkins(locale, {
    nom: titre,
    description: resume.join(" "),
    chemin: `/events/${m.mois}`,
    elements: skins.map((s) => ({
      nom: `${s.nom} (${nomHeros(s.heros)})`,
      chemin: s.ancre ? lienSkin(s) : `/heroes/${s.heros}/skins`,
    })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={titre}
        chapeau={resume.join(" ")}
        miettes={[
          { nom: t("pages.evenements.miette"), href: "/events" },
          {
            nom: nomMois(locale, m.mois),
            freres: cles
              .filter((c) => c.startsWith(annee))
              .reverse()
              .map((c) => ({ nom: nomMois(locale, c), href: `/events/${c}` })),
          },
        ]}
      >
        {statut !== "passe" && (
          <p className="mt-4">
            <span className="biseau-sm inline-block bg-or-500 px-2 py-0.5 text-xs font-semibold text-nuit-950">
              {t(`pages.evenements.statut.${statut}`)}
            </span>
          </p>
        )}
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {statut === "annonce" && (
          <div className="max-w-3xl space-y-2 text-craie-300">
            <p>{t("pages.evenements.mois.annonce")}</p>
            <ListeSources sources={sourcesDuMois(m.mois)} t={t} locale={locale} />
          </div>
        )}

        <ContenuMois m={m} t={t} locale={locale} niveau="page" />

        <nav
          aria-label={t("pages.evenements.mois.navMois")}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-nuit-800 pt-6 text-sm"
        >
          {precedent ? (
            <Link href={`/events/${precedent}`} rel="prev" className={lien}>
              ← {nomMois(locale, precedent)}
            </Link>
          ) : (
            <span />
          )}
          <Link href="/events" className="text-craie-300 transition-colors hover:text-or-400">
            {t("pages.evenements.mois.tousLesMois")}
          </Link>
          {suivant ? (
            <Link href={`/events/${suivant}`} rel="next" className={lien}>
              {nomMois(locale, suivant)} →
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <section className="space-y-3">
          <ListeSources sources={sourcesDuMois(m.mois)} t={t} locale={locale} />
          {anneesCalendrier().includes(Number(annee)) && (
            <p className="text-sm">
              <Link href={`/skins/calendar/${annee}`} className={lien}>
                {t("pages.evenements.mois.lienAnnee", { annee })} →
              </Link>
            </p>
          )}
          <CreditWiki t={t} href={synchro.source} cle="pages.evenements.source" />
        </section>
      </div>
    </>
  );
}

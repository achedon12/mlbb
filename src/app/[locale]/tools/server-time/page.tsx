import type { Metadata } from "next";
import { HorlogeServeur } from "@/components/horloge-serveur";
import Link from "@/components/lien";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { patchsDetail } from "@/lib/donnees";
import { donneesLd } from "@/lib/html";
import { DECALAGE_SERVEUR_MIN, HEURE_REMISE, SOURCES_HEURE, finsDeSaison } from "@/lib/heure-serveur";

type Params = { params: Promise<{ locale: Langue }> };

const CHEMIN = "/tools/server-time";

/** Fins de saison annoncees dans les notes de patch synchronisees ; le composant garde celle a venir. */
const FINS = finsDeSaison(Object.values(patchsDetail));

/**
 * Pays de reference des exemples de la FAQ, par langue : leur heure locale de
 * remise, ete comme hiver, se calcule a partir du fuseau du serveur.
 */
const FUSEAU_EXEMPLE: Record<Langue, string> = {
  fr: "Europe/Paris",
  en: "Europe/London",
  it: "Europe/Rome",
  es: "Europe/Madrid",
};

/** Heure « murale » du serveur convertie dans un fuseau, a une date donnee. */
function heureServeurEn(locale: Langue, heure: number, fuseau: string, mois = 0) {
  const instant = Date.UTC(2026, mois, 5, heure) - DECALAGE_SERVEUR_MIN * 60_000;
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: fuseau }).format(
    instant,
  );
}

const instantRendu = () => Date.now();

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.heureServeur.titre"),
    description: t("pages.seo.heureServeur.description", { utc: heureServeurEn(locale, HEURE_REMISE, "UTC") }),
    chemin: CHEMIN,
    motsCles: ["server time", "daily reset", "weekly reset", "reset time", "Starlight", "Mobile Legends", "MLBB"],
  });
}

export default async function PageHeureServeur({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const utc = heureServeurEn(locale, HEURE_REMISE, "UTC");
  const exemple = FUSEAU_EXEMPLE[locale];
  const annonce = FINS.at(-1);
  const donneesStructurees = donneesOutil(locale, {
    nom: t("pages.heureServeur.titre"),
    description: t("pages.seo.heureServeur.description", { utc }),
    chemin: CHEMIN,
    categorie: "UtilitiesApplication",
  });

  const regles = [
    { titre: t("pages.heureServeur.fuseauTitre"), texte: t("pages.heureServeur.fuseauTexte") },
    { titre: t("pages.heureServeur.quotidienneTitre"), texte: t("pages.heureServeur.quotidienneTexte", { utc }) },
    { titre: t("pages.heureServeur.hebdoTitre"), texte: t("pages.heureServeur.hebdoTexte", { utc }) },
    { titre: t("pages.heureServeur.starlightTitre"), texte: t("pages.heureServeur.starlightTexte", { utc }) },
    { titre: t("pages.heureServeur.saisonTitre"), texte: t("pages.heureServeur.saisonTexte") },
    {
      titre: t("pages.heureServeur.majTitre"),
      texte: t("pages.heureServeur.majTexte", {
        debut: heureServeurEn(locale, 18, "UTC"),
        fin: heureServeurEn(locale, 22, "UTC"),
      }),
    },
  ];

  const faq = [
    {
      q: t("pages.heureServeur.faq1q"),
      r: t("pages.heureServeur.faq1r", {
        utc,
        ete: heureServeurEn(locale, HEURE_REMISE, exemple, 6),
        hiver: heureServeurEn(locale, HEURE_REMISE, exemple, 0),
        manille: heureServeurEn(locale, HEURE_REMISE, "Asia/Manila"),
      }),
    },
    { q: t("pages.heureServeur.faq2q"), r: t("pages.heureServeur.faq2r") },
    { q: t("pages.heureServeur.faq3q"), r: t("pages.heureServeur.faq3r") },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage titre={t("pages.heureServeur.titre")} chapeau={t("pages.heureServeur.chapeau", { utc })} />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <HorlogeServeur reference={instantRendu()} fins={FINS} />

        <section aria-labelledby="regles-titre">
          <h2 id="regles-titre" className="font-titre text-2xl font-bold text-craie-100">
            {t("pages.heureServeur.reglesTitre")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {regles.map((r) => (
              <div key={r.titre} className="biseau-sm border border-nuit-700/70 bg-nuit-900/60 p-4">
                <dt className="font-titre font-bold text-or-400">{r.titre}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-craie-300">{r.texte}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="faq-titre">
          <h2 id="faq-titre" className="font-titre text-2xl font-bold text-craie-100">
            {t("pages.heureServeur.faqTitre")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <div className="mt-5 space-y-6">
            {faq.map((e) => (
              <div key={e.q}>
                <h3 className="font-titre text-lg font-bold text-craie-100">{e.q}</h3>
                <p className="mt-1 leading-relaxed text-craie-300">{e.r}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm">
            <Link href="/ranks" className="font-semibold text-or-400 transition-colors hover:text-or-500">
              {t("pages.heureServeur.lienRangs")} →
            </Link>
          </p>
        </section>

        <section aria-labelledby="sources-titre" className="border-t border-nuit-800 pt-6 text-sm text-craie-500">
          <h2 id="sources-titre" className="font-semibold text-craie-300">{t("pages.heureServeur.sourcesTitre")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <a href={SOURCES_HEURE.serveur} rel="noopener" className="underline transition-colors hover:text-or-400">
                {t("pages.heureServeur.sourceServeur")}
              </a>
            </li>
            <li>
              <a href={SOURCES_HEURE.starlight} rel="noopener" className="underline transition-colors hover:text-or-400">
                {t("pages.heureServeur.sourceStarlight")}
              </a>
            </li>
            {annonce && (
              <li>
                <a href={annonce.lien} rel="noopener" className="underline transition-colors hover:text-or-400">
                  {t("pages.heureServeur.sourcePatch", { v: annonce.patch, n: annonce.saison })}
                </a>
              </li>
            )}
          </ul>
        </section>
      </div>
    </>
  );
}

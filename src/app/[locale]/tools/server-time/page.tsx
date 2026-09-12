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
    titre: t("pages.seo.serverTime.title"),
    description: t("pages.seo.serverTime.description", { utc: heureServeurEn(locale, HEURE_REMISE, "UTC") }),
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
    nom: t("pages.serverTime.title"),
    description: t("pages.seo.serverTime.description", { utc }),
    chemin: CHEMIN,
    categorie: "UtilitiesApplication",
  });

  const regles = [
    { titre: t("pages.serverTime.timezoneTitle"), texte: t("pages.serverTime.timezoneText") },
    { titre: t("pages.serverTime.dailyTitle"), texte: t("pages.serverTime.dailyText", { utc }) },
    { titre: t("pages.serverTime.weeklyTitle"), texte: t("pages.serverTime.weeklyText", { utc }) },
    { titre: t("pages.serverTime.starlightTitle"), texte: t("pages.serverTime.starlightText", { utc }) },
    { titre: t("pages.serverTime.seasonTitle"), texte: t("pages.serverTime.seasonText") },
    {
      titre: t("pages.serverTime.updateTitle"),
      texte: t("pages.serverTime.updateText", {
        debut: heureServeurEn(locale, 18, "UTC"),
        fin: heureServeurEn(locale, 22, "UTC"),
      }),
    },
  ];

  const faq = [
    {
      q: t("pages.serverTime.faq1q"),
      r: t("pages.serverTime.faq1a", {
        utc,
        ete: heureServeurEn(locale, HEURE_REMISE, exemple, 6),
        hiver: heureServeurEn(locale, HEURE_REMISE, exemple, 0),
        manille: heureServeurEn(locale, HEURE_REMISE, "Asia/Manila"),
      }),
    },
    { q: t("pages.serverTime.faq2q"), r: t("pages.serverTime.faq2a") },
    { q: t("pages.serverTime.faq3q"), r: t("pages.serverTime.faq3a") },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage titre={t("pages.serverTime.title")} chapeau={t("pages.serverTime.lead", { utc })} />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <HorlogeServeur reference={instantRendu()} fins={FINS} />

        <section aria-labelledby="regles-titre">
          <h2 id="regles-titre" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.serverTime.rulesTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {regles.map((r) => (
              <div key={r.titre} className="bevel-sm border border-night-700/70 bg-night-900/60 p-4">
                <dt className="font-heading font-bold text-gold-400">{r.titre}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-chalk-300">{r.texte}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="faq-titre">
          <h2 id="faq-titre" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.serverTime.faqTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-5 space-y-6">
            {faq.map((e) => (
              <div key={e.q}>
                <h3 className="font-heading text-lg font-bold text-chalk-100">{e.q}</h3>
                <p className="mt-1 leading-relaxed text-chalk-300">{e.r}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm">
            <Link href="/ranks" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
              {t("pages.serverTime.ranksLink")} →
            </Link>
          </p>
        </section>

        <section aria-labelledby="sources-titre" className="border-t border-night-800 pt-6 text-sm text-chalk-500">
          <h2 id="sources-titre" className="font-semibold text-chalk-300">{t("pages.serverTime.sourcesTitle")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <a href={SOURCES_HEURE.serveur} rel="noopener" className="underline transition-colors hover:text-gold-400">
                {t("pages.serverTime.sourceServer")}
              </a>
            </li>
            <li>
              <a href={SOURCES_HEURE.starlight} rel="noopener" className="underline transition-colors hover:text-gold-400">
                {t("pages.serverTime.sourceStarlight")}
              </a>
            </li>
            {annonce && (
              <li>
                <a href={annonce.lien} rel="noopener" className="underline transition-colors hover:text-gold-400">
                  {t("pages.serverTime.sourcePatch", { v: annonce.patch, n: annonce.saison })}
                </a>
              </li>
            )}
          </ul>
        </section>
      </div>
    </>
  );
}

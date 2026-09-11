import type { Metadata } from "next";
import Link from "@/components/lien";
import { LigneFraicheur } from "@/components/fraicheur";
import { TableauStatistiques } from "@/components/tableau-statistiques";
import { EnTetePage } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT, type T } from "@/i18n/traductions";
import { herosParSlug } from "@/lib/donnees";
import { tendancesDe } from "@/lib/evolution";
import { dateLongue, dateMesure, patchActuel, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import type { RangMesure } from "@/lib/rangs-mesure";
import { site } from "@/lib/site";
import { cheminStatistiques, coderLigne, echelonnerCourbe, type LigneStat } from "@/lib/tableau-statistiques";
import {
  decalerDate,
  decrireEcart,
  formaterEcart,
  mouvementsSemaine,
  SEUIL_NOTABLE,
  variationSemaine,
  type Mouvement,
} from "@/lib/tendances";
import { classementDuRang, RANGS_CLASSES } from "@/lib/tier-list";
import { cn } from "@/lib/utils";

/**
 * Statistiques des heros d'une tranche de rang : le tableau complet des taux
 * (victoire, ban, selection), leur ecart sur sept jours et leur courbe sur
 * trente. Comme la tier list, chaque rang a sa propre adresse ; la page
 * principale montre tous rangs confondus.
 */

const estMesure = (v: number | null): v is number => typeof v === "number";

const lignesParRang = new Map<RangMesure, LigneStat[]>();

/** Lignes du tableau, dans l'ordre du classement ; memorisees, la page et ses metadonnees les partagent. */
function lignesDuRang(rang: RangMesure): LigneStat[] {
  const deja = lignesParRang.get(rang);
  if (deja) return deja;
  const lignes = classementDuRang(rang).map((e): LigneStat => {
    const serie = tendancesDe(e.heros.slug)[rang];
    const variation = variationSemaine(serie);
    const mesures = serie?.victoire.filter(estMesure) ?? [];
    const courbe = serie ? echelonnerCourbe(serie.victoire) : null;
    return {
      slug: e.heros.slug,
      nom: e.heros.nom,
      roles: e.heros.roles,
      lanes: e.heros.lanes,
      palier: e.palier,
      score: e.score,
      victoire: e.victoire,
      ban: e.ban,
      selection: e.selection,
      // Champs absents plutot que nuls : 132 lignes partent au navigateur.
      ...(variation ? { ecart: variation.ecart, jours: variation.jours } : {}),
      ...(e.faibleEchantillon ? { faible: true as const } : {}),
      ...(courbe ? { courbe, debut: mesures[0], fin: mesures.at(-1) } : {}),
    };
  });
  lignesParRang.set(rang, lignes);
  return lignes;
}

const premierSelon = (lignes: LigneStat[], cle: "victoire" | "ban" | "selection") =>
  lignes.reduce((a, b) => (b[cle] > a[cle] ? b : a));

/** Jours couverts par les courbes du rang, pour la couverture temporelle du jeu de donnees. */
function periode(rang: RangMesure, lignes: LigneStat[]): string | null {
  let debut: string | null = null;
  let fin: string | null = null;
  for (const l of lignes) {
    const s = tendancesDe(l.slug)[rang];
    if (!s?.victoire.length) continue;
    const dernier = decalerDate(s.debut, s.victoire.length - 1);
    if (!debut || s.debut < debut) debut = s.debut;
    if (!fin || dernier > fin) fin = dernier;
  }
  return debut && fin ? `${debut}/${fin}` : null;
}

function variables(locale: Langue, t: T, rang: RangMesure, lignes: LigneStat[]) {
  const meilleur = premierSelon(lignes, "victoire");
  return {
    v: patchActuel?.version ?? "",
    rang: t(`rangsMesure.${rang}`),
    n: lignes.length,
    nom: meilleur.nom,
    taux: pourcentage(locale, meilleur.victoire),
    date: dateLongue(locale),
  };
}

export function metaStatistiques(locale: Langue, rang: RangMesure): Metadata {
  const t = creerT(locale);
  const tous = rang === "all";
  const v = variables(locale, t, rang, lignesDuRang(rang));
  return metaPage(locale, {
    titre: t(tous ? "pages.statistics.metaTitre" : "pages.statistics.metaTitreRang", v),
    description: t(tous ? "pages.statistics.metaDescription" : "pages.statistics.metaDescriptionRang", v),
    chemin: cheminStatistiques(rang),
  });
}

export function Statistiques({ locale, rang }: { locale: Langue; rang: RangMesure }) {
  const t = creerT(locale);
  const tous = rang === "all";
  const lignes = lignesDuRang(rang);
  const nomRang = t(`rangsMesure.${rang}`);
  const titre = tous ? t("pages.statistics.titre") : t("pages.statistics.titreRang", { rang: nomRang });
  const victoire = premierSelon(lignes, "victoire");
  const ban = premierSelon(lignes, "ban");
  const pick = premierSelon(lignes, "selection");
  const { hausses, baisses } = mouvementsSemaine(
    lignes.map((l) => ({ slug: l.slug, serie: tendancesDe(l.slug)[rang] })),
    5,
  );
  const seuil = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(SEUIL_NOTABLE);
  const couverture = periode(rang, lignes);

  // Jeu de donnees plutot que liste : c'est ce que la page publie, et Google
  // Dataset Search l'indexe. La liste ordonnee des heros existe deja sur la
  // tier list du meme rang.
  const donnees = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: t("pages.statistics.ldNom", { rang: nomRang }),
    description: t(tous ? "pages.statistics.metaDescription" : "pages.statistics.metaDescriptionRang", variables(locale, t, rang, lignes)),
    url: `${site.url}/${locale}${cheminStatistiques(rang)}`,
    inLanguage: LOCALE_HTML[locale],
    isAccessibleForFree: true,
    dateModified: dateMesure,
    ...(patchActuel ? { version: patchActuel.version } : {}),
    ...(couverture ? { temporalCoverage: couverture } : {}),
    keywords: ["Mobile Legends: Bang Bang", "MLBB", nomRang],
    creator: { "@type": "Organization", name: site.nom, url: site.url },
    isPartOf: { "@type": "WebSite", name: site.nom, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: { "@type": "Organization", name: "Moonton" } },
    variableMeasured: (["victoire", "ban", "selection"] as const).map((c) => ({
      "@type": "PropertyValue",
      name: t(`pages.statisticsTable.${c}`),
      unitText: "%",
    })),
    // L'API publique ne sert que le classement tous rangs.
    ...(tous
      ? {
          distribution: [
            { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${site.url}/api/v1/classement` },
          ],
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }} />
      <EnTetePage
        titre={titre}
        chapeau={tous ? t("pages.statistics.chapeau") : t("pages.statistics.chapeauRang", { rang: nomRang })}
        miettes={
          tous
            ? undefined
            : [
                { nom: t("pages.statistics.titre"), href: "/statistics" },
                {
                  nom: nomRang,
                  freres: RANGS_CLASSES.map((r) => ({ nom: t(`rangsMesure.${r}`), href: cheminStatistiques(r) })),
                },
              ]
        }
      >
        <LigneFraicheur langue={locale} avant={t("pages.statistics.mesures", { n: lignes.length })} className="mt-6" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Phrase de donnees : ce que les resultats de recherche reprennent en extrait. */}
        <p className="mb-8 max-w-3xl leading-relaxed text-craie-300">
          {t("pages.statistics.resume", {
            contexte: tous ? t("pages.statistics.contexteTous") : t("pages.statistics.contexteRang", { rang: nomRang }),
            victoire: victoire.nom,
            tauxVictoire: pourcentage(locale, victoire.victoire),
            ban: ban.nom,
            tauxBan: pourcentage(locale, ban.ban),
            pick: pick.nom,
            tauxPick: pourcentage(locale, pick.selection),
          })}
        </p>

        <TableauStatistiques compactes={lignes.map(coderLigne)} rang={rang} rangs={RANGS_CLASSES} />

        <section className="mt-12">
          <div className="grid gap-6 md:grid-cols-2">
            <Mouvements locale={locale} t={t} titre={t("pages.statistics.hausses")} liste={hausses} />
            <Mouvements locale={locale} t={t} titre={t("pages.statistics.baisses")} liste={baisses} />
          </div>
          <p className="mt-3 text-xs text-craie-500">{t("pages.statistics.mouvementsIntro", { seuil })}</p>
        </section>

        <details className="biseau mt-10 border border-nuit-700/70 bg-nuit-900/60 p-5">
          <summary className="cursor-pointer font-titre font-bold text-or-400">{t("pages.statistics.lecture.titre")}</summary>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-craie-300">
            {(["victoire", "ban", "selection", "tendance", "courbe", "palier", "faible"] as const).map((c) => (
              <li key={c}>{t(`pages.statistics.lecture.${c}`, { seuil })}</li>
            ))}
          </ul>
        </details>

        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            href={tous ? "/tier-list" : `/tier-list/${rang}`}
            className="font-semibold text-or-400 underline-offset-4 hover:underline"
          >
            {tous ? t("pages.tierList.titre") : t("pages.tierList.titreRang", { rang: nomRang })} →
          </Link>
          <span className="text-craie-500">
            {t("pages.statistics.api")}{" "}
            <Link href="/api-doc" className="font-semibold text-or-400 underline-offset-4 hover:underline">
              {t("pages.statistics.apiLien")}
            </Link>
          </span>
        </p>
      </div>
    </>
  );
}

function Mouvements({ locale, t, titre, liste }: { locale: Langue; t: T; titre: string; liste: Mouvement[] }) {
  return (
    <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-5">
      <h2 className="font-titre text-lg font-bold text-craie-100">{titre}</h2>
      {liste.length === 0 ? (
        <p className="mt-3 text-sm text-craie-500">{t("pages.statistics.aucunMouvement")}</p>
      ) : (
        <ol className="mt-3 space-y-1.5 text-sm">
          {liste.map(({ slug, variation }) => (
            <li key={slug} className="flex items-baseline justify-between gap-3">
              <Link href={`/heroes/${slug}`} className="font-medium text-craie-100 hover:text-or-400">
                {herosParSlug.get(slug)?.nom ?? slug}
              </Link>
              <span className="tabular-nums text-craie-500">
                <span
                  aria-hidden
                  className={cn("font-semibold", variation.ecart > 0 ? "text-emerald-400" : "text-sang-500")}
                >
                  {formaterEcart(variation.ecart, locale)}
                </span>
                <span className="sr-only">{decrireEcart(t, locale, variation.ecart, variation.jours)}</span>
                {" · "}
                {pourcentage(locale, variation.actuel)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

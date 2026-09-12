import type { Metadata } from "next";
import Link from "@/components/lien";
import type { Miette } from "@/components/fil-ariane";
import { LigneFraicheur } from "@/components/fraicheur";
import { BadgePalier, EnTetePage } from "@/components/ui";
import { tendancesDe } from "@/lib/evolution";
import {
  cheminFiltre,
  cheminRole,
  filtrerClassement,
  FILTRES_LANE,
  FILTRES_ROLE,
  iconeHabituelle,
  type FiltreTier,
} from "@/lib/filtres-tier-list";
import { dateLongue, dateMesure, listeNoms, moisAnnee, patchActuel, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { classementDuRang, ORDRE_PALIERS, RANGS_CLASSES, type EntreeClassee } from "@/lib/tier-list";
import type { RangMesure } from "@/lib/rangs-mesure";
import { decrireEcart, estNotable, SEUIL_NOTABLE, variationSemaine } from "@/lib/tendances";
import type { Langue } from "@/i18n/config";
import { creerT, type T } from "@/i18n/traductions";
import { donneesListeHeros, metaPage } from "@/i18n/seo";
import { tierNotes as tierNotesDe } from "@/lib/donnees";
import { LignesTier, type LigneTier } from "./lignes-tier";
import { RangeesTier, type RangeeTier } from "./rangees-tier";

/**
 * Tier list d'une tranche de rang, d'une lane ou d'un role. La page principale
 * montre tous rangs confondus ; chaque rang, chaque lane et chaque role a sa
 * propre adresse, pour etre partage et reference (« tier list mythique »,
 * « best jungle heroes »). Lanes et roles portent sur tous les rangs : croiser
 * les deux multiplierait les pages sans rien apprendre de plus.
 */
const cheminDu = (rang: RangMesure) => (rang === "all" ? "/tier-list" : `/tier-list/${rang}`);
const cheminDe = (rang: RangMesure, filtre: FiltreTier | null) => (filtre ? cheminFiltre(filtre) : cheminDu(rang));

/** Classement de la page : celui du rang, restreint a la lane ou au role. */
const classementDe = (rang: RangMesure, filtre: FiltreTier | null) => filtrerClassement(classementDuRang(rang), filtre);

/** Nom court d'une lane ou d'un role, celui des puces et du fil d'Ariane. */
const nomFiltre = (t: T, f: FiltreTier) => (f.type === "lane" ? t(`lanes.${f.valeur}`) : t(`roles.${f.valeur}`));

/**
 * Formes employees par les titres et les phrases : la lane telle que les
 * joueurs la cherchent (« gold lane » plutot que « Or »), le role au pluriel.
 */
function reperesFiltre(t: T, f: FiltreTier): Record<string, string> {
  return f.type === "lane"
    ? { lane: t(`pages.tierList.laneSeo.${f.valeur}`) }
    : { role: t(`roles.${f.valeur}`), pluriel: t(`pages.tierList.rolePlural.${f.valeur}`) };
}

/**
 * Titre calque sur les recherches recurrentes (« mlbb tier list septembre
 * 2026 », « best jungle heroes mlbb ») : mois du releve et patch en cours,
 * tires des donnees.
 */
export function metaTierList(locale: Langue, rang: RangMesure, filtre: FiltreTier | null = null): Metadata {
  const t = creerT(locale);
  const reperes = { mois: moisAnnee(locale), v: patchActuel.version, rang: t(`measuredRanks.${rang}`) };
  const titre = filtre
    ? t(filtre.type === "lane" ? "pages.seo.tierLane.title" : "pages.seo.tierRole.title", {
        ...reperes,
        ...reperesFiltre(t, filtre),
      })
    : rang === "all"
      ? t("pages.seo.tierList.title", reperes)
      : t("pages.seo.tierList.titleRank", reperes);
  return metaPage(locale, {
    titre,
    description: descriptionTierList(locale, rang, filtre),
    partage: rang === "all" && !filtre ? t("pages.tierList.ogDescription") : undefined,
    chemin: cheminDe(rang, filtre),
  });
}

/** Phrase de donnees : les trois premiers, le taux du premier, la date et le patch du releve. */
function descriptionTierList(locale: Langue, rang: RangMesure, filtre: FiltreTier | null): string {
  const t = creerT(locale);
  const classement = classementDe(rang, filtre);
  const nomRang = t(`measuredRanks.${rang}`);
  const premier = classement[0];
  if (!premier) {
    if (filtre) return chapeauFiltre(t, filtre, 0);
    return rang === "all"
      ? t("pages.tierList.metaDescription")
      : t("pages.tierList.metaDescriptionRank", { rang: nomRang });
  }
  const valeurs = {
    top: listeNoms(locale, classement.slice(0, 3).map((e) => e.hero.name)),
    premier: premier.hero.name,
    victoire: pourcentage(locale, premier.winRate),
    n: classement.length,
    date: dateLongue(locale),
    v: patchActuel.version,
    rang: nomRang,
  };
  if (filtre) {
    return t(filtre.type === "lane" ? "pages.seo.tierLane.description" : "pages.seo.tierRole.description", {
      ...valeurs,
      ...reperesFiltre(t, filtre),
    });
  }
  return rang === "all"
    ? t("pages.seo.tierList.description", valeurs)
    : t("pages.seo.tierList.descriptionRank", valeurs);
}

function chapeauFiltre(t: T, f: FiltreTier, n: number): string {
  return t(f.type === "lane" ? "pages.tierList.leadLane" : "pages.tierList.leadRole", {
    ...reperesFiltre(t, f),
    n,
  });
}

export function TierList({
  locale,
  rang,
  filtre = null,
}: {
  locale: Langue;
  rang: RangMesure;
  /** Lane ou role ; le classement porte alors sur tous les rangs. */
  filtre?: FiltreTier | null;
}) {
  const t = creerT(locale);
  const notes = tierNotesDe(locale);
  const classement = classementDe(rang, filtre);
  const nomRang = t(`measuredRanks.${rang}`);
  const chemin = cheminDe(rang, filtre);
  const titre = filtre
    ? t(filtre.type === "lane" ? "pages.tierList.titleLane" : "pages.tierList.titleRole", reperesFiltre(t, filtre))
    : rang === "all"
      ? t("pages.tierList.title")
      : t("pages.tierList.titleRank", { rang: nomRang });
  const chapeau = filtre
    ? chapeauFiltre(t, filtre, classement.length)
    : rang === "all"
      ? t("pages.tierList.lead")
      : t("pages.tierList.leadRank", { rang: nomRang });
  const pourcent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const taux = (v: number) => `${pourcent.format(v)} %`;

  // Evolution du taux de victoire sur sept jours, dans le rang de la page ;
  // rien quand la serie manque ou que l'ecart se confond avec l'arrondi.
  const tendance = (slug: string) => {
    const v = variationSemaine(tendancesDe(slug)[rang]);
    if (!estNotable(v)) return null;
    return {
      hausse: v.ecart > 0,
      texte: pourcent.format(Math.abs(v.ecart)),
      description: decrireEcart(t, locale, v.ecart, v.jours),
    };
  };

  // Une ligne compacte par heros : les champs vides ne sont pas envoyes.
  const ligne = (e: EntreeClassee): LigneTier => {
    const evolution = tendance(e.hero.slug);
    const note = notes[e.hero.slug] ?? e.comment;
    const icone = e.hero.images.icon ?? e.hero.images.portrait;
    return {
      slug: e.hero.slug,
      nom: e.hero.name,
      ...(icone === iconeHabituelle(e.hero.slug) ? {} : { icone }),
      lanes: e.hero.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—",
      victoire: taux(e.winRate),
      ban: taux(e.banRate),
      pick: taux(e.pickRate),
      ...(evolution ? { tendance: evolution } : {}),
      ...(e.lowSample ? { faible: true } : {}),
      ...(note ? { note } : {}),
    };
  };
  const libelles = {
    victoire: t("pages.tierList.win"),
    ban: t("pages.tierList.ban"),
    pick: t("pages.tierList.pick"),
    tropPeu: t("pages.tierList.tooFew"),
  };

  // Tout le classement de la page, dans son ordre, avec la date du releve.
  const donneesStructurees = donneesListeHeros(locale, {
    nom: titre,
    description: descriptionTierList(locale, rang, filtre),
    chemin,
    heros: classement.map((e) => ({ nom: e.hero.name, slug: e.hero.slug })),
    modifie: dateMesure,
    classe: true,
  });

  const miettes: Miette[] | undefined = filtre
    ? [
        { nom: t("pages.tierList.title"), href: "/tier-list" },
        {
          nom: nomFiltre(t, filtre),
          freres: (filtre.type === "lane" ? FILTRES_LANE : FILTRES_ROLE).map((f) => ({
            nom: nomFiltre(t, f),
            href: cheminFiltre(f),
          })),
        },
      ]
    : rang === "all"
      ? undefined
      : [
          { nom: t("pages.tierList.title"), href: "/tier-list" },
          {
            nom: nomRang,
            freres: RANGS_CLASSES.map((r) => ({ nom: t(`measuredRanks.${r}`), href: cheminDu(r) })),
          },
        ];

  // Trois entrees vers les autres listes : par rang, par lane, par role.
  const memeFiltre = (f: FiltreTier) => filtre?.type === f.type && filtre.valeur === f.valeur;
  const rangees: RangeeTier[] = [
    {
      libelle: t("pages.tierList.byRank"),
      liens: RANGS_CLASSES.map((r) => ({ href: cheminDu(r), nom: t(`measuredRanks.${r}`), actif: !filtre && r === rang })),
    },
    {
      libelle: t("pages.tierList.byLane"),
      liens: FILTRES_LANE.map((f) => ({ href: cheminFiltre(f), nom: nomFiltre(t, f), actif: memeFiltre(f) })),
    },
    {
      libelle: t("pages.tierList.byRole"),
      liens: FILTRES_ROLE.map((f) => ({ href: cheminFiltre(f), nom: nomFiltre(t, f), actif: memeFiltre(f) })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <EnTetePage titre={titre} chapeau={chapeau} miettes={miettes}>
        <LigneFraicheur
          langue={locale}
          avant={t("pages.freshness.heroesRanked", { n: classement.length })}
          className="mt-6"
        />
      </EnTetePage>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 space-y-3">
          <RangeesTier rangees={rangees} />
          {filtre && (
            <p className="text-sm leading-relaxed text-chalk-500">
              {t("pages.tierList.filterNote")}
              {filtre.type === "role" && (
                <>
                  {" "}
                  <Link href={cheminRole(filtre.valeur)} className="font-semibold text-gold-400 hover:text-gold-500">
                    {t("pages.tierList.seeRole", reperesFiltre(t, filtre))} →
                  </Link>
                </>
              )}
            </p>
          )}
        </div>

        {/* Le lecteur doit pouvoir contester le classement : on montre la regle. */}
        <p className="mb-6 text-sm">
          <Link href={rang === "all" ? "/statistics" : `/statistics/${rang}`} className="font-semibold text-gold-400 hover:text-gold-500">
            {t("pages.statistics.fromTierListLink")} →
          </Link>
        </p>
        <details className="bevel mb-10 border border-night-700/70 bg-night-900/60 p-5">
          <summary className="cursor-pointer font-heading font-bold text-gold-400">
            {t("pages.tierList.howCalculated")}
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-chalk-300">
            <p>
              {t("pages.tierList.scorePre")}<strong className="text-chalk-100">{t("pages.tierList.scoreBold")}</strong>.
            </p>
            <p>{t("pages.tierList.p2")}</p>
            <p>
              {t("pages.tierList.p3pre")}
              <span className="text-gold-400">{t("pages.tierList.asterisk")}</span>{t("pages.tierList.p3post")}
            </p>
            <p>{t("pages.tierList.trends", { seuil: pourcent.format(SEUIL_NOTABLE) })}</p>
          </div>
        </details>

        <div className="space-y-10">
          {ORDRE_PALIERS.map((palier) => {
            const entrees = classement.filter((e) => e.tier === palier);
            if (entrees.length === 0) return null;

            return (
              <section key={palier}>
                <div className="flex items-center gap-4">
                  <BadgePalier palier={palier} />
                  <div>
                    <h2 className="font-heading text-xl font-bold text-chalk-100">
                      {t("pages.tierList.tier", { p: palier })}
                      <span className="ml-2 text-sm font-medium text-chalk-500">{entrees.length}</span>
                    </h2>
                    <p className="text-sm text-chalk-500">{t(`pages.tierList.legend.${palier}`)}</p>
                  </div>
                </div>

                <LignesTier lignes={entrees.map(ligne)} libelles={libelles} />
              </section>
            );
          })}
        </div>

        <p className="mt-14 border-t border-night-800 pt-6 text-sm leading-relaxed text-chalk-500">
          {t("pages.tierList.conclusion")}
        </p>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { classesPuce } from "@/components/puce";
import { BadgePalier, EnTetePage } from "@/components/ui";
import { tendancesDe } from "@/lib/evolution";
import { classementDuRang, mesureLe, ORDRE_PALIERS, RANGS_CLASSES } from "@/lib/tier-list";
import type { RangMesure } from "@/lib/rangs-mesure";
import { decrireEcart, estNotable, SEUIL_NOTABLE, variationSemaine } from "@/lib/tendances";
import type { Langue } from "@/i18n/config";
import { LOCALE_HTML } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { tierNotes as tierNotesDe } from "@/lib/donnees";
import { cn, formaterDate } from "@/lib/utils";

/**
 * Tier list d'une tranche de rang. La page principale montre tous rangs
 * confondus ; chaque rang a sa propre adresse, pour etre partage et reference
 * (« tier list mythique »).
 */
const cheminDu = (rang: RangMesure) => (rang === "all" ? "/tier-list" : `/tier-list/${rang}`);

export function metaTierList(locale: Langue, rang: RangMesure): Metadata {
  const t = creerT(locale);
  if (rang === "all") {
    return metaPage(locale, {
      titre: t("pages.tierList.metaTitre"),
      description: t("pages.tierList.metaDescription"),
      partage: t("pages.tierList.ogDescription"),
      chemin: cheminDu(rang),
    });
  }
  const nomRang = t(`rangsMesure.${rang}`);
  return metaPage(locale, {
    titre: t("pages.tierList.metaTitreRang", { rang: nomRang }),
    description: t("pages.tierList.metaDescriptionRang", { rang: nomRang }),
    chemin: cheminDu(rang),
  });
}

export function TierList({ locale, rang }: { locale: Langue; rang: RangMesure }) {
  const t = creerT(locale);
  const notes = tierNotesDe(locale);
  const classement = classementDuRang(rang);
  const nomRang = t(`rangsMesure.${rang}`);
  const titre = rang === "all" ? t("pages.tierList.titre") : t("pages.tierList.titreRang", { rang: nomRang });
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

  return (
    <>
      <EnTetePage
        titre={titre}
        chapeau={rang === "all" ? t("pages.tierList.chapeau") : t("pages.tierList.chapeauRang", { rang: nomRang })}
        miettes={
          rang === "all"
            ? undefined
            : [
                { nom: t("pages.tierList.titre"), href: "/tier-list" },
                {
                  nom: nomRang,
                  freres: RANGS_CLASSES.map((r) => ({ nom: t(`rangsMesure.${r}`), href: cheminDu(r) })),
                },
              ]
        }
      >
        <p className="mt-6 text-sm text-craie-500">
          {t("pages.tierList.mesures", { n: classement.length })}{" "}
          <time dateTime={mesureLe}>{formaterDate(mesureLe, LOCALE_HTML[locale])}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <nav aria-label={t("pages.tierList.parRang")} className="mb-8 flex flex-wrap items-center gap-2">
          <span aria-hidden className="mr-1 text-xs uppercase tracking-wide text-craie-500">
            {t("pages.tierList.parRang")}
          </span>
          {RANGS_CLASSES.map((r) => (
            <Link
              key={r}
              href={cheminDu(r)}
              aria-current={r === rang ? "page" : undefined}
              className={classesPuce(r === rang)}
            >
              {t(`rangsMesure.${r}`)}
            </Link>
          ))}
        </nav>

        {/* Le lecteur doit pouvoir contester le classement : on montre la regle. */}
        <details className="biseau mb-10 border border-nuit-700/70 bg-nuit-900/60 p-5">
          <summary className="cursor-pointer font-titre font-bold text-or-400">
            {t("pages.tierList.commentCalcule")}
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-craie-300">
            <p>
              {t("pages.tierList.scorePre")}<strong className="text-craie-100">{t("pages.tierList.scoreBold")}</strong>.
            </p>
            <p>{t("pages.tierList.p2")}</p>
            <p>
              {t("pages.tierList.p3pre")}
              <span className="text-or-400">{t("pages.tierList.asterisque")}</span>{t("pages.tierList.p3post")}
            </p>
            <p>{t("pages.tierList.tendances", { seuil: pourcent.format(SEUIL_NOTABLE) })}</p>
          </div>
        </details>

        <div className="space-y-10">
          {ORDRE_PALIERS.map((palier) => {
            const entrees = classement.filter((e) => e.palier === palier);
            if (entrees.length === 0) return null;

            return (
              <section key={palier}>
                <div className="flex items-center gap-4">
                  <BadgePalier palier={palier} />
                  <div>
                    <h2 className="font-titre text-xl font-bold text-craie-100">
                      {t("pages.tierList.palier", { p: palier })}
                      <span className="ml-2 text-sm font-medium text-craie-500">{entrees.length}</span>
                    </h2>
                    <p className="text-sm text-craie-500">{t(`pages.tierList.legende.${palier}`)}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {entrees.map((e) => (
                    <li key={e.heros.slug} className="hors-ecran">
                      <Link
                        href={`/heroes/${e.heros.slug}`}
                        className="biseau-sm group flex flex-wrap items-center gap-x-3 gap-y-2 border border-nuit-700/70 bg-nuit-900/60 p-2.5 transition-colors hover:border-or-500/60 sm:flex-nowrap"
                      >
                        <PortraitHeros
                          source={e.heros.visuels.icone ?? e.heros.visuels.portrait}
                          nom={e.heros.nom}
                          taille="icone"
                        />

                        <div className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                          <span className="font-titre font-bold text-craie-100 transition-colors group-hover:text-or-400">
                            {e.heros.nom}
                          </span>
                          {e.faibleEchantillon && (
                            <span className="ml-1 text-or-400" title={t("pages.tierList.tropPeu")}>
                              *
                            </span>
                          )}
                          <span className="block text-[0.7rem] uppercase tracking-wide text-craie-500">
                            {e.heros.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}
                          </span>
                        </div>

                        <dl className="flex shrink-0 gap-3 text-xs tabular-nums sm:gap-4">
                          <Taux
                            libelle={t("pages.tierList.victoire")}
                            valeur={taux(e.victoire)}
                            accent
                            tendance={tendance(e.heros.slug)}
                          />
                          <Taux libelle={t("pages.tierList.ban")} valeur={taux(e.ban)} />
                          <Taux libelle={t("pages.tierList.pick")} valeur={taux(e.selection)} />
                        </dl>

                        {(notes[e.heros.slug] ?? e.note) && (
                          <p className="hidden flex-1 text-xs leading-relaxed text-craie-500 lg:block">
                            {notes[e.heros.slug] ?? e.note}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-14 border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-500">
          {t("pages.tierList.conclusion")}
        </p>
      </div>
    </>
  );
}

function Taux({
  libelle,
  valeur,
  accent = false,
  tendance = null,
}: {
  libelle: string;
  valeur: string;
  accent?: boolean;
  /** Evolution sur sept jours : fleche et ecart, et sa description pour les lecteurs d'ecran. */
  tendance?: { hausse: boolean; texte: string; description: string } | null;
}) {
  return (
    <div className="w-12 text-right sm:w-14">
      <dt className="text-[0.65rem] uppercase leading-tight tracking-wide text-craie-500">{libelle}</dt>
      <dd className={cn("whitespace-nowrap", accent ? "font-semibold text-or-400" : "text-craie-300")}>
        {valeur}
        {tendance && (
          <span
            className={cn(
              "block text-[0.65rem] font-semibold leading-none",
              tendance.hausse ? "text-emerald-400" : "text-sang-500",
            )}
          >
            <span aria-hidden>
              {tendance.hausse ? "↑" : "↓"}
              {tendance.texte}
            </span>
            <span className="sr-only"> {tendance.description}</span>
          </span>
        )}
      </dd>
    </div>
  );
}

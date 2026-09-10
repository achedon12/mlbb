import type { Metadata } from "next";
import Link from "next/link";
import { PortraitHeros } from "@/components/portrait-heros";
import { BadgePalier, EnTetePage } from "@/components/ui";
import {
  classementComplet,
  mesureLe,
  ORDRE_PALIERS,
  parPalier,
} from "@/lib/tier-list";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { tierNotes as tierNotesDe } from "@/lib/donnees";
import { site } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.tierList.metaTitre"),
    description: t("pages.tierList.metaDescription"),
    alternates: metaLangues(locale, "/tier-list"),
    openGraph: { title: `${t("pages.tierList.metaTitre")} — ${site.nom}`, description: t("pages.tierList.ogDescription"), url: `/${locale}/tier-list` },
  };
}

export default async function PageTierList({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const notes = tierNotesDe(locale);
  return (
    <>
      <EnTetePage
        titre={t("pages.tierList.titre")}
        chapeau={t("pages.tierList.chapeau")}
      >
        <p className="mt-6 text-sm text-craie-500">
          {t("pages.tierList.mesures", { n: classementComplet.length })}{" "}
          <time dateTime={mesureLe}>{formaterDate(mesureLe)}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-5xl px-4 py-12">
        {/* Le lecteur doit pouvoir contester le classement : on montre la regle. */}
        <details className="biseau mb-10 border border-nuit-700/70 bg-nuit-900/60 p-5">
          <summary className="cursor-pointer font-titre font-bold text-or-400">
            {t("pages.tierList.commentCalcule")}
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-craie-300">
            <p>
              {t("pages.tierList.scorePre")}<strong className="text-craie-100">{t("pages.tierList.scoreBold")}</strong>.
            </p>
            <p>
              {t("pages.tierList.p2")}
            </p>
            <p>
              {t("pages.tierList.p3pre")}
              <span className="text-or-400">{t("pages.tierList.asterisque")}</span>{t("pages.tierList.p3post")}
            </p>
          </div>
        </details>

        <div className="space-y-10">
          {ORDRE_PALIERS.map((palier) => {
            const entrees = parPalier(palier);
            if (entrees.length === 0) return null;

            return (
              <section key={palier}>
                <div className="flex items-center gap-4">
                  <BadgePalier palier={palier} />
                  <div>
                    <h2 className="font-titre text-xl font-bold text-craie-100">
                      {t("pages.tierList.palier", { p: palier })}
                      <span className="ml-2 text-sm font-medium text-craie-500">
                        {entrees.length}
                      </span>
                    </h2>
                    <p className="text-sm text-craie-500">{t(`pages.tierList.legende.${palier}`)}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {entrees.map((e) => (
                    <li key={e.heros.slug}>
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
                            <span
                              className="ml-1 text-or-400"
                              title={t("pages.tierList.tropPeu")}
                            >
                              *
                            </span>
                          )}
                          <span className="block text-[0.7rem] uppercase tracking-wide text-craie-500">
                            {e.heros.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}
                          </span>
                        </div>

                        <dl className="flex shrink-0 gap-3 text-xs tabular-nums sm:gap-4">
                          <Taux libelle={t("pages.tierList.victoire")} valeur={e.victoire} accent />
                          <Taux libelle={t("pages.tierList.ban")} valeur={e.ban} />
                          <Taux libelle={t("pages.tierList.pick")} valeur={e.selection} />
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
          Un classement mesure la marge d&apos;erreur qu&apos;un heros pardonne,
          pas le plafond qu&apos;il permet d&apos;atteindre. Un heros de palier C
          maitrise bat un heros de palier S+ decouvert la veille.
        </p>
      </div>
    </>
  );
}

function Taux({
  libelle,
  valeur,
  accent = false,
}: {
  libelle: string;
  valeur: number;
  accent?: boolean;
}) {
  return (
    <div className="w-12 text-right sm:w-14">
      <dt className="text-[0.65rem] uppercase tracking-wide text-craie-500">{libelle}</dt>
      <dd className={accent ? "font-semibold text-or-400" : "text-craie-300"}>
        {valeur.toFixed(1)}%
      </dd>
    </div>
  );
}

"use client";

import { useState } from "react";
import { BarresDuree } from "@/components/barres-duree";
import { CourbeTaux, type PointCourbe, type Repere } from "@/components/courbe-taux";
import { GroupeFiltres, Puce } from "@/components/puce";
import { useRang } from "@/components/selecteur-rang";
import { useLangue, useT } from "@/i18n/fournisseur";
import { profilDuree } from "@/lib/composition";
import type { SerieTaux, TrancheDuree } from "@/lib/evolution";
import { RANGS_MESURE, type RangMesure } from "@/lib/rangs-mesure";
import {
  formaterEcart,
  impactsDuHeros,
  JOURS_IMPACT,
  MESURES_MIN_IMPACT,
  pointsDe as pointsDates,
  SEUIL_IMPACT,
} from "@/lib/tendances";
import type { TypeAjustement } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mesure = "victoire" | "ban" | "selection";
const MESURES: Mesure[] = ["victoire", "ban", "selection"];
const PERIODES = [7, 15, 30];

/** Une serie alignee, jour par jour. */
const pointsDe = (serie: SerieTaux, mesure: Mesure): PointCourbe[] => pointsDates(serie.debut, serie[mesure]);

const mesurees = (points: PointCourbe[]) => points.flatMap((p) => (p.valeur === null ? [] : [p.valeur]));

/**
 * Statistiques d'un heros dans le temps : taux quotidiens sur trente jours,
 * taux de victoire selon la duree de partie, comparaison des rangs et
 * historique long. Tout suit le rang choisi en haut de la fiche ; les donnees
 * arrivent avec la page, sans requete au changement de rang.
 */
export function StatistiquesHeros({
  nom,
  tendances,
  duree,
  historique,
  patchs,
  parRang,
  ajustements = [],
}: {
  nom: string;
  tendances: Partial<Record<RangMesure, SerieTaux>>;
  duree: Partial<Record<RangMesure, TrancheDuree[]>>;
  historique: SerieTaux | null;
  patchs: { version: string; date: string }[];
  parRang: Partial<Record<RangMesure, { victoire: number; ban: number }>>;
  /** Patchs qui ont touche le heros, pour en mesurer l'effet. */
  ajustements?: { version: string; type: TypeAjustement | null }[];
}) {
  const t = useT();
  const langue = useLangue();
  const rang = useRang();
  const [mesure, setMesure] = useState<Mesure>("victoire");
  const [periode, setPeriode] = useState(30);

  const serie = tendances[rang] ?? tendances.all;
  const tranches = duree[rang] ?? duree.all;
  const rangs = RANGS_MESURE.filter((r) => parRang[r]);
  const reperes: Repere[] = patchs.map((p) => ({ date: p.date, libelle: p.version }));
  const decimales = mesure === "selection" ? 2 : 1;
  const nombre = (v: number, d = 1) =>
    new Intl.NumberFormat(langue, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

  if (!serie && !tranches && rangs.length < 2) {
    return <p className="text-sm text-craie-500">{t("pages.heroDetail.statistiques.aucuneDonnee")}</p>;
  }

  const points = serie ? pointsDe(serie, mesure).slice(-periode) : [];
  const valeurs = mesurees(points);
  const debut = valeurs[0];
  const fin = valeurs.at(-1);
  const long = historique && historique.victoire.length > 31 ? pointsDe(historique, "victoire") : null;

  return (
    <div className="space-y-12">
      {serie && valeurs.length > 1 && (
        <section>
          <h3 className="font-titre text-lg font-bold text-craie-100">
            {t("pages.heroDetail.statistiques.evolution", { n: periode })}
          </h3>
          <p className="mt-1 text-sm text-craie-500">{t("pages.heroDetail.statistiques.evolutionIntro")}</p>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            <GroupeFiltres legende={t("pages.heroDetail.statistiques.mesure")} largeurLegende="">
              {MESURES.map((m) => (
                <Puce key={m} dense actif={m === mesure} onClick={() => setMesure(m)}>
                  {t(`pages.heroDetail.statistiques.mesures.${m}`)}
                </Puce>
              ))}
            </GroupeFiltres>
            <GroupeFiltres legende={t("pages.heroDetail.statistiques.periode")} largeurLegende="">
              {PERIODES.map((p) => (
                <Puce key={p} dense actif={p === periode} onClick={() => setPeriode(p)}>
                  {t("pages.heroDetail.statistiques.jours", { n: p })}
                </Puce>
              ))}
            </GroupeFiltres>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t("pages.heroDetail.statistiques.actuel"), `${nombre(fin!, decimales)} %`, null],
              [
                t("pages.heroDetail.statistiques.variation"),
                `${fin! - debut! > 0 ? "+" : ""}${nombre(fin! - debut!, decimales)} ${t("contres.pts")}`,
                mesure === "victoire" ? Math.sign(fin! - debut!) : 0,
              ],
              [t("pages.heroDetail.statistiques.min"), `${nombre(Math.min(...valeurs), decimales)} %`, null],
              [t("pages.heroDetail.statistiques.max"), `${nombre(Math.max(...valeurs), decimales)} %`, null],
            ].map(([libelle, valeur, signe]) => (
              <div key={String(libelle)} className="biseau-sm border border-nuit-700/70 bg-nuit-900/60 px-3 py-2">
                <dt className="text-[0.7rem] uppercase tracking-wide text-craie-500">{libelle}</dt>
                <dd
                  className={cn(
                    "mt-0.5 font-semibold tabular-nums text-craie-100",
                    signe === 1 && "text-emerald-400",
                    signe === -1 && "text-sang-500",
                  )}
                >
                  {valeur}
                </dd>
              </div>
            ))}
          </dl>

          <div className="biseau mt-4 border border-nuit-700/70 bg-nuit-900/60 p-3 sm:p-4">
            <CourbeTaux
              points={points}
              reperes={reperes}
              decimales={decimales}
              libelle={t("pages.heroDetail.statistiques.resumeCourbe", {
                mesure: t(`pages.heroDetail.statistiques.mesures.${mesure}`),
                debut: nombre(debut!, decimales),
                fin: nombre(fin!, decimales),
              })}
            />
          </div>
          {!long && <p className="mt-2 text-xs leading-relaxed text-craie-500">{t("pages.heroDetail.statistiques.historiqueCourt")}</p>}
        </section>
      )}

      {tranches && tranches.length > 1 && <Duree nom={nom} tranches={tranches} nombre={nombre} />}

      {rangs.length > 1 && (
        <section>
          <h3 className="font-titre text-lg font-bold text-craie-100">{t("pages.heroDetail.statistiques.parRang")}</h3>
          <p className="mt-1 text-sm text-craie-500">{t("pages.heroDetail.statistiques.parRangIntro")}</p>
          <ul className="mt-4 space-y-2.5">
            {(() => {
              const taux = rangs.map((r) => parRang[r]!.victoire);
              const bas = Math.min(...taux) - 1;
              const haut = Math.max(...taux) + 0.5;
              return rangs.map((r) => {
                const s = parRang[r]!;
                return (
                  <li key={r} className="flex items-center gap-3 text-sm">
                    <span className={cn("w-28 shrink-0", r === rang ? "font-semibold text-or-400" : "text-craie-300")}>
                      {t(`rangsMesure.${r}`)}
                    </span>
                    <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-nuit-800">
                      <span
                        className={cn("block h-full rounded-full", r === rang ? "bg-or-500" : "bg-craie-500/50")}
                        style={{ width: `${((s.victoire - bas) / (haut - bas)) * 100}%` }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right tabular-nums text-craie-100">{nombre(s.victoire)} %</span>
                    <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-craie-500 sm:block">
                      {t("pages.heroDetail.statistiques.banCourt", { v: nombre(s.ban) })}
                    </span>
                  </li>
                );
              });
            })()}
          </ul>
        </section>
      )}

      {long && historique && (
        <section>
          <h3 className="font-titre text-lg font-bold text-craie-100">{t("pages.heroDetail.statistiques.historique")}</h3>
          <p className="mt-1 text-sm text-craie-500">
            {t("pages.heroDetail.statistiques.historiqueIntro", {
              date: new Intl.DateTimeFormat(langue, { dateStyle: "long", timeZone: "UTC" }).format(
                new Date(`${historique.debut}T00:00:00Z`),
              ),
            })}
          </p>
          <div className="biseau mt-4 border border-nuit-700/70 bg-nuit-900/60 p-3 sm:p-4">
            <CourbeTaux
              points={long}
              reperes={reperes}
              libelle={t("pages.heroDetail.statistiques.historique")}
            />
          </div>
        </section>
      )}

      <EffetPatchs nom={nom} historique={historique} ajustements={ajustements} patchs={patchs} nombre={nombre} />
    </div>
  );
}

const COULEUR_TYPE: Record<TypeAjustement, string> = {
  amelioration: "border-emerald-500/30 text-emerald-400",
  affaiblissement: "border-sang-500/30 text-sang-500",
  ajustement: "border-azur-500/30 text-azur-400",
};

/**
 * Effet de chaque patch sur le taux de victoire : moyenne des sept jours
 * d'avant contre celle des sept jours d'apres, et verdict (« le nerf a-t-il
 * porte ? »). Tant que l'historique ne couvre pas un patch des deux cotes, un
 * message le dit plutot qu'un bloc vide ; sans patch date, rien.
 */
function EffetPatchs({
  nom,
  historique,
  ajustements,
  patchs,
  nombre,
}: {
  nom: string;
  historique: SerieTaux | null;
  ajustements: { version: string; type: TypeAjustement | null }[];
  patchs: { version: string; date: string }[];
  nombre: (v: number) => string;
}) {
  const t = useT();
  const langue = useLangue();
  const dateDe = new Map(patchs.map((p) => [p.version, p.date]));
  const dates = ajustements.flatMap((a) => (dateDe.has(a.version) ? [{ ...a, date: dateDe.get(a.version)! }] : []));
  if (dates.length === 0) return null;
  const impacts = impactsDuHeros(historique, dates);

  return (
    <section>
      <h3 className="font-titre text-lg font-bold text-craie-100">{t("pages.heroDetail.statistiques.impact.titre")}</h3>
      <p className="mt-1 text-sm text-craie-500">
        {t("pages.heroDetail.statistiques.impact.intro", { nom, n: JOURS_IMPACT })}
      </p>

      {impacts.length === 0 ? (
        <p className="biseau-sm mt-4 border border-dashed border-nuit-700 px-4 py-3 text-sm leading-relaxed text-craie-500">
          {historique
            ? t("pages.heroDetail.statistiques.impact.vide", {
                n: MESURES_MIN_IMPACT,
                date: new Intl.DateTimeFormat(langue, { dateStyle: "long", timeZone: "UTC" }).format(
                  new Date(`${historique.debut}T00:00:00Z`),
                ),
              })
            : t("pages.heroDetail.statistiques.impact.videSansHistorique", { nom })}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {impacts.map((i, k) => {
            const signe = Math.abs(i.ecart) < SEUIL_IMPACT - 1e-9 ? 0 : Math.sign(i.ecart);
            return (
              <li
                key={`${i.version}-${k}`}
                className="biseau-sm flex flex-wrap items-center gap-x-4 gap-y-1 border border-nuit-700/70 bg-nuit-900/60 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-craie-100">
                  {t("pages.heroDetail.statistiques.impact.patch", { version: i.version })}
                </span>
                {i.type && (
                  <span className={cn("biseau-sm border px-1.5 py-0.5 text-[0.7rem]", COULEUR_TYPE[i.type])}>
                    {t(`patchHeros.${i.type}`)}
                  </span>
                )}
                <span className="tabular-nums text-craie-300">
                  <span aria-hidden>
                    {nombre(i.avant)} % → {nombre(i.apres)} %
                  </span>
                  <span className="sr-only">
                    {t("pages.heroDetail.statistiques.impact.avantApres", {
                      avant: nombre(i.avant),
                      apres: nombre(i.apres),
                    })}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    signe === 1 ? "text-emerald-400" : signe === -1 ? "text-sang-500" : "text-craie-100",
                  )}
                >
                  {formaterEcart(i.ecart, langue)} {t("contres.pts")}
                </span>
                {i.verdict && (
                  <span className="text-xs text-craie-500">
                    {t(`pages.heroDetail.statistiques.impact.verdict.${i.verdict}`)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Taux de victoire par duree de partie : dit si le heros pese en debut ou en
 * fin de partie, mieux qu'une etiquette « early » ou « late » posee a la main.
 */
function Duree({
  nom,
  tranches,
  nombre,
}: {
  nom: string;
  tranches: TrancheDuree[];
  nombre: (v: number) => string;
}) {
  const t = useT();
  const taux = tranches.map((x) => x.victoire);
  const meilleure = taux.indexOf(Math.max(...taux));
  const libelle = (x: Pick<TrancheDuree, "de" | "a">) =>
    x.a === null
      ? t("pages.heroDetail.statistiques.minutesPlus", { de: x.de })
      : t("pages.heroDetail.statistiques.minutes", { de: x.de, a: x.a });

  return (
    <section>
      <h3 className="font-titre text-lg font-bold text-craie-100">{t("pages.heroDetail.statistiques.duree")}</h3>
      <p className="mt-1 text-sm text-craie-500">{t("pages.heroDetail.statistiques.dureeIntro", { nom })}</p>
      <p className="mt-3 text-sm text-craie-300">
        <span className="font-semibold text-or-400">
          {t(`pages.heroDetail.statistiques.profil.${profilDuree(taux)}`)}
        </span>
        {" · "}
        {t("pages.heroDetail.statistiques.pic", { tranche: libelle(tranches[meilleure]) })}
      </p>

      <BarresDuree tranches={tranches} nombre={nombre} libelle={libelle} className="mt-4" />
    </section>
  );
}

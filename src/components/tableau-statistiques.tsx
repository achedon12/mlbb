"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "@/components/lien";
import { ChampRecherche } from "@/components/champ-recherche";
import { ImageLegere } from "@/components/image-legere";
import { ChoixUnique, classesPuce } from "@/components/puce";
import { COULEUR_PALIER } from "@/components/ui";
import { useLangue, useT } from "@/i18n/fournisseur";
import type { RangMesure } from "@/lib/rangs-mesure";
import {
  cheminCourbe,
  cheminStatistiques,
  decoderLigne,
  ecrireEtat,
  ETAT_DEFAUT,
  filtrerLignes,
  formateurTaux,
  HAUTEUR_COURBE,
  iconeHeros,
  LANES,
  lireEtat,
  ordreInitial,
  POINTS_COURBE,
  ROLES,
  trierLignes,
  type ColonneTri,
  type EtatTableau,
  type LigneCompacte,
  type LigneStat,
} from "@/lib/tableau-statistiques";
import { decrireEcart, formaterEcart, SEUIL_NOTABLE } from "@/lib/tendances";
import { cn } from "@/lib/utils";

/** Lignes dont l'icone se charge tout de suite : celles du premier ecran. */
const PREMIERES = 8;

const notable = (ecart: number) => Math.abs(ecart) >= SEUIL_NOTABLE - 1e-9;
/** Classe d'une evolution : verte en hausse, rouge en baisse, rien sous le seuil du bruit. */
const sens = (ecart: number) => (!notable(ecart) ? undefined : ecart > 0 ? "rising" : "falling");

/**
 * Tableau des statistiques, triable et filtrable.
 *
 * Le serveur le rend en entier, dans l'ordre par defaut : moteurs et lecteurs
 * sans JavaScript lisent toutes les lignes. Dans le navigateur, le tri, les
 * filtres et la recherche reordonnent ces memes lignes, sans requete. L'etat
 * passe dans l'URL apres le montage, comme le catalogue des heros : un tri se
 * partage, et les liens de rang le conservent.
 *
 * Les cellules n'ont pas de classe : `.stats-table` (globals.css) les
 * habille par position, sans quoi les memes utilitaires se repetaient sur
 * 132 lignes.
 */
export function TableauStatistiques({
  compactes,
  rang,
  rangs,
}: {
  /** Lignes en tuples (`coderLigne`), decodees une fois ici. */
  compactes: LigneCompacte[];
  rang: RangMesure;
  rangs: readonly RangMesure[];
}) {
  const t = useT();
  const langue = useLangue();
  const lignes = useMemo(() => compactes.map(decoderLigne), [compactes]);
  const [etat, setEtat] = useState<EtatTableau>(ETAT_DEFAUT);
  const taux = useMemo(() => formateurTaux(langue), [langue]);

  const monte = useRef(false);
  useEffect(() => {
    if (!monte.current) {
      monte.current = true;
      const lu = lireEtat(new URLSearchParams(window.location.search));
      if (ecrireEtat(lu).toString()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de l'URL apres montage
        setEtat(lu);
        return;
      }
    }
    const suffixe = ecrireEtat(etat, new URLSearchParams(window.location.search)).toString();
    window.history.replaceState(null, "", suffixe ? `?${suffixe}` : window.location.pathname);
  }, [etat]);

  const affichees = useMemo(() => trierLignes(filtrerLignes(lignes, etat), etat.tri, etat.ordre), [lignes, etat]);
  const requete = ecrireEtat(etat).toString();
  const maj = (partiel: Partial<EtatTableau>) => setEtat((e) => ({ ...e, ...partiel }));
  const trier = (c: ColonneTri) =>
    setEtat((e) => ({ ...e, tri: c, ordre: e.tri !== c ? ordreInitial(c) : e.ordre === "asc" ? "desc" : "asc" }));
  const entete = { etat, onTri: trier };

  return (
    <div>
      <div className="flex flex-col gap-4">
        <nav aria-label={t("rangsMesure.label")} className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="mr-1 w-20 shrink-0 text-xs uppercase tracking-wide text-chalk-500">
            {t("rangsMesure.label")}
          </span>
          {rangs.map((r) => (
            <Link
              key={r}
              href={`${cheminStatistiques(r)}${requete ? `?${requete}` : ""}`}
              aria-current={r === rang ? "page" : undefined}
              className={classesPuce(r === rang)}
            >
              {t(`rangsMesure.${r}`)}
            </Link>
          ))}
        </nav>
        <ChampRecherche
          valeur={etat.recherche}
          onChange={(recherche) => maj({ recherche })}
          libelle={t("pages.heroesListe.rechercher")}
          className="max-w-md"
        />
        <ChoixUnique
          legende={t("pages.heroesListe.role")}
          valeurs={ROLES}
          actif={etat.role}
          onChange={(role) => maj({ role })}
          libelle={(r) => t(`roles.${r}`)}
        />
        <ChoixUnique
          legende={t("pages.heroesListe.position")}
          valeurs={LANES}
          actif={etat.lane}
          onChange={(lane) => maj({ lane })}
          libelle={(l) => t(`lanes.${l}`)}
        />
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {t("pages.heroesListe.compte", { n: affichees.length })}
        {affichees.length !== lignes.length && ` ${t("pages.heroesListe.compteSur", { total: lignes.length })}`}
      </p>

      {/* Defilement horizontal sur mobile, nom du heros fige a gauche. Le
          conteneur est positionne : les textes .sr-only des cellules, en position
          absolue, s'y rattachent au lieu d'elargir toute la page. */}
      <div className="relative mt-3 overflow-x-auto border border-night-700/70">
        <table className="stats-table">
          <caption className="sr-only">
            {t("pages.statisticsTable.legende", { rang: t(`rangsMesure.${rang}`) })}
          </caption>
          <thead>
            <tr>
              <Entete colonne="nom" {...entete}>
                {t("pages.statisticsTable.heros")}
              </Entete>
              <Entete colonne="palier" {...entete}>
                {t("pages.statisticsTable.palier")}
              </Entete>
              <Entete colonne="victoire" {...entete}>
                {t("pages.statisticsTable.victoire")}
              </Entete>
              <Entete colonne="tendance" {...entete}>
                {t("pages.statisticsTable.ecart")}
              </Entete>
              <Entete colonne="ban" {...entete}>
                {t("pages.statisticsTable.ban")}
              </Entete>
              <Entete colonne="selection" {...entete}>
                {t("pages.statisticsTable.selection")}
              </Entete>
              <th scope="col">{t("pages.statisticsTable.courbe")}</th>
            </tr>
          </thead>
          <tbody>
            {affichees.map((l, i) => (
              <Ligne key={l.slug} ligne={l} premiere={i < PREMIERES} taux={taux} />
            ))}
            {affichees.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  {t("pages.heroesListe.aucun")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** En-tete triable : le bouton porte l'action, `aria-sort` annonce l'ordre courant. */
function Entete({
  colonne,
  etat,
  onTri,
  children,
}: {
  colonne: ColonneTri;
  etat: EtatTableau;
  onTri: (c: ColonneTri) => void;
  children: React.ReactNode;
}) {
  const actif = etat.tri === colonne;
  const Icone = !actif ? ArrowUpDown : etat.ordre === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={actif ? (etat.ordre === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onTri(colonne)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wide transition-colors hover:text-gold-400",
          actif && "text-gold-400",
        )}
      >
        {children}
        <Icone size={12} aria-hidden className={actif ? undefined : "opacity-40"} />
      </button>
    </th>
  );
}

function Ligne({ ligne: l, premiere, taux }: { ligne: LigneStat; premiere: boolean; taux: (v: number) => string }) {
  const t = useT();
  const langue = useLangue();
  const evolution = l.debut !== undefined && l.fin !== undefined ? l.fin - l.debut : 0;

  return (
    <tr>
      <th scope="row">
        <Link href={`/heroes/${l.slug}`} prefetch={false}>
          <ImageLegere src={iconeHeros(l.slug)} alt="" largeur={28} hauteur={28} immediate={premiere} />
          <span className="min-w-0">
            <b>
              {l.nom}
              {l.faible && (
                <span className="text-gold-400" title={t("pages.statisticsTable.faible")}>
                  {" *"}
                  <span className="sr-only">{t("pages.statisticsTable.faible")}</span>
                </span>
              )}
            </b>
            <small>
              {[l.roles.map((r) => t(`roles.${r}`)).join("/"), l.lanes.map((x) => t(`lanes.${x}`)).join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
        </Link>
      </th>
      <td>
        <span className={cn("stats-tier", COULEUR_PALIER[l.palier])}>{l.palier}</span>
      </td>
      <td>{taux(l.victoire)}</td>
      <td className={l.ecart === undefined ? undefined : sens(l.ecart)}>
        {l.ecart === undefined ? (
          <span title={t("pages.statisticsTable.sansMesure")}>
            <span aria-hidden>—</span>
            <span className="sr-only">{t("pages.statisticsTable.sansMesure")}</span>
          </span>
        ) : notable(l.ecart) ? (
          <>
            <span aria-hidden>{formaterEcart(l.ecart, langue)}</span>
            <span className="sr-only">{decrireEcart(t, langue, l.ecart, l.jours ?? 7)}</span>
          </>
        ) : (
          formaterEcart(l.ecart, langue)
        )}
      </td>
      <td>{taux(l.ban)}</td>
      <td>{taux(l.selection)}</td>
      <td>
        {l.courbe && l.debut !== undefined && l.fin !== undefined ? (
          <svg
            viewBox={`0 0 ${POINTS_COURBE - 1} ${HAUTEUR_COURBE}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={t("pages.statisticsTable.courbeAria", { debut: taux(l.debut), fin: taux(l.fin) })}
            className={sens(evolution)}
          >
            <path d={cheminCourbe(l.courbe)} />
          </svg>
        ) : (
          <span aria-hidden>—</span>
        )}
      </td>
    </tr>
  );
}

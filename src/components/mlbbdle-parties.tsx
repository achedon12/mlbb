"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Check, LayoutGrid, Lock, X } from "lucide-react";
import { ChampDevinette } from "@/components/champ-devinette";
import { SelecteurHeros } from "@/components/choix-heros";
import { PortraitHeros } from "@/components/portrait-heros";
import { useT } from "@/i18n/fournisseur";
import type { T } from "@/i18n/t";
import {
  COLONNES,
  comparer,
  indicesDebloques,
  INDICES_COMPETENCE,
  type CaseComparee,
  type Colonne,
  type EnigmeCompetence,
  type HerosMlbbdle,
  type Verdict,
} from "@/lib/mlbbdle";
import { cn } from "@/lib/utils";

/**
 * Plateaux de MLBBdle : la grille du mode classique et l'enigme du mode
 * competence. Sans etat de partie : le defi du jour et l'entrainement tiennent
 * les essais, ces vues les montrent et remontent chaque proposition.
 */

export interface CatalogueMlbbdle {
  heros: HerosMlbbdle[];
  parSlug: Map<string, HerosMlbbdle>;
  /** Libelle de chaque valeur, sous `<colonne>.<cle>`. */
  libelles: Record<string, string>;
}

/** Blanc sur fond fonce : le contraste tient sur les trois couleurs. */
const FOND: Record<Verdict, string> = {
  oui: "border-emerald-400/60 bg-emerald-700 text-white",
  partiel: "border-orange-400/60 bg-orange-700 text-white",
  non: "border-red-400/40 bg-red-800 text-white",
  inconnu: "border-nuit-600 bg-nuit-700 text-craie-300",
};

/** Retournement d'une case : pose ici, il ne sert qu'a cette grille. */
const ANIMATION = "@keyframes mlbbdle-retourner{from{transform:rotateX(90deg)}to{transform:none}}";

/** Texte d'une case : les libelles des valeurs du heros dans cette colonne. */
export function texteCase(h: HerosMlbbdle, c: Colonne, libelles: Record<string, string>): string {
  const lib = (champ: string, v: string) => libelles[`${champ}.${v}`] ?? v;
  if (c === "genre") return h.genre ? lib("genre", h.genre) : "";
  if (c === "roles" || c === "lanes" || c === "specialites") return h[c].map((v) => lib(c, v)).join(", ");
  if (c === "annee") return h.annee ? String(h.annee) : "";
  const v = h[c];
  return v ? lib(c, v) : "";
}

function verdictTexte(c: CaseComparee, colonne: Colonne, t: T): string {
  return colonne === "annee" && c.sens ? t(`pages.mlbbdleUI.sens.${c.sens}`) : t(`pages.mlbbdleUI.verdicts.${c.verdict}`);
}

/**
 * Champ de reponse et fenetre « Parcourir les heros » : taper un nom ou
 * choisir dans le roster, au clavier comme au doigt.
 */
function ChampHeros({
  catalogue,
  exclus,
  onChoisir,
}: {
  catalogue: CatalogueMlbbdle;
  exclus: Set<string>;
  onChoisir: (slug: string) => void;
}) {
  const t = useT();
  const [roster, setRoster] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">
        <ChampDevinette
          options={catalogue.heros}
          exclus={exclus}
          libelle={t("pages.mlbbdleUI.champ")}
          aucun={t("pages.mlbbdleUI.aucunResultat")}
          onChoisir={onChoisir}
        />
      </div>
      <button
        type="button"
        onClick={() => setRoster(true)}
        className="biseau-sm flex min-h-11 items-center justify-center gap-1.5 border border-nuit-600 px-3 py-2 text-sm text-craie-300 transition-colors hover:border-or-500 hover:text-or-400"
      >
        <LayoutGrid size={15} aria-hidden />
        {t("pages.mlbbdleUI.parcourir")}
      </button>
      {roster && (
        <SelecteurHeros
          heros={catalogue.heros}
          exclus={exclus}
          lane={null}
          titre={t("pages.mlbbdleUI.parcourir")}
          onChoisir={(slug) => {
            setRoster(false);
            onChoisir(slug);
          }}
          onFermer={() => setRoster(false)}
        />
      )}
    </div>
  );
}

/** Cadre commun aux deux plateaux : biseau sur un calque de fond, qui ne rogne ni la liste ni la fenetre. */
function Plateau({
  etiquette,
  question,
  essais,
  refTitre,
  children,
}: {
  etiquette: string;
  question: string;
  essais: number;
  refTitre?: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="relative p-4 sm:p-6">
      <div aria-hidden className="biseau absolute inset-0 border border-nuit-700/70 bg-nuit-900/60" />
      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs uppercase tracking-wide text-craie-500">
          <span>{etiquette}</span>
          <span className="tabular-nums text-craie-300">{t("pages.mlbbdleUI.essais", { n: essais })}</span>
        </div>
        <h3
          ref={refTitre}
          tabIndex={-1}
          className="mt-2 font-titre text-xl font-bold text-craie-100 outline-none sm:text-2xl"
        >
          {question}
        </h3>
        {children}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Mode classique
// ─────────────────────────────────────────────────────────────

export function PartieClassique({
  cible,
  essais,
  catalogue,
  onEssai,
  etiquette,
  termine = false,
  refTitre,
}: {
  cible: HerosMlbbdle;
  essais: string[];
  catalogue: CatalogueMlbbdle;
  onEssai: (slug: string) => void;
  etiquette: string;
  /** Partie close sans victoire (reponse revelee a l'entrainement). */
  termine?: boolean;
  refTitre?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const exclus = useMemo(() => new Set(essais), [essais]);
  const trouve = essais.includes(cible.slug);

  function annonce(): string {
    const dernier = essais.at(-1);
    const h = dernier ? catalogue.parSlug.get(dernier) : undefined;
    if (!h) return "";
    if (h.slug === cible.slug) return t("pages.mlbbdleUI.annonceTrouve", { nom: h.nom, n: essais.length });
    const c = comparer(h, cible);
    const details = COLONNES.map(
      (col) =>
        `${t(`pages.mlbbdleUI.colonnes.${col}`)} ${texteCase(h, col, catalogue.libelles) || t("pages.mlbbdleUI.inconnu")} : ${verdictTexte(c[col], col, t)}`,
    ).join(" ; ");
    return `${t("pages.mlbbdleUI.annonceEssai", { nom: h.nom, n: essais.length })} ${details}.`;
  }

  return (
    <Plateau etiquette={etiquette} question={t("pages.mlbbdleUI.questionClassique")} essais={essais.length} refTitre={refTitre}>
      {!trouve && !termine && (
        <div className="mt-4">
          <ChampHeros catalogue={catalogue} exclus={exclus} onChoisir={onEssai} />
          {essais.length === 0 && <p className="mt-3 text-sm text-craie-400">{t("pages.mlbbdleUI.aideClassique")}</p>}
        </div>
      )}
      {essais.length > 0 && <GrilleClassique essais={essais} cible={cible} catalogue={catalogue} />}
      <p aria-live="polite" className="sr-only">
        {annonce()}
      </p>
    </Plateau>
  );
}

function GrilleClassique({
  essais,
  cible,
  catalogue,
}: {
  essais: string[];
  cible: HerosMlbbdle;
  catalogue: CatalogueMlbbdle;
}) {
  const t = useT();
  // Les essais deja la au montage (partie reprise) ne se retournent pas :
  // seuls ceux joues pendant la visite s'animent.
  const [depart] = useState(essais.length);
  const lignes = essais.map((slug, i) => ({ slug, i })).reverse();

  return (
    <div className="relative mt-5 overflow-x-auto pb-1">
      <style>{ANIMATION}</style>
      <table className="border-separate border-spacing-1 text-center">
        <caption className="sr-only">{t("pages.mlbbdleUI.grilleLegende")}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-1 pb-1 align-bottom text-[0.65rem] font-medium uppercase tracking-wide text-craie-500">
              {t("pages.mlbbdleUI.colonneHeros")}
            </th>
            {COLONNES.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-1 pb-1 align-bottom text-[0.65rem] font-medium uppercase leading-tight tracking-wide text-craie-500"
              >
                {t(`pages.mlbbdleUI.colonnes.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map(({ slug, i }) => {
            const h = catalogue.parSlug.get(slug);
            if (!h) return null;
            const cases = comparer(h, cible);
            const gagnant = slug === cible.slug;
            const anime = i >= depart;
            return (
              <tr key={slug}>
                <th
                  scope="row"
                  className={cn(
                    "h-[4.5rem] w-[4.5rem] min-w-[4.5rem] border p-1 align-middle font-normal",
                    gagnant ? FOND.oui : "border-nuit-600 bg-nuit-950/60",
                  )}
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <PortraitHeros source={h.icone} nom={h.nom} taille="icone" decoratif />
                    <span className="block max-w-[4rem] truncate text-[0.62rem] leading-tight text-craie-100">{h.nom}</span>
                  </span>
                </th>
                {COLONNES.map((c, j) => {
                  const cas = cases[c];
                  const verdict = gagnant ? "oui" : cas.verdict;
                  const texte = texteCase(h, c, catalogue.libelles);
                  const Fleche = !gagnant && cas.sens === "plus" ? ArrowUp : !gagnant && cas.sens === "moins" ? ArrowDown : null;
                  return (
                    <td
                      key={c}
                      className={cn(
                        "h-[4.5rem] w-[4.5rem] min-w-[4.5rem] max-w-[5.5rem] border px-1 py-1 align-middle text-[0.68rem] font-semibold leading-tight [overflow-wrap:anywhere]",
                        FOND[verdict],
                        anime && "motion-safe:animate-[mlbbdle-retourner_0.45s_ease-out_both]",
                      )}
                      style={anime ? { animationDelay: `${(j + 1) * 110}ms` } : undefined}
                    >
                      <span className="flex flex-col items-center justify-center gap-0.5">
                        <span>{texte || t("pages.mlbbdleUI.inconnu")}</span>
                        {Fleche && <Fleche size={16} aria-hidden />}
                      </span>
                      <span className="sr-only"> : {verdictTexte(cas, c, t)}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mode competence
// ─────────────────────────────────────────────────────────────

export function PartieCompetence({
  enigme,
  essais,
  catalogue,
  onEssai,
  etiquette,
  termine = false,
  refTitre,
}: {
  enigme: EnigmeCompetence;
  essais: string[];
  catalogue: CatalogueMlbbdle;
  onEssai: (slug: string) => void;
  etiquette: string;
  termine?: boolean;
  refTitre?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const exclus = useMemo(() => new Set(essais), [essais]);
  const trouve = essais.includes(enigme.reponse);
  const fini = trouve || termine;
  const erreurs = essais.filter((e) => e !== enigme.reponse).length;
  const debloques = indicesDebloques(fini ? Infinity : erreurs);
  const cible = catalogue.parSlug.get(enigme.reponse);
  const indices = INDICES_COMPETENCE.filter((i) => i.cle !== "description" || enigme.extrait);

  function contenu(cle: (typeof INDICES_COMPETENCE)[number]["cle"]): React.ReactNode {
    if (cle === "couleur") return t("pages.mlbbdleUI.indiceCouleur");
    if (cle === "nom") return enigme.nom;
    if (cle === "description") return <q>{enigme.extrait}</q>;
    return cible ? cible.roles.map((r) => catalogue.libelles[`roles.${r}`] ?? r).join(", ") : "";
  }

  function annonce(): string {
    const dernier = essais.at(-1);
    const h = dernier ? catalogue.parSlug.get(dernier) : undefined;
    if (!h) return "";
    if (h.slug === enigme.reponse) return t("pages.mlbbdleUI.annonceTrouve", { nom: h.nom, n: essais.length });
    const nouvel = INDICES_COMPETENCE.find((i) => i.seuil === erreurs);
    return [
      t("pages.mlbbdleUI.annonceFaux", { nom: h.nom, n: essais.length }),
      nouvel ? t("pages.mlbbdleUI.annonceIndice", { indice: t(`pages.mlbbdleUI.indices.${nouvel.cle}`) }) : "",
    ].join(" ");
  }

  return (
    <Plateau etiquette={etiquette} question={t("pages.mlbbdleUI.questionCompetence")} essais={essais.length} refTitre={refTitre}>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <Image
          src={enigme.icone}
          alt={t(debloques.has("couleur") ? "pages.mlbbdleUI.altCompetence" : "pages.mlbbdleUI.altCompetenceGris")}
          width={96}
          height={96}
          className={cn(
            "biseau-sm size-24 shrink-0 bg-nuit-800 transition-[filter] duration-700",
            !debloques.has("couleur") && "grayscale",
          )}
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-xs uppercase tracking-wide text-craie-500">{t("pages.mlbbdleUI.indicesTitre")}</h4>
          <ol className="mt-2 space-y-1.5">
            {indices.map((ind) =>
              debloques.has(ind.cle) ? (
                <li key={ind.cle} className="border-l-2 border-or-500/60 pl-3 text-sm leading-relaxed text-craie-200">
                  <span className="font-semibold text-or-400">{t(`pages.mlbbdleUI.indices.${ind.cle}`)} : </span>
                  {contenu(ind.cle)}
                </li>
              ) : (
                <li key={ind.cle} className="flex items-center gap-2 pl-3 text-xs text-craie-500">
                  <Lock size={12} aria-hidden />
                  {t("pages.mlbbdleUI.indiceVerrouille", {
                    indice: t(`pages.mlbbdleUI.indices.${ind.cle}`),
                    n: ind.seuil - erreurs,
                  })}
                </li>
              ),
            )}
          </ol>
        </div>
      </div>

      {!fini && (
        <div className="mt-5">
          <ChampHeros catalogue={catalogue} exclus={exclus} onChoisir={onEssai} />
        </div>
      )}

      {essais.length > 0 && (
        <ol className="mt-4 flex flex-wrap gap-1.5" aria-label={t("pages.mlbbdleUI.vosEssais")}>
          {[...essais].reverse().map((slug) => {
            const h = catalogue.parSlug.get(slug);
            if (!h) return null;
            const bon = slug === enigme.reponse;
            return (
              <li
                key={slug}
                className={cn(
                  "biseau-sm flex items-center gap-2 border py-1 pl-1 pr-2.5 text-sm",
                  bon ? FOND.oui : "border-red-400/40 bg-red-800/40 text-craie-100",
                )}
              >
                <PortraitHeros source={h.icone} nom={h.nom} taille="petite" decoratif />
                {h.nom}
                {bon ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}
                <span className="sr-only"> : {t(bon ? "pages.mlbbdleUI.verdicts.oui" : "pages.mlbbdleUI.verdicts.non")}</span>
              </li>
            );
          })}
        </ol>
      )}

      <p aria-live="polite" className="sr-only">
        {annonce()}
      </p>
    </Plateau>
  );
}

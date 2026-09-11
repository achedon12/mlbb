"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Check, Flag, LayoutGrid, Lock, X } from "lucide-react";
import { ChampDevinette } from "@/components/champ-devinette";
import { SelecteurHeros } from "@/components/choix-heros";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import type { T } from "@/i18n/t";
import {
  ABANDON,
  comparerHeros,
  comparerObjets,
  erreurs,
  essaisMax,
  mancheFinie,
  reponsesDuel,
  ZOOMS,
  type Accord,
  type HerosQuiz,
  type Manche,
  type ObjetRoster,
  type Sens,
} from "@/lib/quiz";
import { cn } from "@/lib/utils";

/**
 * Une manche du quiz : l'enonce, les indices qui se debloquent a chaque
 * erreur, le champ de reponse et les essais deja joues. Sans etat de partie :
 * le defi du jour et l'entrainement tiennent les essais, cette vue les montre.
 */

export interface CatalogueQuiz {
  heros: HerosQuiz[];
  objets: ObjetRoster[];
  herosParSlug: Map<string, HerosQuiz>;
  objetsParSlug: Map<string, ObjetRoster>;
}

interface Indice {
  cle: string;
  contenu: React.ReactNode;
}

const COULEUR_ACCORD: Record<Accord, string> = {
  oui: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
  partiel: "border-or-500/60 bg-or-500/15 text-or-400",
  non: "border-sang-500/50 bg-sang-500/10 text-sang-500",
};

function listeRoles(h: HerosQuiz, t: T) {
  return h.roles.map((r) => t(`roles.${r}`)).join(" / ");
}
function listeLanes(h: HerosQuiz, t: T) {
  return h.lanes.map((l) => t(`lanes.${l}`)).join(" / ") || "—";
}

/** Indices de la manche, dans l'ordre ou les erreurs les debloquent. */
function indicesDe(manche: Manche, cible: HerosQuiz | undefined, t: T): Indice[] {
  const liste: (Indice | null)[] = [];
  if (manche.type === "competence" && cible) {
    liste.push(
      { cle: "nomCompetence", contenu: manche.nom },
      manche.extrait ? { cle: "description", contenu: <q>{manche.extrait}</q> } : null,
      { cle: "roles", contenu: listeRoles(cible, t) },
      { cle: "lanes", contenu: listeLanes(cible, t) },
    );
  } else if (manche.type === "skin" && cible) {
    liste.push(
      { cle: "roles", contenu: listeRoles(cible, t) },
      { cle: "lanes", contenu: listeLanes(cible, t) },
      cible.annee ? { cle: "annee", contenu: String(cible.annee) } : null,
      { cle: "skin", contenu: manche.skin },
    );
  } else if (manche.type === "histoire" && cible) {
    liste.push(
      manche.extraits[1] ? { cle: "extrait", contenu: <q>{manche.extraits[1]}</q> } : null,
      cible.region ? { cle: "region", contenu: cible.region } : null,
      { cle: "roles", contenu: listeRoles(cible, t) },
      {
        cle: "initiale",
        contenu: t("pages.quizUI.initiale", { lettre: cible.nom[0], n: cible.nom.replace(/[^\p{L}]/gu, "").length }),
      },
    );
  } else if (manche.type === "objet") {
    liste.push(
      { cle: "categorie", contenu: manche.categorie },
      manche.recette.length
        ? {
            cle: "recette",
            contenu: (
              <span className="flex flex-wrap gap-2">
                {manche.recette.map((r, i) => (
                  <span key={`${r.nom}-${i}`} className="inline-flex items-center gap-1.5">
                    <PortraitHeros source={r.icone} nom={r.nom} taille="micro" decoratif />
                    {r.nom}
                  </span>
                ))}
              </span>
            ),
          }
        : null,
      manche.passif ? { cle: "passif", contenu: <q>{manche.passif}</q> } : null,
    );
  }
  return liste.filter((x): x is Indice => x !== null);
}

/** Pastille de comparaison : l'essai partage-t-il ce trait avec la reponse ? */
function Pastille({ accord, libelle, valeur, t }: { accord: Accord; libelle: string; valeur?: string; t: T }) {
  const Icone = accord === "oui" ? Check : accord === "partiel" ? null : X;
  return (
    <span
      className={cn("biseau-sm inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.7rem]", COULEUR_ACCORD[accord])}
    >
      {Icone ? <Icone size={12} aria-hidden /> : <span aria-hidden>≈</span>}
      {valeur ?? libelle}
      <span className="sr-only">
        {valeur ? ` (${libelle})` : ""} : {t(`pages.quizUI.accord.${accord}`)}
      </span>
    </span>
  );
}

/** Pastille de sens : la reponse est plus recente, plus chere… ou egale. */
function PastilleSens({ sens, valeur, famille, t }: { sens: Sens; valeur: string; famille: "annee" | "prix"; t: T }) {
  const accord: Accord = sens === "egal" ? "oui" : "non";
  const Icone = sens === "plus" ? ArrowUp : sens === "moins" ? ArrowDown : sens === "egal" ? Check : null;
  return (
    <span
      className={cn("biseau-sm inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.7rem]", COULEUR_ACCORD[accord])}
      title={t(`pages.quizUI.${famille}.${sens}`)}
    >
      {valeur}
      {Icone && <Icone size={12} aria-hidden />}
      <span className="sr-only"> : {t(`pages.quizUI.${famille}.${sens}`)}</span>
    </span>
  );
}

export function MancheQuiz({
  manche,
  essais,
  catalogue,
  onEssai,
  etiquette,
  refTitre,
  mesure,
}: {
  manche: Manche;
  essais: string[];
  catalogue: CatalogueQuiz;
  onEssai: (slug: string) => void;
  /** Position de la manche, « Manche 2/5 ». */
  etiquette: string;
  refTitre?: React.Ref<HTMLHeadingElement>;
  /** Date du releve des taux, citee par le duel. */
  mesure: string;
}) {
  const t = useT();
  const langue = useLangue();
  const [roster, setRoster] = useState(false);
  const finie = mancheFinie(manche, essais);
  const formatTaux = useMemo(
    () => new Intl.NumberFormat(LOCALE_HTML[langue], { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
    [langue],
  );
  const formatPrix = useMemo(() => new Intl.NumberFormat(LOCALE_HTML[langue]), [langue]);

  const estObjet = manche.type === "objet";
  const reponse = manche.type === "duel" ? null : manche.reponse;
  const cible = reponse && !estObjet ? catalogue.herosParSlug.get(reponse) : undefined;
  const cibleObjet = reponse && estObjet ? catalogue.objetsParSlug.get(reponse) : undefined;
  const nomReponse = cible?.nom ?? cibleObjet?.nom ?? "";
  const nbErreurs = erreurs(manche, essais);
  const indices = indicesDe(manche, cible, t);
  const visibles = finie ? indices.length : Math.min(nbErreurs, indices.length);
  const joues = essais.filter((e) => e !== ABANDON);
  const exclus = useMemo(() => new Set(essais), [essais]);

  const annonce = annonceDe();

  function annonceDe(): string {
    const dernier = essais.at(-1);
    if (dernier === undefined) return "";
    if (manche.type === "duel") {
      const i = essais.length - 1;
      const bon = reponsesDuel(manche)[i];
      const h = catalogue.herosParSlug.get(bon);
      const taux = formatTaux.format(manche.paires[i].find((d) => d.slug === bon)?.victoire ?? 0);
      return t(dernier === bon ? "pages.quizUI.annonceDuelBon" : "pages.quizUI.annonceDuelFaux", {
        nom: h?.nom ?? bon,
        taux,
      });
    }
    if (dernier === manche.reponse) return t("pages.quizUI.annonceTrouve", { nom: nomReponse });
    if (finie) return t("pages.quizUI.annonceRate", { nom: nomReponse });
    const essai = catalogue.herosParSlug.get(dernier)?.nom ?? catalogue.objetsParSlug.get(dernier)?.nom ?? dernier;
    const nouvel = indices[visibles - 1];
    return [
      t("pages.quizUI.annonceFaux", { nom: essai, n: essaisMax(manche) - essais.length }),
      nouvel ? t("pages.quizUI.annonceIndice", { titre: t(`pages.quizUI.indices.${nouvel.cle}`) }) : "",
    ].join(" ");
  }

  return (
    <section className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs uppercase tracking-wide text-craie-500">
        <span>
          {etiquette} · {t(`pages.quizUI.types.${manche.type}`)}
        </span>
        {manche.type !== "duel" && !finie && (
          <span className="tabular-nums text-craie-300">
            {t("pages.quizUI.essaisRestants", { n: essaisMax(manche) - essais.length })}
          </span>
        )}
      </div>
      <h3
        ref={refTitre}
        tabIndex={-1}
        className="mt-2 font-titre text-xl font-bold text-craie-100 outline-none sm:text-2xl"
      >
        {t(`pages.quizUI.questions.${manche.type}`)}
      </h3>

      <div className="mt-4">
        <Enonce manche={manche} nbErreurs={nbErreurs} finie={finie} formatPrix={formatPrix} t={t} />
      </div>

      {manche.type === "duel" ? (
        <Duel manche={manche} essais={essais} catalogue={catalogue} onEssai={onEssai} formatTaux={formatTaux} t={t} />
      ) : (
        <>
          {indices.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs uppercase tracking-wide text-craie-500">
                {t("pages.quizUI.indicesTitre", { n: visibles, max: indices.length })}
              </h4>
              <ol className="mt-2 space-y-1.5">
                {indices.map((ind, i) =>
                  i < visibles ? (
                    <li key={ind.cle} className="border-l-2 border-or-500/60 pl-3 text-sm leading-relaxed text-craie-200">
                      <span className="font-semibold text-or-400">{t(`pages.quizUI.indices.${ind.cle}`)} : </span>
                      {ind.contenu}
                    </li>
                  ) : (
                    <li key={ind.cle} className="flex items-center gap-2 pl-3 text-xs text-craie-600">
                      <Lock size={12} aria-hidden />
                      {t("pages.quizUI.indiceVerrouille", { n: i + 1 })}
                    </li>
                  ),
                )}
              </ol>
            </div>
          )}

          {!finie && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <ChampDevinette
                  options={estObjet ? catalogue.objets : catalogue.heros}
                  exclus={exclus}
                  libelle={t(estObjet ? "pages.quizUI.champObjet" : "pages.quizUI.champHeros")}
                  aucun={t("pages.quizUI.aucunResultat")}
                  onChoisir={onEssai}
                />
              </div>
              <div className="flex gap-2">
                {!estObjet && (
                  <button
                    type="button"
                    onClick={() => setRoster(true)}
                    className="biseau-sm flex flex-1 items-center justify-center gap-1.5 border border-nuit-600 px-3 py-2 text-sm text-craie-300 transition-colors hover:border-or-500 hover:text-or-400"
                  >
                    <LayoutGrid size={15} aria-hidden />
                    {t("pages.quizUI.parcourir")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEssai(ABANDON)}
                  className="biseau-sm flex flex-1 items-center justify-center gap-1.5 border border-nuit-600 px-3 py-2 text-sm text-craie-500 transition-colors hover:border-sang-500 hover:text-sang-500"
                >
                  <Flag size={15} aria-hidden />
                  {t("pages.quizUI.passer")}
                </button>
              </div>
            </div>
          )}

          {joues.length > 0 && (
            <ol className="mt-4 space-y-1.5" aria-label={t("pages.quizUI.vosEssais")}>
              {joues.map((slug) => {
                const bon = slug === reponse;
                const h = catalogue.herosParSlug.get(slug);
                const o = catalogue.objetsParSlug.get(slug);
                const essai = estObjet ? o : h;
                if (!essai) return null;
                return (
                  <li
                    key={slug}
                    className={cn(
                      "biseau-sm flex flex-wrap items-center gap-2 border px-2 py-1.5",
                      bon ? "border-emerald-500/60 bg-emerald-500/10" : "border-nuit-700/70 bg-nuit-950/40",
                    )}
                  >
                    <PortraitHeros source={essai.icone} nom={essai.nom} taille="petite" decoratif />
                    <span className={cn("mr-auto text-sm font-medium", bon ? "text-emerald-300" : "text-craie-100")}>
                      {essai.nom}
                    </span>
                    {bon ? (
                      <Check size={16} className="text-emerald-400" aria-label={t("pages.quizUI.accord.oui")} />
                    ) : h && cible ? (
                      <ComparaisonHeros essai={h} cible={cible} t={t} />
                    ) : o && cibleObjet ? (
                      <ComparaisonObjet essai={o} cible={cibleObjet} formatPrix={formatPrix} t={t} />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}

          {finie && (
            <Resultat
              manche={manche}
              trouve={reponse !== null && essais.includes(reponse)}
              essais={joues.length}
              cible={cible ?? cibleObjet}
              t={t}
            />
          )}
        </>
      )}

      {manche.type === "duel" && (
        <p className="mt-4 text-xs text-craie-500">
          {t("pages.quizUI.duelSource", {
            date: new Intl.DateTimeFormat(LOCALE_HTML[langue], { dateStyle: "long", timeZone: "UTC" }).format(
              new Date(mesure),
            ),
          })}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {annonce}
      </p>

      {roster && (
        <SelecteurHeros
          heros={catalogue.heros}
          exclus={exclus}
          lane={null}
          titre={t("pages.quizUI.parcourir")}
          onChoisir={(slug) => {
            setRoster(false);
            onEssai(slug);
          }}
          onFermer={() => setRoster(false)}
        />
      )}
    </section>
  );
}

function ComparaisonHeros({ essai, cible, t }: { essai: HerosQuiz; cible: HerosQuiz; t: T }) {
  const c = comparerHeros(essai, cible);
  return (
    <span className="flex flex-wrap gap-1">
      <Pastille accord={c.roles} libelle={t("pages.quizUI.comparaison.roles")} t={t} />
      <Pastille accord={c.lanes} libelle={t("pages.quizUI.comparaison.lanes")} t={t} />
      {essai.annee !== null && <PastilleSens sens={c.annee} valeur={String(essai.annee)} famille="annee" t={t} />}
      <Pastille accord={c.region} libelle={t("pages.quizUI.comparaison.region")} t={t} />
    </span>
  );
}

function ComparaisonObjet({
  essai,
  cible,
  formatPrix,
  t,
}: {
  essai: ObjetRoster;
  cible: ObjetRoster;
  formatPrix: Intl.NumberFormat;
  t: T;
}) {
  const c = comparerObjets(essai, cible);
  return (
    <span className="flex flex-wrap gap-1">
      {essai.prix !== null && <PastilleSens sens={c.prix} valeur={formatPrix.format(essai.prix)} famille="prix" t={t} />}
      <Pastille accord={c.categorie} libelle={t("pages.quizUI.comparaison.categorie")} valeur={essai.categorie} t={t} />
    </span>
  );
}

/** Ce que la manche montre d'emblee ; l'illustration d'un skin se degage erreur apres erreur. */
function Enonce({
  manche,
  nbErreurs,
  finie,
  formatPrix,
  t,
}: {
  manche: Manche;
  nbErreurs: number;
  finie: boolean;
  formatPrix: Intl.NumberFormat;
  t: T;
}) {
  if (manche.type === "competence") {
    return (
      <Image
        src={manche.icone}
        alt={t("pages.quizUI.altCompetence")}
        width={80}
        height={80}
        className="biseau-sm size-20 bg-nuit-800"
      />
    );
  }
  if (manche.type === "skin") {
    const zoom = finie ? 1 : ZOOMS[Math.min(nbErreurs, ZOOMS.length - 1)];
    return (
      <div className="biseau relative aspect-video w-full overflow-hidden border border-nuit-700 bg-nuit-800">
        <Image
          src={manche.image}
          alt={t(finie ? "pages.quizUI.altSkinEntier" : "pages.quizUI.altSkin")}
          fill
          sizes="(min-width: 768px) 720px, 100vw"
          draggable={false}
          className="select-none object-cover transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: `${manche.foyer[0] * 100}% ${manche.foyer[1] * 100}%` }}
        />
      </div>
    );
  }
  if (manche.type === "histoire") {
    return (
      <blockquote className="border-l-2 border-or-500 pl-4 leading-relaxed text-craie-200">
        {manche.extraits[0]}
      </blockquote>
    );
  }
  if (manche.type === "objet") {
    return (
      <div className="biseau-sm border border-nuit-700 bg-nuit-950/50 p-4">
        <ul className="space-y-1 text-sm text-craie-100">
          {manche.bonus.split(/,\s*(?=[+-])/).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {manche.prix !== null && (
          <p className="mt-3 text-sm font-semibold text-or-400">
            {t("pages.quizUI.prixObjet", { prix: formatPrix.format(manche.prix) })}
          </p>
        )}
      </div>
    );
  }
  return null;
}

function Resultat({
  manche,
  trouve,
  essais,
  cible,
  t,
}: {
  manche: Exclude<Manche, { type: "duel" }>;
  trouve: boolean;
  essais: number;
  cible: HerosQuiz | ObjetRoster | undefined;
  t: T;
}) {
  if (!cible) return null;
  const objet = manche.type === "objet";
  return (
    <div
      className={cn(
        "biseau mt-5 flex flex-wrap items-center gap-4 border p-4",
        trouve ? "border-emerald-500/60 bg-emerald-500/10" : "border-sang-500/50 bg-sang-500/10",
      )}
    >
      <PortraitHeros source={cible.icone} nom={cible.nom} taille="vignette" decoratif />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", trouve ? "text-emerald-300" : "text-sang-500")}>
          {trouve ? t("pages.quizUI.trouve", { n: essais, max: essaisMax(manche) }) : t("pages.quizUI.rate")}
        </p>
        <p className="font-titre text-xl font-bold text-craie-100">{cible.nom}</p>
        {manche.type === "skin" && (
          <p className="text-sm text-craie-300">{t("pages.quizUI.skinNom", { nom: manche.skin })}</p>
        )}
        {manche.type === "competence" && (
          <p className="text-sm text-craie-300">{t("pages.quizUI.competenceNom", { nom: manche.nom })}</p>
        )}
      </div>
      <Link
        href={objet ? `/items#${cible.slug}` : `/heroes/${cible.slug}`}
        className="text-sm font-semibold text-or-400 transition-colors hover:text-or-500"
      >
        {t(objet ? "pages.quizUI.voirObjet" : "pages.quizUI.voirFiche")} →
      </Link>
    </div>
  );
}

function Duel({
  manche,
  essais,
  catalogue,
  onEssai,
  formatTaux,
  t,
}: {
  manche: Extract<Manche, { type: "duel" }>;
  essais: string[];
  catalogue: CatalogueQuiz;
  onEssai: (slug: string) => void;
  formatTaux: Intl.NumberFormat;
  t: T;
}) {
  const bonnes = reponsesDuel(manche);
  return (
    <ol className="space-y-3">
      {manche.paires.map((paire, i) => {
        if (i > essais.length) return null;
        const choix = essais[i];
        const repondu = choix !== undefined;
        return (
          <li key={`${paire[0].slug}-${paire[1].slug}`}>
            {manche.paires.length > 1 && (
              <p className="mb-1.5 text-xs uppercase tracking-wide text-craie-500">
                {t("pages.quizUI.paire", { n: i + 1, max: manche.paires.length })}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {paire.map((d) => {
                const h = catalogue.herosParSlug.get(d.slug);
                const gagnant = d.slug === bonnes[i];
                const choisi = choix === d.slug;
                return (
                  <button
                    key={d.slug}
                    type="button"
                    disabled={repondu}
                    aria-pressed={repondu ? choisi : undefined}
                    onClick={() => onEssai(d.slug)}
                    className={cn(
                      "biseau-sm flex flex-col items-center gap-2 border p-3 text-center transition-colors",
                      !repondu && "border-nuit-600 hover:border-or-500 hover:bg-nuit-850",
                      repondu && gagnant && "border-emerald-500/60 bg-emerald-500/10",
                      repondu && !gagnant && "border-nuit-700/70 opacity-80",
                      repondu && choisi && !gagnant && "border-sang-500/60 bg-sang-500/10",
                    )}
                  >
                    <PortraitHeros source={h?.icone ?? null} nom={h?.nom ?? d.slug} taille="vignette" decoratif />
                    <span className="font-titre text-base font-bold text-craie-100">{h?.nom ?? d.slug}</span>
                    {repondu && (
                      <span
                        className={cn("text-sm tabular-nums", gagnant ? "text-emerald-300" : "text-craie-400")}
                      >
                        {t("pages.quizUI.victoire", { taux: formatTaux.format(d.victoire) })}
                      </span>
                    )}
                    {repondu && choisi && (
                      <span className="sr-only">
                        {t(gagnant ? "pages.quizUI.duelBon" : "pages.quizUI.duelFaux")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Dices, Eye, Share2, SkipForward } from "lucide-react";
import Link from "@/components/lien";
import { PartieClassique, PartieCompetence, type CatalogueMlbbdle } from "@/components/mlbbdle-parties";
import { PortraitHeros } from "@/components/portrait-heros";
import { GroupeFiltres, Puce } from "@/components/puce";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  enregistrerVictoire,
  grilleClassique,
  grilleCompetence,
  moyenneEssais,
  SEAU_MAX,
  textePartage,
  tirerAuHasard,
  type DefiMlbbdle,
  type EnigmeCompetence,
  type HerosMlbbdle,
} from "@/lib/mlbbdle";
import {
  chargerDefi,
  ecrireEntrainement,
  ecrirePartie,
  ecrireStats,
  lireEntrainement,
  lirePartie,
  lireStats,
  type EssaisJour,
  type ModeJour,
  type RecordEntrainement,
} from "@/lib/mlbbdle-stockage";
import { decalerJour, jourUtc, serieCourante, STATS_VIDES, type StatsQuiz } from "@/lib/quiz";
import { chargerPool } from "@/lib/quiz-stockage";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * MLBBdle : deux defis par jour (classique, competence), les memes pour tous,
 * et un entrainement sans fin.
 *
 * La page est statique : elle n'apporte que le roster compare. Le defi du
 * jour arrive apres le montage, pour la date UTC du visiteur
 * (`/mlbbdle/jour/<langue>-<date>.json`) ; l'entrainement du mode competence
 * reprend le vivier du quiz, a son ouverture seulement.
 */

type Mode = ModeJour | "entrainement";
const MODES_JOUR: ModeJour[] = ["classique", "competence"];

const boutonPrincipal =
  "biseau-sm inline-flex min-h-11 items-center justify-center gap-2 bg-or-500 px-4 py-2 font-semibold text-nuit-950 transition-colors hover:bg-or-400";
const boutonSecondaire =
  "biseau-sm inline-flex min-h-11 items-center justify-center gap-2 border border-nuit-600 px-4 py-2 text-sm text-craie-300 transition-colors hover:border-or-500 hover:text-or-400";

export function Mlbbdle({ heros, libelles }: { heros: HerosMlbbdle[]; libelles: Record<string, string> }) {
  const t = useT();
  const langue = useLangue();
  const catalogue = useMemo<CatalogueMlbbdle>(
    () => ({ heros, libelles, parSlug: new Map(heros.map((h) => [h.slug, h])) }),
    [heros, libelles],
  );
  const [mode, setMode] = useState<Mode>("classique");
  // L'entrainement n'est monte qu'a sa premiere ouverture, puis reste monte.
  const [entrainementOuvert, setEntrainementOuvert] = useState(false);
  const [jour, setJour] = useState<string | null>(null);
  const [defi, setDefi] = useState<DefiMlbbdle | "erreur" | null>(null);
  const [essais, setEssais] = useState<EssaisJour>({ classique: [], competence: [] });
  const [stats, setStats] = useState<Record<ModeJour, StatsQuiz>>({ classique: STATS_VIDES, competence: STATS_VIDES });
  const [tentative, setTentative] = useState(0);
  const titreVictoire = useRef<HTMLHeadingElement>(null);
  const focaliser = useRef(false);

  // Le jour et la memoire se lisent apres le montage : la page, statique, ne
  // connait ni l'heure ni le navigateur du visiteur.
  useEffect(() => {
    const aujourdhui = jourUtc(new Date());
    /* eslint-disable react-hooks/set-state-in-effect -- horloge et stockage lus apres montage */
    setJour(aujourdhui);
    setEssais(lirePartie(aujourdhui));
    setStats({ classique: lireStats("classique"), competence: lireStats("competence") });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!jour) return;
    let actif = true;
    chargerDefi(langue, jour).then(
      (d) => actif && setDefi(d),
      () => actif && setDefi("erreur"),
    );
    return () => {
      actif = false;
    };
  }, [jour, langue, tentative]);

  // Le focus passe au bilan quand le heros est trouve : un lecteur d'ecran l'annonce aussitot.
  useEffect(() => {
    if (!focaliser.current) return;
    focaliser.current = false;
    titreVictoire.current?.focus();
  }, [essais]);

  function choisirMode(m: Mode) {
    setMode(m);
    if (m === "entrainement") setEntrainementOuvert(true);
  }

  const reponseDe = (d: DefiMlbbdle, m: ModeJour) => (m === "classique" ? d.classique : d.competence?.reponse);
  const resolu = (m: ModeJour) => {
    const r = defi && defi !== "erreur" ? reponseDe(defi, m) : undefined;
    return Boolean(r && essais[m].includes(r));
  };

  function jouer(m: ModeJour, slug: string) {
    if (!jour || !defi || defi === "erreur") return;
    const reponse = reponseDe(defi, m);
    const actuels = essais[m];
    if (!reponse || actuels.includes(reponse) || actuels.includes(slug)) return;
    const suivants = { ...essais, [m]: [...actuels, slug] };
    setEssais(suivants);
    ecrirePartie(jour, suivants);
    if (slug === reponse) {
      const nouvelles = enregistrerVictoire(lireStats(m), jour, suivants[m].length);
      ecrireStats(m, nouvelles);
      setStats((s) => ({ ...s, [m]: nouvelles }));
      focaliser.current = true;
    }
  }

  function nouveauJour() {
    const aujourdhui = jourUtc(new Date());
    setDefi(null);
    setEssais(lirePartie(aujourdhui));
    setJour(aujourdhui);
  }

  return (
    <div>
      <GroupeFiltres legende={t("pages.mlbbdleUI.mode")} largeurLegende="" className="mb-6">
        {(["classique", "competence", "entrainement"] as const).map((m) => (
          <Puce key={m} actif={mode === m} onClick={() => choisirMode(m)}>
            <span className="inline-flex items-center gap-1.5">
              {t(`pages.mlbbdleUI.modes.${m}`)}
              {m !== "entrainement" && resolu(m) && (
                <>
                  <Check size={14} aria-hidden />
                  <span className="sr-only"> ({t("pages.mlbbdleUI.resolu")})</span>
                </>
              )}
            </span>
          </Puce>
        ))}
      </GroupeFiltres>

      {mode !== "entrainement" &&
        (defi === null || !jour ? (
          <p role="status" className="py-10 text-center text-sm text-craie-500">
            {t("pages.mlbbdleUI.chargement")}
          </p>
        ) : defi === "erreur" ? (
          <div role="alert" className="biseau border border-sang-500/40 bg-nuit-900/60 p-5 text-sm text-craie-300">
            <p>{t("pages.mlbbdleUI.erreurChargement")}</p>
            <button type="button" onClick={() => setTentative((n) => n + 1)} className={cn(boutonSecondaire, "mt-3")}>
              {t("pages.mlbbdleUI.reessayer")}
            </button>
          </div>
        ) : (
          <DefiDuJour
            key={`${defi.jour}-${mode}`}
            mode={mode}
            defi={defi}
            essais={essais[mode]}
            stats={stats[mode]}
            catalogue={catalogue}
            onEssai={(slug) => jouer(mode, slug)}
            refVictoire={titreVictoire}
            autreMode={MODES_JOUR.find((m) => m !== mode && !resolu(m)) ?? null}
            onMode={choisirMode}
            onNouveauJour={nouveauJour}
          />
        ))}

      {entrainementOuvert && (
        <div hidden={mode !== "entrainement"}>
          <Entrainement catalogue={catalogue} />
        </div>
      )}
    </div>
  );
}

function DefiDuJour({
  mode,
  defi,
  essais,
  stats,
  catalogue,
  onEssai,
  refVictoire,
  autreMode,
  onMode,
  onNouveauJour,
}: {
  mode: ModeJour;
  defi: DefiMlbbdle;
  essais: string[];
  stats: StatsQuiz;
  catalogue: CatalogueMlbbdle;
  onEssai: (slug: string) => void;
  refVictoire: React.Ref<HTMLHeadingElement>;
  autreMode: ModeJour | null;
  onMode: (m: Mode) => void;
  onNouveauJour: () => void;
}) {
  const t = useT();
  const langue = useLangue();
  const dateLisible = new Intl.DateTimeFormat(LOCALE_HTML[langue], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${defi.jour}T00:00:00Z`),
  );
  const reponse = mode === "classique" ? defi.classique : defi.competence?.reponse;
  const cible = reponse ? catalogue.parSlug.get(reponse) : undefined;
  const etiquette = t("pages.mlbbdleUI.numero", { n: defi.numero, date: dateLisible });

  if (!cible) {
    return (
      <p role="status" className="biseau border border-nuit-700/70 bg-nuit-900/60 p-5 text-sm text-craie-300">
        {t("pages.mlbbdleUI.indisponible")}
      </p>
    );
  }
  const trouve = essais.includes(cible.slug);

  return (
    <div className="space-y-5">
      {mode === "classique" ? (
        <PartieClassique cible={cible} essais={essais} catalogue={catalogue} onEssai={onEssai} etiquette={etiquette} />
      ) : (
        defi.competence && (
          <PartieCompetence
            enigme={defi.competence}
            essais={essais}
            catalogue={catalogue}
            onEssai={onEssai}
            etiquette={etiquette}
          />
        )
      )}
      {trouve && (
        <Victoire
          mode={mode}
          defi={defi}
          essais={essais}
          cible={cible}
          stats={stats}
          catalogue={catalogue}
          refTitre={refVictoire}
          autreMode={autreMode}
          onMode={onMode}
          onNouveauJour={onNouveauJour}
        />
      )}
    </div>
  );
}

function Victoire({
  mode,
  defi,
  essais,
  cible,
  stats,
  catalogue,
  refTitre,
  autreMode,
  onMode,
  onNouveauJour,
}: {
  mode: ModeJour;
  defi: DefiMlbbdle;
  essais: string[];
  cible: HerosMlbbdle;
  stats: StatsQuiz;
  catalogue: CatalogueMlbbdle;
  refTitre: React.Ref<HTMLHeadingElement>;
  autreMode: ModeJour | null;
  onMode: (m: Mode) => void;
  onNouveauJour: () => void;
}) {
  const t = useT();
  const langue = useLangue();
  const [statut, setStatut] = useState<"copie" | "partage" | "erreur" | null>(null);
  const serie = serieCourante(stats, defi.jour);
  const lignes =
    mode === "classique"
      ? grilleClassique(essais, cible, catalogue.parSlug)
      : [grilleCompetence(essais, cible.slug)];
  const titre = `${t("pages.mlbbdleUI.partageTitre", {
    n: defi.numero,
    mode: t(`pages.mlbbdleUI.modes.${mode}`),
    essais: essais.length,
  })}${serie >= 2 ? ` 🔥${serie}` : ""}`;
  const texte = textePartage({ titre, lignes, url: `${site.url}/${langue}/mlbbdle` });
  const distribution = Array.from({ length: SEAU_MAX }, (_, i) => stats.distribution[i + 1] ?? 0);
  const plusHaut = Math.max(1, ...distribution);
  const format = new Intl.NumberFormat(LOCALE_HTML[langue], { maximumFractionDigits: 1 });
  const hier = defi.hier?.[mode] ? catalogue.parSlug.get(defi.hier[mode]!) : undefined;
  const seau = Math.min(essais.length, SEAU_MAX);

  // Le partage natif sert sur mobile ; ailleurs, le presse-papiers suffit.
  async function partager() {
    const tactile = window.matchMedia("(pointer: coarse)").matches;
    if (tactile && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: texte });
        setStatut("partage");
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(texte);
      setStatut("copie");
    } catch {
      setStatut("erreur");
    }
  }

  return (
    <section className="relative p-4 sm:p-6">
      <div aria-hidden className="biseau absolute inset-0 border border-emerald-500/50 bg-nuit-900/70" />
      <div className="relative">
        <h3 ref={refTitre} tabIndex={-1} className="font-titre text-2xl font-bold text-craie-100 outline-none">
          {t("pages.mlbbdleUI.victoireTitre", { n: essais.length })}
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <PortraitHeros source={cible.icone} nom={cible.nom} taille="vignette" decoratif />
          <div className="min-w-0 flex-1">
            <p className="font-titre text-xl font-bold text-emerald-300">{cible.nom}</p>
            {mode === "competence" && defi.competence && (
              <p className="text-sm text-craie-300">{t("pages.mlbbdleUI.competenceEtait", { nom: defi.competence.nom })}</p>
            )}
          </div>
          <Link
            href={`/heroes/${cible.slug}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-or-400 transition-colors hover:text-or-500"
          >
            {t("pages.mlbbdleUI.voirFiche", { nom: cible.nom })} →
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <pre aria-hidden className="overflow-x-auto font-sans text-lg leading-snug tracking-wider sm:text-xl">
              {lignes.join("\n")}
            </pre>
            <p className="sr-only">{t("pages.mlbbdleUI.resumeGrille", { n: essais.length })}</p>
          </div>
          <div className="flex-1 space-y-3">
            <button type="button" onClick={partager} className={cn(boutonPrincipal, "w-full sm:w-auto")}>
              <Share2 size={16} aria-hidden />
              {t("pages.mlbbdleUI.partager")}
            </button>
            <p aria-live="polite" className="min-h-5 text-sm text-craie-300">
              {statut === "copie"
                ? t("pages.mlbbdleUI.copie")
                : statut === "partage"
                  ? t("pages.mlbbdleUI.partage")
                  : statut === "erreur"
                    ? t("pages.mlbbdleUI.erreurCopie")
                    : ""}
            </p>
            <ProchainDefi jour={defi.jour} onNouveauJour={onNouveauJour} />
            <div className="flex flex-wrap gap-2">
              {autreMode && (
                <button type="button" onClick={() => onMode(autreMode)} className={boutonSecondaire}>
                  {t("pages.mlbbdleUI.jouerMode", { mode: t(`pages.mlbbdleUI.modes.${autreMode}`) })} →
                </button>
              )}
              <button type="button" onClick={() => onMode("entrainement")} className={boutonSecondaire}>
                {t("pages.mlbbdleUI.entrainer")} →
              </button>
            </div>
          </div>
        </div>

        {hier && (
          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-craie-300">
            <span>{t("pages.mlbbdleUI.hier")}</span>
            <PortraitHeros source={hier.icone} nom={hier.nom} taille="petite" decoratif />
            <Link href={`/heroes/${hier.slug}`} className="font-semibold text-or-400 transition-colors hover:text-or-500">
              {hier.nom}
            </Link>
          </p>
        )}

        <h4 className="mt-8 text-xs uppercase tracking-wide text-craie-500">
          {t("pages.mlbbdleUI.statsTitre", { mode: t(`pages.mlbbdleUI.modes.${mode}`) })}
        </h4>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["joues", String(stats.joues)],
              ["serie", String(serie)],
              ["meilleure", String(stats.meilleure)],
              ["moyenne", format.format(moyenneEssais(stats))],
            ] as const
          ).map(([cle, valeur]) => (
            <div key={cle} className="biseau-sm border border-nuit-700/70 bg-nuit-950/40 p-3 text-center">
              <dt className="text-[0.7rem] uppercase tracking-wide text-craie-500">{t(`pages.mlbbdleUI.stats.${cle}`)}</dt>
              <dd className="font-titre text-2xl font-bold tabular-nums text-craie-100">{valeur}</dd>
            </div>
          ))}
        </dl>

        <h4 className="mt-6 text-xs uppercase tracking-wide text-craie-500">{t("pages.mlbbdleUI.distribution")}</h4>
        <ol className="mt-2 space-y-1">
          {distribution.map((n, i) => {
            const essaisCase = i + 1;
            const libelle = essaisCase === SEAU_MAX ? `${SEAU_MAX}+` : String(essaisCase);
            return (
              <li key={essaisCase} className="flex items-center gap-2 text-xs tabular-nums">
                <span aria-hidden className="w-8 shrink-0 text-right text-craie-400">
                  {libelle}
                </span>
                <span aria-hidden className="h-4 flex-1 bg-nuit-800">
                  <span
                    className={cn("block h-full", essaisCase === seau ? "bg-emerald-600" : "bg-nuit-600")}
                    style={{ width: `${Math.max(n ? 4 : 0, (n / plusHaut) * 100)}%` }}
                  />
                </span>
                <span aria-hidden className="w-8 shrink-0 text-craie-300">
                  {n}
                </span>
                <span className="sr-only">{t("pages.mlbbdleUI.distributionLigne", { essais: libelle, n })}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Compte a rebours jusqu'a minuit UTC ; passe minuit, le nouveau defi se lance d'un clic. */
function ProchainDefi({ jour, onNouveauJour }: { jour: string; onNouveauJour: () => void }) {
  const t = useT();
  const [restant, setRestant] = useState<number | null>(null);

  useEffect(() => {
    const fin = Date.parse(`${decalerJour(jour, 1)}T00:00:00Z`);
    const maj = () => setRestant(fin - Date.now());
    const premier = setTimeout(maj, 0);
    const minuterie = setInterval(maj, 1000);
    return () => {
      clearTimeout(premier);
      clearInterval(minuterie);
    };
  }, [jour]);

  if (restant === null) return null;
  if (restant <= 0) {
    return (
      <button type="button" onClick={onNouveauJour} className={boutonSecondaire}>
        {t("pages.mlbbdleUI.nouveauDefi")}
      </button>
    );
  }
  const deux = (n: number) => String(n).padStart(2, "0");
  const s = Math.floor(restant / 1000);
  const temps = `${deux(Math.floor(s / 3600))}:${deux(Math.floor((s % 3600) / 60))}:${deux(s % 60)}`;
  // Le texte change chaque seconde : hors de toute region annoncee.
  return (
    <p className="text-sm text-craie-400">
      {t("pages.mlbbdleUI.prochain")} <span className="font-semibold tabular-nums text-craie-100">{temps}</span>
    </p>
  );
}

// ─────────────────────────────────────────────────────────────
// Entrainement
// ─────────────────────────────────────────────────────────────

type Manche = { mode: "classique"; cible: string } | { mode: "competence"; enigme: EnigmeCompetence };

function Entrainement({ catalogue }: { catalogue: CatalogueMlbbdle }) {
  const t = useT();
  const langue = useLangue();
  const [type, setType] = useState<ModeJour>("classique");
  const [competences, setCompetences] = useState<Record<string, EnigmeCompetence[]> | "erreur" | null>(null);
  const [manche, setManche] = useState<Manche | null>(null);
  const [essais, setEssais] = useState<string[]>([]);
  const [revele, setRevele] = useState(false);
  const [numero, setNumero] = useState(1);
  const [record, setRecord] = useState<RecordEntrainement>({ trouves: 0, essais: 0, meilleur: null });
  const recents = useRef<string[]>([]);
  const titre = useRef<HTMLHeadingElement>(null);
  const focaliser = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stockage lu apres montage
    setRecord(lireEntrainement());
  }, []);

  // Le vivier des competences n'est demande qu'au premier passage en mode competence.
  useEffect(() => {
    if (type !== "competence" || competences !== null) return;
    let actif = true;
    chargerPool(langue).then(
      (pool) => {
        if (!actif) return;
        setCompetences(
          Object.fromEntries(
            Object.entries(pool.competences).map(([slug, liste]) => [
              slug,
              liste.map((c) => ({ reponse: slug, nom: c.nom, icone: c.icone, extrait: c.extrait })),
            ]),
          ),
        );
      },
      () => actif && setCompetences("erreur"),
    );
    return () => {
      actif = false;
    };
  }, [type, competences, langue]);

  useEffect(() => {
    if (!focaliser.current) return;
    focaliser.current = false;
    titre.current?.focus();
  }, [numero]);

  function tirer(m: ModeJour): Manche | null {
    if (m === "classique") {
      const cible = tirerAuHasard(catalogue.heros.map((h) => h.slug), recents.current);
      return cible ? { mode: m, cible } : null;
    }
    if (!competences || competences === "erreur") return null;
    const slug = tirerAuHasard(
      Object.keys(competences).filter((s) => catalogue.parSlug.has(s)),
      recents.current,
    );
    const liste = slug ? competences[slug] : [];
    return liste.length ? { mode: m, enigme: liste[Math.floor(Math.random() * liste.length)] } : null;
  }

  // La premiere manche d'un type se tire des que ses donnees sont la.
  const courante = manche && manche.mode === type ? manche : null;
  const pret = type === "classique" || (competences !== null && competences !== "erreur");
  useEffect(() => {
    if (courante || !pret) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tirage au hasard, apres montage seulement
    setManche(tirer(type));
    setEssais([]);
    setRevele(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tirer ne change qu'avec les donnees deja suivies
  }, [courante, pret, type]);

  const reponse = courante ? (courante.mode === "classique" ? courante.cible : courante.enigme.reponse) : null;
  const cible = reponse ? catalogue.parSlug.get(reponse) : undefined;
  const trouve = reponse !== null && essais.includes(reponse);
  const fini = trouve || revele;

  function jouer(slug: string) {
    if (!reponse || fini || essais.includes(slug)) return;
    const suivants = [...essais, slug];
    setEssais(suivants);
    if (slug !== reponse) return;
    const r: RecordEntrainement = {
      trouves: record.trouves + 1,
      essais: record.essais + suivants.length,
      meilleur: record.meilleur === null ? suivants.length : Math.min(record.meilleur, suivants.length),
    };
    setRecord(r);
    ecrireEntrainement(r);
  }

  function suivante() {
    if (reponse) recents.current = [reponse, ...recents.current].slice(0, 30);
    focaliser.current = true;
    setManche(tirer(type));
    setEssais([]);
    setRevele(false);
    setNumero((n) => n + 1);
  }

  const format = new Intl.NumberFormat(LOCALE_HTML[langue], { maximumFractionDigits: 1 });
  const etiquette = t("pages.mlbbdleUI.entrainementNumero", { n: numero });

  return (
    <div className="space-y-5">
      <GroupeFiltres legende={t("pages.mlbbdleUI.typeEntrainement")} largeurLegende="" className="gap-1.5">
        {MODES_JOUR.map((m) => (
          <Puce key={m} dense actif={type === m} onClick={() => setType(m)}>
            {t(`pages.mlbbdleUI.modes.${m}`)}
          </Puce>
        ))}
      </GroupeFiltres>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-craie-500">{t("pages.mlbbdleUI.entrainementTrouves")}</dt>
          <dd className="font-semibold tabular-nums text-craie-100">{record.trouves}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-craie-500">{t("pages.mlbbdleUI.stats.moyenne")}</dt>
          <dd className="font-semibold tabular-nums text-craie-100">
            {record.trouves ? format.format(record.essais / record.trouves) : "—"}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-craie-500">{t("pages.mlbbdleUI.entrainementMeilleur")}</dt>
          <dd className="font-semibold tabular-nums text-or-400">{record.meilleur ?? "—"}</dd>
        </div>
      </dl>

      {type === "competence" && competences === "erreur" ? (
        <div role="alert" className="biseau border border-sang-500/40 bg-nuit-900/60 p-5 text-sm text-craie-300">
          <p>{t("pages.mlbbdleUI.erreurChargement")}</p>
          <button type="button" onClick={() => setCompetences(null)} className={cn(boutonSecondaire, "mt-3")}>
            {t("pages.mlbbdleUI.reessayer")}
          </button>
        </div>
      ) : !courante || !cible ? (
        <p role="status" className="py-10 text-center text-sm text-craie-500">
          {t("pages.mlbbdleUI.chargement")}
        </p>
      ) : (
        <>
          {courante.mode === "classique" ? (
            <PartieClassique
              key={numero}
              cible={cible}
              essais={essais}
              catalogue={catalogue}
              onEssai={jouer}
              etiquette={etiquette}
              termine={revele}
              refTitre={titre}
            />
          ) : (
            <PartieCompetence
              key={numero}
              enigme={courante.enigme}
              essais={essais}
              catalogue={catalogue}
              onEssai={jouer}
              etiquette={etiquette}
              termine={revele}
              refTitre={titre}
            />
          )}

          {fini && (
            <div
              className={cn(
                "biseau flex flex-wrap items-center gap-4 border p-4",
                trouve ? "border-emerald-500/60 bg-emerald-500/10" : "border-sang-500/50 bg-sang-500/10",
              )}
            >
              <PortraitHeros source={cible.icone} nom={cible.nom} taille="vignette" decoratif />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", trouve ? "text-emerald-300" : "text-sang-500")}>
                  {trouve ? t("pages.mlbbdleUI.victoireTitre", { n: essais.length }) : t("pages.mlbbdleUI.reponseEtait")}
                </p>
                <p className="font-titre text-xl font-bold text-craie-100">{cible.nom}</p>
              </div>
              <Link
                href={`/heroes/${cible.slug}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-or-400 transition-colors hover:text-or-500"
              >
                {t("pages.mlbbdleUI.voirFiche", { nom: cible.nom })} →
              </Link>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {!fini && (
              <button type="button" onClick={() => setRevele(true)} className={boutonSecondaire}>
                <Eye size={15} aria-hidden />
                {t("pages.mlbbdleUI.reveler")}
              </button>
            )}
            <button type="button" onClick={suivante} className={fini ? boutonPrincipal : boutonSecondaire}>
              {fini ? <Dices size={16} aria-hidden /> : <SkipForward size={15} aria-hidden />}
              {t(fini ? "pages.mlbbdleUI.nouveauHeros" : "pages.mlbbdleUI.passer")}
            </button>
          </div>
          <p aria-live="polite" className="sr-only">
            {revele ? `${t("pages.mlbbdleUI.reponseEtait")} ${cible.nom}` : ""}
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Palette, Scale, ScrollText, Share2, Shield, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { GroupeFiltres, Puce } from "@/components/puce";
import { MancheQuiz, type CatalogueQuiz } from "@/components/quiz-manche";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import type { T } from "@/i18n/t";
import {
  decalerJour,
  enregistrerPartie,
  genererManche,
  jourUtc,
  ligneGrille,
  mancheFinie,
  mancheReussie,
  ORDRE_DEFI,
  pointsManche,
  pointsMax,
  reponsesDuel,
  serieCourante,
  STATS_VIDES,
  textePartage,
  type Defi,
  type HerosQuiz,
  type Manche,
  type ObjetRoster,
  type PoolQuiz,
  type StatsQuiz,
  type TypeManche,
} from "@/lib/quiz";
import {
  chargerDefi,
  chargerPool,
  ecrireEntrainement,
  ecrirePartie,
  ecrireStats,
  lireEntrainement,
  lirePartie,
  lireStats,
  type RecordEntrainement,
} from "@/lib/quiz-stockage";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Quiz MLBB : le defi du jour, le meme pour tous, et un entrainement sans fin.
 *
 * La page est statique : elle n'apporte que le roster (noms, icones, traits
 * compares). Le defi du jour arrive apres le montage, pour la date UTC du
 * visiteur (`/quiz/jour/<langue>-<date>.json`, quelques Ko) ; le vivier de
 * l'entrainement seulement a son ouverture. Tous deux restent sur l'appareil :
 * une fois la page visitee, le quiz se joue hors ligne.
 */

const ICONES: Record<TypeManche, LucideIcon> = {
  competence: Sparkles,
  skin: Palette,
  histoire: ScrollText,
  objet: Shield,
  duel: Scale,
};

const boutonPrincipal =
  "bevel-sm inline-flex items-center justify-center gap-2 bg-gold-500 px-4 py-2 font-semibold text-night-950 transition-colors hover:bg-gold-400";
const boutonSecondaire =
  "bevel-sm inline-flex items-center justify-center gap-2 border border-night-600 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400";

export function QuizMlbb({ heros, objets }: { heros: HerosQuiz[]; objets: ObjetRoster[] }) {
  const t = useT();
  const [mode, setMode] = useState<"jour" | "entrainement">("jour");
  // L'entrainement n'est monte qu'a sa premiere ouverture : son vivier ne se
  // telecharge pas pour qui ne fait que le defi. Il reste monte ensuite.
  const [entrainementOuvert, setEntrainementOuvert] = useState(false);
  const catalogue = useMemo<CatalogueQuiz>(
    () => ({
      heros,
      objets,
      herosParSlug: new Map(heros.map((h) => [h.slug, h])),
      objetsParSlug: new Map(objets.map((o) => [o.slug, o])),
    }),
    [heros, objets],
  );

  function choisirMode(m: "jour" | "entrainement") {
    setMode(m);
    if (m === "entrainement") setEntrainementOuvert(true);
  }

  return (
    <div>
      <GroupeFiltres legende={t("pages.quizUI.mode")} largeurLegende="" className="mb-6">
        <Puce actif={mode === "jour"} onClick={() => choisirMode("jour")}>
          {t("pages.quizUI.dailyMode")}
        </Puce>
        <Puce actif={mode === "entrainement"} onClick={() => choisirMode("entrainement")}>
          {t("pages.quizUI.practiceMode")}
        </Puce>
      </GroupeFiltres>
      <div hidden={mode !== "jour"}>
        <DefiDuJour catalogue={catalogue} onEntrainement={() => choisirMode("entrainement")} />
      </div>
      {entrainementOuvert && (
        <div hidden={mode !== "entrainement"}>
          <Entrainement catalogue={catalogue} />
        </div>
      )}
    </div>
  );
}

/** Premiere manche encore a jouer ; le nombre de manches quand tout est joue (le bilan). */
function mancheOuverte(defi: Defi, essais: string[][]): number {
  const i = defi.manches.findIndex((m, j) => !mancheFinie(m, essais[j] ?? []));
  return i < 0 ? defi.manches.length : i;
}

function DefiDuJour({ catalogue, onEntrainement }: { catalogue: CatalogueQuiz; onEntrainement: () => void }) {
  const t = useT();
  const langue = useLangue();
  const [jour, setJour] = useState<string | null>(null);
  const [etat, setEtat] = useState<{ defi: Defi; local: boolean } | "erreur" | null>(null);
  const [essais, setEssais] = useState<string[][]>([]);
  const [courante, setCourante] = useState(0);
  const [stats, setStats] = useState<StatsQuiz>(STATS_VIDES);
  const [tentative, setTentative] = useState(0);
  const titre = useRef<HTMLHeadingElement>(null);
  const titreBilan = useRef<HTMLHeadingElement>(null);
  const focaliser = useRef(false);

  // Le jour se lit apres le montage : la page, statique, ne connait ni
  // l'heure ni la memoire du visiteur.
  useEffect(() => {
    const aujourdhui = jourUtc(new Date());
    /* eslint-disable react-hooks/set-state-in-effect -- horloge et stockage lus apres montage */
    setJour(aujourdhui);
    setStats(lireStats());
    setEssais(lirePartie(aujourdhui) ?? []);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!jour) return;
    let actif = true;
    chargerDefi(langue, jour).then(
      (r) => {
        if (!actif) return;
        setEtat(r);
        setCourante(mancheOuverte(r.defi, lirePartie(jour) ?? []));
      },
      () => actif && setEtat("erreur"),
    );
    return () => {
      actif = false;
    };
  }, [jour, langue, tentative]);

  // Le focus suit la manche suivante : un lecteur d'ecran l'annonce aussitot.
  useEffect(() => {
    if (!focaliser.current) return;
    focaliser.current = false;
    (titre.current ?? titreBilan.current)?.focus();
  }, [courante]);

  if (etat === null || !jour) {
    return (
      <p role="status" className="py-10 text-center text-sm text-chalk-500">
        {t("pages.quizUI.loading")}
      </p>
    );
  }
  if (etat === "erreur") {
    return (
      <div role="alert" className="bevel border border-blood-500/40 bg-night-900/60 p-5 text-sm text-chalk-300">
        <p>{t("pages.quizUI.loadError")}</p>
        <button type="button" onClick={() => setTentative((n) => n + 1)} className={cn(boutonSecondaire, "mt-3")}>
          {t("pages.quizUI.retry")}
        </button>
      </div>
    );
  }

  const { defi } = etat;
  const termine = defi.manches.every((m, i) => mancheFinie(m, essais[i] ?? []));
  const dateLisible = new Intl.DateTimeFormat(LOCALE_HTML[langue], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${defi.jour}T00:00:00Z`),
  );

  function jouer(i: number, slug: string) {
    if (!jour || etat === null || etat === "erreur") return;
    const m = etat.defi.manches[i];
    const actuels = essais[i] ?? [];
    if (mancheFinie(m, actuels)) return;
    const suivants = etat.defi.manches.map((_, j) => (j === i ? [...actuels, slug] : (essais[j] ?? [])));
    setEssais(suivants);
    ecrirePartie(jour, suivants);
    if (etat.defi.manches.every((mm, j) => mancheFinie(mm, suivants[j]))) {
      const points = etat.defi.manches.reduce((n, mm, j) => n + pointsManche(mm, suivants[j]), 0);
      const nouvelles = enregistrerPartie(lireStats(), jour, points);
      setStats(nouvelles);
      ecrireStats(nouvelles);
    }
  }

  function aller(i: number) {
    focaliser.current = true;
    setCourante(i);
  }

  function nouveauJour() {
    const aujourdhui = jourUtc(new Date());
    setEtat(null);
    setEssais(lirePartie(aujourdhui) ?? []);
    setCourante(0);
    setJour(aujourdhui);
  }

  const manche = defi.manches[courante];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-heading text-lg font-bold text-gold-400">
          {t("pages.quizUI.puzzleNumber", { n: defi.numero, date: dateLisible })}
        </p>
        {etat.local && <p className="text-xs text-chalk-500">{t("pages.quizUI.offline")}</p>}
      </div>

      <nav aria-label={t("pages.quizUI.steps")}>
        <ol className="grid grid-cols-6 gap-1.5">
          {defi.manches.map((m, i) => {
            const finie = mancheFinie(m, essais[i] ?? []);
            const reussie = finie && mancheReussie(m, essais[i] ?? []);
            const Icone = ICONES[m.type];
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => aller(i)}
                  aria-current={i === courante ? "step" : undefined}
                  aria-label={`${t("pages.quizUI.round", { n: i + 1, max: defi.manches.length })} · ${t(`pages.quizUI.types.${m.type}`)}${finie ? ` · ${t(reussie ? "pages.quizUI.stepSolved" : "pages.quizUI.stepMissed")}` : ""}`}
                  className={cn(
                    "bevel-sm flex h-11 w-full items-center justify-center border transition-colors",
                    i === courante ? "border-gold-500 bg-gold-500/15 text-gold-400" : "border-night-700 text-chalk-500",
                    finie && reussie && i !== courante && "border-emerald-500/50 text-emerald-400",
                    finie && !reussie && i !== courante && "border-blood-500/40 text-blood-500",
                    "hover:border-gold-500/70",
                  )}
                >
                  <Icone size={18} aria-hidden />
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => aller(defi.manches.length)}
              disabled={!termine}
              aria-current={courante === defi.manches.length ? "step" : undefined}
              aria-label={t("pages.quizUI.stepSummary")}
              className={cn(
                "bevel-sm flex h-11 w-full items-center justify-center border transition-colors disabled:opacity-40",
                courante === defi.manches.length
                  ? "border-gold-500 bg-gold-500/15 text-gold-400"
                  : "border-night-700 text-chalk-500 enabled:hover:border-gold-500/70",
              )}
            >
              <Trophy size={18} aria-hidden />
            </button>
          </li>
        </ol>
      </nav>

      {manche ? (
        <>
          <MancheQuiz
            key={courante}
            manche={manche}
            essais={essais[courante] ?? []}
            catalogue={catalogue}
            onEssai={(slug) => jouer(courante, slug)}
            etiquette={t("pages.quizUI.round", { n: courante + 1, max: defi.manches.length })}
            refTitre={titre}
            mesure={defi.mesure}
          />
          {mancheFinie(manche, essais[courante] ?? []) && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => aller(termine ? defi.manches.length : mancheOuverte(defi, essais))}
                className={boutonPrincipal}
              >
                {termine ? t("pages.quizUI.seeSummary") : t("pages.quizUI.nextRound")} →
              </button>
            </div>
          )}
        </>
      ) : (
        <Bilan
          defi={defi}
          essais={essais}
          stats={stats}
          jour={jour}
          refTitre={titreBilan}
          onEntrainement={onEntrainement}
          onNouveauJour={nouveauJour}
        />
      )}
    </div>
  );
}

function Bilan({
  defi,
  essais,
  stats,
  jour,
  refTitre,
  onEntrainement,
  onNouveauJour,
}: {
  defi: Defi;
  essais: string[][];
  stats: StatsQuiz;
  jour: string;
  refTitre: React.Ref<HTMLHeadingElement>;
  onEntrainement: () => void;
  onNouveauJour: () => void;
}) {
  const t = useT();
  const langue = useLangue();
  const [statut, setStatut] = useState<"copie" | "partage" | "erreur" | null>(null);
  const points = defi.manches.reduce((n, m, i) => n + pointsManche(m, essais[i] ?? []), 0);
  const max = pointsMax(defi.manches);
  const lignes = defi.manches.map((m, i) => ligneGrille(m, essais[i] ?? []));
  const serie = serieCourante(stats, jour);
  const texte = textePartage({ numero: defi.numero, points, max, serie, lignes, url: `${site.url}/${langue}/quiz` });
  const distribution = Array.from({ length: max + 1 }, (_, i) => stats.distribution[i] ?? 0);
  const plusHaut = Math.max(1, ...distribution);
  const moyenne = stats.joues ? distribution.reduce((s, n, i) => s + n * i, 0) / stats.joues : 0;
  const format = new Intl.NumberFormat(LOCALE_HTML[langue], { maximumFractionDigits: 1 });

  // Le partage natif sert sur mobile ; ailleurs, il ouvrirait une fenetre
  // systeme la ou le presse-papiers suffit.
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
    <section className="bevel border border-gold-500/40 bg-night-900/60 p-4 sm:p-6">
      <h3 ref={refTitre} tabIndex={-1} className="font-heading text-2xl font-bold text-chalk-100 outline-none">
        {t("pages.quizUI.summaryTitle", { points, max })}
      </h3>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div>
          <pre aria-hidden className="font-sans text-xl leading-snug tracking-wider sm:text-2xl">
            {lignes.join("\n")}
          </pre>
          <ul className="sr-only">
            {defi.manches.map((m, i) => (
              <li key={i}>{resume(m, essais[i] ?? [], t)}</li>
            ))}
          </ul>
        </div>
        <div className="flex-1 space-y-3">
          <button type="button" onClick={partager} className={cn(boutonPrincipal, "w-full sm:w-auto")}>
            <Share2 size={16} aria-hidden />
            {t("pages.quizUI.share")}
          </button>
          <p aria-live="polite" className="min-h-5 text-sm text-chalk-300">
            {statut === "copie"
              ? t("pages.quizUI.copied")
              : statut === "partage"
                ? t("pages.quizUI.shared")
                : statut === "erreur"
                  ? t("pages.quizUI.copyError")
                  : ""}
          </p>
          <ProchainDefi jour={jour} onNouveauJour={onNouveauJour} />
          <button type="button" onClick={onEntrainement} className={boutonSecondaire}>
            {t("pages.quizUI.practise")} →
          </button>
        </div>
      </div>

      <h4 className="mt-8 text-xs uppercase tracking-wide text-chalk-500">{t("pages.quizUI.statsTitle")}</h4>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["joues", String(stats.joues)],
            ["serie", String(serie)],
            ["meilleure", String(stats.meilleure)],
            ["moyenne", `${format.format(moyenne)}/${max}`],
          ] as const
        ).map(([cle, valeur]) => (
          <div key={cle} className="bevel-sm border border-night-700/70 bg-night-950/40 p-3 text-center">
            <dt className="text-[0.7rem] uppercase tracking-wide text-chalk-500">{t(`pages.quizUI.stats.${cle}`)}</dt>
            <dd className="font-heading text-2xl font-bold tabular-nums text-chalk-100">{valeur}</dd>
          </div>
        ))}
      </dl>

      <h4 className="mt-6 text-xs uppercase tracking-wide text-chalk-500">{t("pages.quizUI.distribution")}</h4>
      <ol className="mt-2 space-y-1">
        {distribution.map((n, score) => (
          <li key={score} className="flex items-center gap-2 text-xs tabular-nums">
            <span className="w-8 shrink-0 text-right text-chalk-400">{score}</span>
            <span aria-hidden className="h-4 flex-1 bg-night-800">
              <span
                className={cn("block h-full", score === points ? "bg-gold-500" : "bg-night-600")}
                style={{ width: `${Math.max(n ? 4 : 0, (n / plusHaut) * 100)}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-chalk-300">{n}</span>
            <span className="sr-only">{t("pages.quizUI.distributionRow", { score, n })}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Resume d'une manche pour les lecteurs d'ecran : la grille d'emojis ne se lit pas. */
function resume(m: Manche, essais: string[], t: T): string {
  const type = t(`pages.quizUI.types.${m.type}`);
  if (m.type === "duel") {
    return t("pages.quizUI.summaryDuel", { type, n: pointsManche(m, essais), max: m.paires.length });
  }
  return mancheReussie(m, essais)
    ? t("pages.quizUI.summaryFound", { type, n: essais.length })
    : t("pages.quizUI.summaryMissed", { type });
}

/** Compte a rebours jusqu'a minuit UTC ; passe minuit, le nouveau defi se lance d'un clic. */
function ProchainDefi({ jour, onNouveauJour }: { jour: string; onNouveauJour: () => void }) {
  const t = useT();
  const [restant, setRestant] = useState<number | null>(null);

  useEffect(() => {
    const fin = Date.parse(`${decalerJour(jour, 1)}T00:00:00Z`);
    const maj = () => setRestant(fin - Date.now());
    const premier = setTimeout(maj, 0);
    const minuterie = setInterval(maj, 20_000);
    return () => {
      clearTimeout(premier);
      clearInterval(minuterie);
    };
  }, [jour]);

  if (restant === null) return null;
  if (restant <= 0) {
    return (
      <button type="button" onClick={onNouveauJour} className={boutonSecondaire}>
        {t("pages.quizUI.newPuzzle")}
      </button>
    );
  }
  const h = Math.floor(restant / 3_600_000);
  const m = Math.floor((restant % 3_600_000) / 60_000);
  return <p className="text-sm text-chalk-500">{t("pages.quizUI.next", { h, m })}</p>;
}

/** Une manche au hasard, d'un des types choisis, en evitant les reponses recentes. */
function tirer(pool: PoolQuiz, types: TypeManche[], recents: string[]): Manche | null {
  const type = types[Math.floor(Math.random() * types.length)] ?? "competence";
  const aleatoire = () => Math.random();
  return (
    genererManche(pool, type, aleatoire, { exclus: new Set(recents) }) ?? genererManche(pool, type, aleatoire)
  );
}

function reponsesDe(m: Manche): string[] {
  return m.type === "duel" ? reponsesDuel(m).concat(m.paires.flat().map((d) => d.slug)) : [m.reponse];
}

function Entrainement({ catalogue }: { catalogue: CatalogueQuiz }) {
  const t = useT();
  const langue = useLangue();
  const [pool, setPool] = useState<PoolQuiz | "erreur" | null>(null);
  const [types, setTypes] = useState<TypeManche[]>(ORDRE_DEFI);
  const [manche, setManche] = useState<Manche | null>(null);
  const [essais, setEssais] = useState<string[]>([]);
  const [serie, setSerie] = useState(0);
  const [record, setRecord] = useState<RecordEntrainement>({ meilleure: 0, jouees: 0, reussies: 0 });
  const [numero, setNumero] = useState(1);
  const [tentative, setTentative] = useState(0);
  const recents = useRef<string[]>([]);
  const titre = useRef<HTMLHeadingElement>(null);
  const focaliser = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stockage lu apres montage
    setRecord(lireEntrainement());
  }, []);

  useEffect(() => {
    let actif = true;
    chargerPool(langue).then(
      (p) => {
        if (!actif) return;
        setPool(p);
        setManche(tirer(p, ORDRE_DEFI, recents.current));
        setEssais([]);
      },
      () => actif && setPool("erreur"),
    );
    return () => {
      actif = false;
    };
  }, [langue, tentative]);

  useEffect(() => {
    if (!focaliser.current) return;
    focaliser.current = false;
    titre.current?.focus();
  }, [numero]);

  if (pool === null) {
    return (
      <p role="status" className="py-10 text-center text-sm text-chalk-500">
        {t("pages.quizUI.loading")}
      </p>
    );
  }
  if (pool === "erreur" || !manche) {
    return (
      <div role="alert" className="bevel border border-blood-500/40 bg-night-900/60 p-5 text-sm text-chalk-300">
        <p>{t("pages.quizUI.loadError")}</p>
        <button type="button" onClick={() => setTentative((n) => n + 1)} className={cn(boutonSecondaire, "mt-3")}>
          {t("pages.quizUI.retry")}
        </button>
      </div>
    );
  }

  const finie = mancheFinie(manche, essais);

  function jouer(slug: string) {
    if (!manche || mancheFinie(manche, essais)) return;
    const suivants = [...essais, slug];
    setEssais(suivants);
    if (!mancheFinie(manche, suivants)) return;
    const reussie = mancheReussie(manche, suivants);
    const nouvelleSerie = reussie ? serie + 1 : 0;
    const r = {
      meilleure: Math.max(record.meilleure, nouvelleSerie),
      jouees: record.jouees + 1,
      reussies: record.reussies + (reussie ? 1 : 0),
    };
    setSerie(nouvelleSerie);
    setRecord(r);
    ecrireEntrainement(r);
  }

  function suivante() {
    if (!manche || pool === null || pool === "erreur") return;
    recents.current = [...reponsesDe(manche), ...recents.current].slice(0, 40);
    focaliser.current = true;
    setManche(tirer(pool, types, recents.current));
    setEssais([]);
    setNumero((n) => n + 1);
  }

  function basculer(type: TypeManche) {
    setTypes((liste) =>
      liste.includes(type) ? (liste.length > 1 ? liste.filter((x) => x !== type) : liste) : [...liste, type],
    );
  }

  return (
    <div className="space-y-5">
      <GroupeFiltres legende={t("pages.quizUI.typeFilters")} largeurLegende="" className="gap-1.5">
        {ORDRE_DEFI.map((type) => (
          <Puce key={type} dense actif={types.includes(type)} onClick={() => basculer(type)}>
            {t(`pages.quizUI.types.${type}`)}
          </Puce>
        ))}
      </GroupeFiltres>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-chalk-500">{t("pages.quizUI.practiceStreak")}</dt>
          <dd className="font-semibold tabular-nums text-gold-400">{serie}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-chalk-500">{t("pages.quizUI.record")}</dt>
          <dd className="font-semibold tabular-nums text-chalk-100">{record.meilleure}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-chalk-500">{t("pages.quizUI.successRate")}</dt>
          <dd className="font-semibold tabular-nums text-chalk-100">
            {record.reussies}/{record.jouees}
          </dd>
        </div>
      </dl>

      <MancheQuiz
        key={numero}
        manche={manche}
        essais={essais}
        catalogue={catalogue}
        onEssai={jouer}
        etiquette={t("pages.quizUI.question", { n: numero })}
        refTitre={titre}
        mesure={pool.mesure}
      />
      {finie && (
        <div className="flex justify-end">
          <button type="button" onClick={suivante} className={boutonPrincipal}>
            {t("pages.quizUI.nextQuestion")} →
          </button>
        </div>
      )}
    </div>
  );
}

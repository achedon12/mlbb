"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Palette, Scale, ScrollText, Share2, Shield, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { FilterGroup, Chip } from "@/components/chip";
import { RoundQuiz, type CatalogQuiz } from "@/components/quiz-round";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import type { T } from "@/i18n/t";
import {
  shiftDay,
  saveMatch,
  generateRound,
  dayUtc,
  rowGrid,
  roundFinished,
  roundSuccessful,
  ORDER_CHALLENGE,
  pointsRound,
  pointsMax,
  responsesDuel,
  currentStreak,
  STATS_EMPTY,
  textShare,
  type Challenge,
  type QuizHero,
  type Round,
  type ItemRoster,
  type PoolQuiz,
  type StatsQuiz,
  type TypeRound,
} from "@/lib/quiz";
import {
  loadChallenge,
  loadPool,
  writePractice,
  writeMatch,
  writeStats,
  readPractice,
  readMatch,
  readStats,
  type RecordPractice,
} from "@/lib/quiz-storage";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Quiz MLBB : le defi du jour, le meme pour tous, et un entrainement sans fin.
 *
 * La page est statique : elle n'apporte que le roster (noms, icones, traits
 * compares). Le defi du jour arrive apres le montage, pour la date UTC du
 * visiteur (`/quiz/day/<langue>-<date>.json`, quelques Ko) ; le vivier de
 * l'entrainement seulement a son ouverture. Tous deux restent sur l'appareil :
 * une fois la page visitee, le quiz se joue hors ligne.
 */

const ICONS: Record<TypeRound, LucideIcon> = {
  skill: Sparkles,
  skin: Palette,
  story: ScrollText,
  item: Shield,
  duel: Scale,
};

const buttonMain =
  "bevel-sm inline-flex items-center justify-center gap-2 bg-gold-500 px-4 py-2 font-semibold text-night-950 transition-colors hover:bg-gold-400";
const secondaryButton =
  "bevel-sm inline-flex items-center justify-center gap-2 border border-night-600 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400";

export function QuizMlbb({ heroes, items }: { heroes: QuizHero[]; items: ItemRoster[] }) {
  const t = useT();
  const [mode, setMode] = useState<"daily" | "practice">("daily");
  // L'entrainement n'est monte qu'a sa premiere ouverture : son vivier ne se
  // telecharge pas pour qui ne fait que le defi. Il reste monte ensuite.
  const [practiceOpen, setPracticeOpen] = useState(false);
  const catalog = useMemo<CatalogQuiz>(
    () => ({
      heroes,
      items,
      heroesBySlug: new Map(heroes.map((h) => [h.slug, h])),
      itemsBySlug: new Map(items.map((o) => [o.slug, o])),
      heroChoices: heroes.map((h) => ({ slug: h.slug, name: h.nom, icon: h.icone, roles: h.roles, lanes: h.lanes })),
      itemChoices: items.map((o) => ({ slug: o.slug, name: o.nom, icon: o.icone })),
    }),
    [heroes, items],
  );

  function chooseMode(m: "daily" | "practice") {
    setMode(m);
    if (m === "practice") setPracticeOpen(true);
  }

  return (
    <div>
      <FilterGroup legend={t("pages.quizUI.mode")} widthLegend="" className="mb-6">
        <Chip active={mode === "daily"} onClick={() => chooseMode("daily")}>
          {t("pages.quizUI.dailyMode")}
        </Chip>
        <Chip active={mode === "practice"} onClick={() => chooseMode("practice")}>
          {t("pages.quizUI.practiceMode")}
        </Chip>
      </FilterGroup>
      <div hidden={mode !== "daily"}>
        <ChallengeOfDay catalog={catalog} onPractice={() => chooseMode("practice")} />
      </div>
      {practiceOpen && (
        <div hidden={mode !== "practice"}>
          <Practice catalog={catalog} />
        </div>
      )}
    </div>
  );
}

/** Premiere manche encore a jouer ; le nombre de manches quand tout est joue (le bilan). */
function roundOpen(challenge: Challenge, attempts: string[][]): number {
  const i = challenge.manches.findIndex((m, j) => !roundFinished(m, attempts[j] ?? []));
  return i < 0 ? challenge.manches.length : i;
}

function ChallengeOfDay({ catalog, onPractice }: { catalog: CatalogQuiz; onPractice: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<{ challenge: Challenge; local: boolean } | "error" | null>(null);
  const [attempts, setAttempts] = useState<string[][]>([]);
  const [current, setCurrent] = useState(0);
  const [stats, setStats] = useState<StatsQuiz>(STATS_EMPTY);
  const [tentative, setTentative] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const titleSummary = useRef<HTMLHeadingElement>(null);
  const focus = useRef(false);

  // Le jour se lit apres le montage : la page, statique, ne connait ni
  // l'heure ni la memoire du visiteur.
  useEffect(() => {
    const today = dayUtc(new Date());
    /* eslint-disable react-hooks/set-state-in-effect -- horloge et stockage lus apres montage */
    setDay(today);
    setStats(readStats());
    setAttempts(readMatch(today) ?? []);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!day) return;
    let active = true;
    loadChallenge(locale, day).then(
      (r) => {
        if (!active) return;
        setState(r);
        setCurrent(roundOpen(r.challenge, readMatch(day) ?? []));
      },
      () => active && setState("error"),
    );
    return () => {
      active = false;
    };
  }, [day, locale, tentative]);

  // Le focus suit la manche suivante : un lecteur d'ecran l'annonce aussitot.
  useEffect(() => {
    if (!focus.current) return;
    focus.current = false;
    (title.current ?? titleSummary.current)?.focus();
  }, [current]);

  if (state === null || !day) {
    return (
      <p role="status" className="py-10 text-center text-sm text-chalk-500">
        {t("pages.quizUI.loading")}
      </p>
    );
  }
  if (state === "error") {
    return (
      <div role="alert" className="bevel border border-blood-500/40 bg-night-900/60 p-5 text-sm text-chalk-300">
        <p>{t("pages.quizUI.loadError")}</p>
        <button type="button" onClick={() => setTentative((n) => n + 1)} className={cn(secondaryButton, "mt-3")}>
          {t("pages.quizUI.retry")}
        </button>
      </div>
    );
  }

  const { challenge } = state;
  const allFinished = challenge.manches.every((m, i) => roundFinished(m, attempts[i] ?? []));
  const readableDate = new Intl.DateTimeFormat(LOCALE_HTML[locale], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${challenge.jour}T00:00:00Z`),
  );

  function play(i: number, slug: string) {
    if (!day || state === null || state === "error") return;
    const m = state.challenge.manches[i];
    const currentGuesses = attempts[i] ?? [];
    if (roundFinished(m, currentGuesses)) return;
    const nextGuesses = state.challenge.manches.map((_, j) => (j === i ? [...currentGuesses, slug] : (attempts[j] ?? [])));
    setAttempts(nextGuesses);
    writeMatch(day, nextGuesses);
    if (state.challenge.manches.every((mm, j) => roundFinished(mm, nextGuesses[j]))) {
      const points = state.challenge.manches.reduce((n, mm, j) => n + pointsRound(mm, nextGuesses[j]), 0);
      const nextStats = saveMatch(readStats(), day, points);
      setStats(nextStats);
      writeStats(nextStats);
    }
  }

  function aller(i: number) {
    focus.current = true;
    setCurrent(i);
  }

  function newDay() {
    const today = dayUtc(new Date());
    setState(null);
    setAttempts(readMatch(today) ?? []);
    setCurrent(0);
    setDay(today);
  }

  const round = challenge.manches[current];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-heading text-lg font-bold text-gold-400">
          {t("pages.quizUI.puzzleNumber", { n: challenge.numero, date: readableDate })}
        </p>
        {state.local && <p className="text-xs text-chalk-500">{t("pages.quizUI.offline")}</p>}
      </div>

      <nav aria-label={t("pages.quizUI.steps")}>
        <ol className="grid grid-cols-6 gap-1.5">
          {challenge.manches.map((m, i) => {
            const finished = roundFinished(m, attempts[i] ?? []);
            const successful = finished && roundSuccessful(m, attempts[i] ?? []);
            const Icon = ICONS[m.type];
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => aller(i)}
                  aria-current={i === current ? "step" : undefined}
                  aria-label={`${t("pages.quizUI.round", { n: i + 1, max: challenge.manches.length })} · ${t(`pages.quizUI.types.${m.type}`)}${finished ? ` · ${t(successful ? "pages.quizUI.stepSolved" : "pages.quizUI.stepMissed")}` : ""}`}
                  className={cn(
                    "bevel-sm flex h-11 w-full items-center justify-center border transition-colors",
                    i === current ? "border-gold-500 bg-gold-500/15 text-gold-400" : "border-night-700 text-chalk-500",
                    finished && successful && i !== current && "border-emerald-500/50 text-emerald-400",
                    finished && !successful && i !== current && "border-blood-500/40 text-blood-500",
                    "hover:border-gold-500/70",
                  )}
                >
                  <Icon size={18} aria-hidden />
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => aller(challenge.manches.length)}
              disabled={!allFinished}
              aria-current={current === challenge.manches.length ? "step" : undefined}
              aria-label={t("pages.quizUI.stepSummary")}
              className={cn(
                "bevel-sm flex h-11 w-full items-center justify-center border transition-colors disabled:opacity-40",
                current === challenge.manches.length
                  ? "border-gold-500 bg-gold-500/15 text-gold-400"
                  : "border-night-700 text-chalk-500 enabled:hover:border-gold-500/70",
              )}
            >
              <Trophy size={18} aria-hidden />
            </button>
          </li>
        </ol>
      </nav>

      {round ? (
        <>
          <RoundQuiz
            key={current}
            round={round}
            attempts={attempts[current] ?? []}
            catalog={catalog}
            onAttempt={(slug) => play(current, slug)}
            roundLabel={t("pages.quizUI.round", { n: current + 1, max: challenge.manches.length })}
            refTitle={title}
            measure={challenge.mesure}
          />
          {roundFinished(round, attempts[current] ?? []) && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => aller(allFinished ? challenge.manches.length : roundOpen(challenge, attempts))}
                className={buttonMain}
              >
                {allFinished ? t("pages.quizUI.seeSummary") : t("pages.quizUI.nextRound")} →
              </button>
            </div>
          )}
        </>
      ) : (
        <Summary
          challenge={challenge}
          attempts={attempts}
          stats={stats}
          day={day}
          refTitle={titleSummary}
          onPractice={onPractice}
          onNewDay={newDay}
        />
      )}
    </div>
  );
}

function Summary({
  challenge,
  attempts,
  stats,
  day,
  refTitle,
  onPractice,
  onNewDay,
}: {
  challenge: Challenge;
  attempts: string[][];
  stats: StatsQuiz;
  day: string;
  refTitle: React.Ref<HTMLHeadingElement>;
  onPractice: () => void;
  onNewDay: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [status, setStatus] = useState<"copied" | "shared" | "error" | null>(null);
  const points = challenge.manches.reduce((n, m, i) => n + pointsRound(m, attempts[i] ?? []), 0);
  const max = pointsMax(challenge.manches);
  const rows = challenge.manches.map((m, i) => rowGrid(m, attempts[i] ?? []));
  const series = currentStreak(stats, day);
  const text = textShare({ number: challenge.numero, points, max, series, rows, url: `${site.url}/${locale}/quiz` });
  const distribution = Array.from({ length: max + 1 }, (_, i) => stats.distribution[i] ?? 0);
  const higher = Math.max(1, ...distribution);
  const average = stats.joues ? distribution.reduce((s, n, i) => s + n * i, 0) / stats.joues : 0;
  const format = new Intl.NumberFormat(LOCALE_HTML[locale], { maximumFractionDigits: 1 });

  // Le partage natif sert sur mobile ; ailleurs, il ouvrirait une fenetre
  // systeme la ou le presse-papiers suffit.
  async function share() {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        setStatus("shared");
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="bevel border border-gold-500/40 bg-night-900/60 p-4 sm:p-6">
      <h3 ref={refTitle} tabIndex={-1} className="font-heading text-2xl font-bold text-chalk-100 outline-none">
        {t("pages.quizUI.summaryTitle", { points, max })}
      </h3>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div>
          <pre aria-hidden className="font-sans text-xl leading-snug tracking-wider sm:text-2xl">
            {rows.join("\n")}
          </pre>
          <ul className="sr-only">
            {challenge.manches.map((m, i) => (
              <li key={i}>{summary(m, attempts[i] ?? [], t)}</li>
            ))}
          </ul>
        </div>
        <div className="flex-1 space-y-3">
          <button type="button" onClick={share} className={cn(buttonMain, "w-full sm:w-auto")}>
            <Share2 size={16} aria-hidden />
            {t("pages.quizUI.share")}
          </button>
          <p aria-live="polite" className="min-h-5 text-sm text-chalk-300">
            {status === "copied"
              ? t("pages.quizUI.copied")
              : status === "shared"
                ? t("pages.quizUI.shared")
                : status === "error"
                  ? t("pages.quizUI.copyError")
                  : ""}
          </p>
          <NextChallenge day={day} onNewDay={onNewDay} />
          <button type="button" onClick={onPractice} className={secondaryButton}>
            {t("pages.quizUI.practise")} →
          </button>
        </div>
      </div>

      <h4 className="mt-8 text-xs uppercase tracking-wide text-chalk-500">{t("pages.quizUI.statsTitle")}</h4>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["played", String(stats.joues)],
            ["series", String(series)],
            ["best", String(stats.meilleure)],
            ["average", `${format.format(average)}/${max}`],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="bevel-sm border border-night-700/70 bg-night-950/40 p-3 text-center">
            <dt className="text-[0.7rem] uppercase tracking-wide text-chalk-500">{t(`pages.quizUI.stats.${key}`)}</dt>
            <dd className="font-heading text-2xl font-bold tabular-nums text-chalk-100">{value}</dd>
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
                style={{ width: `${Math.max(n ? 4 : 0, (n / higher) * 100)}%` }}
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
function summary(m: Round, attempts: string[], t: T): string {
  const type = t(`pages.quizUI.types.${m.type}`);
  if (m.type === "duel") {
    return t("pages.quizUI.summaryDuel", { type, n: pointsRound(m, attempts), max: m.paires.length });
  }
  return roundSuccessful(m, attempts)
    ? t("pages.quizUI.summaryFound", { type, n: attempts.length })
    : t("pages.quizUI.summaryMissed", { type });
}

/** Compte a rebours jusqu'a minuit UTC ; passe minuit, le nouveau defi se lance d'un clic. */
function NextChallenge({ day, onNewDay }: { day: string; onNewDay: () => void }) {
  const t = useT();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const end = Date.parse(`${shiftDay(day, 1)}T00:00:00Z`);
    const maj = () => setRemaining(end - Date.now());
    const first = setTimeout(maj, 0);
    const timer = setInterval(maj, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [day]);

  if (remaining === null) return null;
  if (remaining <= 0) {
    return (
      <button type="button" onClick={onNewDay} className={secondaryButton}>
        {t("pages.quizUI.newPuzzle")}
      </button>
    );
  }
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return <p className="text-sm text-chalk-500">{t("pages.quizUI.next", { h, m })}</p>;
}

/** Une manche au hasard, d'un des types choisis, en evitant les reponses recentes. */
function draw(pool: PoolQuiz, types: TypeRound[], recent: string[]): Round | null {
  const type = types[Math.floor(Math.random() * types.length)] ?? "skill";
  const random = () => Math.random();
  return (
    generateRound(pool, type, random, { excluded: new Set(recent) }) ?? generateRound(pool, type, random)
  );
}

function responsesOf(m: Round): string[] {
  return m.type === "duel" ? responsesDuel(m).concat(m.paires.flat().map((d) => d.slug)) : [m.reponse];
}

function Practice({ catalog }: { catalog: CatalogQuiz }) {
  const t = useT();
  const locale = useLocale();
  const [pool, setPool] = useState<PoolQuiz | "error" | null>(null);
  const [types, setTypes] = useState<TypeRound[]>(ORDER_CHALLENGE);
  const [round, setRound] = useState<Round | null>(null);
  const [attempts, setAttempts] = useState<string[]>([]);
  const [series, setSeries] = useState(0);
  const [record, setRecord] = useState<RecordPractice>({ meilleure: 0, jouees: 0, reussies: 0 });
  const [number, setNumber] = useState(1);
  const [tentative, setTentative] = useState(0);
  const recent = useRef<string[]>([]);
  const title = useRef<HTMLHeadingElement>(null);
  const focus = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stockage lu apres montage
    setRecord(readPractice());
  }, []);

  useEffect(() => {
    let active = true;
    loadPool(locale).then(
      (p) => {
        if (!active) return;
        setPool(p);
        setRound(draw(p, ORDER_CHALLENGE, recent.current));
        setAttempts([]);
      },
      () => active && setPool("error"),
    );
    return () => {
      active = false;
    };
  }, [locale, tentative]);

  useEffect(() => {
    if (!focus.current) return;
    focus.current = false;
    title.current?.focus();
  }, [number]);

  if (pool === null) {
    return (
      <p role="status" className="py-10 text-center text-sm text-chalk-500">
        {t("pages.quizUI.loading")}
      </p>
    );
  }
  if (pool === "error" || !round) {
    return (
      <div role="alert" className="bevel border border-blood-500/40 bg-night-900/60 p-5 text-sm text-chalk-300">
        <p>{t("pages.quizUI.loadError")}</p>
        <button type="button" onClick={() => setTentative((n) => n + 1)} className={cn(secondaryButton, "mt-3")}>
          {t("pages.quizUI.retry")}
        </button>
      </div>
    );
  }

  const finished = roundFinished(round, attempts);

  function play(slug: string) {
    if (!round || roundFinished(round, attempts)) return;
    const nextGuesses = [...attempts, slug];
    setAttempts(nextGuesses);
    if (!roundFinished(round, nextGuesses)) return;
    const successful = roundSuccessful(round, nextGuesses);
    const newStreak = successful ? series + 1 : 0;
    const r = {
      meilleure: Math.max(record.meilleure, newStreak),
      jouees: record.jouees + 1,
      reussies: record.reussies + (successful ? 1 : 0),
    };
    setSeries(newStreak);
    setRecord(r);
    writePractice(r);
  }

  function next() {
    if (!round || pool === null || pool === "error") return;
    recent.current = [...responsesOf(round), ...recent.current].slice(0, 40);
    focus.current = true;
    setRound(draw(pool, types, recent.current));
    setAttempts([]);
    setNumber((n) => n + 1);
  }

  function toggle(type: TypeRound) {
    setTypes((list) =>
      list.includes(type) ? (list.length > 1 ? list.filter((x) => x !== type) : list) : [...list, type],
    );
  }

  return (
    <div className="space-y-5">
      <FilterGroup legend={t("pages.quizUI.typeFilters")} widthLegend="" className="gap-1.5">
        {ORDER_CHALLENGE.map((type) => (
          <Chip key={type} dense active={types.includes(type)} onClick={() => toggle(type)}>
            {t(`pages.quizUI.types.${type}`)}
          </Chip>
        ))}
      </FilterGroup>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-chalk-500">{t("pages.quizUI.practiceStreak")}</dt>
          <dd className="font-semibold tabular-nums text-gold-400">{series}</dd>
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

      <RoundQuiz
        key={number}
        round={round}
        attempts={attempts}
        catalog={catalog}
        onAttempt={play}
        roundLabel={t("pages.quizUI.question", { n: number })}
        refTitle={title}
        measure={pool.mesure}
      />
      {finished && (
        <div className="flex justify-end">
          <button type="button" onClick={next} className={buttonMain}>
            {t("pages.quizUI.nextQuestion")} →
          </button>
        </div>
      )}
    </div>
  );
}

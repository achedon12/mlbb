"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Dices, Eye, Share2, SkipForward } from "lucide-react";
import Link from "@/components/lien";
import { buildCatalogue, ClassicGame, SkillGame, type MlbbdleCatalogue } from "@/components/mlbbdle-games";
import { PortraitHeros } from "@/components/portrait-heros";
import { classesPuce, GroupeFiltres } from "@/components/puce";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  averageGuesses,
  classicGrid,
  drawRandom,
  LAST_BUCKET,
  recordWin,
  shareText,
  skillGrid,
  type MlbbdleHero,
  type MlbbdlePuzzle,
  type SkillPuzzle,
} from "@/lib/mlbbdle";
import {
  loadPuzzle,
  readGame,
  readPractice,
  readStats,
  writeGame,
  writePractice,
  writeStats,
  type DailyGuesses,
  type DailyMode,
  type PracticeRecord,
} from "@/lib/mlbbdle-storage";
import { decalerJour, jourUtc, serieCourante, STATS_VIDES, type StatsQuiz } from "@/lib/quiz";
import { chargerPool } from "@/lib/quiz-stockage";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * MLBBdle: two puzzles a day (classic, skill), the same for everyone, and
 * endless practice.
 *
 * The page is static: it only brings the compared roster. The daily puzzle
 * arrives after mounting, for the visitor's UTC date
 * (`/mlbbdle/day/<language>-<date>.json`); skill-mode practice reuses the
 * quiz pool, fetched only when first opened.
 */

type Mode = DailyMode | "practice";
const DAILY_MODES: DailyMode[] = ["classic", "skill"];

const primaryButton =
  "bevel-sm inline-flex min-h-11 items-center justify-center gap-2 bg-gold-500 px-4 py-2 font-semibold text-night-950 transition-colors hover:bg-gold-400";
const secondaryButton =
  "bevel-sm inline-flex min-h-11 items-center justify-center gap-2 border border-night-600 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400";

export function Mlbbdle({ heroes, labels }: { heroes: MlbbdleHero[]; labels: Record<string, string> }) {
  const t = useT();
  const language = useLangue();
  const catalogue = useMemo(() => buildCatalogue(heroes, labels), [heroes, labels]);
  const [mode, setMode] = useState<Mode>("classic");
  // Practice is only mounted when first opened, then stays mounted.
  const [practiceOpened, setPracticeOpened] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<MlbbdlePuzzle | "error" | null>(null);
  const [guesses, setGuesses] = useState<DailyGuesses>({ classic: [], skill: [] });
  const [stats, setStats] = useState<Record<DailyMode, StatsQuiz>>({ classic: STATS_VIDES, skill: STATS_VIDES });
  const [attempt, setAttempt] = useState(0);
  const winTitle = useRef<HTMLHeadingElement>(null);
  const shouldFocus = useRef(false);

  // The day and the memory are read after mounting: the static page knows
  // neither the visitor's clock nor their browser.
  useEffect(() => {
    const today = jourUtc(new Date());
    /* eslint-disable react-hooks/set-state-in-effect -- clock and storage read after mounting */
    setDay(today);
    setGuesses(readGame(today));
    setStats({ classic: readStats("classic"), skill: readStats("skill") });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!day) return;
    let active = true;
    loadPuzzle(language, day).then(
      (p) => active && setPuzzle(p),
      () => active && setPuzzle("error"),
    );
    return () => {
      active = false;
    };
  }, [day, language, attempt]);

  // Focus moves to the win panel once the hero is found: a screen reader announces it at once.
  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    winTitle.current?.focus();
  }, [guesses]);

  function chooseMode(m: Mode) {
    setMode(m);
    if (m === "practice") setPracticeOpened(true);
  }

  const answerOf = (p: MlbbdlePuzzle, m: DailyMode) => (m === "classic" ? p.classic : p.skill?.answer);
  const isSolved = (m: DailyMode) => {
    const answer = puzzle && puzzle !== "error" ? answerOf(puzzle, m) : undefined;
    return Boolean(answer && guesses[m].includes(answer));
  };

  function play(m: DailyMode, slug: string) {
    if (!day || !puzzle || puzzle === "error") return;
    const answer = answerOf(puzzle, m);
    const current = guesses[m];
    if (!answer || current.includes(answer) || current.includes(slug)) return;
    const next = { ...guesses, [m]: [...current, slug] };
    setGuesses(next);
    writeGame(day, next);
    if (slug === answer) {
      const updated = recordWin(readStats(m), day, next[m].length);
      writeStats(m, updated);
      setStats((s) => ({ ...s, [m]: updated }));
      shouldFocus.current = true;
    }
  }

  function newDay() {
    const today = jourUtc(new Date());
    setPuzzle(null);
    setGuesses(readGame(today));
    setDay(today);
  }

  return (
    <div>
      <GroupeFiltres legende={t("pages.mlbbdleUI.mode")} largeurLegende="" className="mb-6">
        {/* The site's chips are 32 px tall: same look here, but finger-sized. */}
        {(["classic", "skill", "practice"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => chooseMode(m)}
            className={cn(classesPuce(mode === m), "inline-flex min-h-11 items-center gap-1.5")}
          >
            {t(`pages.mlbbdleUI.modes.${m}`)}
            {m !== "practice" && isSolved(m) && (
              <>
                <Check size={14} aria-hidden />
                <span className="sr-only"> ({t("pages.mlbbdleUI.solved")})</span>
              </>
            )}
          </button>
        ))}
      </GroupeFiltres>

      {mode !== "practice" &&
        (puzzle === null || !day ? (
          <p role="status" className="py-10 text-center text-sm text-chalk-500">
            {t("pages.mlbbdleUI.loading")}
          </p>
        ) : puzzle === "error" ? (
          <div role="alert" className="bevel border border-blood-500/40 bg-night-900/60 p-5 text-sm text-chalk-300">
            <p>{t("pages.mlbbdleUI.loadError")}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={cn(secondaryButton, "mt-3")}>
              {t("pages.mlbbdleUI.retry")}
            </button>
          </div>
        ) : (
          <DailyPuzzle
            key={`${puzzle.day}-${mode}`}
            mode={mode}
            puzzle={puzzle}
            guesses={guesses[mode]}
            stats={stats[mode]}
            catalogue={catalogue}
            onGuess={(slug) => play(mode, slug)}
            winTitleRef={winTitle}
            otherMode={DAILY_MODES.find((m) => m !== mode && !isSolved(m)) ?? null}
            onMode={chooseMode}
            onNewDay={newDay}
          />
        ))}

      {practiceOpened && (
        <div hidden={mode !== "practice"}>
          <Practice catalogue={catalogue} />
        </div>
      )}
    </div>
  );
}

function DailyPuzzle({
  mode,
  puzzle,
  guesses,
  stats,
  catalogue,
  onGuess,
  winTitleRef,
  otherMode,
  onMode,
  onNewDay,
}: {
  mode: DailyMode;
  puzzle: MlbbdlePuzzle;
  guesses: string[];
  stats: StatsQuiz;
  catalogue: MlbbdleCatalogue;
  onGuess: (slug: string) => void;
  winTitleRef: React.Ref<HTMLHeadingElement>;
  otherMode: DailyMode | null;
  onMode: (m: Mode) => void;
  onNewDay: () => void;
}) {
  const t = useT();
  const language = useLangue();
  const readableDate = new Intl.DateTimeFormat(LOCALE_HTML[language], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${puzzle.day}T00:00:00Z`),
  );
  const answer = mode === "classic" ? puzzle.classic : puzzle.skill?.answer;
  const target = answer ? catalogue.bySlug.get(answer) : undefined;
  const label = t("pages.mlbbdleUI.number", { n: puzzle.number, date: readableDate });

  if (!target) {
    return (
      <p role="status" className="bevel border border-night-700/70 bg-night-900/60 p-5 text-sm text-chalk-300">
        {t("pages.mlbbdleUI.unavailable")}
      </p>
    );
  }
  const found = guesses.includes(target.slug);

  return (
    <div className="space-y-5">
      {mode === "classic" ? (
        <ClassicGame target={target} guesses={guesses} catalogue={catalogue} onGuess={onGuess} label={label} />
      ) : (
        puzzle.skill && (
          <SkillGame puzzle={puzzle.skill} guesses={guesses} catalogue={catalogue} onGuess={onGuess} label={label} />
        )
      )}
      {found && (
        <WinPanel
          mode={mode}
          puzzle={puzzle}
          guesses={guesses}
          target={target}
          stats={stats}
          catalogue={catalogue}
          titleRef={winTitleRef}
          otherMode={otherMode}
          onMode={onMode}
          onNewDay={onNewDay}
        />
      )}
    </div>
  );
}

function WinPanel({
  mode,
  puzzle,
  guesses,
  target,
  stats,
  catalogue,
  titleRef,
  otherMode,
  onMode,
  onNewDay,
}: {
  mode: DailyMode;
  puzzle: MlbbdlePuzzle;
  guesses: string[];
  target: MlbbdleHero;
  stats: StatsQuiz;
  catalogue: MlbbdleCatalogue;
  titleRef: React.Ref<HTMLHeadingElement>;
  otherMode: DailyMode | null;
  onMode: (m: Mode) => void;
  onNewDay: () => void;
}) {
  const t = useT();
  const language = useLangue();
  const [status, setStatus] = useState<"copied" | "shared" | "error" | null>(null);
  const streak = serieCourante(stats, puzzle.day);
  const rows = mode === "classic" ? classicGrid(guesses, target, catalogue.bySlug) : [skillGrid(guesses, target.slug)];
  const title = `${t("pages.mlbbdleUI.shareTitle", {
    n: puzzle.number,
    mode: t(`pages.mlbbdleUI.modes.${mode}`),
    guesses: guesses.length,
  })}${streak >= 2 ? ` 🔥${streak}` : ""}`;
  const text = shareText({ title, rows, url: `${site.url}/${language}/mlbbdle` });
  const distribution = Array.from({ length: LAST_BUCKET }, (_, i) => stats.distribution[i + 1] ?? 0);
  const highest = Math.max(1, ...distribution);
  const format = new Intl.NumberFormat(LOCALE_HTML[language], { maximumFractionDigits: 1 });
  const yesterdaySlug = puzzle.yesterday?.[mode];
  const yesterday = yesterdaySlug ? catalogue.bySlug.get(yesterdaySlug) : undefined;
  const bucket = Math.min(guesses.length, LAST_BUCKET);

  // The native share sheet helps on mobile; elsewhere the clipboard is enough.
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
    <section className="relative p-4 sm:p-6">
      <div aria-hidden className="bevel absolute inset-0 border border-emerald-500/50 bg-night-900/70" />
      <div className="relative">
        <h3 ref={titleRef} tabIndex={-1} className="font-heading text-2xl font-bold text-chalk-100 outline-none">
          {t("pages.mlbbdleUI.winTitle", { n: guesses.length })}
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <PortraitHeros source={target.icon} nom={target.name} taille="vignette" decoratif />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-xl font-bold text-emerald-300">{target.name}</p>
            {mode === "skill" && puzzle.skill && (
              <p className="text-sm text-chalk-300">{t("pages.mlbbdleUI.skillWas", { name: puzzle.skill.name })}</p>
            )}
          </div>
          <Link
            href={`/heroes/${target.slug}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
          >
            {t("pages.mlbbdleUI.viewProfile")} →
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <pre aria-hidden className="overflow-x-auto font-sans text-lg leading-snug tracking-wider sm:text-xl">
              {rows.join("\n")}
            </pre>
            <p className="sr-only">{t("pages.mlbbdleUI.gridSummary", { n: guesses.length })}</p>
          </div>
          <div className="flex-1 space-y-3">
            <button type="button" onClick={share} className={cn(primaryButton, "w-full sm:w-auto")}>
              <Share2 size={16} aria-hidden />
              {t("pages.mlbbdleUI.share")}
            </button>
            <p aria-live="polite" className="min-h-5 text-sm text-chalk-300">
              {status === "copied"
                ? t("pages.mlbbdleUI.copied")
                : status === "shared"
                  ? t("pages.mlbbdleUI.shared")
                  : status === "error"
                    ? t("pages.mlbbdleUI.copyError")
                    : ""}
            </p>
            <NextPuzzle day={puzzle.day} onNewDay={onNewDay} />
            <div className="flex flex-wrap gap-2">
              {otherMode && (
                <button type="button" onClick={() => onMode(otherMode)} className={secondaryButton}>
                  {t("pages.mlbbdleUI.playMode", { mode: t(`pages.mlbbdleUI.modes.${otherMode}`) })} →
                </button>
              )}
              <button type="button" onClick={() => onMode("practice")} className={secondaryButton}>
                {t("pages.mlbbdleUI.practiseMore")} →
              </button>
            </div>
          </div>
        </div>

        {yesterday && (
          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-chalk-300">
            <span>{t("pages.mlbbdleUI.yesterday")}</span>
            <PortraitHeros source={yesterday.icon} nom={yesterday.name} taille="petite" decoratif />
            <Link
              href={`/heroes/${yesterday.slug}`}
              className="inline-flex min-h-11 items-center font-semibold text-gold-400 transition-colors hover:text-gold-500"
            >
              {yesterday.name}
            </Link>
          </p>
        )}

        <h4 className="mt-8 text-xs uppercase tracking-wide text-chalk-500">
          {t("pages.mlbbdleUI.statsTitle", { mode: t(`pages.mlbbdleUI.modes.${mode}`) })}
        </h4>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["played", String(stats.joues)],
              ["streak", String(streak)],
              ["best", String(stats.meilleure)],
              ["average", format.format(averageGuesses(stats))],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="bevel-sm border border-night-700/70 bg-night-950/40 p-3 text-center">
              <dt className="text-[0.7rem] uppercase tracking-wide text-chalk-500">{t(`pages.mlbbdleUI.stats.${key}`)}</dt>
              <dd className="font-heading text-2xl font-bold tabular-nums text-chalk-100">{value}</dd>
            </div>
          ))}
        </dl>

        <h4 className="mt-6 text-xs uppercase tracking-wide text-chalk-500">{t("pages.mlbbdleUI.distribution")}</h4>
        <ol className="mt-2 space-y-1">
          {distribution.map((n, i) => {
            const count = i + 1;
            const countLabel = count === LAST_BUCKET ? `${LAST_BUCKET}+` : String(count);
            return (
              <li key={count} className="flex items-center gap-2 text-xs tabular-nums">
                <span aria-hidden className="w-8 shrink-0 text-right text-chalk-400">
                  {countLabel}
                </span>
                <span aria-hidden className="h-4 flex-1 bg-night-800">
                  <span
                    className={cn("block h-full", count === bucket ? "bg-emerald-600" : "bg-night-600")}
                    style={{ width: `${Math.max(n ? 4 : 0, (n / highest) * 100)}%` }}
                  />
                </span>
                <span aria-hidden className="w-8 shrink-0 text-chalk-300">
                  {n}
                </span>
                <span className="sr-only">{t("pages.mlbbdleUI.distributionRow", { guesses: countLabel, n })}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Countdown to midnight UTC; once past, the new puzzle starts with one click. */
function NextPuzzle({ day, onNewDay }: { day: string; onNewDay: () => void }) {
  const t = useT();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const end = Date.parse(`${decalerJour(day, 1)}T00:00:00Z`);
    const update = () => setRemaining(end - Date.now());
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [day]);

  if (remaining === null) return null;
  if (remaining <= 0) {
    return (
      <button type="button" onClick={onNewDay} className={secondaryButton}>
        {t("pages.mlbbdleUI.newPuzzle")}
      </button>
    );
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = Math.floor(remaining / 1000);
  const time = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  // The text changes every second: kept out of any announced region.
  return (
    <p className="text-sm text-chalk-400">
      {t("pages.mlbbdleUI.next")} <span className="font-semibold tabular-nums text-chalk-100">{time}</span>
    </p>
  );
}

// ─────────────────────────────────────────────────────────────
// Practice
// ─────────────────────────────────────────────────────────────

type Round = { mode: "classic"; target: string } | { mode: "skill"; puzzle: SkillPuzzle };

function Practice({ catalogue }: { catalogue: MlbbdleCatalogue }) {
  const t = useT();
  const language = useLangue();
  const [kind, setKind] = useState<DailyMode>("classic");
  const [skills, setSkills] = useState<Record<string, SkillPuzzle[]> | "error" | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [number, setNumber] = useState(1);
  const [record, setRecord] = useState<PracticeRecord>({ found: 0, guesses: 0, best: null });
  const recent = useRef<string[]>([]);
  const title = useRef<HTMLHeadingElement>(null);
  const shouldFocus = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage read after mounting
    setRecord(readPractice());
  }, []);

  // The skill pool is only fetched the first time skill practice is opened.
  useEffect(() => {
    if (kind !== "skill" || skills !== null) return;
    let active = true;
    chargerPool(language).then(
      (pool) => {
        if (!active) return;
        setSkills(
          Object.fromEntries(
            Object.entries(pool.competences).map(([slug, list]) => [
              slug,
              list.map((c) => ({ answer: slug, name: c.nom, icon: c.icone, excerpt: c.extrait })),
            ]),
          ),
        );
      },
      () => active && setSkills("error"),
    );
    return () => {
      active = false;
    };
  }, [kind, skills, language]);

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    title.current?.focus();
  }, [number]);

  function draw(m: DailyMode): Round | null {
    if (m === "classic") {
      const target = drawRandom(catalogue.heroes.map((h) => h.slug), recent.current);
      return target ? { mode: m, target } : null;
    }
    if (!skills || skills === "error") return null;
    const slug = drawRandom(
      Object.keys(skills).filter((s) => catalogue.bySlug.has(s)),
      recent.current,
    );
    const list = slug ? skills[slug] : [];
    return list.length ? { mode: m, puzzle: list[Math.floor(Math.random() * list.length)] } : null;
  }

  // The first round of a kind is drawn as soon as its data is there.
  const current = round && round.mode === kind ? round : null;
  const ready = kind === "classic" || (skills !== null && skills !== "error");
  useEffect(() => {
    if (current || !ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- random draw, after mounting only
    setRound(draw(kind));
    setGuesses([]);
    setRevealed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draw only changes with data already tracked
  }, [current, ready, kind]);

  const answer = current ? (current.mode === "classic" ? current.target : current.puzzle.answer) : null;
  const target = answer ? catalogue.bySlug.get(answer) : undefined;
  const found = answer !== null && guesses.includes(answer);
  const finished = found || revealed;

  function play(slug: string) {
    if (!answer || finished || guesses.includes(slug)) return;
    const next = [...guesses, slug];
    setGuesses(next);
    if (slug !== answer) return;
    const r: PracticeRecord = {
      found: record.found + 1,
      guesses: record.guesses + next.length,
      best: record.best === null ? next.length : Math.min(record.best, next.length),
    };
    setRecord(r);
    writePractice(r);
  }

  function nextRound() {
    if (answer) recent.current = [answer, ...recent.current].slice(0, 30);
    shouldFocus.current = true;
    setRound(draw(kind));
    setGuesses([]);
    setRevealed(false);
    setNumber((n) => n + 1);
  }

  const format = new Intl.NumberFormat(LOCALE_HTML[language], { maximumFractionDigits: 1 });
  const label = t("pages.mlbbdleUI.practiceNumber", { n: number });

  return (
    <div className="space-y-5">
      <GroupeFiltres legende={t("pages.mlbbdleUI.practiceType")} largeurLegende="" className="gap-1.5">
        {DAILY_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={kind === m}
            onClick={() => setKind(m)}
            className={cn(classesPuce(kind === m), "min-h-11")}
          >
            {t(`pages.mlbbdleUI.modes.${m}`)}
          </button>
        ))}
      </GroupeFiltres>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-chalk-500">{t("pages.mlbbdleUI.practiceFound")}</dt>
          <dd className="font-semibold tabular-nums text-chalk-100">{record.found}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-chalk-500">{t("pages.mlbbdleUI.stats.average")}</dt>
          <dd className="font-semibold tabular-nums text-chalk-100">
            {record.found ? format.format(record.guesses / record.found) : "—"}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-chalk-500">{t("pages.mlbbdleUI.practiceBest")}</dt>
          <dd className="font-semibold tabular-nums text-gold-400">{record.best ?? "—"}</dd>
        </div>
      </dl>

      {kind === "skill" && skills === "error" ? (
        <div role="alert" className="bevel border border-blood-500/40 bg-night-900/60 p-5 text-sm text-chalk-300">
          <p>{t("pages.mlbbdleUI.loadError")}</p>
          <button type="button" onClick={() => setSkills(null)} className={cn(secondaryButton, "mt-3")}>
            {t("pages.mlbbdleUI.retry")}
          </button>
        </div>
      ) : !current || !target ? (
        <p role="status" className="py-10 text-center text-sm text-chalk-500">
          {t("pages.mlbbdleUI.loading")}
        </p>
      ) : (
        <>
          {current.mode === "classic" ? (
            <ClassicGame
              key={number}
              target={target}
              guesses={guesses}
              catalogue={catalogue}
              onGuess={play}
              label={label}
              question={t("pages.mlbbdleUI.practiceQuestion")}
              over={revealed}
              titleRef={title}
            />
          ) : (
            <SkillGame
              key={number}
              puzzle={current.puzzle}
              guesses={guesses}
              catalogue={catalogue}
              onGuess={play}
              label={label}
              over={revealed}
              titleRef={title}
            />
          )}

          {finished && (
            <div
              className={cn(
                "bevel flex flex-wrap items-center gap-4 border p-4",
                found ? "border-emerald-500/60 bg-emerald-500/10" : "border-blood-500/50 bg-blood-500/10",
              )}
            >
              <PortraitHeros source={target.icon} nom={target.name} taille="vignette" decoratif />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", found ? "text-emerald-300" : "text-blood-500")}>
                  {found ? t("pages.mlbbdleUI.winTitle", { n: guesses.length }) : t("pages.mlbbdleUI.answerWas")}
                </p>
                <p className="font-heading text-xl font-bold text-chalk-100">{target.name}</p>
              </div>
              <Link
                href={`/heroes/${target.slug}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
              >
                {t("pages.mlbbdleUI.viewProfile")} →
              </Link>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {!finished && (
              <button type="button" onClick={() => setRevealed(true)} className={secondaryButton}>
                <Eye size={15} aria-hidden />
                {t("pages.mlbbdleUI.reveal")}
              </button>
            )}
            <button type="button" onClick={nextRound} className={finished ? primaryButton : secondaryButton}>
              {finished ? <Dices size={16} aria-hidden /> : <SkipForward size={15} aria-hidden />}
              {t(finished ? "pages.mlbbdleUI.newHero" : "pages.mlbbdleUI.skip")}
            </button>
          </div>
          <p aria-live="polite" className="sr-only">
            {revealed ? `${t("pages.mlbbdleUI.answerWas")} ${target.name}` : ""}
          </p>
        </>
      )}
    </div>
  );
}

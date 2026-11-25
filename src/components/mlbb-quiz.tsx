"use client";

import { DexNotice } from "@/components/dex-states";
import { GameSkeleton } from "@/components/game-skeleton";
import { Flash } from "@/components/dex-states";
import { useAccountPrompt } from "@/components/account-prompt";
import { useDiscordMoment } from "@/components/discord-moment";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Link2, Palette, Scale, ScrollText, Shield, Sparkles, Swords, Trophy, Type, type LucideIcon } from "lucide-react";
import { FilterGroup, Chip } from "@/components/chip";
import { GameDex } from "@/components/game-dex";
import Link from "@/components/link";
import { Dex } from "@/components/mascot";
import { RoundQuiz, type CatalogQuiz } from "@/components/quiz-round";
import { ShareImageButton } from "@/components/share-image-button";
import { LOCALE_INTL } from "@/i18n/config";
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
  cellsOfRow,
  cleanName,
  dayOfNumber,
  duelCode,
  duelOutcome,
  quizRank,
  RANK_POSE,
  type Challenge,
  type DuelLink,
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
  writeDuelMatch,
  writeName,
  readPractice,
  readMatch,
  readStats,
  readDuelMatch,
  readName,
  type RecordPractice,
} from "@/lib/quiz-storage";
import { trackEvent, trackShare } from "@/lib/analytics";
import { SYNCED_EVENT } from "@/lib/progress-signal";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { SupportCard } from "@/components/support-links";
import { recordSupportWin } from "@/lib/support-prompt";

/**
 * MLBB quiz: the daily challenge, the same for everyone, and endless practice.
 *
 * The page is static: it only ships the roster (names, icons, compared
 * traits). The daily challenge arrives after mount, for the visitor's UTC
 * date (`/quiz/day/<locale>-<date>.json`, a few KB); the practice pool only
 * when practice is opened. Both stay on the device: once the page has been
 * visited, the quiz plays offline.
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

export function QuizMlbb({ heroes, items, duel }: { heroes: QuizHero[]; items: ItemRoster[]; duel?: DuelLink }) {
  const t = useT();
  const [mode, setMode] = useState<"daily" | "practice">("daily");
  // Practice is only mounted when first opened: its pool is not downloaded
  // for players who only do the challenge. It stays mounted afterwards.
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
        <ChallengeOfDay catalog={catalog} duel={duel} onPractice={() => chooseMode("practice")} />
      </div>
      {practiceOpen && (
        <div hidden={mode !== "practice"}>
          <Practice catalog={catalog} />
        </div>
      )}
    </div>
  );
}

/** First round still to play; the number of rounds once everything is played (the summary). */
function roundOpen(challenge: Challenge, attempts: string[][]): number {
  const i = challenge.manches.findIndex((m, j) => !roundFinished(m, attempts[j] ?? []));
  return i < 0 ? challenge.manches.length : i;
}

/**
 * The daily challenge, or the one a friend's link names (`duel`): today's when
 * the link is from today, then it counts as the daily game; an older one is
 * played apart, outside the stats and the streak.
 */
function ChallengeOfDay({ catalog, duel, onPractice }: { catalog: CatalogQuiz; duel?: DuelLink; onPractice: () => void }) {
  const discord = useDiscordMoment();
  const prompt = useAccountPrompt();
  const t = useT();
  const locale = useLocale();
  const [today, setToday] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  /** The friend who sent the link, when they put their name on it. */
  const [rival, setRival] = useState("");
  const [state, setState] = useState<{ challenge: Challenge; local: boolean } | "error" | null>(null);
  const [attempts, setAttempts] = useState<string[][]>([]);
  const [current, setCurrent] = useState(0);
  const [stats, setStats] = useState<StatsQuiz>(STATS_EMPTY);
  const [tentative, setTentative] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const titleSummary = useRef<HTMLHeadingElement>(null);
  const focus = useRef(false);

  // The day is read after mount: the static page knows neither the time
  // nor the visitor's stored progress.
  const duelNumber = duel?.number;
  useEffect(() => {
    const now = dayUtc(new Date());
    const target = duelNumber ? dayOfNumber(duelNumber) : now;
    /* eslint-disable react-hooks/set-state-in-effect -- clock, address and storage read after mount */
    setToday(now);
    setDay(target);
    setStats(readStats());
    setAttempts((target === now ? readMatch(target) : readDuelMatch(target)) ?? []);
    if (duelNumber) {
      setRival(cleanName(new URLSearchParams(window.location.search).get("by")));
      trackEvent("Quiz", "Challenge open", target === now ? "today" : "past");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Signed in, the account may bring days played on another device.
    const reread = () => setStats(readStats());
    window.addEventListener(SYNCED_EVENT, reread);
    return () => window.removeEventListener(SYNCED_EVENT, reread);
  }, [duelNumber]);

  const daily = day !== null && day === today;
  // The link's score stays on its own challenge: not on the next day's, once it is opened.
  const duelHere = duel && day === dayOfNumber(duel.number) ? duel : undefined;

  useEffect(() => {
    if (!day || !today) return;
    let active = true;
    const isDaily = day === today;
    loadChallenge(locale, day, { save: isDaily }).then(
      (r) => {
        if (!active) return;
        setState(r);
        setCurrent(roundOpen(r.challenge, (isDaily ? readMatch(day) : readDuelMatch(day)) ?? []));
      },
      () => active && setState("error"),
    );
    return () => {
      active = false;
    };
  }, [day, today, locale, tentative]);

  // Focus follows the next round: a screen reader announces it right away.
  useEffect(() => {
    if (!focus.current) return;
    focus.current = false;
    (title.current ?? titleSummary.current)?.focus();
  }, [current]);

  if (state === null || !day) {
    // The round drawn in skeletons, at its height once loaded: the rules below stay put.
    return <GameSkeleton label={t("pages.quizUI.loading")} steps={6} className="min-h-[36rem] sm:min-h-[32rem]" />;
  }
  if (state === "error") {
    return (
      <DexNotice role="alert" tone="error" title={t("dexStates.errorTitle")}>
        <p>{t("pages.quizUI.loadError")}</p>
        <button type="button" onClick={() => setTentative((n) => n + 1)} className={cn(secondaryButton, "mt-3")}>
          {t("pages.quizUI.retry")}
        </button>
      </DexNotice>
    );
  }

  const { challenge } = state;
  const allFinished = challenge.manches.every((m, i) => roundFinished(m, attempts[i] ?? []));
  const readableDate = new Intl.DateTimeFormat(LOCALE_INTL[locale], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${challenge.jour}T00:00:00Z`),
  );

  function play(i: number, slug: string) {
    if (!day || state === null || state === "error") return;
    const m = state.challenge.manches[i];
    const currentGuesses = attempts[i] ?? [];
    if (roundFinished(m, currentGuesses)) return;
    const nextGuesses = state.challenge.manches.map((_, j) => (j === i ? [...currentGuesses, slug] : (attempts[j] ?? [])));
    setAttempts(nextGuesses);
    if (daily) writeMatch(day, nextGuesses);
    else writeDuelMatch(day, nextGuesses);
    if (state.challenge.manches.every((mm, j) => roundFinished(mm, nextGuesses[j]))) {
      const points = state.challenge.manches.reduce((n, mm, j) => n + pointsRound(mm, nextGuesses[j]), 0);
      if (daily) {
        const nextStats = saveMatch(readStats(), day, points);
        setStats(nextStats);
        writeStats(nextStats);
        trackEvent("Quiz", "Finish", "daily", points);
        recordSupportWin();
        // One card at a time: the account prompt only when the Discord one stays away.
        if (!discord.offer("quiz", 2500)) prompt.offer("quiz", { streak: nextStats.serie }, 2500);
      }
      if (duelHere) trackEvent("Quiz", "Challenge result", duelOutcome(points, duelHere.points), points);
    }
  }

  function goTo(i: number) {
    focus.current = true;
    setCurrent(i);
  }

  function newDay() {
    const now = dayUtc(new Date());
    setState(null);
    setAttempts(readMatch(now) ?? []);
    setCurrent(0);
    setToday(now);
    setDay(now);
  }

  const round = challenge.manches[current];

  return (
    <div className="space-y-5">
      {discord.card}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-heading text-lg font-bold text-gold-400">
          {t("pages.quizUI.puzzleNumber", { n: challenge.numero, date: readableDate })}
        </p>
        {state.local && <p className="text-xs text-chalk-500">{t("pages.quizUI.offline")}</p>}
      </div>

      {duelHere && !allFinished && <DuelBanner duel={duelHere} rival={rival} daily={daily} />}
      {daily && today && !allFinished && <StreakBadge stats={stats} today={today} />}

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
                  onClick={() => goTo(i)}
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
              onClick={() => goTo(challenge.manches.length)}
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
                onClick={() => goTo(allFinished ? challenge.manches.length : roundOpen(challenge, attempts))}
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
          daily={daily}
          duel={duelHere}
          rival={rival}
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
  daily,
  duel,
  rival,
  refTitle,
  onPractice,
  onNewDay,
}: {
  challenge: Challenge;
  attempts: string[][];
  stats: StatsQuiz;
  day: string;
  /** Today's challenge: it counts in the stats and the streak. */
  daily: boolean;
  /** The score to beat, when the challenge was opened from a friend's link. */
  duel?: DuelLink;
  rival: string;
  refTitle: React.Ref<HTMLHeadingElement>;
  onPractice: () => void;
  onNewDay: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [status, setStatus] = useState<"copied" | "shared" | "error" | null>(null);
  const [name, setName] = useState("");
  const points = challenge.manches.reduce((n, m, i) => n + pointsRound(m, attempts[i] ?? []), 0);
  const max = pointsMax(challenge.manches);
  const rows = challenge.manches.map((m, i) => rowGrid(m, attempts[i] ?? []));
  const series = daily ? currentStreak(stats, day) : 0;
  const rank = quizRank(points, max);
  const score = `${points}/${max}`;
  // Every share is a challenge: the link replays these questions against this score.
  const clean = cleanName(name);
  const duelUrl = `${site.url}/${locale}/quiz/vs/${duelCode({ number: challenge.numero, points, max })}${clean ? `?by=${encodeURIComponent(clean)}` : ""}`;
  const text = textShare({ number: challenge.numero, points, max, series, rows, url: duelUrl });
  const pitch = t("pages.quizUI.sharePitch", { score, n: challenge.numero });
  const distribution = Array.from({ length: max + 1 }, (_, i) => stats.distribution[i] ?? 0);
  const higher = Math.max(1, ...distribution);
  const average = stats.joues ? distribution.reduce((s, n, i) => s + n * i, 0) / stats.joues : 0;
  const format = new Intl.NumberFormat(LOCALE_INTL[locale], { maximumFractionDigits: 1 });
  const outcome = duel ? duelOutcome(points, duel.points) : null;
  const target = duel ? `${duel.points}/${duel.max}` : "";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage read after mount
    setName(readName());
  }, []);

  // Native sharing is for mobile; elsewhere it would open a system dialog
  // where the clipboard is enough.
  async function share() {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        setStatus("shared");
        trackShare("Quiz", "native");
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      trackShare("Quiz", "clipboard");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section data-mood={points * 2 >= max ? "won" : undefined} className="win-panel relative p-4 sm:p-6">
      <div aria-hidden className="game-stage absolute inset-0 shadow-[inset_0_3px_0_var(--color-gold-400)]" />
      <div className="relative">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            ref={refTitle}
            tabIndex={-1}
            className="win-punch display-caps text-[2.2rem] text-gold-400 outline-none sm:text-[3rem]"
          >
            {t("pages.quizUI.summaryTitle", { points, max })}
          </h3>
          <p className="mt-1 text-sm uppercase tracking-wide text-chalk-500">
            {t("pages.quizUI.rankLabel")}{" "}
            <strong className="font-heading text-xl font-bold normal-case tracking-normal text-chalk-100 sm:text-2xl">
              {t(`pages.quizUI.ranks.${rank}`)}
            </strong>
          </p>
        </div>
        {/* Dex reacts to the rank: let down at the bottom, jumping at a perfect score. */}
        <GameDex mood={points * 2 >= max ? "won" : "over"} pose={RANK_POSE[rank]} beat={0} height={110} />
      </div>

      {outcome && (
        <p
          className={cn(
            "bevel-sm mt-4 border px-3 py-2 font-semibold",
            outcome === "won" ? "border-emerald-500/50 text-emerald-300" : outcome === "tie" ? "border-gold-500/50 text-gold-300" : "border-blood-500/40 text-chalk-200",
          )}
        >
          {rival
            ? t(`pages.quizUI.duel.${outcome}`, { name: rival, score: target })
            : t(`pages.quizUI.duel.${outcome}Anon`, { score: target })}
        </p>
      )}
      {daily && <StreakBadge stats={stats} today={day} className="mt-4" />}

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
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
        <div className="min-w-0 flex-1 space-y-4">
          <ShareImageButton
            card={{
              kind: "quiz",
              number: challenge.numero,
              points,
              max,
              rows: rows.map(cellsOfRow),
              streak: series,
              duel: false,
            }}
            name="Quiz"
            url={duelUrl}
            text={`${pitch}\n${duelUrl}`}
            label={t("pages.quizUI.shareScore")}
            variant="primary"
            large
          />
          <ChallengeFriend url={duelUrl} pitch={pitch} name={name} onName={setName} />
          <div className="space-y-1">
            <button type="button" onClick={share} className={secondaryButton}>
              <Type size={15} aria-hidden />
              {t("pages.quizUI.share")}
            </button>
            <p aria-live="polite" className="min-h-5 text-sm">
              {status && (
                <Flash tone={status === "error" ? "error" : "ok"}>
                  {status === "copied" ? t("pages.quizUI.copied") : status === "shared" ? t("pages.quizUI.shared") : t("pages.quizUI.copyError")}
                </Flash>
              )}
            </p>
          </div>
          {daily ? (
            <NextChallenge day={day} onNewDay={onNewDay} />
          ) : (
            <Link href="/quiz" className={buttonMain}>
              {t("pages.quizUI.playToday")} →
            </Link>
          )}
          <button type="button" onClick={onPractice} className={secondaryButton}>
            {t("pages.quizUI.practise")} →
          </button>
        </div>
      </div>

      {daily && (
        <>
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
            {distribution.map((n, s) => (
              <li key={s} className="flex items-center gap-2 text-xs tabular-nums">
                <span className="w-8 shrink-0 text-right text-chalk-400">{s}</span>
                <span aria-hidden className="h-4 flex-1 bg-night-800">
                  <span
                    className={cn("block h-full", s === points ? "bg-gold-500" : "bg-night-600")}
                    style={{ width: `${Math.max(n ? 4 : 0, (n / higher) * 100)}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-chalk-300">{n}</span>
                <span className="sr-only">{t("pages.quizUI.distributionRow", { score: s, n })}</span>
              </li>
            ))}
          </ol>
          <SupportCard placement="Quiz" className="mt-8" />
        </>
      )}
      </div>
    </section>
  );
}

/**
 * "Challenge a friend": a link to these very questions with the score to
 * beat, sent through the share sheet on a phone, copied elsewhere. The name
 * is optional and stays on the device.
 */
function ChallengeFriend({ url, pitch, name, onName }: { url: string; pitch: string; name: string; onName: (n: string) => void }) {
  const t = useT();
  const [status, setStatus] = useState<"copied" | "shared" | "error" | null>(null);

  async function send() {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("pages.quizUI.challengeTitle"), text: pitch, url });
        setStatus("shared");
        trackShare("Quiz challenge", "native");
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      trackShare("Quiz challenge", "clipboard");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="bevel-sm space-y-2 border border-night-700/70 bg-night-950/40 p-3">
      <label className="block text-xs uppercase tracking-wide text-chalk-500" htmlFor="quiz-duel-name">
        {t("pages.quizUI.nameLabel")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="quiz-duel-name"
          type="text"
          value={name}
          maxLength={20}
          autoComplete="nickname"
          placeholder={t("pages.quizUI.namePlaceholder")}
          onChange={(e) => onName(e.target.value)}
          onBlur={() => writeName(cleanName(name))}
          className="bevel-sm min-h-11 min-w-0 flex-1 border border-night-600 bg-night-900 px-3 text-base text-chalk-100 placeholder:text-chalk-500 focus:border-gold-500 focus:outline-none"
        />
        <button type="button" onClick={send} className={cn("btn btn-secondary min-h-12 w-full sm:w-auto")}>
          <Swords size={18} aria-hidden />
          {t("pages.quizUI.challengeFriend")}
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm">
        {status && (
          <Flash tone={status === "error" ? "error" : "ok"}>
            {status === "copied" ? (
              <>
                <Link2 size={14} aria-hidden className="mr-1 inline" />
                {t("pages.quizUI.challengeCopied")}
              </>
            ) : status === "shared" ? (
              t("pages.quizUI.challengeShared")
            ) : (
              t("pages.quizUI.copyError")
            )}
          </Flash>
        )}
      </p>
    </div>
  );
}

/** The daily streak, kept on the device: what playing today does to it. */
function StreakBadge({ stats, today, className }: { stats: StatsQuiz; today: string; className?: string }) {
  const t = useT();
  const streak = currentStreak(stats, today);
  const playedToday = stats.dernier === today;
  const hint = playedToday
    ? t("pages.quizUI.streakDone")
    : streak > 0
      ? t("pages.quizUI.streakKeep")
      : t("pages.quizUI.streakStart");
  return (
    <div className={cn("bevel-sm flex items-center gap-3 border border-night-700/70 bg-night-950/40 px-3 py-2", className)}>
      <Flame size={22} aria-hidden className={streak > 0 ? "text-gold-400" : "text-chalk-500"} />
      <p className="text-sm text-chalk-300">
        <span className="font-semibold text-chalk-100">{t("pages.quizUI.streakDays", { n: streak })}</span>
        <span className="mx-1.5 text-chalk-500" aria-hidden>·</span>
        {hint}
      </p>
    </div>
  );
}

/** Top of a challenge opened from a friend's link: the score to beat, Dex pointing at it. */
function DuelBanner({ duel, rival, daily }: { duel: DuelLink; rival: string; daily: boolean }) {
  const t = useT();
  const score = `${duel.points}/${duel.max}`;
  return (
    <div className="bevel-sm flex items-center gap-3 border border-gold-500/50 bg-gold-500/10 p-3">
      <Dex pose="pointe" height={72} still />
      <div className="min-w-0">
        <p className="font-heading text-lg font-bold text-gold-300">
          {rival ? t("pages.quizUI.duel.beat", { name: rival, score }) : t("pages.quizUI.duel.beatAnon", { score })}
        </p>
        <p className="text-sm text-chalk-300">
          {daily ? t("pages.quizUI.duel.today") : t("pages.quizUI.duel.past")}
          {!daily && (
            <>
              {" "}
              <Link href="/quiz" className="font-semibold text-gold-400 hover:text-gold-300">
                {t("pages.quizUI.playToday")} →
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Round summary for screen readers: the emoji grid cannot be read aloud. */
function summary(m: Round, attempts: string[], t: T): string {
  const type = t(`pages.quizUI.types.${m.type}`);
  if (m.type === "duel") {
    return t("pages.quizUI.summaryDuel", { type, n: pointsRound(m, attempts), max: m.paires.length });
  }
  return roundSuccessful(m, attempts)
    ? t("pages.quizUI.summaryFound", { type, n: attempts.length })
    : t("pages.quizUI.summaryMissed", { type });
}

/** Countdown to UTC midnight; past midnight, the new challenge starts with one click. */
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

/** A random round of one of the chosen types, avoiding recent answers. */
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage read after mount
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
      <GameSkeleton label={t("pages.quizUI.loading")} />
    );
  }
  if (pool === "error" || !round) {
    return (
      <DexNotice role="alert" tone="error" title={t("dexStates.errorTitle")}>
        <p>{t("pages.quizUI.loadError")}</p>
        <button type="button" onClick={() => setTentative((n) => n + 1)} className={cn(secondaryButton, "mt-3")}>
          {t("pages.quizUI.retry")}
        </button>
      </DexNotice>
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

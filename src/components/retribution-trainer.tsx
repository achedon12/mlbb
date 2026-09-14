"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Copy,
  Crown,
  Download,
  Film,
  Flame,
  ImageIcon,
  Share2,
  Skull,
  Sparkles,
  Target,
  Trophy,
  Turtle,
  Zap,
} from "lucide-react";
import { Chip } from "@/components/chip";
import { Card } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { HEIGHT_CARD, WIDTH_CARD, drawCard, recordCard, type CardData } from "@/lib/retribution-card";
import {
  OBJECTIVE_KEYS,
  DIFFICULTY_ORDER,
  ROUNDS_PER_RUN,
  LEVEL_MAX,
  LEVEL_MIN,
  OBJECTIVES,
  COOLDOWN_RETRIBUTION_S,
  SETTINGS,
  afterRound,
  afterRun,
  runSummary,
  keyRecord,
  hitNext,
  createRandom,
  damageRetribution,
  evaluateHit,
  readRecords,
  prepareRound,
  resultRate,
  resultStolen,
  type ObjectiveKey,
  type Hit,
  type Difficulty,
  type Round,
  type Records,
  type Result,
} from "@/lib/retribution";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Retribution trainer: the monster takes the team's hits in a small arena —
 * it shakes, damage numbers fly off, its health bar melts — and the player
 * strikes (the spell, Space or Enter) as soon as its HP drops below their
 * Retribution damage. Too early, the spell hits nothing; too late, the enemy
 * jungler takes it. Each round ends on its timeline: your strike against the
 * enemy jungler's, in milliseconds.
 *
 * Everything runs in the browser, with no request: once the page has been
 * visited, the service worker serves it offline. Records and streaks stay on
 * the device.
 */
const KEY_STORAGE = "mlbb_chatiment";
const EVENT_RECORDS = "mlbb-chatiment";
const ICONS: Record<ObjectiveKey, LucideIcon> = {
  turtle: Turtle,
  lord: Crown,
  "lord-12": Crown,
  "purple-buff": Sparkles,
  "orange-buff": Flame,
};
/** Arena ambient tint, taken from each monster's portrait. */
const TINTS: Record<ObjectiveKey, string> = {
  turtle: "#2dd4bf",
  lord: "#a78bfa",
  "lord-12": "#c084fc",
  "purple-buff": "#818cf8",
  "orange-buff": "#fb923c",
};
/** Intensity of each difficulty: lit bars, from green to red. */
const INTENSITIES: Record<Difficulty, { n: number; color: string }> = {
  easy: { n: 1, color: "#34d399" },
  normal: { n: 2, color: "#4da3ff" },
  hard: { n: 3, color: "#fb923c" },
  pro: { n: 4, color: "#d94848" },
};
const ICON_RETRIBUTION = "/visuels/sorts/retribution.png";
/** Delay between a round's announcement and the first hit, in ms: impossible to anticipate. */
const READY_MS: [number, number] = [700, 1300];
/** After a verdict, presses are ignored for a moment: one press too many does not restart the round. */
const BLOCK_MS = 500;
const SHARDS_MAX = 6;
const LEVELS = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => LEVEL_MIN + i);

type Phase = "waiting" | "ready" | "fight" | "result" | "summary";
interface Shard {
  id: number;
  damage: number;
  source: Hit["source"];
}

// Records: the browser is the source, read as an external store. Without
// storage (strict private browsing), they live in memory for the visit.
let memory: string | null = null;
function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? memory;
  } catch {
    return memory;
  }
}
function save(records: Records) {
  memory = JSON.stringify(records);
  try {
    localStorage.setItem(KEY_STORAGE, memory);
  } catch {
    // Storage refused: the in-memory copy is enough.
  }
  window.dispatchEvent(new Event(EVENT_RECORDS));
}
function subscribeToRecords(reminder: () => void) {
  window.addEventListener("storage", reminder);
  window.addEventListener(EVENT_RECORDS, reminder);
  return () => {
    window.removeEventListener("storage", reminder);
    window.removeEventListener(EVENT_RECORDS, reminder);
  };
}

const REQUEST_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(reminder: () => void) {
  const m = window.matchMedia(REQUEST_MOTION);
  m.addEventListener("change", reminder);
  return () => m.removeEventListener("change", reminder);
}
const motionReduced = () => window.matchMedia(REQUEST_MOTION).matches;

/** Reaction clock: never called during render, only by timers and presses. */
const timestamp = () => performance.now();

function seed(): number {
  const draw = new Uint32Array(1);
  crypto.getRandomValues(draw);
  return draw[0];
}

/** Damage of a hit, flying above the monster (static when motion is reduced). */
function DamageFigure({ shard, text, reduced }: { shard: Shard; text: string; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reduced) return;
    ref.current?.animate?.(
      [
        { transform: "translateY(10px) scale(0.8)", opacity: 1 },
        { transform: "translateY(-6px) scale(1.1)", opacity: 1, offset: 0.25 },
        { transform: "translateY(-44px) scale(1)", opacity: 0 },
      ],
      { duration: 900, easing: "ease-out", fill: "forwards" },
    );
  }, [reduced]);
  return (
    <span
      ref={ref}
      className={cn(
        "absolute font-heading font-bold tabular-nums drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]",
        shard.source === "skill" && "text-2xl text-gold-400",
        shard.source === "enemy" && "text-2xl text-blood-500",
        shard.source === "ally" && "text-base text-chalk-100",
      )}
      style={{ left: `${14 + ((shard.id * 37) % 64)}%`, top: `${30 + ((shard.id * 23) % 30)}%` }}
    >
      −{text}
    </span>
  );
}

/** Golden bolt striking the monster when Retribution secures it. */
function Flash() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    ref.current?.animate?.(
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 0.3, offset: 0.26 },
        { opacity: 1, offset: 0.4 },
        { opacity: 0 },
      ],
      { duration: 700, easing: "ease-out", fill: "forwards" },
    );
  }, []);
  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox="0 0 64 128"
      className="pointer-events-none absolute -top-1/4 left-1/2 h-[150%] -translate-x-1/2 opacity-0 drop-shadow-[0_0_14px_#f5c451]"
    >
      <path
        d="M40 0 L14 72 L31 72 L20 128 L54 50 L36 50 L48 0 Z"
        fill="#fff5cf"
        stroke="#f5c451"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Verdict stamped across the arena. */
function Buffer({ passed, title, points, reduced }: { passed: boolean; title: string; points: string; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced) return;
    ref.current?.animate?.(
      [
        { transform: "scale(1.9) rotate(-6deg)", opacity: 0 },
        { transform: "scale(0.95) rotate(-3deg)", opacity: 1, offset: 0.7 },
        { transform: "scale(1) rotate(-3deg)", opacity: 1 },
      ],
      { duration: 320, easing: "ease-out", fill: "forwards" },
    );
  }, [reduced]);
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "bevel pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 -rotate-3 whitespace-nowrap border-2 bg-night-950/90 px-5 py-2 text-center font-heading font-bold uppercase shadow-2xl shadow-black/70",
        passed ? "border-gold-400 text-gold-400" : "border-blood-500 text-blood-500",
      )}
    >
      <span className="block text-2xl tracking-wide sm:text-3xl">{title}</span>
      {passed && <span className="block text-lg tabular-nums text-chalk-100">+{points}</span>}
    </div>
  );
}

/**
 * Timeline of a round, from the moment HP drops below the threshold: the
 * player's strike, when there was one, and the enemy jungler's.
 */
function RowTime({
  you,
  enemy,
  t,
  count,
}: {
  you: number | null;
  enemy: number;
  t: (key: string, values?: Record<string, string | number>) => string;
  count: Intl.NumberFormat;
}) {
  const scale = Math.max(1000, enemy, you ?? 0) * 1.08;
  const part = (ms: number) => (ms / scale) * 100;
  // A label near an edge aligns to it instead of overflowing.
  const placement = (p: number) => (p < 12 ? "left-0" : p > 82 ? "right-0" : "-translate-x-1/2");
  const markers = [
    { key: "vous", ms: you, color: "text-gold-400", background: "bg-gold-400", icon: Target, top: true },
    { key: "enemy", ms: enemy, color: "text-blood-500", background: "bg-blood-500", icon: Skull, top: false },
  ] as const;
  return (
    <figure className="mt-4">
      <figcaption className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.rowTime")}</figcaption>
      <div className="relative mb-9 mt-10 h-2 bg-night-800">
        <div
          aria-hidden
          className={cn("absolute inset-y-0 left-0", you === null ? "bg-blood-500/40" : "bg-gold-500/50")}
          style={{ width: `${part(you ?? enemy)}%` }}
        />
        <span aria-hidden className="absolute -top-1.5 left-0 h-5 w-0.5 bg-chalk-300" />
        <span className="absolute left-0 top-4 text-xs text-chalk-500">{t("tools.retribution.rowThreshold")}</span>
        {markers.map(({ key, ms, color, background, icon: Icon, top }) => {
          if (ms === null) return null;
          const p = part(ms);
          return (
            <div key={key} className="absolute inset-y-0" style={{ left: `${p}%` }}>
              <span aria-hidden className={cn("absolute -top-1.5 h-5 w-0.5 -translate-x-1/2", background)} />
              <span
                className={cn(
                  "absolute flex items-center gap-1 whitespace-nowrap text-xs font-semibold tabular-nums",
                  color,
                  top ? "-top-8" : "top-4",
                  placement(p),
                )}
              >
                <Icon size={13} aria-hidden />
                {t(key === "vous" ? "tools.retribution.rowYou" : "tools.retribution.rowEnemy", {
                  ms: count.format(ms),
                })}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export function RetributionTrainer({ address }: { address: string }) {
  const t = useT();
  const siteLocale = useLocale();
  const locale = LOCALE_HTML[siteLocale];
  const count = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const percent = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }), [locale]);
  const reduced = useSyncExternalStore(subscribeToMotion, motionReduced, () => false);
  const raw = useSyncExternalStore(subscribeToRecords, readRaw, () => null);
  const records = useMemo(() => readRecords(raw), [raw]);
  const ids = { objective: useId(), difficulty: useId(), level: useId(), help: useId() };

  const [objective, setObjective] = useState<ObjectiveKey>("lord");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [level, setLevel] = useState(OBJECTIVES.lord.levelRecommended);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [round, setRound] = useState<Round | null>(null);
  const [hp, setHp] = useState(0);
  const [shards, setShards] = useState<Shard[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [share, setShare] = useState<"copied" | "error" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [video, setVideo] = useState<{ url: string; extension: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [view, setView] = useState<"video" | "image">("video");

  // Fight state, read and written by the timers: it lives outside render.
  const game = useRef({
    phase: "waiting" as Phase,
    objective: "lord" as ObjectiveKey,
    difficulty: "normal" as Difficulty,
    level: OBJECTIVES.lord.levelRecommended,
    round: null as Round | null,
    hp: 0,
    crossedAt: null as number | null,
    hpCrossing: null as number | null,
    random: Math.random,
    timers: [] as ReturnType<typeof setTimeout>[],
    results: [] as Result[],
    blockedUntil: 0,
    lastKey: 0,
    idShard: 0,
    image: null as Blob | null,
    preview: null as string | null,
    video: null as { blob: Blob; url: string } | null,
  });
  const button = useRef<HTMLButtonElement>(null);
  const monster = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  const nameObjective = (o: ObjectiveKey) => t(`tools.retribution.objective.${o}`);
  const nameDifficulty = (d: Difficulty) => t(`tools.retribution.difficulty.${d}`);

  function changePhase(p: Phase) {
    game.current.phase = p;
    setPhase(p);
  }

  function stop() {
    game.current.timers.forEach(clearTimeout);
    game.current.timers = [];
  }

  function later(action: () => void, ms: number) {
    game.current.timers.push(setTimeout(action, ms));
  }

  /** The monster shakes under the hit, harder for a skill or an enemy burst. */
  function shake(source: Hit["source"]) {
    if (motionReduced()) return;
    const strong = source !== "ally";
    const d = strong ? 8 : 3;
    monster.current?.animate?.(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${-d}px, ${d / 2}px)` },
        { transform: `translate(${d}px, ${-d / 2}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: strong ? 260 : 160, easing: "ease-out" },
    );
    if (flash.current) {
      flash.current.style.background = source === "enemy" ? "#d94848" : "#ffffff";
      flash.current.animate?.([{ opacity: strong ? 0.55 : 0.28 }, { opacity: 0 }], { duration: 240, easing: "ease-out" });
    }
  }

  function verdict(r: Result): { title: string; detail: string } {
    switch (r.issue) {
      case "secured":
        return {
          title: t("tools.retribution.outcomeSecured"),
          detail: t("tools.retribution.detailSecured", {
            precision: percent.format(r.accuracy ?? 0),
            reaction: count.format(r.reaction ?? 0),
            points: count.format(r.points),
          }),
        };
      case "tooEarly":
        return {
          title: t("tools.retribution.outcomeTooEarly"),
          detail: t("tools.retribution.detailTooEarly", { reste: count.format(r.rest ?? 0), recharge: COOLDOWN_RETRIBUTION_S }),
        };
      case "stolen":
        return {
          title: t("tools.retribution.outcomeStolen"),
          detail: t("tools.retribution.detailStolen", { reaction: count.format(r.reactionEnemy ?? 0) }),
        };
      default:
        return { title: t("tools.retribution.outcomeMissed"), detail: t("tools.retribution.detailMissed") };
    }
  }

  async function cardData(series: Result[], record: boolean): Promise<CardData> {
    const j = game.current;
    const b = runSummary(series);
    await document.fonts?.ready;
    const style = getComputedStyle(document.documentElement);
    const font = (variable: string) => `${style.getPropertyValue(variable).trim() || "system-ui"}, system-ui, sans-serif`;
    // Local portrait (same origin): the canvas stays exportable.
    const portrait = new Image();
    portrait.src = OBJECTIVES[j.objective].image;
    const load = await portrait.decode().then(
      () => true,
      () => false,
    );
    return {
      mark: site.name,
      title: t("tools.retribution.mapTitle"),
      subtitle: [nameObjective(j.objective), nameDifficulty(j.difficulty), t("tools.retribution.levelShort", { n: j.level })]
        .join(" · "),
      total: b.total,
      format: (n) => count.format(n),
      labelScore: t("tools.retribution.points"),
      stats: [
        { label: t("tools.retribution.secured"), value: `${b.secured}/${b.rounds}` },
        {
          label: t("tools.retribution.bestReaction"),
          value: b.bestReaction === null ? "—" : `${count.format(b.bestReaction)} ms`,
        },
        {
          label: t("tools.retribution.averageAccuracy"),
          value: b.accuracyAverage === null ? "—" : percent.format(b.accuracyAverage),
        },
      ],
      rounds: series.map((r) => r.issue),
      record: record ? t("tools.retribution.newRecord") : null,
      address: address.replace(/^https?:\/\//, ""),
      fonts: { title: font("--heading-font"), body: font("--body-font") },
      portrait: load ? portrait : null,
      tint: TINTS[j.objective],
    };
  }

  function imageFixed(d: CardData): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH_CARD;
    canvas.height = HEIGHT_CARD;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    drawCard(ctx, d);
    return new Promise((ok) => canvas.toBlob(ok, "image/png"));
  }

  /** The card image first, then its video, recorded in a few seconds. */
  async function producePreview(series: Result[], record: boolean) {
    const j = game.current;
    const d = await cardData(series, record);
    const image = await imageFixed(d);
    if (image) {
      if (j.preview) URL.revokeObjectURL(j.preview);
      j.image = image;
      j.preview = URL.createObjectURL(image);
      setPreview(j.preview);
    }
    if (j.video) URL.revokeObjectURL(j.video.url);
    j.video = null;
    setVideo(null);
    setRecording(true);
    const film = await recordCard(d).catch(() => null);
    setRecording(false);
    // A new game may have started during recording: the video no longer matches it.
    if (!film || j.results !== series) return;
    j.video = { blob: film, url: URL.createObjectURL(film) };
    setVideo({ url: j.video.url, extension: film.type.includes("mp4") ? "mp4" : "webm" });
  }

  function finish(r: Result) {
    const j = game.current;
    if (j.phase !== "fight") return;
    stop();
    const series = [...j.results, r];
    j.results = series;
    setResults(series);
    let next = afterRound(readRecords(readRaw()), r.issue);
    let record = false;
    const finished = series.length >= ROUNDS_PER_RUN;
    if (finished) {
      const issue = afterRun(
        next,
        keyRecord(j.objective, j.difficulty),
        runSummary(series),
        new Date().toISOString().slice(0, 10),
      );
      next = issue.records;
      record = issue.isNewRecord;
    }
    save(next);
    setNewRecord(record);
    j.blockedUntil = timestamp() + BLOCK_MS;
    changePhase(finished ? "summary" : "result");
    const v = verdict(r);
    const total = runSummary(series).total;
    setAnnouncement(`${v.title} ${v.detail}${finished ? ` ${t("tools.retribution.announceSummary", { points: count.format(total) })}` : ""}`);
    if (finished) void producePreview(series, record);
  }

  function schedule() {
    const j = game.current;
    if (!j.round) return;
    const hit = hitNext(j.hp, j.round, j.difficulty, j.random);
    later(() => apply(hit), hit.interval);
  }

  function apply(hit: Hit) {
    const j = game.current;
    if (j.phase !== "fight" || !j.round) return;
    j.hp = hit.hpAfter;
    setHp(hit.hpAfter);
    j.idShard += 1;
    const shard = { id: j.idShard, damage: hit.damage, source: hit.source };
    setShards((e) => [...e.slice(-(SHARDS_MAX - 1)), shard]);
    shake(hit.source);
    if (j.crossedAt === null && hit.hpAfter <= j.round.threshold) {
      j.crossedAt = timestamp();
      j.hpCrossing = hit.hpAfter;
      const reaction = j.round.reactionEnemy;
      later(() => finish(resultStolen(reaction)), reaction);
    }
    if (hit.hpAfter <= 0) finish(resultRate());
    else schedule();
  }

  function start() {
    const j = game.current;
    stop();
    if (j.results.length >= ROUNDS_PER_RUN) {
      j.results = [];
      setResults([]);
      setNewRecord(false);
    }
    j.random = createRandom(seed());
    j.objective = objective;
    j.difficulty = difficulty;
    j.level = level;
    const m = prepareRound(objective, difficulty, level, j.random);
    j.round = m;
    j.hp = m.hpStart;
    j.crossedAt = null;
    j.hpCrossing = null;
    setRound(m);
    setHp(m.hpStart);
    setShards([]);
    changePhase("ready");
    setAnnouncement(
      t("tools.retribution.announceRound", {
        n: j.results.length + 1,
        total: ROUNDS_PER_RUN,
        objectif: nameObjective(objective),
      }),
    );
    const waiting = READY_MS[0] + (READY_MS[1] - READY_MS[0]) * j.random();
    later(() => {
      changePhase("fight");
      schedule();
    }, waiting);
  }

  function strike() {
    const j = game.current;
    const instant = timestamp();
    if (j.phase === "fight" && j.round) {
      finish(
        evaluateHit({
          hp: j.hp,
          threshold: j.round.threshold,
          hpCrossing: j.hpCrossing,
          reaction: j.crossedAt === null ? null : instant - j.crossedAt,
        }),
      );
    } else if (j.phase !== "ready" && instant >= j.blockedUntil) {
      start();
    }
  }

  function reset() {
    stop();
    const j = game.current;
    j.results = [];
    j.round = null;
    setResults([]);
    setRound(null);
    setShards([]);
    setNewRecord(false);
    setAnnouncement("");
    changePhase("waiting");
  }

  // The keyboard shortcut always calls the current version of `strike`.
  const hitCurrent = useRef(strike);
  useEffect(() => {
    hitCurrent.current = strike;
  });

  useEffect(() => {
    const j = game.current;
    const targetIgnored = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, select, textarea, [contenteditable='true']")) return true;
      // Outside a fight, Space keeps its role on other buttons and links.
      return j.phase !== "fight" && !!target?.closest("button, a, summary") && target !== button.current;
    };
    const press = (e: KeyboardEvent) => {
      if (e.code !== "Space" || targetIgnored(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      j.lastKey = timestamp();
      hitCurrent.current();
    };
    const release = (e: KeyboardEvent) => {
      if (e.code === "Space") j.lastKey = timestamp();
    };
    window.addEventListener("keydown", press);
    window.addEventListener("keyup", release);
    return () => {
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", release);
      j.timers.forEach(clearTimeout);
      if (j.preview) URL.revokeObjectURL(j.preview);
      if (j.video) URL.revokeObjectURL(j.video.url);
    };
  }, []);

  const summary = phase === "summary" ? runSummary(results) : null;
  const text = summary
    ? t("tools.retribution.shareText", {
        objectif: nameObjective(objective),
        difficulte: nameDifficulty(difficulty),
        points: count.format(summary.total),
        securises: summary.secured,
        manches: summary.rounds,
      })
    : "";

  function report(state: "copied" | "error") {
    setShare(state);
    setTimeout(() => setShare(null), 3000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${address}`);
      report("copied");
    } catch {
      report("error");
    }
  }

  async function shareResult() {
    const { image, video: film } = game.current;
    try {
      // Share what the preview shows: the video, or the image.
      const file =
        view === "video" && film && video
          ? new File([film.blob], `mlbbdex-retribution.${video.extension}`, { type: film.blob.type })
          : image
            ? new File([image], "mlbbdex-retribution.png", { type: "image/png" })
            : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t("tools.retribution.mapTitle"), text: `${text} ${address}` });
      } else if (typeof navigator.share === "function") {
        await navigator.share({ title: t("tools.retribution.mapTitle"), text, url: address });
      } else {
        await copy();
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) report("error");
    }
  }

  const o = OBJECTIVES[objective];
  const tint = TINTS[objective];
  const setting = SETTINGS[difficulty];
  const threshold = damageRetribution(level);
  const Icon = ICONS[objective];
  const hpMax = round?.hpMax ?? o.hp;
  const hpShown = round ? hp : o.hp;
  const part = Math.max(0, (hpShown / hpMax) * 100);
  const partThreshold = Math.min(100, (threshold / hpMax) * 100);
  const locked = phase === "ready" || phase === "fight";
  const last = phase === "result" || phase === "summary" ? (results.at(-1) ?? null) : null;
  // The monster falls, unless Retribution went off too early: it then stays standing.
  const killed = last !== null && last.issue !== "tooEarly";
  // On difficulties that show the marker, the bar turns gold below the threshold.
  const hasRange = phase === "fight" && setting.marker && hpShown <= threshold;
  const record = records.series[keyRecord(objective, difficulty)];
  const roundCurrent = Math.min(ROUNDS_PER_RUN, results.length + (locked ? 1 : 0));
  const segment = (o.segment / hpMax) * 100;
  const labelButton = {
    waiting: t("tools.retribution.start"),
    ready: t("tools.retribution.ready"),
    fight: t("tools.retribution.smite"),
    result: t("tools.retribution.next"),
    summary: t("tools.retribution.newRun"),
  }[phase];
  const classChoice = (active: boolean) =>
    cn(
      "bevel-sm border transition-colors",
      active ? "border-gold-400 bg-gold-500/10" : "border-night-700 bg-night-950/40 hover:border-night-600",
    );

  return (
    <div className="space-y-6">
      <Card>
        <fieldset disabled={locked} className="space-y-6 disabled:opacity-60">
          <legend className="sr-only">{t("tools.retribution.settings")}</legend>
          <div>
            <p id={ids.objective} className="text-xs uppercase tracking-wide text-chalk-500">
              {t("tools.retribution.objectiveLabel")}
            </p>
            <div role="group" aria-labelledby={ids.objective} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {OBJECTIVE_KEYS.map((key) => {
                const active = key === objective;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setObjective(key);
                      setLevel(OBJECTIVES[key].levelRecommended);
                      reset();
                    }}
                    className={cn("group flex flex-col items-center gap-2 p-3 text-center", classChoice(active))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local portrait, already downsized */}
                    <img
                      src={OBJECTIVES[key].image}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className={cn(
                        "size-16 rounded-full border-2 object-cover transition",
                        !active && "opacity-70 grayscale-[35%] group-hover:opacity-100 group-hover:grayscale-0",
                      )}
                      style={{ borderColor: active ? TINTS[key] : "transparent" }}
                    />
                    <span className={cn("text-sm font-semibold leading-tight", active ? "text-gold-400" : "text-chalk-200")}>
                      {nameObjective(key)}
                    </span>
                    <span className="text-xs tabular-nums text-chalk-500">
                      {t("tools.retribution.maxHp", { pv: count.format(OBJECTIVES[key].hp) })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p id={ids.difficulty} className="text-xs uppercase tracking-wide text-chalk-500">
              {t("tools.retribution.difficultyLabel")}
            </p>
            <div role="group" aria-labelledby={ids.difficulty} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIFFICULTY_ORDER.map((d) => {
                const active = d === difficulty;
                const { n, color } = INTENSITIES[d];
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setDifficulty(d);
                      reset();
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold",
                      classChoice(active),
                      active ? "text-gold-400" : "text-chalk-200",
                    )}
                  >
                    {nameDifficulty(d)}
                    <span aria-hidden className="flex items-end gap-0.5">
                      {[1, 2, 3, 4].map((k) => (
                        <span
                          key={k}
                          className="w-1.5"
                          style={{ height: `${4 + k * 3}px`, background: k <= n ? color : "var(--color-night-700)" }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-chalk-400">{t(`tools.retribution.difficultyHelp.${difficulty}`)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <label htmlFor={ids.level} className="text-xs uppercase tracking-wide text-chalk-500">
                {t("tools.retribution.levelLabel")}
              </label>
              {/* Damage at each level, the chosen level in gold: the curve reads at a glance. */}
              <div aria-hidden className="mt-3 flex h-12 items-end gap-1">
                {LEVELS.map((n) => (
                  <span
                    key={n}
                    className={cn("flex-1 transition-colors", n === level ? "bg-gold-400" : n < level ? "bg-gold-500/35" : "bg-night-700")}
                    style={{ height: `${(damageRetribution(n) / damageRetribution(LEVEL_MAX)) * 100}%` }}
                  />
                ))}
              </div>
              <input
                id={ids.level}
                type="range"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                step={1}
                value={level}
                aria-valuetext={t("tools.retribution.levelOption", { n: level, degats: count.format(threshold) })}
                onChange={(e) => {
                  setLevel(Number(e.target.value));
                  reset();
                }}
                className="mt-2 w-full cursor-pointer accent-gold-500"
              />
              <div aria-hidden className="flex justify-between text-xs tabular-nums text-chalk-500">
                <span>{LEVEL_MIN}</span>
                <span>{LEVEL_MAX}</span>
              </div>
            </div>
            <div className="bevel-sm flex items-center gap-3 border border-gold-500/40 bg-gold-500/10 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local spell icon */}
              <img src={ICON_RETRIBUTION} alt="" width={48} height={48} className="size-12 rounded-full" />
              <div>
                <p className="text-xs uppercase tracking-wide text-chalk-400">
                  {t("tools.retribution.levelShort", { n: level })}
                </p>
                <p className="font-heading text-3xl font-bold leading-none tabular-nums text-gold-400">{count.format(threshold)}</p>
                <p className="mt-0.5 text-xs text-chalk-400">{t("tools.retribution.rawDamage")}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-chalk-300">
            {t("tools.retribution.thresholdSentence", { degats: count.format(threshold), conseille: o.levelRecommended })}
          </p>
        </fieldset>
      </Card>

      <section aria-labelledby={`${ids.help}-titre`} className="relative">
        {/* The bevel is carried by the background: on the arena itself, it would clip the flying numbers. */}
        <div
          aria-hidden
          className="bevel absolute inset-0 border border-night-700/70 bg-night-950"
          style={{
            backgroundImage: `radial-gradient(ellipse 70% 55% at 50% 32%, ${tint}40, transparent 70%), radial-gradient(ellipse 90% 40% at 50% 110%, ${tint}26, transparent 70%)`,
          }}
        />
        <div className="relative space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-chalk-500">
                {t("tools.retribution.round")}{" "}
                <span className="font-heading text-base font-bold tabular-nums text-chalk-100">
                  {roundCurrent}/{ROUNDS_PER_RUN}
                </span>
              </p>
              <ol className="mt-2 flex items-center gap-1.5" aria-label={t("tools.retribution.rounds")}>
                {Array.from({ length: ROUNDS_PER_RUN }, (_, i) => {
                  const r = results[i];
                  const inProgress = !r && locked && i === results.length;
                  return (
                    <li
                      key={i}
                      className={cn(
                        "bevel-sm grid size-6 place-items-center border",
                        !r && !inProgress && "border-night-600",
                        inProgress && "animate-pulse border-gold-400 bg-gold-500/20",
                        r?.issue === "secured" && "border-gold-400 bg-gold-400 text-night-950",
                        r && r.issue !== "secured" && "border-blood-500 bg-blood-500/30 text-blood-500",
                      )}
                    >
                      {r?.issue === "secured" && <Zap size={13} aria-hidden />}
                      {r && r.issue !== "secured" && <Skull size={12} aria-hidden />}
                      <span className="sr-only">{r ? verdict(r).title : t("tools.retribution.toPlay")}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
            <dl className="flex gap-5 text-right text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.score")}</dt>
                <dd className="font-heading text-2xl font-bold tabular-nums text-gold-400">
                  {count.format(results.reduce((s, r) => s + r.points, 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.run")}</dt>
                <dd className="flex items-center justify-end gap-1 font-heading text-2xl font-bold tabular-nums text-chalk-100">
                  {records.enCours > 0 && <Flame size={18} aria-hidden className="text-gold-400" />}
                  {count.format(records.enCours)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative flex flex-col items-center pt-2">
            <div ref={monster} className="relative size-40 sm:size-52">
              <div aria-hidden className="absolute -inset-5 rounded-full opacity-50 blur-2xl" style={{ background: tint }} />
              {/* eslint-disable-next-line @next/next/no-img-element -- local portrait, already downsized */}
              <img
                src={o.image}
                alt=""
                width={320}
                height={320}
                className={cn(
                  "relative size-full rounded-full border-4 object-cover shadow-2xl shadow-black/70 transition-[filter] duration-500",
                  killed && "brightness-50 grayscale",
                )}
                style={{ borderColor: tint }}
              />
              <div ref={flash} aria-hidden className="pointer-events-none absolute inset-0 rounded-full opacity-0 mix-blend-screen" />
              <span
                aria-hidden
                className="bevel-sm absolute -bottom-2 left-1/2 grid size-10 -translate-x-1/2 place-items-center border border-night-600 bg-night-900 text-chalk-200"
              >
                <Icon size={20} />
              </span>
              {last?.issue === "secured" && !reduced && <Flash key={results.length} />}
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56">
              {(reduced ? shards.slice(-1) : shards).map((e) => (
                <DamageFigure key={e.id} shard={e} text={count.format(e.damage)} reduced={reduced} />
              ))}
            </div>
            {phase === "ready" && (
              <p
                aria-hidden
                className="absolute top-[38%] animate-pulse font-heading text-4xl font-bold uppercase tracking-wider text-chalk-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
              >
                {t("tools.retribution.ready")}
              </p>
            )}
            {last && (
              <Buffer
                key={results.length}
                passed={last.issue === "secured"}
                title={verdict(last).title}
                points={count.format(last.points)}
                reduced={reduced}
              />
            )}
            <h2 id={`${ids.help}-titre`} className="mt-6 font-heading text-xl font-bold text-chalk-100">
              {nameObjective(objective)}
            </h2>
            <p className="text-sm text-chalk-500">
              {t("tools.retribution.maxHp", { pv: count.format(o.hp) })} · {nameDifficulty(difficulty)}
            </p>
          </div>

          <div>
            <div
              role="progressbar"
              aria-label={t("tools.retribution.bar", { objectif: nameObjective(objective) })}
              aria-valuemin={0}
              aria-valuemax={hpMax}
              aria-valuenow={hpShown}
              className="relative h-8 overflow-hidden border border-black/70 bg-night-950 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)]"
            >
              {setting.marker && (
                <div aria-hidden className="absolute inset-y-0 left-0 bg-gold-400/10" style={{ width: `${partThreshold}%` }} />
              )}
              {/* Light trail: lost health fades a moment after the hit, as in game. */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 bg-chalk-100/60 transition-[width] delay-150 duration-500 ease-out"
                style={{ width: `${part}%` }}
              />
              <div
                className={cn(
                  "absolute inset-y-0 left-0 bg-linear-to-b transition-[width] duration-100 ease-linear",
                  hasRange ? "from-[#ffe08a] to-gold-500" : "from-[#ff7a66] to-blood-500",
                )}
                style={{ width: `${part}%` }}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, transparent 0 calc(${segment}% - 1px), rgba(6, 8, 15, 0.9) calc(${segment}% - 1px) ${segment}%)`,
                }}
              />
              {setting.marker && (
                <div
                  aria-hidden
                  className="absolute inset-y-0 w-0.5 bg-gold-400 shadow-[0_0_8px_#f5c451]"
                  style={{ left: `${partThreshold}%` }}
                />
              )}
              {setting.hpFigures && (
                <span
                  aria-hidden
                  className="absolute inset-0 grid place-items-center text-xs font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                >
                  {count.format(hpShown)}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
              <span className="tabular-nums text-chalk-300">
                {setting.hpFigures
                  ? t("tools.retribution.hpLeft", { pv: count.format(hpShown), max: count.format(hpMax) })
                  : t("tools.retribution.hpHidden")}
              </span>
              <span className={setting.marker ? "text-gold-400" : "text-chalk-500"}>
                {setting.marker ? t("tools.retribution.marker", { degats: count.format(threshold) }) : t("tools.retribution.noMarker")}
              </span>
            </div>
          </div>

          <button
            ref={button}
            type="button"
            onPointerDown={(e) => {
              if (e.button === 0) strike();
            }}
            onClick={(e) => {
              // Keyboard (Enter) or assistive-technology click; the pointer is already handled on press.
              if (e.detail === 0 && timestamp() - game.current.lastKey > BLOCK_MS) strike();
            }}
            aria-keyshortcuts="Space"
            aria-describedby={ids.help}
            className={cn(
              "group flex w-full touch-manipulation select-none flex-col items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400",
              phase === "ready" && "cursor-wait",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "relative grid size-28 place-items-center rounded-full border-4 bg-night-950 transition-[border-color,box-shadow,transform] duration-150 group-active:scale-95 sm:size-32",
                phase === "fight" && "border-gold-400 shadow-[0_0_36px_rgba(245,196,81,0.6)]",
                phase === "ready" && "border-night-600",
                (phase === "waiting" || phase === "result" || phase === "summary") &&
                  "border-azure-400 shadow-[0_0_24px_rgba(77,163,255,0.35)] group-hover:shadow-[0_0_34px_rgba(77,163,255,0.55)]",
              )}
            >
              {phase === "fight" && <span className="absolute -inset-2 animate-ping rounded-full border-2 border-gold-400/50" />}
              {/* eslint-disable-next-line @next/next/no-img-element -- local spell icon */}
              <img
                src={ICON_RETRIBUTION}
                alt=""
                width={100}
                height={100}
                className={cn("size-full rounded-full object-cover p-1", phase === "ready" && "opacity-40 grayscale")}
              />
              {phase === "ready" && (
                <span className="absolute -inset-1 animate-spin rounded-full border-4 border-transparent border-t-gold-400" />
              )}
            </span>
            <span
              className={cn(
                "flex items-center gap-2 font-heading text-2xl font-bold uppercase tracking-wide",
                phase === "fight" ? "text-gold-400" : phase === "ready" ? "text-chalk-400" : "text-azure-400",
              )}
            >
              <Zap size={22} aria-hidden />
              {labelButton}
            </span>
          </button>
          <p id={ids.help} className="text-center text-xs text-chalk-500">
            {t("tools.retribution.help")}
          </p>

          {last && (
            <div
              className={cn(
                "bevel-sm border p-4",
                last.issue === "secured" ? "border-gold-500/50 bg-gold-500/10" : "border-blood-500/50 bg-blood-500/10",
              )}
            >
              <p className={cn("font-heading text-xl font-bold", last.issue === "secured" ? "text-gold-400" : "text-blood-500")}>
                {verdict(last).title}
              </p>
              <p className="mt-1 text-sm text-chalk-200">{verdict(last).detail}</p>
              {round && (last.issue === "secured" || last.issue === "stolen") && (
                <RowTime
                  you={last.issue === "secured" ? last.reaction : null}
                  enemy={last.reactionEnemy ?? round.reactionEnemy}
                  t={t}
                  count={count}
                />
              )}
            </div>
          )}
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>
      </section>

      {summary && (
        <Card className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("tools.retribution.summaryTitle")}</h2>
            {newRecord && (
              <span className="bevel-sm inline-flex items-center gap-1.5 bg-gold-500 px-3 py-1 font-heading text-sm font-bold text-night-950">
                <Trophy size={15} aria-hidden />
                {t("tools.retribution.newRecord")}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.points")}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-gold-400">{count.format(summary.total)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.secured")}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-chalk-100">
                {summary.secured}/{summary.rounds}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.bestReaction")}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-chalk-100">
                {summary.bestReaction === null ? "—" : `${count.format(summary.bestReaction)} ms`}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.averageAccuracy")}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-chalk-100">
                {summary.accuracyAverage === null ? "—" : percent.format(summary.accuracyAverage)}
              </dd>
            </div>
          </dl>

          <figure>
            <figcaption className="text-xs uppercase tracking-wide text-chalk-500">
              {t("tools.retribution.summaryChart")}
            </figcaption>
            <ol className="mt-3 flex h-44 items-end gap-2 sm:gap-4">
              {results.map((r, i) => {
                const passed = r.issue === "secured";
                return (
                  <li key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className={cn("text-sm font-bold tabular-nums", passed ? "text-gold-400" : "text-blood-500")}>
                      {passed ? count.format(r.points) : <Skull size={16} aria-hidden />}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "bevel-sm w-full",
                        passed ? "bg-linear-to-t from-gold-600 to-gold-400" : "bg-blood-500/40",
                      )}
                      style={{ height: `${Math.max(4, (r.points / 1000) * 72)}%` }}
                    />
                    <span className="text-xs tabular-nums text-chalk-500">{i + 1}</span>
                    <span className="sr-only">{verdict(r).title}</span>
                  </li>
                );
              })}
            </ol>
          </figure>

          {(recording || video) && (
            <div role="group" aria-label={t("tools.retribution.previewFormat")} className="flex flex-wrap gap-2">
              <Chip active={view === "video"} dense onClick={() => setView("video")}>
                <Film size={14} aria-hidden className="-mt-0.5 mr-1.5 inline" />
                {t("tools.retribution.videoPreview")}
              </Chip>
              <Chip active={view === "image"} dense onClick={() => setView("image")}>
                <ImageIcon size={14} aria-hidden className="-mt-0.5 mr-1.5 inline" />
                {t("tools.retribution.imagePreview")}
              </Chip>
            </div>
          )}
          {view === "video" && video ? (
            <video
              key={video.url}
              src={video.url}
              width={WIDTH_CARD}
              height={HEIGHT_CARD}
              autoPlay={!reduced}
              controls={reduced}
              loop
              muted
              playsInline
              aria-label={`${t("tools.retribution.mapTitle")} — ${text}`}
              className="bevel h-auto w-full border border-night-700 bg-night-950"
            />
          ) : view === "video" && recording ? (
            <div
              role="status"
              className="bevel grid aspect-[1200/630] w-full place-items-center border border-night-700 bg-night-950 text-sm text-chalk-400"
            >
              <span className="flex items-center gap-3">
                <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-night-600 border-t-gold-400" />
                {t("tools.retribution.videoPreparing")}
              </span>
            </div>
          ) : (
            preview && (
              // eslint-disable-next-line @next/next/no-img-element -- image generated in the browser (blob URL)
              <img
                src={preview}
                width={WIDTH_CARD}
                height={HEIGHT_CARD}
                alt={`${t("tools.retribution.mapTitle")} — ${text}`}
                className="bevel h-auto w-full border border-night-700"
              />
            )
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={shareResult}
              className="bevel-sm inline-flex items-center gap-2 bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
            >
              <Share2 size={16} aria-hidden />
              {t("tools.retribution.share")}
            </button>
            <button
              type="button"
              onClick={copy}
              className="bevel-sm inline-flex items-center gap-2 border border-night-600 px-4 py-2 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-gold-400"
            >
              <Copy size={16} aria-hidden />
              {t("tools.retribution.copy")}
            </button>
            {preview && (
              <a
                href={preview}
                download="mlbbdex-retribution.png"
                className="bevel-sm inline-flex items-center gap-2 border border-night-600 px-4 py-2 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                <Download size={16} aria-hidden />
                {t("tools.retribution.download")}
              </a>
            )}
            {video && (
              <a
                href={video.url}
                download={`mlbbdex-retribution.${video.extension}`}
                className="bevel-sm inline-flex items-center gap-2 border border-night-600 px-4 py-2 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                <Film size={16} aria-hidden />
                {t("tools.retribution.downloadVideo")}
              </a>
            )}
          </div>
          <p role="status" className="min-h-5 text-sm text-chalk-400">
            {share === "copied" && t("tools.retribution.copied")}
            {share === "error" && t("tools.retribution.shareError")}
          </p>
        </Card>
      )}

      <Card>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-chalk-100">
          <Trophy size={18} aria-hidden className="text-gold-400" />
          {t("tools.retribution.recordsTitle")}
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="bevel-sm border border-gold-500/30 bg-gold-500/5 p-3">
            <dt className="text-chalk-500">
              {t("tools.retribution.recordSetting", { objectif: nameObjective(objective), difficulte: nameDifficulty(difficulty) })}
            </dt>
            <dd className="mt-1 font-heading text-2xl font-bold tabular-nums text-gold-400">
              {record ? count.format(record.total) : "—"}
            </dd>
          </div>
          <div className="bevel-sm border border-night-700/70 bg-night-950/40 p-3">
            <dt className="text-chalk-500">{t("tools.retribution.currentRun")}</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-heading text-2xl font-bold tabular-nums text-chalk-100">
              <Flame size={18} aria-hidden className={records.enCours > 0 ? "text-gold-400" : "text-chalk-600"} />
              {count.format(records.enCours)}
            </dd>
          </div>
          <div className="bevel-sm border border-night-700/70 bg-night-950/40 p-3">
            <dt className="text-chalk-500">{t("tools.retribution.bestRun")}</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-heading text-2xl font-bold tabular-nums text-chalk-100">
              <Crown size={18} aria-hidden className="text-chalk-500" />
              {count.format(records.meilleureSuite)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-chalk-500">{t("tools.retribution.localRecords")}</p>
      </Card>
    </div>
  );
}

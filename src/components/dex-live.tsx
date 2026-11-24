"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DexPose } from "@/components/mascot";

type Move = "hop" | "wiggle" | "look" | "spin" | "jump";
/** A short act: the frames he goes through (pose, milliseconds) and the move that carries them. */
type Act = { frames: [DexPose | "base", number][]; move?: Move };
const WAVE: Act = { frames: [["coucou", 260], ["coucou2", 240], ["coucou", 240], ["coucou2", 240], ["coucou", 220]], move: "hop" };
/** What he does now and then, on his own, while on screen. */
const FIDGETS: Act[] = [
  { frames: [], move: "hop" },
  { frames: [], move: "wiggle" },
  { frames: [["leve", 1300]], move: "look" },
  { frames: [], move: "spin" },
  WAVE,
  { frames: [["bravo", 300], ["joie", 300], ["bravo", 300], ["joie", 300]], move: "hop" },
  { frames: [["pointe", 1500]], move: "wiggle" },
  { frames: [["cligne", 140]] },
  { frames: [["cligne", 120], ["base", 120], ["cligne", 120]] },
];
/** What a click makes him do, in turn. */
const CHEERS: Act[] = [
  { frames: [["saut", 800]], move: "jump" },
  { frames: [["joie", 900]], move: "jump" },
  { frames: [["bravo", 260], ["joie", 260], ["bravo", 260]], move: "jump" },
];
const FIDGET_MIN_MS = 6000, FIDGET_SPREAD_MS = 6000;
/** No sign of the visitor for this long and he dozes off; any sign wakes him. */
const SLEEP_MS = 45000;
/** The pose he takes to talk. */
const talkPose = (pose: DexPose): DexPose => (pose === "parle" ? "debout" : "parle");
/** Frames fetched once he is on screen, so a swap never waits for the network. */
const PRELOAD: DexPose[] = ["parle", "coucou", "coucou2", "cligne", "leve", "joie", "bravo", "saut", "pointe", "dodo"];

/**
 * The living part of every Dex (see `mascot.tsx`), built like a cartoon
 * character in layers that each move on their own rhythm:
 *
 * - **arrival**: he drops in when he first comes into view and lands with a
 *   squash, his shadow growing under him;
 * - **idle**: he floats and sways (one layer) while breathing (another), out
 *   of step, and his shadow on the ground follows the float;
 * - **attention**: on a pointer device he leans and looks toward the cursor
 *   when it comes near, and perks up on hover;
 * - **hello**: he waves once he has landed;
 * - **fidgets**: every few seconds, a small random act, only while he is on
 *   screen: a hop, a wiggle, a pirouette, looking up, waving, clapping,
 *   pointing, blinking. An act is a few frames (other drawings of him) on top
 *   of a move; each swap of drawing comes with a quick squash, which hides
 *   that two drawings never line up exactly;
 * - **click**: anticipation squash, a stretched jump with a happy drawing, a
 *   landing squash, a burst of bubbles and a tip suited to the page;
 * - **talking**: while his bubble shows he switches to his talking drawing
 *   and bobs as he speaks;
 * - **sleep**: left alone long enough, he curls up and dozes (little z rise);
 *   the visitor's next move wakes him with a start;
 * - soap bubbles rise from him and pop.
 *
 * When no bubble already stands beside him he says a tip on his own now and
 * then; only one Dex per page does, the first to appear, so a page with
 * several Dex never chatters. Everything rests under
 * `prefers-reduced-motion` (globals.css).
 */
const SECTIONS: [RegExp, string][] = [
  [/^\/heroes\/[^/]+/, "hero"], [/^\/heroes|^\/compare|^\/lore/, "heroes"],
  [/^\/tier-list|^\/meta/, "tierList"], [/^\/statistics/, "statistics"],
  [/^\/items|^\/emblems|^\/spells/, "items"], [/^\/guides|^\/game-modes|^\/ranks/, "guides"], [/^\/map/, "map"],
  [/^\/draft/, "draft"], [/^\/mlbbdle|^\/quiz/, "games"], [/^\/tools|^\/builds/, "tools"],
  [/^\/patch-notes|^\/news|^\/watch/, "patch"], [/^\/esports/, "esports"], [/^\/community|^\/account|^\/login/, "community"],
  [/^\/skins|^\/events/, "skins"], [/^\/?$/, "home"],
];
const sectionOf = (path: string) => SECTIONS.find(([re]) => re.test(path))?.[1] ?? "default";
const TIPS = 3;
const FIRST_TIP_MS = 6000, TIP_SHOWN_MS = 7000, TIP_EVERY_MS = 30000, MAX_AUTO_TIPS = 3;

/** The one Dex of the page allowed to talk on his own. */
let speaker: symbol | null = null;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function DexLive({ pose, width, height, alt, priority, still }: {
  pose: DexPose;
  width: number;
  height: number;
  alt: string;
  priority: boolean;
  still: boolean;
}) {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const section = sectionOf(pathname.replace(/^\/[a-z]{2,3}(?=\/|$)/, "") || "/");
  const root = useRef<HTMLSpanElement>(null);
  const tilt = useRef<HTMLSpanElement>(null);
  const faces = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const [action, setAction] = useState<{ name: Move; n: number } | null>(null);
  const [frame, setFrame] = useState<DexPose | null>(null);
  const [asleep, setAsleep] = useState(false);
  const [seen, setSeen] = useState(false);
  const [extra, setExtra] = useState<DexPose[]>([]);
  const visible = useRef(false);
  const next = useRef(0);
  const cheer = useRef(0);
  const acting = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sleeping = useRef(false);

  /** A bubble already beside this Dex (DexSays, DexNote, game screens…): he does not add his own. */
  const hasNeighbourBubble = useCallback(() => {
    const around = root.current?.parentElement?.parentElement;
    return !!around?.querySelector(".dex-bubble:not(.dex-live-bubble), .game-bubble");
  }, []);

  const say = useCallback(() => {
    setTip(next.current % TIPS);
    next.current += 1;
  }, []);

  const move = useCallback((name: Move) => setAction((a) => ({ name, n: (a?.n ?? 0) + 1 })), []);

  /** Plays an act: its move at once, then each frame in turn, then back to his own pose. */
  const perform = useCallback((act: Act) => {
    acting.current.forEach(clearTimeout);
    acting.current = [];
    if (act.move) move(act.move);
    let at = 0;
    for (const [f, ms] of act.frames) {
      acting.current.push(setTimeout(() => setFrame(f === "base" ? null : f), at));
      at += ms;
    }
    if (act.frames.length) acting.current.push(setTimeout(() => setFrame(null), at));
  }, [move]);

  useEffect(() => () => acting.current.forEach(clearTimeout), []);

  // Arrival when he first comes into view, then a wave; fidgets only while on screen.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let waved = false;
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (!entry.isIntersecting) return;
      setSeen(true);
      if (waved || still || reducedMotion()) return;
      waved = true;
      setExtra(PRELOAD);
      acting.current.push(setTimeout(() => perform(WAVE), 900));
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [still, perform]);

  useEffect(() => {
    if (still || reducedMotion()) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        if (visible.current && !document.hidden && !sleeping.current) perform(FIDGETS[Math.floor(Math.random() * FIDGETS.length)]);
        loop();
      }, FIDGET_MIN_MS + Math.random() * FIDGET_SPREAD_MS);
    };
    loop();
    return () => clearTimeout(timer);
  }, [still, perform]);

  // Left alone, he dozes off; the visitor's next sign wakes him with a start.
  useEffect(() => {
    if (still || reducedMotion()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    const doze = () => {
      if (!visible.current || document.hidden) return arm();
      sleeping.current = true;
      setAsleep(true);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(doze, SLEEP_MS);
    };
    const wake = () => {
      const now = Date.now();
      if (now - last < 400) return;
      last = now;
      if (sleeping.current) {
        sleeping.current = false;
        setAsleep(false);
        perform({ frames: [["surpris", 700], ["leve", 500]], move: "jump" });
      }
      arm();
    };
    const events = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [still, perform]);

  // He leans and looks toward the cursor when it comes near (pointer devices only).
  useEffect(() => {
    if (reducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf || !visible.current) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = tilt.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const near = Math.hypot(dx, dy) < 520;
        const k = near ? Math.max(-1, Math.min(1, dx / 260)) : 0;
        el.style.setProperty("--dex-lean", `${(k * 7).toFixed(2)}deg`);
        el.style.setProperty("--dex-look", `${(k * 4).toFixed(1)}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (hasNeighbourBubble()) return;
    const me = Symbol("dex");
    if (speaker) return;
    speaker = me;
    let shown = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (delay: number) => {
      timers.push(setTimeout(() => {
        if (document.hidden || shown >= MAX_AUTO_TIPS || sleeping.current) return schedule(TIP_EVERY_MS);
        shown += 1;
        say();
        timers.push(setTimeout(() => setTip(null), TIP_SHOWN_MS));
        schedule(TIP_EVERY_MS);
      }, delay));
    };
    schedule(FIRST_TIP_MS);
    return () => {
      timers.forEach(clearTimeout);
      if (speaker === me) speaker = null;
    };
  }, [hasNeighbourBubble, say, section]);

  const talking = tip !== null;
  const shown: DexPose = asleep ? "dodo" : talking ? talkPose(pose) : frame ?? pose;

  // Each change of drawing pops with a quick squash, so the swap reads as a move.
  const firstShown = useRef(true);
  useEffect(() => {
    if (firstShown.current) {
      firstShown.current = false;
      return;
    }
    if (reducedMotion()) return;
    faces.current?.animate(
      [{ transform: "scale(1.07, 0.93)" }, { transform: "scale(0.98, 1.03)", offset: 0.6 }, { transform: "none" }],
      { duration: 200, easing: "cubic-bezier(.3, .9, .4, 1)" },
    );
  }, [shown]);

  const onClick = () => {
    setBurst((b) => b + 1);
    if (!still && !reducedMotion()) {
      if (sleeping.current) {
        sleeping.current = false;
        setAsleep(false);
      }
      setExtra(PRELOAD);
      perform(CHEERS[cheer.current++ % CHEERS.length]);
    } else move("jump");
    if (!hasNeighbourBubble()) say();
  };

  /** Every drawing he may show, kept mounted (hidden) so a swap is instant. */
  const drawings = [...new Set<DexPose>([pose, talkPose(pose), ...extra, ...(frame ? [frame] : []), ...(asleep ? ["dodo" as const] : [])])];

  return (
    <span ref={root} className={cn("dex-live", seen && "dex-seen", asleep && "dex-asleep")} style={{ width, height }}>
      <span className="dex-shadow" aria-hidden="true" />
      <span className="dex-rise" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      {asleep && <span className="dex-zzz" aria-hidden="true"><i>z</i><i>z</i><i>z</i></span>}
      {burst > 0 && <span key={burst} className="dex-burst" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>}
      {talking && (
        <span key={`${section}${tip}`} className="dex-bubble dex-live-bubble" role="status">
          {t(`dex.${section}${tip + 1}`)}
        </span>
      )}
      <span className={cn("dex-float", !still && "dex-idle")}>
        <span ref={tilt} className="dex-tilt">
          <button
            type="button"
            key={action?.n ?? 0}
            className={cn("dex-live-btn", action && `dex-do-${action.name}`, talking && "dex-talking")}
            aria-label={t("dex.talk")}
            onClick={onClick}
            onAnimationEnd={(e) => { if (e.target === e.currentTarget && e.animationName.startsWith("dex-do")) setAction(null); }}
          >
            <span ref={faces} className="dex-faces">
              {drawings.map((d) => (
                <span key={d} className={cn("dex-face", d !== shown && "dex-face-off")} aria-hidden={d === pose ? undefined : true}>
                  <Image
                    src={`/mascot/dex-${d}.webp`}
                    alt={d === pose ? alt : ""}
                    width={width}
                    height={height}
                    priority={d === pose && priority}
                    loading={d === pose && priority ? undefined : "lazy"}
                    sizes={`${width}px`}
                  />
                </span>
              ))}
            </span>
          </button>
        </span>
      </span>
    </span>
  );
}

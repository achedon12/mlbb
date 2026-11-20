"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DexPose } from "@/components/mascot";

const FIDGETS = ["hop", "wiggle", "look", "spin", "hop", "wiggle"] as const;
type Fidget = (typeof FIDGETS)[number] | "jump";
const FIDGET_MIN_MS = 7000, FIDGET_SPREAD_MS = 7000;
/** The pose he takes to talk, never the same as his own. */
const talkPose = (pose: DexPose): DexPose => (pose === "idee" ? "victoire" : "idee");

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
 * - **fidgets**: every few seconds, a small random action (a hop, a wiggle,
 *   a look around, a pirouette), only while he is on screen;
 * - **click**: anticipation squash, a stretched jump, a landing squash, a
 *   burst of bubbles and a tip suited to the page;
 * - **talking**: while his bubble shows he switches to a talking pose and
 *   bobs as he speaks;
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
  const [tip, setTip] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const [action, setAction] = useState<{ name: Fidget; n: number } | null>(null);
  const [seen, setSeen] = useState(false);
  const visible = useRef(false);
  const next = useRef(0);

  /** A bubble already beside this Dex (DexSays, DexNote, game screens…): he does not add his own. */
  const hasNeighbourBubble = useCallback(() => {
    const around = root.current?.parentElement?.parentElement;
    return !!around?.querySelector(".dex-bubble:not(.dex-live-bubble), .game-bubble");
  }, []);

  const say = useCallback(() => {
    setTip(next.current % TIPS);
    next.current += 1;
  }, []);

  const play = useCallback((name: Fidget) => setAction((a) => ({ name, n: (a?.n ?? 0) + 1 })), []);

  // Arrival when he first comes into view; fidgets only while on screen.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (entry.isIntersecting) setSeen(true);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || reducedMotion()) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        if (visible.current && !document.hidden) play(FIDGETS[Math.floor(Math.random() * FIDGETS.length)]);
        loop();
      }, FIDGET_MIN_MS + Math.random() * FIDGET_SPREAD_MS);
    };
    loop();
    return () => clearTimeout(timer);
  }, [still, play]);

  // He leans and looks toward the cursor when it comes near (pointer devices only).
  useEffect(() => {
    if (reducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame || !visible.current) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
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
      cancelAnimationFrame(frame);
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
        if (document.hidden || shown >= MAX_AUTO_TIPS) return;
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

  const onClick = () => {
    setBurst((b) => b + 1);
    play("jump");
    if (!hasNeighbourBubble()) say();
  };

  const talking = tip !== null;

  return (
    <span ref={root} className={cn("dex-live", seen && "dex-seen")} style={{ width, height }}>
      <span className="dex-shadow" aria-hidden="true" />
      <span className="dex-rise" aria-hidden="true"><i /><i /><i /><i /><i /></span>
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
            <span className={cn("dex-face", talking && "dex-face-off")}>
              <Image src={`/mascot/dex-${pose}.webp`} alt={alt} width={width} height={height} priority={priority} sizes={`${width}px`} />
            </span>
            <span className={cn("dex-face", !talking && "dex-face-off")} aria-hidden="true">
              <Image src={`/mascot/dex-${talkPose(pose)}.webp`} alt="" width={width} height={height} loading="lazy" sizes={`${width}px`} />
            </span>
          </button>
        </span>
      </span>
    </span>
  );
}

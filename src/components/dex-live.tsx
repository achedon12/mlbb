"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DexPose } from "@/components/mascot";

/**
 * The living part of every Dex (see `mascot.tsx`): soap bubbles rise from
 * him, a click makes him hop, burst bubbles and say a tip suited to the page,
 * and — when no bubble already stands beside him — he says a tip on his own
 * now and then. Only one Dex per page talks on his own, the first to appear,
 * so a page with several Dex never chatters. Everything rests under
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
  const [tip, setTip] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const [hop, setHop] = useState(0);
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
    setHop((h) => h + 1);
    if (!hasNeighbourBubble()) say();
  };

  return (
    <span ref={root} className={cn("dex-live", !still && "dex-idle")} style={{ width, height }}>
      <span className="dex-rise" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      {burst > 0 && <span key={burst} className="dex-burst" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>}
      {tip !== null && (
        <span key={`${section}${tip}`} className="dex-bubble dex-live-bubble" role="status">
          {t(`dex.${section}${tip + 1}`)}
        </span>
      )}
      <button type="button" className={cn("dex-live-btn", hop > 0 && "dex-hopping")} key={hop} aria-label={t("dex.talk")} onClick={onClick}>
        <Image src={`/mascot/dex-${pose}.webp`} alt={alt} width={width} height={height} priority={priority} sizes={`${width}px`} />
      </button>
    </span>
  );
}

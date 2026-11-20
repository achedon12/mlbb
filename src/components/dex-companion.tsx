"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { Dex, type DexPose } from "@/components/mascot";

/**
 * Dex, the companion: a small Dex in the bottom-left corner of every page.
 * Now and then he says a tip suited to the page (a bubble that pops in,
 * stays a few seconds and goes), little bubbles rise from him, and a click
 * makes him hop and say the next tip. He can be hidden; the choice is kept
 * for a week in this browser. He steps aside for the site's bottom bars
 * (`data-bottom-ui`) and the 404 page, which has its own Dex.
 */
const SECTIONS: [RegExp, string][] = [
  [/^\/heroes\/[^/]+/, "hero"], [/^\/heroes/, "heroes"], [/^\/compare|^\/lore/, "heroes"],
  [/^\/tier-list|^\/meta/, "tierList"], [/^\/statistics/, "statistics"],
  [/^\/items|^\/emblems|^\/spells/, "items"], [/^\/guides|^\/game-modes|^\/ranks/, "guides"], [/^\/map/, "map"],
  [/^\/draft/, "draft"], [/^\/mlbbdle|^\/quiz/, "games"], [/^\/tools|^\/builds/, "tools"],
  [/^\/patch-notes|^\/news|^\/watch/, "patch"], [/^\/esports/, "esports"], [/^\/community|^\/account|^\/login/, "community"],
  [/^\/skins|^\/events/, "skins"], [/^\/?$/, "home"],
];
const sectionOf = (path: string) => SECTIONS.find(([re]) => re.test(path))?.[1] ?? "default";
const TIPS_PER_SECTION = 3;
const FIRST_TIP_MS = 7000, TIP_SHOWN_MS = 7500, TIP_EVERY_MS = 30000, MAX_AUTO_TIPS = 4;
const HIDDEN_KEY = "mlbbdex_dex_hidden", HIDDEN_FOR_MS = 7 * 86_400_000;
const BLOCKING = "[data-bottom-ui]:not([hidden]), [data-not-found]";

function useBlocked(): boolean {
  const subscribe = useCallback((refresh: () => void) => {
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
    return () => observer.disconnect();
  }, []);
  return useSyncExternalStore(subscribe, () => document.querySelector(BLOCKING) !== null, () => true);
}

function readHidden(): boolean {
  try {
    const at = Number(localStorage.getItem(HIDDEN_KEY) ?? 0);
    return at > 0 && Date.now() - at < HIDDEN_FOR_MS;
  } catch {
    return false;
  }
}

// Hidden for a week once closed; read from this browser, no server render.
const hiddenListeners = new Set<() => void>();
function subscribeHidden(refresh: () => void) {
  hiddenListeners.add(refresh);
  window.addEventListener("storage", refresh);
  return () => { hiddenListeners.delete(refresh); window.removeEventListener("storage", refresh); };
}
function hide() {
  try { localStorage.setItem(HIDDEN_KEY, String(Date.now())); } catch {}
  hiddenListeners.forEach((f) => f());
}

export function DexCompanion() {
  const pathname = usePathname() ?? "/";
  const section = sectionOf(pathname.replace(/^\/[a-z]{2,3}(?=\/|$)/, "") || "/");
  const blocked = useBlocked();
  const hidden = useSyncExternalStore(subscribeHidden, readHidden, () => true);
  if (hidden || blocked) return null;
  // A new page starts a new conversation: fresh state, fresh timers.
  return <DexTalk key={section} section={section} />;
}

function DexTalk({ section }: { section: string }) {
  const t = useT();
  const [tip, setTip] = useState<number | null>(null);
  const [pose, setPose] = useState<DexPose>("salut");
  const [burst, setBurst] = useState(0);
  const next = useRef(0);
  const shown = useRef(0);

  const say = useCallback((byClick: boolean) => {
    const i = next.current % TIPS_PER_SECTION;
    next.current += 1;
    setTip(i);
    setPose(byClick ? (i === 0 ? "victoire" : "idee") : i === 2 ? "reflexion" : "idee");
    if (byClick) setBurst((b) => b + 1);
  }, []);

  // Auto tips: a first one after a few seconds, then now and then, a few per page.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (delay: number) => {
      timers.push(setTimeout(() => {
        if (document.hidden || shown.current >= MAX_AUTO_TIPS) return;
        shown.current += 1;
        say(false);
        timers.push(setTimeout(() => setTip(null), TIP_SHOWN_MS));
        schedule(TIP_EVERY_MS);
      }, delay));
    };
    schedule(FIRST_TIP_MS);
    return () => timers.forEach(clearTimeout);
  }, [say]);

  const text = tip === null ? null : t(`dex.${section}${tip + 1}`);

  return (
    <div className="dex-companion" aria-live="polite">
      {text && (
        <div key={tip} className="dex-companion-bubble dex-bubble" role="status">
          <span>{text}</span>
          <button type="button" className="dex-companion-x" aria-label={t("dex.close")} onClick={() => setTip(null)}>
            <X size={14} aria-hidden />
          </button>
        </div>
      )}
      <div className="dex-companion-body">
        <span className="dex-rise" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        {burst > 0 && <span key={burst} className="dex-burst" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>}
        <button type="button" className="dex-companion-btn" aria-label={t("dex.talk")} onClick={() => say(true)}>
          <Dex pose={pose} height={84} alt={t("dex.label")} />
        </button>
        <button type="button" className="dex-companion-hide" aria-label={t("dex.hide")} onClick={hide}>
          <X size={12} aria-hidden />
        </button>
      </div>
    </div>
  );
}

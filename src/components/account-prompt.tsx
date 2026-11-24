"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, X } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import {
  markShownThisVisit,
  momentEarned,
  promptAllowed,
  readPromptMemory,
  readShownThisVisit,
  rememberDismissed,
  rememberFollowed,
  type PromptMoment,
} from "@/lib/account-prompt";
import { syncState } from "@/lib/account-sync-client";

/** Another bottom bar (the cookie banner, the menu sheet, a Discord card) has the place. */
const BLOCKING = "[data-bottom-ui]:not([hidden])";

/**
 * The prompt itself: a slim card along the bottom, not a dialog (it never
 * takes the focus), closed with its button or Escape. Measured in Matomo
 * under "Account": "Prompt shown", "Prompt dismissed", "Sign in from prompt",
 * named after the moment.
 */
export function AccountPromptCard({ moment, onClose }: { moment: PromptMoment; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    trackEvent("Account", "Prompt shown", moment);
  }, [moment]);
  const dismiss = () => {
    trackEvent("Account", "Prompt dismissed", moment);
    rememberDismissed();
    onClose();
  };
  return (
    <aside
      data-bottom-ui
      aria-label={t("accountSync.prompt.label")}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss();
      }}
      className="discord-popup bevel-sm fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 border border-gold-500/50 bg-night-900/95 p-3 shadow-lg shadow-black/40 backdrop-blur-sm"
    >
      <span aria-hidden className="bevel-sm hidden size-10 shrink-0 place-items-center bg-gold-500 text-night-950 sm:grid">
        <CloudUpload size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-bold leading-tight text-chalk-100 sm:text-base">{t(`accountSync.prompt.${moment}.title`)}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-chalk-400">{t("accountSync.prompt.text")}</p>
      </div>
      <Link
        href="/login?from=prompt"
        onClick={() => {
          trackEvent("Account", "Sign in from prompt", moment);
          rememberFollowed();
        }}
        className="bevel-sm shrink-0 bg-gold-500 px-3 py-1.5 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
      >
        {t("accountSync.prompt.action")}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("accountSync.prompt.close")}
        className="grid size-8 shrink-0 place-items-center text-chalk-500 transition-colors hover:text-chalk-100"
      >
        <X size={16} aria-hidden />
      </button>
    </aside>
  );
}

/**
 * `offer(moment, facts, delayMs)` asks for the prompt after a moment: it
 * shows only if the moment earned it (`momentEarned`) and the visitor may
 * see it (`promptAllowed`), after the delay, so it never covers the page's
 * own confirmation. Returns whether it will show. `card` is what to render.
 */
export function useAccountPrompt() {
  const [moment, setMoment] = useState<PromptMoment | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const offer = useCallback((m: PromptMoment, facts: { solves?: number; streak?: number } = {}, delayMs = 1500): boolean => {
    if (!momentEarned(m, facts)) return false;
    const allowed = promptAllowed({ status: syncState().status, memory: readPromptMemory(), shownThisVisit: readShownThisVisit(), now: Date.now() });
    if (!allowed) return false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (document.querySelector(BLOCKING) !== null || readShownThisVisit() !== false) return;
      markShownThisVisit();
      setMoment(m);
    }, delayMs);
    return true;
  }, []);
  const card = moment ? <AccountPromptCard moment={moment} onClose={() => setMoment(null)} /> : null;
  return { offer, card };
}

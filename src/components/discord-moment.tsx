"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { communityInvite } from "@/lib/bot/public";
import { rememberDiscordPopupDismissed } from "@/lib/discord-popup";
import { claimDiscordMoment, type DiscordMoment } from "@/lib/discord-moment";
import { DiscordMark } from "./bot/discord-mark";
import { DiscordJoinLink } from "./discord-join-link";

/**
 * The invitation of a moment: a slim card along the bottom, not a dialog (it
 * never takes the focus), marked as a bottom bar so other bars step aside.
 * Measured apart in Matomo: "Moment shown", "Moment join", "Moment dismiss",
 * named after the moment.
 */
export function DiscordMomentCard({ moment, onClose }: { moment: DiscordMoment; onClose: () => void }) {
  const t = useT();
  const invite = communityInvite();
  useEffect(() => {
    trackEvent("Discord", "Moment shown", moment);
  }, [moment]);
  if (!invite) return null;
  return (
    <aside
      data-bottom-ui
      aria-label={t("discordPopup.label")}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="discord-popup bevel-sm fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 border border-blurple-500/60 bg-night-900/95 p-3 shadow-lg shadow-black/40 backdrop-blur-sm"
    >
      <span aria-hidden className="bevel-sm hidden size-10 shrink-0 place-items-center bg-blurple-500 text-white sm:grid">
        <DiscordMark />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-bold leading-tight text-chalk-100 sm:text-base">{t(`discordCta.moment.${moment}.title`)}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-chalk-400">{t(`discordCta.moment.${moment}.text`)}</p>
      </div>
      <DiscordJoinLink
        href={invite}
        placement="Moment"
        context={moment === "nickname" ? "nickname" : moment === "value" ? "value" : moment === "draft" ? "tools" : "daily"}
        className="bevel-sm shrink-0 bg-blurple-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blurple-600"
      >
        {t("discordPopup.join")}
      </DiscordJoinLink>
      <button
        type="button"
        onClick={() => {
          trackEvent("Discord", "Moment dismiss", moment);
          // Closed: left alone for a month, like the corner card.
          rememberDiscordPopupDismissed(Date.now());
          onClose();
        }}
        aria-label={t("discordPopup.close")}
        className="grid size-8 shrink-0 place-items-center text-chalk-500 transition-colors hover:text-chalk-100"
      >
        <X size={16} aria-hidden />
      </button>
    </aside>
  );
}

/**
 * `offer(moment, delayMs)` asks for the moment's invitation (it shows only if
 * the session's invitation is still free, after the delay, so it never covers
 * the page's own confirmation); `card` is what to render.
 */
export function useDiscordMoment() {
  const [moment, setMoment] = useState<DiscordMoment | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const offer = useCallback((m: DiscordMoment, delayMs = 1200) => {
    if (!claimDiscordMoment()) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoment(m), delayMs);
  }, []);
  const card = moment ? <DiscordMomentCard moment={moment} onClose={() => setMoment(null)} /> : null;
  return { offer, card };
}

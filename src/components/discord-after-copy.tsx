"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { communityInvite } from "@/lib/bot/public";
import { readDiscordPopupMemory } from "@/lib/discord-popup";
import { DiscordMark } from "./bot/discord-mark";
import { DiscordJoinLink } from "./discord-join-link";

const SESSION_KEY = "mlbb_discord_after_copy";

/**
 * Whether the after-copy invitation may show: once per session, never to
 * someone who already followed an invitation, never when storage refuses.
 */
export function mayOfferAfterCopy(): boolean {
  if (!communityInvite()) return false;
  const memory = readDiscordPopupMemory();
  if (!memory || memory.joined) return false;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    return false;
  }
  return true;
}

/**
 * A slim card shown right after a nickname is copied: the moment the visitor
 * got what they came for, and the one most of them leave on (Matomo: two
 * thirds leave right after copying). Not a dialog, it never takes the focus;
 * it marks itself as a bottom bar so the corner invitation steps aside.
 */
export function DiscordAfterCopy({ onClose }: { onClose: () => void }) {
  const t = useT();
  const invite = communityInvite();
  useEffect(() => {
    trackEvent("Discord", "Copy shown", "nickname");
  }, []);
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
        <p className="font-heading text-sm font-bold leading-tight text-chalk-100 sm:text-base">{t("discordCta.copy.title")}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-chalk-400">{t("discordCta.copy.text")}</p>
      </div>
      <DiscordJoinLink
        href={invite}
        placement="Copy"
        context="nickname"
        className="bevel-sm shrink-0 bg-blurple-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blurple-600"
      >
        {t("discordPopup.join")}
      </DiscordJoinLink>
      <button
        type="button"
        onClick={() => {
          trackEvent("Discord", "Copy dismiss", "nickname");
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

"use client";

import { useId } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/provider";
import type { DiscordContext } from "@/lib/discord-cta";
import { DiscordMark } from "./bot/discord-mark";

/**
 * The invitation card itself, loaded on demand by `DiscordPopup`.
 *
 * A labelled region, not a dialog: the page stays fully usable around it and
 * focus is never moved into it. Escape still closes it when the keyboard is
 * already inside. On a phone it is a slim bar along the bottom, inside the
 * gutter and above the home indicator, without the Discord tile so the
 * words keep the width (the blurple button says where it leads); from `md`
 * up, a compact card in the bottom right corner. The rise only plays when
 * motion is welcome.
 */
export function DiscordPopupCard({
  invite,
  context,
  onJoin,
  onDismiss,
}: {
  invite: string;
  /** Which invitation fits the page (`discordCta.<context>`). */
  context: DiscordContext;
  onJoin: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const text = useId();

  return (
    <aside
      aria-label={t("discordPopup.label")}
      aria-describedby={text}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDismiss();
      }}
      className="discord-popup bevel-sm fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5 bg-night-800 py-2.5 pl-3 pr-2 shadow-[inset_0_2px_0_var(--color-gold-400),0_12px_32px_rgb(0_0_0/calc(0.5*var(--shadow-strength)))] md:left-auto md:w-80 md:grid md:grid-cols-[2.25rem_1fr_2rem] md:items-start md:gap-x-3 md:gap-y-2.5 md:p-3"
    >
      <span
        aria-hidden
        className="bevel-sm hidden size-9 place-items-center bg-azure-500 text-night-950 md:grid"
      >
        <DiscordMark size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-heading text-sm font-bold leading-tight text-chalk-100 md:text-base">
          {t(`discordCta.${context}.title`)}
        </p>
        <p id={text} className="mt-0.5 line-clamp-2 text-xs leading-snug text-chalk-400">
          {t(`discordCta.${context}.text`)}
        </p>
      </div>
      <a
        href={invite}
        target="_blank"
        rel="noopener"
        onClick={onJoin}
        className="btn btn-primary btn-sm shrink-0 md:col-start-2 md:row-start-2 md:justify-self-start"
      >
        {t("discordPopup.join")}
      </a>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("discordPopup.close")}
        className="grid size-8 shrink-0 place-items-center text-chalk-500 transition-colors hover:text-chalk-100 md:col-start-3 md:row-start-1"
      >
        <X size={16} aria-hidden />
      </button>
    </aside>
  );
}

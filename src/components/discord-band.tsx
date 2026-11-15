"use client";

import { usePathname } from "next/navigation";
import { useT } from "@/i18n/provider";
import { communityInvite } from "@/lib/bot/public";
import { bandContext } from "@/lib/discord-cta";
import { DiscordMark } from "./bot/discord-mark";
import { DiscordJoinLink } from "./discord-join-link";

/**
 * The invitation band above the footer of the strategic pages, worded for the
 * page (`bandContext`). Pages with an invitation of their own get none.
 */
export function DiscordBand() {
  const t = useT();
  const pathname = usePathname();
  const invite = communityInvite();
  const context = bandContext(pathname);
  if (!invite || !context) return null;
  return (
    <div className="page-wrap pb-10 pt-4">
      <aside
        aria-label={t("discordPopup.label")}
        className="bevel flex flex-wrap items-center justify-between gap-4 border border-blurple-500/40 bg-blurple-500/10 p-4 sm:p-5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden className="bevel-sm grid size-10 shrink-0 place-items-center bg-blurple-500 text-white">
            <DiscordMark />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-bold leading-tight text-chalk-100">{t(`discordCta.${context}.title`)}</p>
            <p className="mt-0.5 text-sm leading-snug text-chalk-300">{t(`discordCta.${context}.text`)}</p>
          </div>
        </div>
        <DiscordJoinLink
          href={invite}
          placement="Band"
          context={context}
          className="bevel-sm inline-flex min-h-11 shrink-0 items-center gap-2 bg-blurple-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-blurple-600"
        >
          {t("discordCta.join")}
        </DiscordJoinLink>
      </aside>
    </div>
  );
}

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
        className="bevel-lg flex flex-wrap items-center justify-between gap-x-6 gap-y-4 bg-night-800 p-5 sm:px-8 sm:py-6"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden className="bevel-sm grid size-12 shrink-0 place-items-center bg-azure-500 text-night-950">
            <DiscordMark />
          </span>
          <div className="min-w-0">
            <p className="display-caps text-2xl text-chalk-100 sm:text-3xl">{t(`discordCta.${context}.title`)}</p>
            <p className="mt-1.5 text-sm leading-snug text-chalk-300">{t(`discordCta.${context}.text`)}</p>
          </div>
        </div>
        <DiscordJoinLink
          href={invite}
          placement="Band"
          context={context}
          className="btn btn-primary shrink-0"
        >
          {t("discordCta.join")}
        </DiscordJoinLink>
      </aside>
    </div>
  );
}

import type { T } from "@/i18n/translations";
import { communityInvite } from "@/lib/bot/public";
import type { DiscordContext } from "@/lib/discord-cta";
import { cn } from "@/lib/utils";
import { DiscordMark } from "./bot/discord-mark";
import { DiscordJoinLink } from "./discord-join-link";

/**
 * An invitation to the community server inside a page, worded for what the
 * page is about (`discordCta.<context>`): the channel that answers the
 * reader's next question, not a generic "join us". Nothing without an
 * invite address.
 */
export function DiscordInvite({ t, context, text, className }: { t: T; context: DiscordContext; text?: string; className?: string }) {
  const invite = communityInvite();
  if (!invite) return null;
  return (
    <aside
      aria-label={t("discordPopup.label")}
      className={cn("bevel flex flex-wrap items-center justify-between gap-4 border border-blurple-500/40 bg-blurple-500/10 p-4 sm:p-5", className)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className="bevel-sm grid size-10 shrink-0 place-items-center bg-blurple-500 text-white">
          <DiscordMark />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-base font-bold leading-tight text-chalk-100">{t(`discordCta.${context}.title`)}</p>
          <p className="mt-0.5 text-sm leading-snug text-chalk-300">{text ?? t(`discordCta.${context}.text`)}</p>
        </div>
      </div>
      <DiscordJoinLink
        href={invite}
        placement="Inline"
        context={context}
        className="bevel-sm inline-flex min-h-11 shrink-0 items-center gap-2 bg-blurple-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-blurple-600"
      >
        {t("discordCta.join")}
      </DiscordJoinLink>
    </aside>
  );
}

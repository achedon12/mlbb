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
      className={cn("bevel-lg flex flex-wrap items-center justify-between gap-x-6 gap-y-4 bg-night-800 p-5 sm:px-8 sm:py-6", className)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className="bevel-sm grid size-12 shrink-0 place-items-center bg-azure-500 text-night-950">
          <DiscordMark />
        </span>
        <div className="min-w-0">
          <p className="display-caps text-2xl text-chalk-100 sm:text-3xl">{t(`discordCta.${context}.title`)}</p>
          <p className="mt-1.5 text-sm leading-snug text-chalk-300">{text ?? t(`discordCta.${context}.text`)}</p>
        </div>
      </div>
      <DiscordJoinLink
        href={invite}
        placement="Inline"
        context={context}
        className="btn btn-primary shrink-0"
      >
        {t("discordCta.join")}
      </DiscordJoinLink>
    </aside>
  );
}

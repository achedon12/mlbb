import { Gamepad2, LogOut } from "lucide-react";
import { DiscordMark } from "@/components/bot/discord-mark";
import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { Member } from "@/lib/community/identity";
import { LinkAccounts } from "./link-accounts";

/**
 * Who is writing, on the forum pages: the two ways in for a visitor (the
 * game account, or Discord when the site's Discord login is configured),
 * and for a member the name they post under, the Discord logout, and the
 * offer to link a Discord login to the game account beside it. Login and
 * logout are a link and a form; only the link offer needs a script.
 */

const BUTTON = "bevel-sm inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors";

export type SignInPurpose = "post" | "reply" | "card";

export function SignInChoice({
  t,
  locale,
  purpose,
  back,
  member,
  discordEnabled,
  failed,
}: {
  t: T;
  locale: Locale;
  purpose: SignInPurpose;
  /** The community page to come back to after the Discord login. */
  back: string;
  member: Member;
  discordEnabled: boolean;
  failed: boolean;
}) {
  const discordHref = `/api/discord/login?${new URLSearchParams({ locale, next: "community", back })}`;
  return (
    <div className="bevel space-y-3 border border-night-700 bg-night-900/60 p-4">
      {failed && (
        <p role="alert" className="border-l-4 border-blood-400 bg-blood-500/10 px-3 py-2 text-sm text-chalk-100">
          {t("pages.community.signInChoice.failed")}
        </p>
      )}
      {member.status === "discordTooNew" && (
        <p role="status" className="border-l-4 border-gold-500 bg-gold-500/10 px-3 py-2 text-sm text-chalk-100">
          {t("pages.community.signInChoice.discordTooNew", { days: 7 })}
        </p>
      )}
      {member.status === "banned" && (
        <p role="status" className="border-l-4 border-blood-400 bg-blood-500/10 px-3 py-2 text-sm text-chalk-100">
          {t("pages.communityUI.errors.banned")}
        </p>
      )}
      <p className="text-sm text-chalk-300">{t(`pages.community.signInChoice.${purpose}`)}</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/login" className={`${BUTTON} bg-gold-500 text-night-950 hover:bg-gold-400`}>
          <Gamepad2 size={16} aria-hidden />
          {t("pages.community.signInChoice.game")}
        </Link>
        {discordEnabled && member.status !== "discordTooNew" && (
          // A plain link: the route sets the OAuth cookie and redirects to Discord.
          <a href={discordHref} rel="nofollow" className={`${BUTTON} bg-blurple-500 text-white hover:bg-blurple-600`}>
            <DiscordMark />
            {t("pages.community.signInChoice.discord")}
          </a>
        )}
      </div>
      {discordEnabled && <p className="text-xs text-chalk-500">{t("pages.community.signInChoice.discordNote")}</p>}
    </div>
  );
}

/** For a signed-in member: the name they write under, and what they can do about the logins. */
export function MemberLine({ t, locale, member, back }: { t: T; locale: Locale; member: Extract<Member, { status: "ok" }>; back: string }) {
  return (
    <div className="space-y-2 text-xs text-chalk-500">
      <div className="flex flex-wrap items-center gap-x-3">
        <p>
          {member.via === "discord"
            ? t("pages.community.postingAsDiscord", { name: member.author.name })
            : t("pages.community.postingAs", { name: member.author.name })}
        </p>
        {member.via === "discord" && (
          <form method="post" action="/api/discord/logout">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="back" value={back} />
            <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 text-chalk-400 underline underline-offset-4 hover:text-chalk-100">
              <LogOut size={13} aria-hidden />
              {t("pages.community.signOutDiscord")}
            </button>
          </form>
        )}
      </div>
      {member.linkable && <LinkAccounts />}
    </div>
  );
}

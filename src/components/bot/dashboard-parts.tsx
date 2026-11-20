import { DiscordMark } from "@/components/bot/discord-mark";
import { Flash } from "@/components/dex-states";
import { Dex } from "@/components/mascot";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/translations";
import { discordImage } from "@/lib/bot/public";
import type { DiscordSession } from "@/lib/bot/session";
import { cn } from "@/lib/utils";

/**
 * Server-rendered pieces shared by the dashboard and the admin panel: the
 * login call to action, the signed-in bar with its logout form, and server
 * icons. No JavaScript: login and logout are a link and a form.
 */

export const BUTTON = "bevel-sm inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors";

export function LoginPanel({ t, locale, next, failed }: { t: T; locale: Locale; next: "dashboard" | "admin" | "moderation"; failed: boolean }) {
  const href = `/api/discord/login?locale=${locale}&next=${next}`;
  return (
    <div className="stage-enter dex-host bevel-lg flex max-w-3xl items-end gap-6 bg-night-800 p-6 shadow-[inset_0_3px_0_var(--color-azure-400)] sm:p-8">
      <div className="min-w-0 flex-1">
      <span aria-hidden className="bevel-sm grid size-12 place-items-center bg-azure-500 text-night-950">
        <DiscordMark />
      </span>
      <h2 className="type-section mt-4 text-chalk-100">{t("pages.botDashboard.loginTitle")}</h2>
      {failed && (
        <p role="alert" className="mt-3">
          <Flash tone="error">{t("pages.botDashboard.loginFailed")}</Flash>
        </p>
      )}
      <p className="mt-3 max-w-prose text-base leading-relaxed text-chalk-300">{t("pages.botDashboard.loginLead")}</p>
      {/* A plain link: the route sets the OAuth cookie and redirects to Discord. */}
      <a href={href} rel="nofollow" className="btn btn-primary mt-5">
        <DiscordMark />
        {t("pages.botDashboard.login")}
      </a>
      </div>
      <span aria-hidden className="hidden shrink-0 sm:block">
        <Dex pose="salut" height={170} still />
      </span>
    </div>
  );
}

/** `compact`: a single line beside the page's own links. */
export function UserBar({ t, locale, user, compact = false }: { t: T; locale: Locale; user: DiscordSession; compact?: boolean }) {
  const avatar = discordImage("avatars", user.id, user.avatar, 64);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", compact ? "justify-end" : "justify-between border-b border-night-700 pb-4")}>
      <p className="flex min-w-0 items-center gap-3 text-sm text-chalk-200">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar, already sized by the CDN
          <img src={avatar} alt="" width={32} height={32} className="bevel-sm size-8 shrink-0 bg-night-800" />
        ) : (
          <span aria-hidden className="bevel-sm grid size-8 shrink-0 place-items-center bg-night-800 text-chalk-400">
            <DiscordMark />
          </span>
        )}
        <span className="truncate">{t("pages.botDashboard.signedAs", { name: user.name })}</span>
      </p>
      <form method="post" action="/api/discord/logout">
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="min-h-11 px-1 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500">
          {t("pages.botDashboard.logout")}
        </button>
      </form>
    </div>
  );
}

const ICON_SIZE = { md: { px: 48, box: "size-12 text-base" }, lg: { px: 64, box: "size-14 text-lg sm:size-16" } } as const;

export function GuildIcon({
  id,
  icon,
  name,
  size = "md",
}: {
  id: string;
  icon: string | null | undefined;
  name: string;
  size?: keyof typeof ICON_SIZE;
}) {
  const { px, box } = ICON_SIZE[size];
  // Twice the displayed size, for sharp icons on dense screens.
  const src = discordImage("icons", id, icon ?? null, 128);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- Discord CDN server icon, already sized by the CDN
    <img src={src} alt="" width={px} height={px} className={cn("bevel-sm shrink-0 bg-night-800", box)} />
  ) : (
    <span aria-hidden className={cn("bevel-sm grid shrink-0 place-items-center bg-night-800 font-heading font-bold text-chalk-200", box)}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

import { DiscordMark } from "@/components/bot/discord-mark";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/translations";
import { discordImage } from "@/lib/bot/public";
import type { DiscordSession } from "@/lib/bot/session";

/**
 * Server-rendered pieces shared by the dashboard and the admin panel: the
 * login call to action, the signed-in bar with its logout form, and server
 * icons. No JavaScript: login and logout are a link and a form.
 */

export const BUTTON = "bevel-sm inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors";

export function LoginPanel({ t, locale, next, failed }: { t: T; locale: Locale; next: "dashboard" | "admin"; failed: boolean }) {
  const href = `/api/discord/login?locale=${locale}&next=${next}`;
  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-6">
      {failed && (
        <p role="alert" className="mb-3 text-sm text-blood-400">
          {t("pages.botDashboard.loginFailed")}
        </p>
      )}
      <p className="leading-relaxed text-chalk-300">{t("pages.botDashboard.loginLead")}</p>
      {/* A plain link: the route sets the OAuth cookie and redirects to Discord. */}
      <a href={href} rel="nofollow" className={`${BUTTON} mt-4 bg-gold-500 text-night-950 hover:bg-gold-400`}>
        <DiscordMark />
        {t("pages.botDashboard.login")}
      </a>
    </div>
  );
}

export function UserBar({ t, locale, user }: { t: T; locale: Locale; user: DiscordSession }) {
  const avatar = discordImage("avatars", user.id, user.avatar, 64);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-night-700/70 pb-4">
      <p className="flex items-center gap-3 text-sm text-chalk-300">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar, already sized by the CDN
          <img src={avatar} alt="" width={32} height={32} className="bevel-sm size-8 bg-night-800" />
        ) : (
          <span aria-hidden className="bevel-sm grid size-8 place-items-center bg-night-800 text-chalk-500">
            <DiscordMark />
          </span>
        )}
        {t("pages.botDashboard.signedAs", { name: user.name })}
      </p>
      <form method="post" action="/api/discord/logout">
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500">
          {t("pages.botDashboard.logout")}
        </button>
      </form>
    </div>
  );
}

export function GuildIcon({ id, icon, name }: { id: string; icon: string | null | undefined; name: string }) {
  const src = discordImage("icons", id, icon ?? null, 64);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- Discord CDN server icon, already sized by the CDN
    <img src={src} alt="" width={40} height={40} className="bevel-sm size-10 shrink-0 bg-night-800" />
  ) : (
    <span aria-hidden className="bevel-sm grid size-10 shrink-0 place-items-center bg-night-800 font-heading text-sm font-bold text-chalk-300">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

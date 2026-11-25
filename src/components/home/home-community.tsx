import { ArrowRight } from "lucide-react";
import { DiscordMark } from "@/components/bot/discord-mark";
import { DiscordJoinLink } from "@/components/discord-join-link";
import { HomeWhy } from "@/components/home/home-why";
import { SupportCard } from "@/components/support-links";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { communityInvite } from "@/lib/bot/public";

/**
 * The last screen, one bold band of azure with dark ink in both themes:
 * why the site (one sentence with its real figures) at the left and, at the
 * right, the Discord server — the real logo set large, one line, the
 * button — when its invite is set. The support card follows when it may
 * show (`SupportCard`: once per page, never forced).
 */
export function HomeCommunity({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const invite = communityInvite();
  return (
    <div className={className}>
      <div className="grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
        <HomeWhy locale={locale} />
        {invite && (
          <section aria-labelledby="home-discord" className="min-w-0">
            <span className="block text-night-950">
              <DiscordMark size={88} />
            </span>
            <h2 id="home-discord" className="display-caps mt-5 pr-[0.1em] text-[clamp(2.2rem,1.6rem+2vw,3.5rem)] leading-[0.9] text-night-950">
              {t("discordPopup.title")}
            </h2>
            <p className="mt-3 max-w-md text-lg font-medium text-night-950/80">{t("discordCta.default.text")}</p>
            <DiscordJoinLink
              href={invite}
              placement="Inline"
              context="default"
              className="btn mt-6 bg-night-950 px-7 text-chalk-100 hover:bg-night-800"
            >
              {t("discordPopup.join")}
              <ArrowRight size={16} aria-hidden />
            </DiscordJoinLink>
          </section>
        )}
      </div>
      <SupportCard placement="Home" className="mt-12" />
    </div>
  );
}

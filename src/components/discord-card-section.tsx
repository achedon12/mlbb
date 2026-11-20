import { MessageSquare } from "lucide-react";
import { CardControls, LinkCardButton } from "@/components/discord-card-controls";
import type { Locale } from "@/i18n/config";
import { LOCALE_INTL } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { botConfig } from "@/lib/bot/config";
import { accountId } from "@/lib/community-builds-server";
import { currentDiscordLogin } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { cardAccess, profileDiscordKey } from "@/lib/discord-profile/access";
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/discord-profile/snapshot";
import { cardByAccount, type StoredCard } from "@/lib/discord-profile/store";
import { logError } from "@/lib/log";

/**
 * The account page's Discord card: what the bot's /profile posts, and how
 * to link it. Linking needs both logins on the same browser, the game one
 * (this page) and Discord's (the button sends there and back here). Shown
 * only when the bot side and the database are configured. Its buttons'
 * texts (`pages.discordCard`) are given by the page.
 */
export async function DiscordCardSection({ locale, roleId, zoneId, now }: { locale: Locale; roleId: number; zoneId: number; now: number }) {
  if (!databaseConfigured() || !botConfig()) return null;
  const t = createT(locale);
  const [discord, card] = await Promise.all([
    currentDiscordLogin(),
    cardByAccount(accountId(roleId, zoneId)).catch(async (error): Promise<StoredCard | null | "down"> => {
      await logError("profile card read failed", error);
      return "down";
    }),
  ]);
  if (card === "down") return null;

  const shown = card && card.snapshot && cardAccess({ viewer: "self", target: "self", row: card, now }).ok ? card : null;
  const sameDiscord = Boolean(discord && card && card.discordKey === profileDiscordKey(discord.id));
  const date = (d: Date) => new Intl.DateTimeFormat(LOCALE_INTL[locale], { dateStyle: "long" }).format(d);

  return (
    <section id="discord-card" className="mt-12 scroll-mt-24">
      <h2 className="flex items-center gap-2 font-heading text-2xl font-bold text-chalk-100">
        <MessageSquare size={20} className="text-gold-400" aria-hidden />
        {t("pages.discordCard.title")}
      </h2>
      <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
      <p className="mt-4 text-sm leading-relaxed text-chalk-300">{t("pages.discordCard.intro")}</p>

      {shown && (
        <div className="mt-5 space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-session PNG: next/image would cache it. */}
          <img
            src={`/api/discord-profile/card?locale=${locale}&v=${shown.snapshotAt.getTime()}-${shown.showId ? 1 : 0}`}
            alt={t("pages.discordCard.preview")}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            loading="lazy"
            className="bevel h-auto w-full border border-night-700 bg-night-900"
          />
          <p className="text-sm text-chalk-300">{t("pages.discordCard.linked")}</p>
          <p className="text-xs text-chalk-500">
            {t("pages.discordCard.updatedAt", { date: date(shown.snapshotAt) })} {t("pages.discordCard.noAccess")}
          </p>
          <CardControls isPublic={shown.public} showId={shown.showId} />
        </div>
      )}

      {/* A card exists but its figures are too old to show: updating brings it back. */}
      {card && !shown && (
        <div className="mt-5 space-y-3">
          <p className="text-xs text-chalk-500">{t("pages.discordCard.noAccess")}</p>
          <CardControls isPublic={card.public} showId={card.showId} />
        </div>
      )}

      {discord && !sameDiscord && (
        <div className="bevel-sm mt-5 space-y-2 border border-night-700 bg-night-900 p-3 text-sm text-chalk-300">
          <p>
            {card
              ? t("pages.discordCard.otherDiscord", { name: discord.name })
              : t("pages.discordCard.linkOffer", { name: discord.name })}
          </p>
          {!card && <p className="text-xs text-chalk-500">{t("pages.discordCard.noAccess")}</p>}
          <LinkCardButton />
        </div>
      )}

      {!discord && !card && (
        <div className="mt-5 space-y-3 text-sm text-chalk-300">
          <p>{t("pages.discordCard.needDiscord")}</p>
          <a
            href={`/api/discord/login?locale=${locale}&next=account`}
            className="bevel-sm inline-flex min-h-11 items-center gap-2 bg-[#5865f2] px-4 font-semibold text-white transition-colors hover:bg-[#4752c4]"
          >
            {t("pages.discordCard.discordButton")}
          </a>
        </div>
      )}
    </section>
  );
}

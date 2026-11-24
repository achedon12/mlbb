import { Breadcrumb } from "@/components/breadcrumb";
import { metaLocales } from "@/i18n/seo";
import { celestialLevel } from "@/lib/account-level";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ChevronRight, CircleAlert, Flame, LogOut, Trophy } from "lucide-react";
import { RankBadge } from "@/components/rank-badge";
import { AccountFavourites } from "@/components/account-favourites";
import { DiscordCardSection } from "@/components/discord-card-section";
import Link from "@/components/link";
import { StateProfile } from "@/components/player-profile";
import { Card, Score, SectionTitle } from "@/components/ui";
import { DexNote, heroArt } from "@/components/stage";
import { PlayerTopHeroes } from "@/components/player-top-heroes";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage } from "@/i18n/translations";
import { ExtendMessages } from "@/i18n/provider";
import { disconnect } from "@/lib/actions";
import { SignOutForm } from "@/components/sign-out-form";
import { formatCount, formatPercent } from "@/lib/player-format";
import type { StatsPlayer } from "@/lib/player-api";
import { friends, seasonHeroes, statistics } from "@/lib/mlbb-auth";
import { countryName, readableRank } from "@/lib/ranks";
import { sessionPlayer } from "@/lib/session";
import { summaryLastPatch } from "@/lib/patch-tracking";
import { requestTime } from "@/lib/community/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return { title: t("pages.account.metaTitle"), description: t("pages.account.metaDescription"), alternates: metaLocales(locale, "/account"), robots: { index: false, follow: false } };
}

/** Personal page: never cached. */
export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const session = await sessionPlayer();
  if (session.state === "missing") redirect(`/${locale}/login`);

  if (session.state === "expired") {
    // Token revoked before it expires: a new code is needed.
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <StateProfile type="expired" t={t} />
      </div>
    );
  }

  if (session.state === "unavailable") {
    // Valid token but profile unavailable: the Moonton source is down.
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Card className="border-gold-500/30">
          <h1 className="flex items-center gap-2 font-heading text-xl font-bold text-gold-400">
            <CircleAlert size={20} aria-hidden />
            {t("pages.account.unavailable")}
          </h1>
          <p className="mt-3 leading-relaxed text-chalk-300">{t("pages.account.unavailableText")}</p>
          <SignOutForm action={disconnect} className="mt-5">
            <button type="submit" className="text-sm text-chalk-500 underline underline-offset-4 hover:text-blood-500">
              {t("pages.account.signOut")}
            </button>
          </SignOutForm>
        </Card>
      </div>
    );
  }

  const { token, profile } = session;

  // Two sources in parallel: stats (often down) and friends
  // (on the auth subsystem, which stays online).
  const [stats, friendList, now] = await Promise.all([
    statistics(token),
    friends(token),
    requestTime(),
  ]);

  const rank = readableRank(profile.rankCurrent);
  const rankMax = readableRank(profile.rankMax);

  const level = celestialLevel(profile.level);
  const art = heroArt("alucard");

  return (
    <>
      {/* ── Profile header, on a stage: avatar, name, the two rank crests big ── */}
      <div className="relative isolate overflow-hidden">
        {art && (
          <div aria-hidden className="absolute inset-y-0 right-0 -z-10 w-full lg:w-[62%]">
            <Image src={art} alt="" fill priority sizes="(min-width: 1024px) 62vw, 100vw" className="affiche-art object-cover object-[60%_20%] opacity-70 lg:opacity-100" />
            <div className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/60 to-night-950/30" />
            <div className="absolute inset-y-0 left-0 w-full bg-linear-to-r from-night-950 via-night-950/80 to-transparent lg:w-3/4" />
          </div>
        )}
        <div className="page-wrap pb-8 pt-3 sm:pb-12 sm:pt-5">
          <Breadcrumb crumbs={[{ name: t("pages.account.metaTitle") }]} className="mb-6 [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs" />
          <div className="flex flex-wrap items-end gap-5 sm:gap-7">
            <span className="bevel-lg relative size-24 shrink-0 overflow-hidden bg-night-800 sm:size-32">
              {profile.avatar ? (
                <Image src={profile.avatar} alt="" fill sizes="128px" className="object-cover" />
              ) : (
                <span className="display-caps grid size-full place-items-center text-4xl text-chalk-500">
                  {profile.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="affiche-name display-caps break-words text-[clamp(2.8rem,1.8rem+4vw,5.5rem)] text-chalk-100">{profile.name}</h1>
              <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-chalk-300">
                <span>
                  {level === null ? t("pages.account.levelX", { n: profile.level }) : t("pages.account.levelCelestial", { n: level })}
                </span>
                <span aria-hidden>·</span>
                <span>{countryName(profile.country, locale)}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">ID {profile.roleId} ({profile.zoneId})</span>
              </div>
            </div>
            <SignOutForm action={disconnect}>
              <button type="submit" className="btn btn-secondary btn-sm">
                <LogOut size={15} aria-hidden />
                {t("pages.account.signedOut")}
              </button>
            </SignOutForm>
          </div>

          {/* ── Ranks and figures ─────────────────────────────────────── */}
          <dl className="stage-enter mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="bevel-lg bg-night-900/90 p-5">
              <dt className="font-heading text-sm font-bold uppercase text-gold-400">{t("pages.account.currentRank")}</dt>
              <dd className="mt-3">
                <RankBadge rank={rank} size="xl" />
              </dd>
            </div>
            <div className="bevel-lg bg-night-900/90 p-5">
              <dt className="font-heading text-sm font-bold uppercase text-chalk-400">{t("pages.account.bestRank")}</dt>
              <dd className="mt-3">
                <RankBadge rank={rankMax} size="xl" />
              </dd>
            </div>
            <Figure
              label={level === null ? t("pages.account.level") : t("pages.account.levelCelestialLabel")}
              value={level ?? profile.level}
            />
            <Figure label={t("pages.account.friends")} value={friendList.status === "ok" ? friendList.data.length : "—"} outline />
          </dl>
        </div>
        <div aria-hidden className="eclat-rule" />
      </div>

      <div className="page-wrap space-y-14 py-10 sm:space-y-20 sm:py-14">
        {/* ── The player's heroes, as artwork (deferred: one more call to the service) ── */}
        {stats.status === "ok" && stats.data.seasons[0] !== undefined && (
          <section aria-labelledby="top-heroes">
            <SectionTitle id="top-heroes" lead={t("pages.account.topHeroesLead")} action={{ href: "/account/profile", label: t("pages.account.profileLink") }}>
              {t("pages.account.topHeroes")}
            </SectionTitle>
            <Suspense fallback={<div className="bevel-lg min-h-[17rem] bg-night-900" />}>
              <TopHeroes token={token} season={stats.data.seasons[0]} locale={locale} />
            </Suspense>
          </section>
        )}

        {/* ── Statistics ─────────────────────────────────────────────── */}
        <section aria-labelledby="account-stats">
          <SectionTitle id="account-stats">{t("pages.account.statistics")}</SectionTitle>

          {stats.status === "ok" ? (
            <SummaryStatistics stats={stats.data} locale={locale} />
          ) : (
            <DexNote pose="triste" height={110}>
              {t("pages.account.detailUnavailable")}
            </DexNote>
          )}

          {/* The detailed profile has its own states: the link stays even when stats are down. */}
          <Link
            href="/account/profile"
            className="card-link group mt-6 flex items-center gap-4 bg-night-800 p-5 shadow-[inset_3px_0_0_var(--color-gold-400)]"
          >
            <Trophy size={26} className="shrink-0 text-gold-400" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-xl font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
                {t("pages.account.profileLink")}
              </span>
              <span className="mt-0.5 block text-sm text-chalk-400">{t("pages.account.profileLinkText")}</span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-gold-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </section>

        {/* ── Discord profile card (the bot's /profile) ────────────────── */}
        <ExtendMessages messages={messagesPage(locale, ["pages.discordCard"])}>
          <DiscordCardSection locale={locale} roleId={profile.roleId} zoneId={profile.zoneId} now={now} />
        </ExtendMessages>

        {/* ── Friends ────────────────────────────────────────────────────── */}
        {friendList.status === "ok" && friendList.data.length > 0 && (
          <section aria-labelledby="account-friends">
            <SectionTitle id="account-friends">{t("pages.account.friends")}</SectionTitle>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {friendList.data.map((friend, i) => (
                <li key={`${friend.name}-${i}`} className="bevel flex items-center gap-3 bg-night-900 p-2.5 transition-[translate] duration-200 hover:-translate-y-0.5">
                  <span className="bevel-sm relative size-11 shrink-0 overflow-hidden bg-night-800">
                    {friend.avatar ? (
                      <Image src={friend.avatar} alt="" fill sizes="44px" className="object-cover" />
                    ) : (
                      <span className="display-caps grid size-full place-items-center text-lg text-chalk-500">
                        {friend.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 truncate font-heading font-semibold text-chalk-100">{friend.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Favorites (in the browser, kept on the account) ───────────── */}
        <section aria-labelledby="account-favourites">
          <SectionTitle id="account-favourites" action={{ href: "/account/progress", label: t("pages.account.progressLink") }}>
            {t("pages.account.favourites")}
          </SectionTitle>
          <Link
            href="/account/progress"
            className="card-link group mb-6 flex items-center gap-4 bg-night-800 p-5 shadow-[inset_3px_0_0_var(--color-gold-400)]"
          >
            <Flame size={26} className="shrink-0 text-gold-400" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-xl font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
                {t("pages.account.progressLink")}
              </span>
              <span className="mt-0.5 block text-sm text-chalk-400">{t("pages.account.progressLinkText")}</span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-gold-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <AccountFavourites lastPatch={summaryLastPatch()} />
        </section>
      </div>
    </>
  );
}

/** The season's most played heroes, read after the rest of the page is out. */
async function TopHeroes({ token, season, locale }: { token: string; season: number; locale: Locale }) {
  const t = createT(locale);
  const list = await seasonHeroes(token, season);
  if (list.status !== "ok" || list.data.heroes.length === 0) {
    return <p className="text-sm text-chalk-400">{t("pages.account.noStat")}</p>;
  }
  return <PlayerTopHeroes heroes={list.data.heroes} t={t} locale={locale} />;
}

function Figure({ label, value, outline = false }: { label: string; value: number | string; outline?: boolean }) {
  return (
    <div className="bevel-lg bg-night-900/90 p-5">
      <dt className="font-heading text-sm font-bold uppercase text-chalk-400">{label}</dt>
      <dd className="mt-2">
        <Score value={value} outline={outline} className="text-[3.5rem]" />
      </dd>
    </div>
  );
}

/**
 * Overall figures, over the seasons the service has kept. The detail —
 * season by season, hero by hero — is on the player profile.
 */
function SummaryStatistics({ stats, locale }: { stats: StatsPlayer; locale: Locale }) {
  const t = createT(locale);
  if (stats.matches === 0) {
    return <DexNote pose="reflexion" height={100}>{t("pages.account.noStat")}</DexNote>;
  }

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Figure label={t("pages.accountProfile.games")} value={formatCount(stats.matches, locale)} />
      <Figure
        label={t("pages.heroDetail.stat.winRate")}
        value={formatPercent((stats.wins / stats.matches) * 100, locale)}
      />
      {stats.mvp !== null && <Figure label={t("pages.accountProfile.mvp")} value={formatCount(stats.mvp, locale)} />}
      {stats.bestStreak !== null && (
        <Figure label={t("pages.accountProfile.bestStreak")} value={formatCount(stats.bestStreak, locale)} />
      )}
    </dl>
  );
}

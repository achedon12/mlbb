import { metaLocales } from "@/i18n/seo";
import { celestialLevel } from "@/lib/account-level";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronRight, Gamepad2, LogIn, LogOut, Trophy } from "lucide-react";
import { RankBadge } from "@/components/rank-badge";
import { AccountFavourites } from "@/components/account-favourites";
import { AccountFriends } from "@/components/account-friends";
import { AccountHubNav } from "@/components/account-hub-nav";
import { AccountPoster } from "@/components/account-poster";
import { DiscordCardSection } from "@/components/discord-card-section";
import Link from "@/components/link";
import { StateProfile } from "@/components/player-profile";
import { DeleteCopy, ProgressOverview, PublicSettings, SyncStatus } from "@/components/progress-panel";
import { Score, SectionTitle } from "@/components/ui";
import { DexNote, heroArt } from "@/components/stage";
import { PlayerTopHeroes } from "@/components/player-top-heroes";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage, type T } from "@/i18n/translations";
import { ExtendMessages } from "@/i18n/provider";
import { disconnect } from "@/lib/actions";
import { SignOutForm } from "@/components/sign-out-form";
import { formatCount, formatPercent } from "@/lib/player-format";
import type { StatsPlayer } from "@/lib/player-api";
import { friends, identity, seasonHeroes, statistics, type Profile } from "@/lib/mlbb-auth";
import { countryName, readableRank } from "@/lib/ranks";
import { sessionPlayer } from "@/lib/session";
import { summaryLastPatch } from "@/lib/patch-tracking";
import { currentDiscordLogin, currentOwner, requestTime } from "@/lib/community/server";
import { discordAccountId } from "@/lib/community/identity";
import type { Owner } from "@/lib/account-owner";
import { databaseConfigured } from "@/lib/db";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return { title: t("pages.account.metaTitle"), description: t("pages.account.metaDescription"), alternates: metaLocales(locale, "/account"), robots: { index: false, follow: false } };
}

/** Personal page: never cached. */
export const dynamic = "force-dynamic";

/** Sections sit under the sticky header and the chip row. */
const SECTION = "scroll-mt-36";

/**
 * The account hub: one page for everything signed in.
 *
 * - a game session: the profile (ranks, level, season heroes, figures,
 *   friends), then the progress, favourites, Discord card and settings;
 *   while the login service is busy, the same page with the last known
 *   profile (or none) and a note that the live data will come back;
 * - a Discord login alone: the progress, favourites and settings, with an
 *   invitation to add the game account;
 * - nobody: the sign-in page. An expired game session asks for a new code.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const session = await sessionPlayer();

  if (session.state === "expired") {
    // Token revoked before it expires: a new code is needed.
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <StateProfile type="expired" t={t} />
      </div>
    );
  }

  const available = databaseConfigured();
  const [owner, discord] = await Promise.all([
    currentOwner().catch((): Owner => ({ status: "unavailable" })),
    currentDiscordLogin().catch(() => null),
  ]);
  if (session.state === "missing" && !discord) redirect(`/${locale}/login`);

  const messages = messagesPage(locale, ["pages.progress", "pages.account"]);
  // A login the progress sync can use: the owner, or a game session waiting for its profile.
  const syncs = owner.status === "ok" || session.state !== "missing";
  const ownerOk = owner.status === "ok";

  const progress = (
    <section id="progress" aria-labelledby="account-progress" className={SECTION}>
      <SectionTitle id="account-progress" lead={t("pages.account.hub.progressLead")}>
        {t("pages.account.hub.progressTitle")}
      </SectionTitle>
      <div className="space-y-4">
        <SyncStatus signedIn={syncs} available={available} />
        <ProgressOverview />
      </div>
    </section>
  );

  const favourites = (
    <section id="favourites" aria-labelledby="account-favourites" className={SECTION}>
      <SectionTitle id="account-favourites" lead={t("pages.account.hub.favouritesLead")}>
        {t("pages.account.favourites")}
      </SectionTitle>
      <AccountFavourites lastPatch={summaryLastPatch()} />
    </section>
  );

  const settings = (
    <section id="settings" aria-labelledby="account-settings" className={SECTION}>
      <SectionTitle id="account-settings" lead={t("pages.account.hub.settingsLead")}>
        {t("pages.account.hub.settingsTitle")}
      </SectionTitle>
      <div className="space-y-6">
        {ownerOk && available && <PublicSettings />}
        {ownerOk && available && <DeleteCopy />}
        <div className="flex flex-wrap gap-2 border-t border-night-800 pt-6">
          {session.state !== "missing" && (
            <SignOutForm action={disconnect}>
              <button type="submit" className="btn btn-secondary btn-sm">
                <LogOut size={15} aria-hidden />
                {t("pages.account.signOut")}
              </button>
            </SignOutForm>
          )}
          {discord && <DiscordSignOut label={t("pages.account.hub.signOutDiscord")} locale={locale} />}
        </div>
      </div>
    </section>
  );

  // ── Discord login alone ─────────────────────────────────────────────
  if (session.state === "missing") {
    const login = owner.status === "ok" ? owner.discord : null;
    const linked = owner.status === "ok" && discord !== null && owner.id !== discordAccountId(discord.id);
    const name = owner.status === "ok" ? owner.name : (discord?.name ?? t("pages.account.metaTitle"));
    return (
      <ExtendMessages messages={messages}>
        <AccountPoster
          name={name}
          kicker={t("pages.account.hub.discordKicker")}
          avatar={login?.avatar ?? null}
          plainAvatar
          art={heroArt("layla")}
          artPosition="55% 20%"
          crumbs={[{ name: t("pages.account.metaTitle") }]}
        >
          <LinkGameCard t={t} linkedName={linked ? name : null} />
        </AccountPoster>
        <AccountHubNav
          sections={[
            { id: "progress", label: t("pages.account.hub.nav.progress") },
            { id: "favourites", label: t("pages.account.hub.nav.favourites") },
            { id: "settings", label: t("pages.account.hub.nav.settings") },
          ]}
        />
        <div className="page-wrap space-y-14 py-10 sm:space-y-20 sm:py-14">
          {progress}
          {favourites}
          {settings}
        </div>
      </ExtendMessages>
    );
  }

  // ── Game session (profile live, or the service busy) ────────────────
  const { token } = session;
  const live = session.state === "ok";
  const profile: Profile | null = live ? session.profile : session.lastKnown;
  const ids = profile ?? identity(token);

  // Two sources in parallel: stats (often down) and friends
  // (on the auth subsystem, which stays online).
  const [stats, friendList, now] = await Promise.all([statistics(token), friends(token), requestTime()]);

  const level = profile ? celestialLevel(profile.level) : null;
  const friendCount = friendList.status === "ok" ? friendList.data.length : null;
  const name = profile?.name || (discord?.name ?? t("pages.account.metaTitle"));

  const nav = [
    { id: "overview", label: t("pages.account.hub.nav.overview") },
    { id: "friends", label: t("pages.account.hub.nav.friends") },
    { id: "progress", label: t("pages.account.hub.nav.progress") },
    { id: "favourites", label: t("pages.account.hub.nav.favourites") },
    ...(ids.roleId ? [{ id: "discord-card", label: t("pages.account.hub.nav.discord") }] : []),
    { id: "settings", label: t("pages.account.hub.nav.settings") },
  ];

  return (
    <ExtendMessages messages={messages}>
      {/* ── Profile poster: avatar, name, the two rank crests big ── */}
      <AccountPoster
        name={name}
        kicker={t("pages.account.hub.kicker")}
        avatar={profile?.avatar ?? null}
        art={heroArt("alucard")}
        crumbs={[{ name: t("pages.account.metaTitle") }]}
        meta={[
          profile && (level === null ? t("pages.account.levelX", { n: profile.level }) : t("pages.account.levelCelestial", { n: level })),
          profile?.country ? countryName(profile.country, locale) : null,
          ids.roleId ? <span className="tabular-nums">ID {ids.roleId} ({ids.zoneId})</span> : null,
        ]}
        actions={
          <SignOutForm action={disconnect}>
            <button type="submit" className="btn btn-secondary btn-sm">
              <LogOut size={15} aria-hidden />
              {t("pages.account.signedOut")}
            </button>
          </SignOutForm>
        }
      >
        {!live && (
          <DexNote pose="dodo" height={96} role="status" title={t("pages.account.hub.unavailable.title")} className="mb-6">
            {t("pages.account.hub.unavailable.text")}
            {profile && <> {t("pages.account.hub.unavailable.lastKnown")}</>}
          </DexNote>
        )}
        {profile && (
          <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <RankTile label={t("pages.account.currentRank")} rank={profile.rankCurrent} gold />
            <RankTile label={t("pages.account.bestRank")} rank={profile.rankMax} />
            <Figure label={level === null ? t("pages.account.level") : t("pages.account.levelCelestialLabel")} value={level ?? profile.level} />
            <Figure label={t("pages.account.friends")} value={friendCount ?? "—"} outline href="#friends" />
          </dl>
        )}
      </AccountPoster>

      <AccountHubNav sections={nav} />

      <div className="page-wrap space-y-14 py-10 sm:space-y-20 sm:py-14">
        {/* ── Season: the player's heroes, as artwork, then the figures ── */}
        <section id="overview" aria-labelledby="account-overview" className={SECTION}>
          <SectionTitle id="account-overview" lead={t("pages.account.hub.overviewLead")} action={{ href: "/account/profile", label: t("pages.account.profileLink") }}>
            {t("pages.account.hub.overviewTitle")}
          </SectionTitle>
          <div className="space-y-8">
            {stats.status === "ok" && stats.data.seasons[0] !== undefined && (
              <div>
                <h3 className="mb-4 font-heading text-xl font-bold uppercase text-chalk-100">{t("pages.account.topHeroes")}</h3>
                {/* Deferred: one more call to the service. */}
                <Suspense fallback={<div className="bevel-lg skeleton min-h-[17rem]" />}>
                  <TopHeroes token={token} season={stats.data.seasons[0]} locale={locale} />
                </Suspense>
              </div>
            )}
            <div>
              <h3 className="mb-4 font-heading text-xl font-bold uppercase text-chalk-100">{t("pages.account.statistics")}</h3>
              {stats.status === "ok" ? (
                <SummaryStatistics stats={stats.data} locale={locale} />
              ) : (
                <DexNote pose="triste" height={110}>
                  {t("pages.account.detailUnavailable")}
                </DexNote>
              )}
            </div>
            {/* The detailed profile has its own states: the link stays even when stats are down. */}
            <Link
              href="/account/profile"
              className="card-link group flex items-center gap-4 bg-night-800 p-5 shadow-[inset_3px_0_0_var(--color-gold-400)]"
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
          </div>
        </section>

        {/* ── Friends ────────────────────────────────────────────────────── */}
        <section id="friends" aria-labelledby="account-friends" className={SECTION}>
          <SectionTitle id="account-friends" lead={t("pages.account.hub.friendsLead")}>
            {t("pages.account.friends")}
            {friendCount !== null && friendCount > 0 && <span className="ml-3 align-middle text-[0.55em] text-gold-400 tabular-nums">{friendCount}</span>}
          </SectionTitle>
          {friendList.status === "ok" ? (
            friendList.data.length > 0 ? (
              <AccountFriends friends={friendList.data} />
            ) : (
              <p className="text-sm text-chalk-400">{t("pages.account.hub.friendsEmpty")}</p>
            )
          ) : (
            <DexNote pose="reflexion" height={96}>{t("pages.account.hub.friendsUnavailable")}</DexNote>
          )}
        </section>

        {progress}
        {favourites}

        {/* ── Discord profile card (the bot's /profile) ────────────────── */}
        {ids.roleId ? (
          <div className="[&>section]:scroll-mt-36">
            <ExtendMessages messages={messagesPage(locale, ["pages.discordCard"])}>
              <DiscordCardSection locale={locale} roleId={ids.roleId} zoneId={ids.zoneId} now={now} />
            </ExtendMessages>
          </div>
        ) : null}

        {settings}
      </div>
    </ExtendMessages>
  );
}

/** The Discord login's sign-out: a plain form to the logout route, back to the sign-in page. */
function DiscordSignOut({ label, locale }: { label: string; locale: Locale }) {
  return (
    <form method="post" action="/api/discord/logout">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back" value="/login" />
      <button type="submit" className="btn btn-secondary btn-sm">
        <LogOut size={15} aria-hidden />
        {label}
      </button>
    </form>
  );
}

/** Signed in with Discord only: the invitation to add the game account, the rank and friends it brings. */
function LinkGameCard({ t, linkedName }: { t: T; linkedName: string | null }) {
  return (
    <div className="bevel-lg relative max-w-3xl overflow-hidden bg-linear-to-br from-gold-500/20 via-night-900 to-night-900 p-5 shadow-[inset_0_0_0_1px_rgb(245_196_81/0.45)] sm:p-7">
      <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-gold-400/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <span aria-hidden className="bevel grid size-14 shrink-0 place-items-center bg-gold-400 text-night-950 shadow-[0_0_24px_rgb(245_196_81/0.4)]">
          <Gamepad2 size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-bold uppercase leading-tight text-chalk-100 sm:text-2xl">{t("pages.account.hub.link.title")}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-chalk-300">{t("pages.account.hub.link.text")}</p>
          {linkedName && <p className="mt-2 text-xs text-chalk-400">{t("pages.account.hub.link.linked", { name: linkedName })}</p>}
        </div>
        <Link href="/login" className="btn btn-primary w-full justify-center sm:w-auto">
          <LogIn size={16} aria-hidden />
          {t("pages.account.hub.link.cta")}
        </Link>
      </div>
    </div>
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

/** A rank crest tile: the smaller badge on a phone, the large crest from `lg`. */
function RankTile({ label, rank, gold = false }: { label: string; rank: number; gold?: boolean }) {
  const readable = readableRank(rank);
  return (
    <div className={cn("bevel-lg bg-night-900/90 p-4 backdrop-blur-sm sm:p-5", gold && "shadow-[inset_0_3px_0_var(--color-gold-500)]")}>
      <dt className={cn("font-heading text-xs font-bold uppercase sm:text-sm", gold ? "text-gold-400" : "text-chalk-400")}>{label}</dt>
      <dd className="mt-3">
        <span className="lg:hidden">
          <RankBadge rank={readable} size="lg" />
        </span>
        <span className="max-lg:hidden">
          <RankBadge rank={readable} size="xl" />
        </span>
      </dd>
    </div>
  );
}

function Figure({ label, value, outline = false, href }: { label: string; value: number | string; outline?: boolean; href?: string }) {
  const score = <Score value={value} outline={outline} className="text-[2.8rem] sm:text-[3.5rem]" />;
  return (
    <div className="bevel-lg bg-night-900/90 p-4 backdrop-blur-sm sm:p-5">
      <dt className="font-heading text-xs font-bold uppercase text-chalk-400 sm:text-sm">{label}</dt>
      <dd className="mt-2">
        {href ? (
          <a href={href} className="transition-colors hover:text-gold-300">
            {score}
          </a>
        ) : (
          score
        )}
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
    <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <Figure label={t("pages.accountProfile.games")} value={formatCount(stats.matches, locale)} />
      <Figure label={t("pages.heroDetail.stat.winRate")} value={formatPercent((stats.wins / stats.matches) * 100, locale)} />
      {stats.mvp !== null && <Figure label={t("pages.accountProfile.mvp")} value={formatCount(stats.mvp, locale)} />}
      {stats.bestStreak !== null && <Figure label={t("pages.accountProfile.bestStreak")} value={formatCount(stats.bestStreak, locale)} />}
    </dl>
  );
}

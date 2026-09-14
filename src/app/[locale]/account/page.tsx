import { Breadcrumb } from "@/components/breadcrumb";
import { metaLocales } from "@/i18n/seo";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ChevronRight, CircleAlert, LogOut, Trophy } from "lucide-react";
import { RankBadge } from "@/components/rank-badge";
import { AccountFavourites } from "@/components/account-favourites";
import Link from "@/components/link";
import { StateProfile } from "@/components/player-profile";
import { Card } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { disconnect } from "@/lib/actions";
import { formatCount, formatPercent } from "@/lib/player-format";
import type { StatsPlayer } from "@/lib/player-api";
import { friends, statistics } from "@/lib/mlbb-auth";
import { countryName, readableRank } from "@/lib/ranks";
import { sessionPlayer } from "@/lib/session";
import { summaryLastPatch } from "@/lib/patch-tracking";

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
  if (session.state === "missing") redirect("/login");

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
          <form action={disconnect} className="mt-5">
            <button type="submit" className="text-sm text-chalk-500 underline underline-offset-4 hover:text-blood-500">
              {t("pages.account.signOut")}
            </button>
          </form>
        </Card>
      </div>
    );
  }

  const { token, profile } = session;

  // Two sources in parallel: stats (often down) and friends
  // (on the auth subsystem, which stays online).
  const [stats, friendList] = await Promise.all([
    statistics(token),
    friends(token),
  ]);

  const rank = readableRank(profile.rankCurrent);
  const rankMax = readableRank(profile.rankMax);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <Breadcrumb crumbs={[{ name: t("pages.account.metaTitle") }]} className="mb-8" />
      {/* ── Profile header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-5">
        <span className="bevel relative size-20 shrink-0 overflow-hidden bg-night-800">
          {profile.avatar ? (
            <Image src={profile.avatar} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <span className="grid size-full place-items-center font-heading text-2xl font-bold text-chalk-500">
              {profile.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-bold text-chalk-100">{profile.name}</h1>
          <div className="mt-2">
            <RankBadge rank={rank} size="sm" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-chalk-500">
            <span>{t("pages.account.levelX", { n: profile.level })}</span>
            <span>{countryName(profile.country, locale)}</span>
            <span>ID {profile.roleId} ({profile.zoneId})</span>
          </div>
        </div>

        <form action={disconnect}>
          <button
            type="submit"
            className="bevel-sm flex items-center gap-2 border border-night-700 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-blood-500/50 hover:text-blood-500"
          >
            <LogOut size={15} aria-hidden />
            {t("pages.account.signedOut")}
          </button>
        </form>
      </div>

      {/* ── Ranks and figures ──────────────────────────────────────────── */}
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.account.currentRank")}</dt>
          <dd className="mt-2">
            <RankBadge rank={rank} size="lg" />
          </dd>
        </div>
        <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.account.bestRank")}</dt>
          <dd className="mt-2">
            <RankBadge rank={rankMax} size="lg" />
          </dd>
        </div>
        <Figure label={t("pages.account.level")} value={profile.level} />
        <Figure label={t("pages.account.friends")} value={friendList.status === "ok" ? friendList.data.length : "—"} />
      </dl>

      {/* ── Statistics ─────────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.account.statistics")}</h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

        {stats.status === "ok" ? (
          <SummaryStatistics stats={stats.data} locale={locale} />
        ) : (
          <Card className="mt-6 border-gold-500/25">
            <p className="text-sm leading-relaxed text-chalk-300">
              {t("pages.account.detailUnavailable")}
            </p>
          </Card>
        )}

        {/* The detailed profile has its own states: the link stays even when stats are down. */}
        <Link
          href="/account/profile"
          className="bevel group mt-6 flex items-center gap-4 border border-gold-500/30 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
        >
          <Trophy size={22} className="shrink-0 text-gold-400" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
              {t("pages.account.profileLink")}
            </span>
            <span className="mt-0.5 block text-sm text-chalk-500">{t("pages.account.profileLinkText")}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-chalk-500" aria-hidden />
        </Link>
      </section>

      {/* ── Friends ────────────────────────────────────────────────────── */}
      {friendList.status === "ok" && friendList.data.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline gap-3">
            <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.account.friends")}</h2>
            <span className="text-sm text-chalk-500">{friendList.data.length}</span>
          </div>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {friendList.data.map((friend, i) => (
              <li
                key={`${friend.name}-${i}`}
                className="bevel flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2.5"
              >
                <span className="bevel-sm relative size-10 shrink-0 overflow-hidden bg-night-800">
                  {friend.avatar ? (
                    <Image src={friend.avatar} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-xs text-chalk-500">
                      {friend.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 truncate text-sm text-chalk-100">{friend.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Favorites (local) ──────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.account.favourites")}</h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <AccountFavourites lastPatch={summaryLastPatch()} />
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
      <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-bold text-gold-400">{value}</dd>
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
    return <p className="mt-6 text-sm text-chalk-500">{t("pages.account.noStat")}</p>;
  }

  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

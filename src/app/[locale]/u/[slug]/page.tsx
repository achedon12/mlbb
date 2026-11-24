import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "@/components/link";
import { AccountPoster } from "@/components/account-poster";
import { Badges, FavouriteList, MlbbdleFigures, ProgressCard, QuizFigures } from "@/components/progress-view";
import { heroArt } from "@/components/stage";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { createT, messagesPage } from "@/i18n/translations";
import { publicView, SLUG } from "@/lib/account-sync";
import { readPublicProfile } from "@/lib/account-sync-server";
import { requestTime } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { logError } from "@/lib/log";
import { dayUtc } from "@/lib/quiz";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/**
 * A player's public progress page, at the random link they chose to share.
 * Only when its owner turned it on, and only the parts they picked: the name
 * of the login they use on the site, and their picture, favourites, quiz and
 * MLBBdle figures and badges if chosen. Never an id, a rank, a country or
 * anything from the game account beyond that. Not indexed: a link to share,
 * not a page to be found.
 */
export const dynamic = "force-dynamic";

const load = cache(async (slug: string) => {
  if (!databaseConfigured() || !SLUG.test(slug)) return null;
  try {
    return await readPublicProfile(slug);
  } catch (error) {
    await logError("progress: public profile read failed", error);
    return null;
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = createT(locale);
  const row = await load(slug);
  return {
    title: row ? t("pages.progress.publicTitle", { name: row.name }) : t("pages.progress.title"),
    description: t("pages.progress.publicDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function PublicProfilePage({ params }: Params) {
  const { locale, slug } = await params;
  const row = await load(slug);
  if (!row) notFound();
  const t = createT(locale);
  const view = publicView({ ...row, today: dayUtc(new Date(await requestTime())) });

  const badgeCount = view.badges?.length ?? 0;
  const bestStreak = Math.max(view.quiz?.bestStreak ?? 0, view.mlbbdle?.bestStreak ?? 0);

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.progress"])}>
      <AccountPoster
        name={view.name}
        kicker={t("pages.progress.publicKicker")}
        avatar={view.avatar}
        // A picture from the game's or Discord's CDN, by an address the server checked.
        plainAvatar
        art={heroArt(view.favourites?.[0] ?? "layla")}
        artPosition="55% 20%"
        crumbs={[{ name: view.name }]}
        meta={[
          view.badges ? t("pages.progress.publicBadges", { n: badgeCount }) : null,
          view.quiz || view.mlbbdle ? t("pages.progress.publicBestStreak", { n: bestStreak }) : null,
        ]}
      >
        <p className="max-w-2xl text-sm leading-relaxed text-chalk-300 sm:text-base">{t("pages.progress.publicLead")}</p>
      </AccountPoster>
      <div className="page-wrap space-y-4 py-10 sm:space-y-5 sm:py-14">
        {(view.quiz || view.mlbbdle) && (
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            {view.quiz && (
              <ProgressCard id="public-quiz" title={t("pages.progress.quiz")} icon="trophy">
                <QuizFigures quiz={view.quiz} />
              </ProgressCard>
            )}
            {view.mlbbdle && (
              <ProgressCard id="public-mlbbdle" title={t("pages.progress.mlbbdle")} icon="puzzle">
                <MlbbdleFigures mlbbdle={view.mlbbdle} />
              </ProgressCard>
            )}
          </div>
        )}
        {view.badges && (
          <ProgressCard id="public-badges" title={t("pages.progress.badgesTitle")}>
            <Badges earned={view.badges} showLocked={false} />
          </ProgressCard>
        )}
        {view.favourites && (
          <ProgressCard id="public-favourites" title={t("pages.progress.favourites")} icon="star">
            <FavouriteList favourites={view.favourites} />
          </ProgressCard>
        )}
        <div className="bevel-lg !mt-10 flex flex-col gap-4 bg-linear-to-br from-gold-500/15 via-night-900 to-night-900 p-5 shadow-[inset_0_0_0_1px_rgb(245_196_81/0.35)] sm:flex-row sm:items-center sm:p-6">
          <p className="min-w-0 flex-1 font-heading text-lg font-bold uppercase leading-tight text-chalk-100">{t("pages.progress.publicCta")}</p>
          <Link href="/account" className="btn btn-primary w-full justify-center sm:w-auto">
            {t("pages.progress.publicCtaLink")}
          </Link>
        </div>
      </div>
    </ExtendMessages>
  );
}

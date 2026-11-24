import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "@/components/link";
import { Badges, FavouriteList, MlbbdleFigures, ProgressSection, QuizFigures } from "@/components/progress-view";
import { heroArt, StageHeader } from "@/components/stage";
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

  return (
    <>
      <StageHeader
        compact
        title={view.name}
        lead={t("pages.progress.publicLead")}
        art={heroArt(view.favourites?.[0] ?? "layla")}
        artPosition="55% 20%"
        kicker={
          view.avatar ? (
            <span className="inline-flex items-center gap-2">
              {/* A picture from the game's or Discord's CDN, by an address the server checked. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={view.avatar} alt="" width={40} height={40} className="bevel-sm size-10 object-cover" referrerPolicy="no-referrer" />
              {t("pages.progress.publicKicker")}
            </span>
          ) : (
            t("pages.progress.publicKicker")
          )
        }
      />
      <div className="page-wrap space-y-12 py-10 sm:py-14">
        <ExtendMessages messages={messagesPage(locale, ["pages.progress"])}>
          {view.quiz && (
            <ProgressSection id="public-quiz" title={t("pages.progress.quiz")} icon="trophy">
              <QuizFigures quiz={view.quiz} />
            </ProgressSection>
          )}
          {view.mlbbdle && (
            <ProgressSection id="public-mlbbdle" title={t("pages.progress.mlbbdle")} icon="puzzle">
              <MlbbdleFigures mlbbdle={view.mlbbdle} />
            </ProgressSection>
          )}
          {view.badges && (
            <ProgressSection id="public-badges" title={t("pages.progress.badgesTitle")}>
              <Badges earned={view.badges} showLocked={false} />
            </ProgressSection>
          )}
          {view.favourites && (
            <ProgressSection id="public-favourites" title={t("pages.progress.favourites")} icon="star">
              <FavouriteList favourites={view.favourites} />
            </ProgressSection>
          )}
        </ExtendMessages>
        <p className="border-t border-night-800 pt-6 text-sm text-chalk-400">
          {t("pages.progress.publicCta")}{" "}
          <Link href="/account/progress" className="font-semibold text-gold-400 hover:underline">
            {t("pages.progress.publicCtaLink")}
          </Link>
        </p>
      </div>
    </>
  );
}

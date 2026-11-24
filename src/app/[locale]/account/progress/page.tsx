import type { Metadata } from "next";
import { ProgressPanel } from "@/components/progress-panel";
import { heroArt, StageHeader } from "@/components/stage";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaLocales } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { currentOwner } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return {
    title: t("pages.progress.metaTitle"),
    description: t("pages.progress.metaDescription"),
    alternates: metaLocales(locale, "/account/progress"),
    robots: { index: false, follow: false },
  };
}

/** Personal page: never cached. */
export const dynamic = "force-dynamic";

/**
 * The player's progress: streaks, quiz and MLBBdle figures, badges and
 * favourites, from this browser's copy; signed in (game account or
 * Discord), kept on the account and shareable as an opt-in public page.
 * Signed out, the same figures with what signing in adds: the page is the
 * pitch as much as the profile.
 */
export default async function ProgressPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const available = databaseConfigured();
  const owner = available ? await currentOwner().catch(() => ({ status: "unavailable" as const })) : { status: "none" as const };
  const signedIn = owner.status === "ok";

  return (
    <>
      <StageHeader
        compact
        title={signedIn ? t("pages.progress.titleNamed", { name: owner.name }) : t("pages.progress.title")}
        lead={t("pages.progress.lead")}
        crumbs={[{ name: t("pages.account.metaTitle"), href: "/account" }, { name: t("pages.progress.title") }]}
        art={heroArt("layla")}
        artPosition="55% 20%"
      />
      <div className="page-wrap py-10 sm:py-14">
        <ExtendMessages messages={messagesPage(locale, ["pages.progress"])}>
          <ProgressPanel signedIn={signedIn} available={available} />
        </ExtendMessages>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import Link from "@/components/link";
import { inlineProse } from "@/components/prose";
import { botPublished } from "@/lib/bot/public";
import { legal } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.privacy.title"),
    description: t("pages.privacy.metaDescription"),
    path: "/privacy",
  });
}

export default async function PrivacyPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  return (
    <>
      <PageHeader title={t("pages.privacy.title")} lead={t("pages.privacy.lead")} />
      <Prose
        locale={locale}
        messageKey="privacy"
        variables={{ contact: legal.contact }}
        extraToc={[
          { title: t("prose.push.title"), anchor: "notifications-push" },
          { title: t("prose.community.title"), anchor: "community" },
          ...(botPublished() ? [{ title: t("prose.bot.title"), anchor: "discord-bot" }] : []),
        ]}
      >
        {/*
          Patch notifications: the only data kept by the server, and
          only on request. Always described: the page is generated at
          build time, which does not know whether the VAPID keys will be set.
        */}
        <h2 id="notifications-push">{t("prose.push.title")}</h2>
        <p>{t("prose.push.intro")}</p>
        <ul>
          <li>{t("prose.push.endpoint")}</li>
          <li>{t("prose.push.language")}</li>
          <li>{t("prose.push.favourites")}</li>
        </ul>
        <p>{t("prose.push.usage")}</p>
        <p>{t("prose.push.unsubscribe")}</p>
        {/* Community (forum, votes, reports, teammate cards): kept in the database. */}
        <h2 id="community">{t("prose.community.title")}</h2>
        <p>{t("prose.community.intro")}</p>
        <ul>
          <li>{t("prose.community.account")}</li>
          <li>{t("prose.community.posts")}</li>
          <li>{t("prose.community.card")}</li>
        </ul>
        <p>{t("prose.community.moderation")}</p>
        <p>{t("prose.community.deletion", { contact: legal.contact })}</p>
        {/* Discord bot: described when it is deployed (its id is known at build time). */}
        {botPublished() && (
          <>
            <h2 id="discord-bot">{t("prose.bot.title")}</h2>
            <p>{t("prose.bot.intro")}</p>
            <ul>
              <li>{inlineProse(t("prose.bot.cookie"))}</li>
              <li>{t("prose.bot.servers")}</li>
              <li>{t("prose.bot.results")}</li>
            </ul>
            <p>{t("prose.bot.members")}</p>
            <p>
              <Link href="/bot/privacy">{t("prose.bot.details")}</Link>
            </p>
          </>
        )}
      </Prose>
    </>
  );
}

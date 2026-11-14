import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/link";
import { inlineProse } from "@/components/prose";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { botClientId } from "@/lib/bot/public";
import { legal } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

/** The bot's privacy policy: the address Discord's developer portal and the bot lists ask for. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!botClientId()) return {};
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.botPrivacy.title"),
    description: t("pages.botPrivacy.metaDescription"),
    path: "/bot/privacy",
  });
}

export default async function BotPrivacyPage({ params }: Params) {
  const { locale } = await params;
  if (!botClientId()) notFound();
  const t = createT(locale);
  const vars = { contact: legal.contact };
  const p = (key: string) => inlineProse(t(`pages.botPrivacy.${key}`), vars, key);

  return (
    <>
      <PageHeader
        title={t("pages.botPrivacy.title")}
        lead={t("pages.botPrivacy.lead")}
        crumbs={[{ name: t("pages.bot.breadcrumb"), href: "/bot" }, { name: t("pages.bot.privacy") }]}
      />
      <div className="prose-mlbb mx-auto max-w-3xl px-4 py-14">
        <h2>{t("pages.botPrivacy.storedTitle")}</h2>
        <ul>
          <li>{p("storedServer")}</li>
          <li>{p("storedResults")}</li>
          <li>{p("storedCommands")}</li>
          <li>{p("storedVotes")}</li>
        </ul>
        <h2>{t("pages.botPrivacy.notStoredTitle")}</h2>
        <p>{p("notStored")}</p>
        <p>{p("autoRoles")}</p>
        <p>{p("roleMenus")}</p>
        <h2>{t("pages.botPrivacy.cookieTitle")}</h2>
        <p>{p("cookie")}</p>
        <h2>{t("pages.botPrivacy.retentionTitle")}</h2>
        <p>{p("retention")}</p>
        <h2>{t("pages.botPrivacy.rightsTitle")}</h2>
        <p>{p("rights")}</p>
        <p>
          <Link href="/privacy">{t("pages.botPrivacy.sitePrivacy")}</Link> · <Link href="/bot/terms">{t("pages.bot.terms")}</Link>
        </p>
      </div>
    </>
  );
}

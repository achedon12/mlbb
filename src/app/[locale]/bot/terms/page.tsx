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

/** The bot's terms of use, the other address the developer portal asks for. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!botClientId()) return {};
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.botTerms.title"),
    description: t("pages.botTerms.metaDescription"),
    path: "/bot/terms",
  });
}

export default async function BotTermsPage({ params }: Params) {
  const { locale } = await params;
  if (!botClientId()) notFound();
  const t = createT(locale);
  return (
    <>
      <PageHeader
        title={t("pages.botTerms.title")}
        lead={t("pages.botTerms.lead")}
        crumbs={[{ name: t("pages.bot.breadcrumb"), href: "/bot" }, { name: t("pages.bot.terms") }]}
      />
      <div className="prose-mlbb mx-auto max-w-3xl px-4 py-14">
        {(["p1", "p2", "p3", "p4", "p5"] as const).map((key) => (
          <p key={key}>{inlineProse(t(`pages.botTerms.${key}`), { contact: legal.contact }, key)}</p>
        ))}
        <p>
          <Link href="/bot/privacy">{t("pages.bot.privacy")}</Link>
        </p>
      </div>
    </>
  );
}

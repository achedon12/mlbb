import type { Metadata } from "next";
import Link from "@/components/link";
import { AuthorProfile } from "@/components/author-profile";
import { heroArt, StageHeader } from "@/components/stage";
import { Prose } from "@/components/prose";
import { SupportBlock } from "@/components/support-links";
import { ActionLink } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.about.title"),
    description: t("pages.about.metaDescription"),
    path: "/about",
  });
}

/**
 * About: the stage, then who makes the site (only once the author has filled
 * `content/fr/editorial/auteur.md`), then the catalogue's prose. The sources
 * and the formulas have their own page, linked from the stage.
 */
export default async function AboutPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  return (
    <>
      <StageHeader
        title={t("pages.about.title")}
        lead={t("pages.about.lead")}
        art={heroArt("vale")}
        artPosition="55% 20%"
        dex="salut"
        actions={<ActionLink href="/methodology">{t("editorial.methodology.title")}</ActionLink>}
      >
        <p className="dex-bubble mt-5 max-w-md font-heading text-lg font-semibold leading-snug text-chalk-100">
          {t("pages.about.dexLine")}{" "}
          <Link href="/dex" className="whitespace-nowrap text-gold-400 transition-colors hover:text-gold-300">
            {t("pages.about.dexLink")} →
          </Link>
        </p>
      </StageHeader>
      <AuthorProfile locale={locale} />
      <Prose locale={locale} messageKey="about" variables={{ repository: site.repository }} />
      <SupportBlock />
    </>
  );
}

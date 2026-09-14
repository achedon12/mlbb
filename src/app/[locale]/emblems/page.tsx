import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import { EmblemGuide } from "@/components/emblem-guide";
import { PageHeader } from "@/components/ui";
import { emblems, battleSpells, talents } from "@/data/emblems";
import visuals from "@/data/game/visuals.json";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { choicePopular, patchCurrent } from "@/lib/freshness";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  // Noms anglais de l'API (« Seasoned Hunter ») vers le catalogue (« emblemData.seasoned-hunter.name »).
  const nameChoice = (name: string) => {
    const key = `emblemData.${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.nom`;
    const translated = t(key);
    return translated === key ? name : translated;
  };
  const { sort, talent } = choicePopular();
  return metaPage(locale, {
    title: t("pages.seo.emblems.title", { v: patchCurrent.version }),
    description:
      sort && talent
        ? t("pages.seo.emblems.description", { sort: nameChoice(sort), talent: nameChoice(talent), v: patchCurrent.version })
        : t("pages.emblems.metaDescription"),
    share: t("pages.emblems.ogDescription"),
    path: "/emblems",
  });
}

const images: Record<string, string> = {
  ...(visuals.emblems as Record<string, string>),
  ...(visuals.talents as Record<string, string>),
  ...(visuals.spells as Record<string, string>),
};

export default async function EmblemsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  return (
    <ExtendMessages messages={messagesPage(locale, ["emblemData"])}>
      <PageHeader
        title={t("pages.emblems.title")}
        lead={t("pages.emblems.lead")}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmblemGuide
          emblems={[...emblems]}
          talents={[...talents]}
          sorts={[...battleSpells]}
          images={images}
        />
      </div>
    </ExtendMessages>
  );
}

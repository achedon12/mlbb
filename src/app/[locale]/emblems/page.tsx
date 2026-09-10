import type { Metadata } from "next";
import { GuideEmblemes } from "@/components/guide-emblemes";
import { EnTetePage } from "@/components/ui";
import { emblemes, sortsDeCombat, talents } from "@/data/emblemes";
import visuels from "@/data/jeu/visuels.json";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.emblems.metaTitre"),
    description: t("pages.emblems.metaDescription"),
    partage: t("pages.emblems.ogDescription"),
    chemin: "/emblems",
  });
}

const images: Record<string, string> = {
  ...(visuels.emblemes as Record<string, string>),
  ...(visuels.talents as Record<string, string>),
  ...(visuels.sorts as Record<string, string>),
};

export default async function PageEmblemes({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage
        titre={t("pages.emblems.titre")}
        chapeau={t("pages.emblems.chapeau")}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <GuideEmblemes
          emblemes={[...emblemes]}
          talents={[...talents]}
          sorts={[...sortsDeCombat]}
          images={images}
        />
      </div>
    </>
  );
}

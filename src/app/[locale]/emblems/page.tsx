import type { Metadata } from "next";
import { CompleterMessages } from "@/i18n/fournisseur";
import { GuideEmblemes } from "@/components/guide-emblemes";
import { EnTetePage } from "@/components/ui";
import { emblemes, sortsDeCombat, talents } from "@/data/emblemes";
import visuels from "@/data/jeu/visuels.json";
import type { Langue } from "@/i18n/config";
import { creerT, messagesPage } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { choixPopulaires, patchActuel } from "@/lib/fraicheur";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  // Noms anglais de l'API (« Seasoned Hunter ») vers le catalogue (« emblemData.seasoned-hunter.name »).
  const nomChoix = (nom: string) => {
    const cle = `emblemData.${nom.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.nom`;
    const traduit = t(cle);
    return traduit === cle ? nom : traduit;
  };
  const { sort, talent } = choixPopulaires();
  return metaPage(locale, {
    titre: t("pages.seo.emblems.title", { v: patchActuel.version }),
    description:
      sort && talent
        ? t("pages.seo.emblems.description", { sort: nomChoix(sort), talent: nomChoix(talent), v: patchActuel.version })
        : t("pages.emblems.metaDescription"),
    partage: t("pages.emblems.ogDescription"),
    chemin: "/emblems",
  });
}

const images: Record<string, string> = {
  ...(visuels.emblems as Record<string, string>),
  ...(visuels.talents as Record<string, string>),
  ...(visuels.spells as Record<string, string>),
};

export default async function PageEmblemes({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <CompleterMessages messages={messagesPage(locale, ["emblemData"])}>
      <EnTetePage
        titre={t("pages.emblems.title")}
        chapeau={t("pages.emblems.lead")}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <GuideEmblemes
          emblemes={[...emblemes]}
          talents={[...talents]}
          sorts={[...sortsDeCombat]}
          images={images}
        />
      </div>
    </CompleterMessages>
  );
}

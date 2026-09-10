import type { Metadata } from "next";
import { ListeObjets } from "@/components/liste-objets";
import { EnTetePage } from "@/components/ui";
import visuels from "@/data/jeu/visuels.json";
import { categoriesObjets, objets } from "@/lib/donnees";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.items.metaTitre"),
    description: t("pages.items.metaDescription", { n: objets.length }),
    alternates: metaLangues(locale, "/items"),
    openGraph: {
      title: `${t("pages.items.metaTitre")} — ${site.nom}`,
      description: t("pages.items.ogDescription", { n: objets.length }),
      url: `/${locale}/items`,
    },
  };
}

const images = visuels.objets as Record<string, string>;

export default async function PageObjets({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const apercus = objets.map((o) => ({ ...o, image: images[o.slug] ?? null }));

  return (
    <>
      <EnTetePage titre={t("pages.items.titre")} chapeau={t("pages.items.chapeau", { n: objets.length })} />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <ListeObjets objets={apercus} categories={categoriesObjets} />
      </div>
    </>
  );
}

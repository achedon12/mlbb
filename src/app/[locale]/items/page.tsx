import type { Metadata } from "next";
import { ListeObjets } from "@/components/liste-objets";
import { EnTetePage } from "@/components/ui";
import visuels from "@/data/jeu/visuels.json";
import { categoriesObjets, nombreObjets, objets } from "@/lib/donnees";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.items.metaTitre"),
    description: t("pages.items.metaDescription", { n: nombreObjets }),
    partage: t("pages.items.ogDescription", { n: nombreObjets }),
    chemin: "/items",
  });
}

const images = visuels.objets as Record<string, string>;

export default async function PageObjets({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const apercus = objets(locale).map((o) => ({ ...o, image: images[o.slug] ?? null }));

  return (
    <>
      <EnTetePage titre={t("pages.items.titre")} chapeau={t("pages.items.chapeau", { n: nombreObjets })} />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <ListeObjets objets={apercus} categories={categoriesObjets} />
      </div>
    </>
  );
}

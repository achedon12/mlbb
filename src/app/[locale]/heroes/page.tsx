import type { Metadata } from "next";
import { donneesLd } from "@/lib/html";
import { ListeHeros } from "@/components/liste-heros";
import { EnTetePage } from "@/components/ui";
import { heros, herosAnalyses, nombreSkins } from "@/lib/donnees";
import { tauxParSlug } from "@/lib/tier-list";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  const n = { heros: heros.length, skins: nombreSkins, analyses: herosAnalyses.length };
  return metaPage(locale, {
    titre: t("pages.heroes.metaTitre"),
    description: t("pages.heroes.metaDescription", n),
    partage: t("pages.heroes.ogDescription", n),
    chemin: "/heroes",
  });
}

export default async function PageHeros({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("pages.heroes.listeLd"),
    numberOfItems: heros.length,
    itemListElement: heros.map((h, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: h.nom,
      url: `${site.url}/${locale}/heroes/${h.slug}`,
    })),
  };

  // On n'envoie au client que les champs affiches par les vignettes.
  const apercus = heros.map((h) => {
    const taux = tauxParSlug.get(h.slug);
    return {
      slug: h.slug,
      nom: h.nom,
      roles: h.roles,
      lanes: h.lanes,
      portrait: h.visuels.icone ?? h.visuels.portrait,
      skins: h.skins.length,
      analyse: h.analyse !== null,
      victoire: taux?.victoire ?? null,
      palier: taux?.palier ?? null,
    };
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <EnTetePage
        titre={t("pages.heroes.titre")}
        chapeau={t("pages.heroes.chapeau", {
          heros: heros.length,
          skins: nombreSkins,
          analyses: herosAnalyses.length,
        })}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <ListeHeros heros={apercus} />
      </div>
    </>
  );
}

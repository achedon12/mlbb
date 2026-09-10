import type { Metadata } from "next";
import { ComparateurHeros, type HerosComparable } from "@/components/comparateur-heros";
import { EnTetePage } from "@/components/ui";
import { heros } from "@/lib/donnees";
import { tauxParSlug } from "@/lib/tier-list";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.compare.metaTitre"),
    description: t("pages.compare.metaDescription"),
    alternates: metaLangues(locale, "/compare"),
    openGraph: { title: `${t("pages.compare.metaTitre")} — ${site.nom}`, description: t("pages.compare.ogDescription"), url: `/${locale}/compare` },
  };
}

export default async function PageComparateur({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const comparables: HerosComparable[] = heros.map((h) => {
    const taux = tauxParSlug.get(h.slug);
    return {
      slug: h.slug,
      nom: h.nom,
      icone: h.visuels.icone ?? h.visuels.portrait,
      roles: h.roles,
      lanes: h.lanes,
      notes: h.notes,
      victoire: taux?.victoire ?? null,
      ban: taux?.ban ?? null,
      palier: taux?.palier ?? null,
      skins: h.skins.length,
    };
  });

  return (
    <>
      <EnTetePage
        titre={t("pages.compare.titre")}
        chapeau={t("pages.compare.chapeau")}
      />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ComparateurHeros heros={comparables} />
      </div>
    </>
  );
}

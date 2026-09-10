import type { Metadata } from "next";
import { OutilDraft } from "@/components/outil-draft";
import { EnTetePage } from "@/components/ui";
import statistiques from "@/data/jeu/statistiques.json";
import { heros } from "@/lib/donnees";
import type { HerosDraft } from "@/lib/draft";
import { classementComplet } from "@/lib/tier-list";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.draft.metaTitre"),
    description: t("pages.draft.metaDescription"),
    alternates: metaLangues(locale, "/draft"),
    openGraph: { title: `${t("pages.draft.metaTitre")} — ${site.nom}`, description: t("pages.draft.ogDescription"), url: `/${locale}/draft` },
  };
}

interface Relation {
  fortContre: string[];
  faibleContre: string[];
  synergies: string[];
}

const relations = statistiques.relations as unknown as Record<string, Relation>;

export default async function PageDraft({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const taux = new Map(classementComplet.map((e) => [e.heros.slug, e.victoire]));

  // On n'envoie au client que ce dont l'outil se sert : la fiche complete
  // d'un heros porte des competences et des skins qui n'entrent pas dans le
  // calcul et pesent lourd multiplies par 133.
  const donnees: HerosDraft[] = heros.map((h) => ({
    slug: h.slug,
    nom: h.nom,
    lanes: h.lanes,
    icone: h.visuels.icone ?? h.visuels.portrait,
    victoire: taux.get(h.slug) ?? null,
    fortContre: relations[h.slug]?.fortContre ?? [],
    faibleContre: relations[h.slug]?.faibleContre ?? [],
    synergies: relations[h.slug]?.synergies ?? [],
  }));

  return (
    <>
      <EnTetePage
        titre={t("pages.draft.titre")}
        chapeau={t("pages.draft.chapeau")}
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <OutilDraft heros={donnees} />

        <p className="mt-14 border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-500">{t("pages.draft.note")}</p>
      </div>
    </>
  );
}

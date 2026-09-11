import type { Metadata } from "next";
import { AnalyseEquipe } from "@/components/analyse-equipe";
import Link from "@/components/lien";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { libelleHeros } from "@/i18n/donnees-heros";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import type { TypeDegats } from "@/lib/composition";
import { catalogueEquipe } from "@/lib/composition-donnees";
import { RANGS_CLASSES } from "@/lib/tier-list";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.equipe.metaTitre"),
    description: t("pages.equipe.metaDescription"),
    partage: t("pages.equipe.ogDescription"),
    chemin: "/tools/team",
    motsCles: ["team composition", "team comp", "analyzer", "synergy", "counter", "Mobile Legends", "MLBB"],
  });
}

export default async function PageEquipe({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  // Le catalogue `donneesHeros` reste cote serveur : les trois libelles de
  // degats partent deja resolus.
  const degats = (cle: TypeDegats) => libelleHeros(t, "degats", cle) ?? cle;

  return (
    <>
      <EnTetePage titre={t("pages.equipe.titre")} chapeau={t("pages.equipe.chapeau")}>
        <Link
          href="/draft"
          className="mt-5 inline-block text-sm font-semibold text-or-400 transition-colors hover:text-or-500"
        >
          {t("pages.equipe.lienDraft")} →
        </Link>
      </EnTetePage>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <AnalyseEquipe
          heros={catalogueEquipe()}
          rangs={RANGS_CLASSES}
          libellesDegats={{ physical: degats("physical"), magic: degats("magic"), mixed: degats("mixed") }}
        />

        <p className="mt-14 border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-500">
          {t("pages.equipe.note")}
        </p>
      </div>
    </>
  );
}

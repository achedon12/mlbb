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
    titre: t("pages.team.metaTitle"),
    description: t("pages.team.metaDescription"),
    partage: t("pages.team.ogDescription"),
    chemin: "/tools/team",
    motsCles: ["team composition", "team comp", "analyzer", "synergy", "counter", "Mobile Legends", "MLBB"],
  });
}

export default async function PageEquipe({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  // Le catalogue `heroData` reste cote serveur : les trois libelles de
  // degats partent deja resolus.
  const degats = (cle: TypeDegats) => libelleHeros(t, "damage", cle) ?? cle;

  return (
    <>
      <EnTetePage titre={t("pages.team.title")} chapeau={t("pages.team.lead")}>
        <Link
          href="/draft"
          className="mt-5 inline-block text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
        >
          {t("pages.team.draftLink")} →
        </Link>
      </EnTetePage>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <AnalyseEquipe
          heros={catalogueEquipe()}
          rangs={RANGS_CLASSES}
          libellesDegats={{ physical: degats("physical"), magic: degats("magic"), mixed: degats("mixed") }}
        />

        <p className="mt-14 border-t border-night-800 pt-6 text-sm leading-relaxed text-chalk-500">
          {t("pages.team.rating")}
        </p>
      </div>
    </>
  );
}

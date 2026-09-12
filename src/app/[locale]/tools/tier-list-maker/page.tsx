import type { Metadata } from "next";
import { CreateurTierList, type HerosTier } from "@/components/createur-tier-list";
import Link from "@/components/lien";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { heros } from "@/lib/donnees";
import { donneesLd } from "@/lib/html";
import type { RangMesure } from "@/lib/rangs-mesure";
import { classementDuRang, ORDRE_PALIERS, RANGS_CLASSES } from "@/lib/tier-list";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.createurTier.titre"),
    description: t("pages.seo.createurTier.description"),
    chemin: "/tools/tier-list-maker",
    motsCles: ["tier list maker", "tier list", "create", "share", "Mobile Legends", "MLBB"],
  });
}

/**
 * Le roster reduit a la vignette et aux filtres, et notre tier list de chaque
 * rang en indices dans ce roster (palier par palier, du plus fort au plus
 * faible) : quelques Ko pour pre-remplir la liste dans n'importe quel rang.
 */
function donnees() {
  const roster: HerosTier[] = heros.map((h) => ({
    slug: h.slug,
    nom: h.name,
    icone: h.images.icon ?? h.images.portrait,
    roles: h.roles,
    lanes: h.lanes,
  }));
  const indice = new Map(roster.map((h, i) => [h.slug, i]));
  const groupes: Partial<Record<RangMesure, number[][]>> = Object.fromEntries(
    RANGS_CLASSES.map((rang) => {
      const entrees = classementDuRang(rang);
      return [
        rang,
        ORDRE_PALIERS.map((p) => entrees.filter((e) => e.tier === p).flatMap((e) => indice.get(e.hero.slug) ?? [])),
      ];
    }),
  );
  return { roster, groupes };
}

export default async function PageCreateurTier({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const { roster, groupes } = donnees();
  const donneesStructurees = donneesOutil(locale, {
    nom: t("pages.createurTier.titre"),
    description: t("pages.seo.createurTier.description"),
    chemin: "/tools/tier-list-maker",
    categorie: "UtilitiesApplication",
  });
  const titre2 = "font-heading text-2xl font-bold text-chalk-100";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={t("pages.createurTier.titre")}
        chapeau={t("pages.createurTier.chapeau")}
        miettes={[{ nom: t("nav.tierList.label"), href: "/tier-list" }, { nom: t("pages.createurTier.miette") }]}
      />
      <div className="mx-auto max-w-5xl space-y-14 px-4 py-10">
        <CompleterMessages messages={messagesPage(locale, ["pages.createurTierUI"])}>
          <CreateurTierList heros={roster} groupes={groupes} rangs={RANGS_CLASSES} />
        </CompleterMessages>

        <section className="max-w-3xl">
          <h2 className={titre2}>{t("pages.createurTier.modeEmploiTitre")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-chalk-300">
            <li>{t("pages.createurTier.etape1")}</li>
            <li>{t("pages.createurTier.etape2")}</li>
            <li>{t("pages.createurTier.etape3")}</li>
            <li>{t("pages.createurTier.etape4")}</li>
          </ol>
        </section>

        <section className="max-w-3xl">
          <h2 className={titre2}>{t("pages.createurTier.methodeTitre")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">{t("pages.createurTier.methode")}</p>
          <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/tier-list" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
              {t("pages.createurTier.lienTierList")} →
            </Link>
            <Link href="/quiz" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
              {t("pages.createurTier.lienQuiz")} →
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}

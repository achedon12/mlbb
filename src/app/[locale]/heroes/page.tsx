import type { Metadata } from "next";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesLd } from "@/lib/html";
import { ListeHeros } from "@/components/liste-heros";
import { EnTetePage } from "@/components/ui";
import { heros, herosAnalyses, nombreSkins } from "@/lib/donnees";
import { classementComplet, tauxParSlug } from "@/lib/tier-list";
import { dateLongue, dateMesure, listeNoms, patchActuel } from "@/lib/fraicheur";
import type { Langue } from "@/i18n/config";
import { creerT, messagesPage } from "@/i18n/traductions";
import { donneesListeHeros, metaPage } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Langue }> };

/** Description en donnees : effectif, patch et date du releve, trois premiers de la tier list. */
function descriptionCatalogue(locale: Langue): string {
  const t = creerT(locale);
  return t("pages.seo.heroes.description", {
    n: heros.length,
    v: patchActuel.version,
    date: dateLongue(locale),
    top: listeNoms(locale, classementComplet.slice(0, 3).map((e) => e.heros.nom)),
    skins: nombreSkins,
    analyses: herosAnalyses.length,
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.heroes.titre", { n: heros.length, v: patchActuel.version }),
    description: descriptionCatalogue(locale),
    partage: t("pages.heroes.ogDescription", { heros: heros.length, skins: nombreSkins }),
    chemin: "/heroes",
  });
}

export default async function PageHeros({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);

  const donneesStructurees = donneesListeHeros(locale, {
    nom: t("pages.heroes.listeLd"),
    description: descriptionCatalogue(locale),
    chemin: "/heroes",
    heros: heros.map((h) => ({ nom: h.nom, slug: h.slug })),
    modifie: dateMesure,
  });

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
    <CompleterMessages messages={messagesPage(locale, ["pages.heroesListe"])}>
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
    </CompleterMessages>
  );
}

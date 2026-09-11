import type { Metadata } from "next";
import { ListeObjets } from "@/components/liste-objets";
import { EnTetePage } from "@/components/ui";
import visuels from "@/data/jeu/visuels.json";
import { buildsJoues, categoriesObjets, herosParSlug, nombreObjets, objets } from "@/lib/donnees";
import { visuelObjet } from "@/lib/visuels-build";
import type { VignetteHeros } from "@/components/liste-objets";
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

  // Heros qui prennent chaque objet dans leurs builds les plus joues, tous
  // rangs confondus, le plus joue d'abord. Le navigateur ne recoit que des
  // identifiants, et une seule table des heros cites.
  const usage = new Map<string, Map<string, number>>();
  for (const [slug, parLane] of Object.entries(buildsJoues)) {
    for (const parRang of Object.values(parLane)) {
      for (const build of parRang.all ?? []) {
        for (const nom of build.objets) {
          const cible = visuelObjet(nom).slug;
          if (!cible) continue;
          const parHeros = usage.get(cible) ?? new Map<string, number>();
          usage.set(cible, parHeros);
          parHeros.set(slug, Math.max(parHeros.get(slug) ?? 0, build.selection ?? 0));
        }
      }
    }
  }
  const utilisePar = Object.fromEntries(
    [...usage].map(([objet, parHeros]) => [
      objet,
      [...parHeros].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([slug]) => slug),
    ]),
  );
  const herosVignettes: Record<string, VignetteHeros> = {};
  for (const slug of new Set(Object.values(utilisePar).flat())) {
    const h = herosParSlug.get(slug);
    if (h) herosVignettes[slug] = { nom: h.nom, portrait: h.visuels.icone ?? h.visuels.portrait };
  }

  return (
    <>
      <EnTetePage titre={t("pages.items.titre")} chapeau={t("pages.items.chapeau", { n: nombreObjets })} />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <ListeObjets
          objets={apercus}
          categories={categoriesObjets}
          utilisePar={utilisePar}
          herosVignettes={herosVignettes}
        />
      </div>
    </>
  );
}

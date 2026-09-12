import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  catalogueRecettes,
  EffetsObjet,
  IconeObjet,
  RecetteObjet,
  type ApercuObjet,
  type VersObjet,
} from "@/components/fiche-objet";
import { ListeLiens, TableauRangs, TableauUsage } from "@/components/fiche-usage";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { Carte, EnTetePage, TitreSection } from "@/components/ui";
import visuels from "@/data/jeu/visuels.json";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { herosParSlug, objets } from "@/lib/donnees";
import { donneesFiche, resumeRangs, usage } from "@/lib/fiches-usage";
import { dateLongue, listeNoms, patchActuel, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

/** Une page par objet, generee au build ; toute autre adresse est une 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return objets("en").map((o) => ({ slug: o.slug }));
}

const images = visuels.items as Record<string, string>;
const nomHeros = (slug: string) => herosParSlug.get(slug)?.name ?? slug;
/** Un effet se termine deja par un point : la phrase n'en ajoute pas un second. */
const sansPoint = (texte: string) => texte.replace(/[.\s]+$/, "");

/**
 * Ce que la page et ses metadonnees disent d'un objet. Titre et description
 * sont faits des donnees : nom, prix, effet, heros qui le prennent, patch.
 */
function fiche(locale: Langue, slug: string) {
  const o = objets(locale).find((x) => x.slug === slug);
  if (!o) return null;
  const t = creerT(locale);
  const heros = usage("objet", slug);
  const prix = o.price === null ? null : `${o.price.toLocaleString(LOCALE_HTML[locale])} ${t("pages.itemsList.gold")}`;
  const details = [t(`categories.${o.category}`), prix].filter(Boolean).join(", ");
  const effet = o.bonus ?? o.summary;
  const phrases = [
    effet
      ? t("pages.itemDetail.itemDesc", { nom: o.name, details, effet: sansPoint(effet) })
      : t("pages.itemDetail.itemDescAlone", { nom: o.name, details }),
  ];
  const premier = heros[0];
  if (premier) {
    const noms = listeNoms(locale, heros.slice(0, 3).map((h) => nomHeros(h.slug)));
    phrases.push(
      premier.victoire === null
        ? t("pages.itemDetail.heroDescSimple", { heros: noms })
        : t("pages.itemDetail.heroDesc", {
            heros: noms,
            premier: nomHeros(premier.slug),
            taux: pourcentage(locale, premier.victoire),
          }),
    );
  }
  return {
    o,
    t,
    heros,
    titre: t("pages.itemDetail.title", { nom: o.name, v: patchActuel?.version ?? "" }),
    chapeau: phrases.join(" "),
    description: [...phrases, t("pages.sheets.updateDesc", { date: dateLongue(locale) })].join(" "),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const f = fiche(locale, slug);
  if (!f) return {};
  return metaPage(locale, { titre: f.titre, description: f.description, chemin: `/items/${slug}` });
}

/** Sur la page d'un objet, un autre objet s'ouvre sur sa propre page. */
const versPage: VersObjet = (o, contenu, className) => (
  <Link href={`/items/${o.slug}`} className={className}>
    {contenu}
  </Link>
);

export default async function PageObjet({ params }: Params) {
  const { locale, slug } = await params;
  const f = fiche(locale, slug);
  if (!f) notFound();
  const { o, t, heros } = f;

  const apercus: ApercuObjet[] = objets(locale).map((x) => ({ ...x, image: images[x.slug] ?? null }));
  const objet = apercus.find((x) => x.slug === slug)!;
  const catalogue = catalogueRecettes(apercus);
  const aFabrication = objet.recipe.length > 0 || (catalogue.debouches.get(objet.name)?.length ?? 0) > 0;
  const prix = (n: number) => `${n.toLocaleString(LOCALE_HTML[locale])} ${t("pages.itemsList.gold")}`;
  const categorie = t(`categories.${o.category}`);

  // Objets voisins : meme categorie, les plus proches en prix, puis ranges par prix.
  const ecart = (x: ApercuObjet) => Math.abs((x.price ?? 0) - (o.price ?? 0));
  const similaires = apercus
    .filter((x) => x.category === o.category && x.slug !== slug)
    .sort((a, b) => ecart(a) - ecart(b))
    .slice(0, 8)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  const titreHeros = t("pages.itemDetail.heroesTitle", { nom: o.name });
  const donnees = donneesFiche(locale, {
    titre: f.titre,
    description: f.description,
    chemin: `/items/${slug}`,
    nom: o.name,
    resume: o.summary,
    image: objet.image,
    listeNom: titreHeros,
    heros: heros.slice(0, 10).map((h) => ({ nom: nomHeros(h.slug), slug: h.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }} />
      <EnTetePage
        titre={o.name}
        chapeau={f.chapeau}
        icone={objet.image ? <IconeObjet image={objet.image} taille={64} /> : undefined}
        miettes={[
          { nom: t("nav.items.label"), href: "/items" },
          {
            nom: o.name,
            freres: [...apercus]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((x) => ({ nom: x.name, href: `/items/${x.slug}` })),
          },
        ]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section className={cn("grid gap-4", aFabrication && "md:grid-cols-2")}>
          <Carte>
            <h2 className="font-heading text-lg font-bold text-chalk-100">{t("pages.itemDetail.effects")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemDetail.category")}</dt>
                  <dd className="mt-1 text-chalk-100">{categorie}</dd>
                </div>
                {o.price !== null && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemDetail.price")}</dt>
                    <dd className="mt-1 font-heading text-gold-400">{prix(o.price)}</dd>
                  </div>
                )}
              </div>
              <EffetsObjet objet={objet} t={t} />
            </dl>
          </Carte>
          {aFabrication && (
            <Carte>
              <h2 className="font-heading text-lg font-bold text-chalk-100">{t("pages.itemDetail.crafting")}</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <RecetteObjet objet={objet} catalogue={catalogue} t={t} langue={locale} vers={versPage} />
              </dl>
            </Carte>
          )}
        </section>

        <section>
          <TitreSection chapeau={t("pages.sheets.help")}>{titreHeros}</TitreSection>
          {heros.length > 0 ? (
            <TableauUsage lignes={heros} legende={titreHeros} t={t} langue={locale} />
          ) : (
            <p className="text-sm text-chalk-500">{t("pages.sheets.none")}</p>
          )}
        </section>

        {heros.length > 0 && (
          <section>
            <TitreSection chapeau={t("pages.sheets.byRankIntro")}>{t("pages.sheets.byRank")}</TitreSection>
            <TableauRangs resume={resumeRangs("objet", slug)} legende={t("pages.sheets.byRank")} t={t} langue={locale} />
          </section>
        )}

        {similaires.length > 0 && (
          <section>
            <TitreSection>{t("pages.itemDetail.similar", { categorie })}</TitreSection>
            <ListeLiens
              liens={similaires.map((x) => ({
                href: `/items/${x.slug}`,
                nom: x.name,
                image: x.image,
                detail: x.price === null ? undefined : prix(x.price),
              }))}
            />
          </section>
        )}
      </div>
    </>
  );
}

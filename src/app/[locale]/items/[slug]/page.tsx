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

const images = visuels.objets as Record<string, string>;
const nomHeros = (slug: string) => herosParSlug.get(slug)?.nom ?? slug;
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
  const prix = o.prix === null ? null : `${o.prix.toLocaleString(LOCALE_HTML[locale])} ${t("pages.itemsListe.or")}`;
  const details = [t(`categories.${o.categorie}`), prix].filter(Boolean).join(", ");
  const effet = o.bonus ?? o.resume;
  const phrases = [
    effet
      ? t("pages.itemDetail.descObjet", { nom: o.nom, details, effet: sansPoint(effet) })
      : t("pages.itemDetail.descObjetSeul", { nom: o.nom, details }),
  ];
  const premier = heros[0];
  if (premier) {
    const noms = listeNoms(locale, heros.slice(0, 3).map((h) => nomHeros(h.slug)));
    phrases.push(
      premier.victoire === null
        ? t("pages.itemDetail.descHerosSimple", { heros: noms })
        : t("pages.itemDetail.descHeros", {
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
    titre: t("pages.itemDetail.titre", { nom: o.nom, v: patchActuel?.version ?? "" }),
    chapeau: phrases.join(" "),
    description: [...phrases, t("pages.fiches.descMaj", { date: dateLongue(locale) })].join(" "),
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
  const aFabrication = objet.recette.length > 0 || (catalogue.debouches.get(objet.nom)?.length ?? 0) > 0;
  const prix = (n: number) => `${n.toLocaleString(LOCALE_HTML[locale])} ${t("pages.itemsListe.or")}`;
  const categorie = t(`categories.${o.categorie}`);

  // Objets voisins : meme categorie, les plus proches en prix, puis ranges par prix.
  const ecart = (x: ApercuObjet) => Math.abs((x.prix ?? 0) - (o.prix ?? 0));
  const similaires = apercus
    .filter((x) => x.categorie === o.categorie && x.slug !== slug)
    .sort((a, b) => ecart(a) - ecart(b))
    .slice(0, 8)
    .sort((a, b) => (a.prix ?? 0) - (b.prix ?? 0));

  const titreHeros = t("pages.itemDetail.herosTitre", { nom: o.nom });
  const donnees = donneesFiche(locale, {
    titre: f.titre,
    description: f.description,
    chemin: `/items/${slug}`,
    nom: o.nom,
    resume: o.resume,
    image: objet.image,
    listeNom: titreHeros,
    heros: heros.slice(0, 10).map((h) => ({ nom: nomHeros(h.slug), slug: h.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }} />
      <EnTetePage
        titre={o.nom}
        chapeau={f.chapeau}
        icone={objet.image ? <IconeObjet image={objet.image} taille={64} /> : undefined}
        miettes={[
          { nom: t("nav.items.label"), href: "/items" },
          {
            nom: o.nom,
            freres: [...apercus]
              .sort((a, b) => a.nom.localeCompare(b.nom))
              .map((x) => ({ nom: x.nom, href: `/items/${x.slug}` })),
          },
        ]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section className={cn("grid gap-4", aFabrication && "md:grid-cols-2")}>
          <Carte>
            <h2 className="font-heading text-lg font-bold text-chalk-100">{t("pages.itemDetail.effets")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemDetail.categorie")}</dt>
                  <dd className="mt-1 text-chalk-100">{categorie}</dd>
                </div>
                {o.prix !== null && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemDetail.prix")}</dt>
                    <dd className="mt-1 font-heading text-gold-400">{prix(o.prix)}</dd>
                  </div>
                )}
              </div>
              <EffetsObjet objet={objet} t={t} />
            </dl>
          </Carte>
          {aFabrication && (
            <Carte>
              <h2 className="font-heading text-lg font-bold text-chalk-100">{t("pages.itemDetail.fabrication")}</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <RecetteObjet objet={objet} catalogue={catalogue} t={t} langue={locale} vers={versPage} />
              </dl>
            </Carte>
          )}
        </section>

        <section>
          <TitreSection chapeau={t("pages.fiches.aide")}>{titreHeros}</TitreSection>
          {heros.length > 0 ? (
            <TableauUsage lignes={heros} legende={titreHeros} t={t} langue={locale} />
          ) : (
            <p className="text-sm text-chalk-500">{t("pages.fiches.aucun")}</p>
          )}
        </section>

        {heros.length > 0 && (
          <section>
            <TitreSection chapeau={t("pages.fiches.parRangIntro")}>{t("pages.fiches.parRang")}</TitreSection>
            <TableauRangs resume={resumeRangs("objet", slug)} legende={t("pages.fiches.parRang")} t={t} langue={locale} />
          </section>
        )}

        {similaires.length > 0 && (
          <section>
            <TitreSection>{t("pages.itemDetail.similaires", { categorie })}</TitreSection>
            <ListeLiens
              liens={similaires.map((x) => ({
                href: `/items/${x.slug}`,
                nom: x.nom,
                image: x.image,
                detail: x.prix === null ? undefined : prix(x.prix),
              }))}
            />
          </section>
        )}
      </div>
    </>
  );
}

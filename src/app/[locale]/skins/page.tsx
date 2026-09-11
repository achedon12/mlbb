import type { Metadata } from "next";
import Link from "@/components/lien";
import { GalerieSkins } from "@/components/galerie-skins";
import { ImageLegere } from "@/components/image-legere";
import { EnTetePage } from "@/components/ui";
import { CompleterMessages } from "@/i18n/fournisseur";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { synchro } from "@/lib/donnees";
import { dateLongue } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { rarete } from "@/lib/raretes";
import { site } from "@/lib/site";
import { formaterSortie } from "@/lib/skins";
import { ancresGalerie, derniersSkins, galerieHeros, groupesSkins, herosAvecSkins, nombreSkinsGaleries } from "@/lib/skins-heros";

/**
 * Catalogue de tous les skins, heros par heros.
 *
 * Un millier de vignettes ne tiennent pas dans une page legere : le serveur
 * rend les derniers skins sortis, la premiere tranche de heros et l'index de
 * toutes les galeries ; la galerie filtrable charge la suite a la demande.
 * Chaque skin reste indexe sur la galerie de son heros.
 */

type Params = { params: Promise<{ locale: Langue }> };

const DERNIERS = 12;
/** Vignettes des derniers skins chargees d'emblee : la premiere rangee. */
const IMMEDIATES = 4;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  const n = new Intl.NumberFormat(locale).format(nombreSkinsGaleries);
  const dernier = derniersSkins(1)[0];
  return metaPage(locale, {
    titre: t("pages.skins.metaTitre", { n }),
    description: t("pages.skins.metaDescription", {
      n,
      h: herosAvecSkins.length,
      dernier: dernier?.skin.nom ?? "—",
      heros: dernier?.heros.nom ?? "—",
    }),
    chemin: "/skins",
  });
}

export default async function PageSkins({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const n = new Intl.NumberFormat(locale).format(nombreSkinsGaleries);
  const derniers = derniersSkins(DERNIERS);
  const tries = [...herosAvecSkins].sort((a, b) => a.nom.localeCompare(b.nom, "en"));
  const chapeau = t("pages.skins.chapeau", { n, h: tries.length });
  const absolue = (chemin: string) => new URL(chemin, site.url).toString();

  // Les derniers skins seulement : chaque galerie de heros porte les siens,
  // et la liste des 132 galeries doublait le poids de la page.
  const donnees = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("pages.skins.titre"),
    description: chapeau,
    url: `${site.url}/${locale}/skins`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: synchro.date,
    isPartOf: { "@type": "WebSite", name: site.nom, url: site.url },
    mainEntity: {
      "@type": "ImageGallery",
      name: t("pages.skins.derniers"),
      associatedMedia: derniers.flatMap(({ heros: h, skin: s }) => {
        const chemin = s.illustration ?? s.portrait;
        if (!chemin) return [];
        return [
          {
            "@type": "ImageObject",
            contentUrl: absolue(chemin),
            name: s.nom,
            caption: s.illustration
              ? t("pages.heroSkins.altIllustration", { skin: s.nom, nom: h.nom })
              : t("pages.heroSkins.altPortrait", { skin: s.nom, nom: h.nom }),
            creditText: "Moonton",
            copyrightNotice: "© Moonton",
            datePublished: s.sortie,
          },
        ];
      }),
    },
  };

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.heroesListe", "pages.skinsGalerie"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }} />
      <EnTetePage titre={t("pages.skins.titre")} chapeau={chapeau}>
        <p className="mt-6 text-sm text-chalk-500">
          <time dateTime={synchro.date}>{t("pages.skins.majLe", { date: dateLongue(locale, synchro.date) })}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section aria-labelledby="derniers-skins">
          <h2 id="derniers-skins" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.skins.derniers")}
          </h2>
          <p className="mt-1 text-sm text-chalk-500">{t("pages.skins.derniersIntro")}</p>
          <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {derniers.map(({ heros: h, skin: s }, i) => {
              const g = galerieHeros(h);
              const image = s.portrait ?? s.illustration;
              return (
                <li key={`${h.slug}-${s.id}`}>
                  <Link href={`/heroes/${h.slug}/skins#${ancresGalerie(g)[g.skins.indexOf(s)]}`} className="group block">
                    <span
                      className="bevel-sm relative block aspect-[240/390] overflow-hidden border-2 bg-night-800"
                      style={{ borderColor: rarete(s.rarete).couleur }}
                    >
                      {image && (
                        <ImageLegere
                          src={image}
                          alt={t("pages.heroSkins.altPortrait", { skin: s.nom, nom: h.nom })}
                          largeur={120}
                          hauteur={195}
                          immediate={i < IMMEDIATES}
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-sm font-semibold text-chalk-100 group-hover:text-gold-400">
                      {s.nom}
                    </span>
                    <span className="block truncate text-xs text-chalk-500">
                      {h.nom} · <time dateTime={s.sortie!}>{formaterSortie(s.sortie!, locale)}</time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="galerie-skins">
          <h2 id="galerie-skins" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.skins.galerie")}
          </h2>
          <div className="mt-5">
            <GalerieSkins groupes={groupesSkins()} />
          </div>
        </section>

        {/* Toutes les galeries en liens simples : moteurs et lecteurs atteignent chaque heros sans filtre ni clic. */}
        <nav aria-labelledby="index-skins">
          <h2 id="index-skins" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.skins.index")}
          </h2>
          <ul className="gallery-index mt-5">
            {tries.map((h) => (
              <li key={h.slug}>
                <Link href={`/heroes/${h.slug}/skins`} prefetch={false}>
                  {h.nom}
                </Link>{" "}
                {galerieHeros(h).total}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </CompleterMessages>
  );
}

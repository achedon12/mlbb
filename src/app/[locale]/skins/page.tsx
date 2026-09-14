import type { Metadata } from "next";
import Link from "@/components/link";
import { SkinGallery } from "@/components/skin-gallery";
import { LightImage } from "@/components/light-image";
import { PageHeader } from "@/components/ui";
import { ExtendMessages } from "@/i18n/provider";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { sync } from "@/lib/data";
import { longDate } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { rarity } from "@/lib/rarities";
import { site } from "@/lib/site";
import { formatRelease } from "@/lib/skins";
import { anchorsGallery, lastSkins, heroGallery, groupsSkins, heroesWithSkins, gallerySkinCount } from "@/lib/hero-skins";

/**
 * Catalogue de tous les skins, heros par heros.
 *
 * Un millier de vignettes ne tiennent pas dans une page legere : le serveur
 * rend les derniers skins sortis, la premiere tranche de heros et l'index de
 * toutes les galeries ; la galerie filtrable charge la suite a la demande.
 * Chaque skin reste indexe sur la galerie de son heros.
 */

type Params = { params: Promise<{ locale: Locale }> };

const LAST = 12;
/** Vignettes des derniers skins chargees d'emblee : la premiere rangee. */
const IMMEDIATES = 4;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  const n = new Intl.NumberFormat(locale).format(gallerySkinCount);
  const last = lastSkins(1)[0];
  return metaPage(locale, {
    title: t("pages.skins.metaTitle", { n }),
    description: t("pages.skins.metaDescription", {
      n,
      h: heroesWithSkins.length,
      dernier: last?.skin.name ?? "—",
      heros: last?.hero.name ?? "—",
    }),
    path: "/skins",
  });
}

export default async function SkinsPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const n = new Intl.NumberFormat(locale).format(gallerySkinCount);
  const last = lastSkins(LAST);
  const sorted = [...heroesWithSkins].sort((a, b) => a.name.localeCompare(b.name, "en"));
  const lead = t("pages.skins.lead", { n, h: sorted.length });
  const absolute = (path: string) => new URL(path, site.url).toString();

  // Les derniers skins seulement : chaque galerie de heros porte les siens,
  // et la liste des 132 galeries doublait le poids de la page.
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("pages.skins.title"),
    description: lead,
    url: `${site.url}/${locale}/skins`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: sync.date,
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    mainEntity: {
      "@type": "ImageGallery",
      name: t("pages.skins.latest"),
      associatedMedia: last.flatMap(({ hero: h, skin: s }) => {
        const path = s.illustration ?? s.portrait;
        if (!path) return [];
        return [
          {
            "@type": "ImageObject",
            contentUrl: absolute(path),
            name: s.name,
            caption: s.illustration
              ? t("pages.heroSkins.altIllustration", { skin: s.name, nom: h.name })
              : t("pages.heroSkins.altPortrait", { skin: s.name, nom: h.name }),
            creditText: "Moonton",
            copyrightNotice: "© Moonton",
            datePublished: s.release,
          },
        ];
      }),
    },
  };

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList", "pages.skinsGallery"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
      <PageHeader title={t("pages.skins.title")} lead={lead}>
        <p className="mt-6 text-sm text-chalk-500">
          <time dateTime={sync.date}>{t("pages.skins.updatedOn", { date: longDate(locale, sync.date) })}</time>
        </p>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section aria-labelledby="derniers-skins">
          <h2 id="derniers-skins" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.skins.latest")}
          </h2>
          <p className="mt-1 text-sm text-chalk-500">{t("pages.skins.latestIntro")}</p>
          <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {last.map(({ hero: h, skin: s }, i) => {
              const g = heroGallery(h);
              const image = s.portrait ?? s.illustration;
              return (
                <li key={`${h.slug}-${s.id}`}>
                  <Link href={`/heroes/${h.slug}/skins#${anchorsGallery(g)[g.skins.indexOf(s)]}`} className="group block">
                    <span
                      className="bevel-sm relative block aspect-[240/390] overflow-hidden border-2 bg-night-800"
                      style={{ borderColor: rarity(s.rarity).color }}
                    >
                      {image && (
                        <LightImage
                          src={image}
                          alt={t("pages.heroSkins.altPortrait", { skin: s.name, nom: h.name })}
                          width={120}
                          height={195}
                          immediate={i < IMMEDIATES}
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-sm font-semibold text-chalk-100 group-hover:text-gold-400">
                      {s.name}
                    </span>
                    <span className="block truncate text-xs text-chalk-500">
                      {h.name} · <time dateTime={s.release!}>{formatRelease(s.release!, locale)}</time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="galerie-skins">
          <h2 id="galerie-skins" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.skins.gallery")}
          </h2>
          <div className="mt-5">
            <SkinGallery groups={groupsSkins()} />
          </div>
        </section>

        {/* Toutes les galeries en liens simples : moteurs et lecteurs atteignent chaque heros sans filtre ni clic. */}
        <nav aria-labelledby="index-skins">
          <h2 id="index-skins" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.skins.index")}
          </h2>
          <ul className="gallery-index mt-5">
            {sorted.map((h) => (
              <li key={h.slug}>
                <Link href={`/heroes/${h.slug}/skins`} prefetch={false}>
                  {h.name}
                </Link>{" "}
                {heroGallery(h).total}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </ExtendMessages>
  );
}

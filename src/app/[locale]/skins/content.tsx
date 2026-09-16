import type { Metadata } from "next";
import Link from "@/components/link";
import { SkinGallery } from "@/components/skin-gallery";
import { Foldable } from "@/components/foldable";
import { LightImage } from "@/components/light-image";
import { PageHeader } from "@/components/ui";
import { ExtendMessages } from "@/i18n/provider";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage, metaPaged } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { sync } from "@/lib/data";
import { longDate } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { rarity } from "@/lib/rarities";
import { site } from "@/lib/site";
import { formatRelease } from "@/lib/skins";
import { pageCount } from "@/lib/pager";
import { anchorsGallery, lastSkins, heroGallery, groupsSkins, heroesWithSkins, gallerySkinCount } from "@/lib/hero-skins";

/**
 * Catalog of every skin, hero by hero, shared by `/skins` and
 * `/skins/page/n`.
 *
 * A thousand thumbnails do not fit in a light page: a page of the gallery
 * holds four heroes, and the index at the foot of the page leads to every
 * other one. Each skin stays indexed on its hero's gallery. Neither route
 * reads a query string: both are prerendered.
 */

export const PATH_SKINS = "/skins";

const LAST = 12;
/** Hero galleries per page; the same number the gallery itself uses. */
export const BY_PAGE_SKINS = 4;

/** How many pages the gallery holds, for the routes to prerender them. */
export const pagesSkins = () => pageCount(heroesWithSkins.length, BY_PAGE_SKINS);
/** Thumbnails of the latest skins loaded right away: the first row. */
const IMMEDIATE_COUNT = 4;

export function metaSkins(locale: Locale, page = 1): Metadata {
  const t = createT(locale);
  const n = new Intl.NumberFormat(locale).format(gallerySkinCount);
  const last = lastSkins(1)[0];
  return metaPaged(
    metaPage(locale, {
      title: t("pages.skins.metaTitle", { n }),
      description: t("pages.skins.metaDescription", {
        n,
        h: heroesWithSkins.length,
        latest: last?.skin.name ?? "—",
        hero: last?.hero.name ?? "—",
      }),
      path: PATH_SKINS,
    }),
    locale,
    PATH_SKINS,
    page,
  );
}

export function Skins({ locale, page = 1 }: { locale: Locale; page?: number }) {
  const t = createT(locale);
  const n = new Intl.NumberFormat(locale).format(gallerySkinCount);
  const last = lastSkins(LAST);
  const sorted = [...heroesWithSkins].sort((a, b) => a.name.localeCompare(b.name, "en"));
  const lead = t("pages.skins.lead", { n, h: sorted.length });
  const absolute = (path: string) => new URL(path, site.url).toString();

  // Only the latest skins: each hero gallery carries its own,
  // and the list of the 132 galleries doubled the page weight.
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
              ? t("pages.heroSkins.altIllustration", { skin: s.name, name: h.name })
              : t("pages.heroSkins.altPortrait", { skin: s.name, name: h.name }),
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
        <section aria-labelledby="latest-skins">
          <h2 id="latest-skins" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.skins.latest")}
          </h2>
          <p className="mt-1 text-sm text-chalk-500">{t("pages.skins.latestIntro")}</p>
          {/* Four thumbnails per row on a phone, as in the gallery below. */}
          <ul className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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
                          alt={t("pages.heroSkins.altPortrait", { skin: s.name, name: h.name })}
                          width={120}
                          height={195}
                          immediate={i < IMMEDIATE_COUNT}
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    {/* Four per row leaves little width: the name wraps over
                        two lines rather than being cut after eight letters. */}
                    <span className="mt-1.5 line-clamp-2 block text-sm font-semibold leading-tight text-chalk-100 group-hover:text-gold-400">
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

        <section aria-labelledby="skins-gallery">
          <h2 id="skins-gallery" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.skins.gallery")}
          </h2>
          <div className="mt-5">
            <SkinGallery groups={groupsSkins()} page={page} />
          </div>
        </section>

        {/* Every gallery as plain links: engines and readers reach each hero
            without filter or click. A hundred and thirty-two names ran two
            screens at the foot of the page; folded, they stay in the document
            — a closed `<details>` keeps its content — and one tap away. */}
        <nav aria-labelledby="index-skins">
          <h2 id="index-skins" className="sr-only">
            {t("pages.skins.index")}
          </h2>
          <Foldable label={t("pages.skins.index")}>
            <ul className="gallery-index">
              {sorted.map((h) => (
                <li key={h.slug}>
                  <Link href={`/heroes/${h.slug}/skins`} prefetch={false}>
                    {h.name}
                  </Link>{" "}
                  {heroGallery(h).total}
                </li>
              ))}
            </ul>
          </Foldable>
        </nav>
      </div>
    </ExtendMessages>
  );
}

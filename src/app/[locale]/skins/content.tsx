import type { Metadata } from "next";
import Link from "@/components/link";
import { SkinGallery } from "@/components/skin-gallery";
import { Foldable } from "@/components/foldable";
import { heroArt } from "@/components/hero-art";
import { ENTRANCE, PosterHeader } from "@/components/poster-header";
import { RarityGem, SkinArtTile, SkinTile } from "@/components/skins/skin-tile";
import { SectionTitle } from "@/components/ui";
import { ExtendMessages } from "@/i18n/provider";
import { LOCALE_HTML, LOCALE_INTL, type Locale } from "@/i18n/config";
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
/** Skins on the wall of the latest: the feature and sixteen portraits. */
const WALL = 17;
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
      card: true,
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
  // The newest in its artwork and sixteen portraits: two rows beside it, one under (twelve on a phone).
  const wall = lastSkins(WALL);
  // The poster: the latest artworks side by side, as slanted panels.
  const poster = last.flatMap(({ skin: s }) => s.illustration ?? []).slice(0, 5);
  const arts = Object.fromEntries(
    heroesWithSkins.flatMap((h) => {
      const art = heroArt(h.slug);
      return art ? [[h.slug, art]] : [];
    }),
  );

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
      <PosterHeader
        title={t("pages.skins.title")}
        lead={lead}
        art={poster}
        tall
        kicker={<time dateTime={sync.date}>{t("pages.skins.updatedOn", { date: longDate(locale, sync.date) })}</time>}
      />

      <div className="page-wrap space-y-14 py-10 sm:space-y-20 sm:py-14">
        {/*
          The latest skins as one wall: the newest in its full artwork, the
          others as portraits framed by rarity, names on the art.
        */}
        <section aria-labelledby="latest-skins" className={ENTRANCE}>
          <SectionTitle id="latest-skins" lead={t("pages.skins.latestIntro")}>
            {t("pages.skins.latest")}
          </SectionTitle>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
            {wall.map(({ hero: h, skin: s }, i) => {
              const g = heroGallery(h);
              const href = `/heroes/${h.slug}/skins#${anchorsGallery(g)[g.skins.indexOf(s)]}`;
              const r = rarity(s.rarity);
              const date = <time dateTime={s.release!}>{formatRelease(s.release!, LOCALE_INTL[locale])}</time>;
              if (i === 0 && s.illustration) {
                return (
                  <li key={`${h.slug}-${s.id}`} className="col-span-3 sm:col-span-4 lg:row-span-2">
                    <SkinArtTile
                      href={href}
                      art={s.illustration}
                      name={s.name}
                      color={r.color}
                      priority
                      aspect="aspect-[16/10] lg:aspect-auto lg:h-full"
                      className="lg:h-full"
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      nameClassName="text-[clamp(2.25rem,1.4rem+3vw,4.5rem)]"
                      kicker={
                        <>
                          <RarityGem color={r.color} />
                          {h.name} · {date}
                        </>
                      }
                    >
                      <span className="sr-only">{t("pages.heroSkins.altIllustration", { skin: s.name, name: h.name })}</span>
                    </SkinArtTile>
                  </li>
                );
              }
              const image = s.portrait ?? s.illustration;
              return (
                <li key={`${h.slug}-${s.id}`} className={i > 12 ? "max-sm:hidden" : undefined}>
                  <SkinTile
                    href={href}
                    src={image}
                    name={s.name}
                    sub={
                      <>
                        {h.name} · {date}
                      </>
                    }
                    alt={t("pages.heroSkins.altPortrait", { skin: s.name, name: h.name })}
                    color={r.color}
                    immediate={i < IMMEDIATE_COUNT}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="skins-gallery">
          <SectionTitle id="skins-gallery">{t("pages.skins.gallery")}</SectionTitle>
          <SkinGallery groups={groupsSkins()} arts={arts} page={page} />
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

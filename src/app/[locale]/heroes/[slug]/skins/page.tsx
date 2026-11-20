import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/link";
import { HeroSubLayout } from "@/components/hero-side-card";
import { heroArt } from "@/components/hero-art";
import { ENTRANCE, PosterHeader } from "@/components/poster-header";
import { RarityBlade, RarityGem } from "@/components/skins/skin-tile";
import { LOCALE_HTML, LOCALE_INTL, type Locale } from "@/i18n/config";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug, sync } from "@/lib/data";
import { serializeJsonLd } from "@/lib/html";
import { rarity, presentRarities } from "@/lib/rarities";
import { site } from "@/lib/site";
import { formatRelease, CURRENCIES, type SkinFull } from "@/lib/skins";
import { anchorsGallery, elide, heroGallery, heroesWithSkins, titleGallery, type HeroGallery } from "@/lib/hero-skins";
import type { Hero } from "@/lib/types";
import { NotFoundPage } from "@/components/not-found-page";
import { collaborationOf } from "@/lib/collaborations";

/**
 * A hero's skin gallery: each skin with its illustration, its
 * shop portrait, its rarity, its release, its availability and its price,
 * all rendered by the server. The hero page showcase shows one skin at a time;
 * here, everything is read — and indexed — at once.
 */

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/**
 * One gallery per hero that has at least one skin or illustration, rendered on
 * its first request then cached until the next deploy, like the counters page.
 * An unknown slug, or a hero without any skin, still falls on the 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

/** Machine-readable date: day, month or year ("201X" is not one). */
const DATE_ISO = /^\d{4}(-\d{2}){0,2}$/;

/** Most recent catalog skin among those whose date can be read. */
function newest(g: HeroGallery): SkinFull | null {
  return g.skins.filter((s) => DATE_ISO.test(s.release ?? "")).sort((a, b) => b.release!.localeCompare(a.release!))[0] ?? null;
}

function description(t: T, locale: Locale, h: Hero, g: HeroGallery): string {
  const base = t("pages.heroSkins.metaDescription", { name: h.name, n: g.total });
  const recent = newest(g);
  if (!recent) return base;
  return `${base} ${t("pages.heroSkins.latest", { skin: recent.name, date: formatRelease(recent.release!, LOCALE_INTL[locale]) })}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return notFoundMetadata(locale);
  const t = createT(locale);
  const g = heroGallery(h);
  if (g.total === 0) return notFoundMetadata(locale);
  const el = elide(locale, h.name);
  return metaPage(locale, {
    title: t(el ? "pages.heroSkins.metaTitleElision" : "pages.heroSkins.metaTitle", { name: h.name, n: g.total }),
    description: description(t, locale, h, g),
    path: `/heroes/${slug}/skins`,
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
}

export default async function HeroSkinsPage({ params }: Params) {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return <NotFoundPage />;
  const g = heroGallery(h);
  if (g.total === 0) return <NotFoundPage />;

  const t = createT(locale);
  // Rarity, availability and tag unknown to the catalog keep their original label.
  const tr = (ns: string, v: string) => {
    const key = `${ns}.${v}`;
    const translated = t(key);
    return translated === key ? v : translated;
  };
  const count = new Intl.NumberFormat(locale);
  const title = titleGallery(t, locale, h.name);
  const anchors = anchorsGallery(g);
  const recent = newest(g);
  const absolute = (path: string) => new URL(path, site.url).toString();
  const altIllustration = (skin: string) => t("pages.heroSkins.altIllustration", { skin, name: h.name });
  const altPortrait = (skin: string) => t("pages.heroSkins.altPortrait", { skin, name: h.name });
  const price = (s: SkinFull) =>
    Object.entries(s.price)
      .map(([m, v]) => {
        // "other" carries a text ("Twilight Pass"), not an amount.
        if (m === "other") return v;
        const amount = /^\d+$/.test(v) ? count.format(Number(v)) : v;
        return `${amount} ${CURRENCIES[m] ? t(`skinsUI.${CURRENCIES[m]}`) : m}`;
      })
      .join(" / ");

  // The poster: the most recent artwork, otherwise the hero's own.
  const poster = (recent && g.skins.find((s) => s === recent)?.illustration) || heroArt(h.slug) || g.others[0]?.illustration || null;
  const byAvailability = new Map<string, number>();
  for (const s of g.skins) if (s.availability) byAvailability.set(s.availability, (byAvailability.get(s.availability) ?? 0) + 1);

  const neighbours = [...heroesWithSkins].sort((a, b) => a.name.localeCompare(b.name, "en"));
  const position = neighbours.findIndex((x) => x.slug === h.slug);
  const previous = neighbours[(position - 1 + neighbours.length) % neighbours.length];
  const next = neighbours[(position + 1) % neighbours.length];

  const image = (path: string, name: string, legend: string, extra: Record<string, string> = {}) => ({
    "@type": "ImageObject",
    contentUrl: absolute(path),
    name,
    caption: legend,
    creditText: "Moonton",
    copyrightNotice: "© Moonton",
    ...extra,
  });
  const data = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: title,
    description: description(t, locale, h, g),
    url: `${site.url}/${locale}/heroes/${h.slug}/skins`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: sync.date,
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: { "@type": "Organization", name: "Moonton" } },
    associatedMedia: [
      ...g.skins.flatMap((s) => {
        const path = s.illustration ?? s.portrait;
        if (!path) return [];
        return [
          image(path, s.name, s.illustration ? altIllustration(s.name) : altPortrait(s.name), {
            ...(collaborationOf(s) ? { copyrightNotice: `© Moonton, ${collaborationOf(s)} © its rights holders` } : {}),
            ...(s.illustration && s.portrait ? { thumbnailUrl: absolute(s.portrait) } : {}),
            ...(s.release && DATE_ISO.test(s.release) ? { datePublished: s.release } : {}),
          }),
        ];
      }),
      ...g.others.map((a) => image(a.illustration, a.name, altIllustration(a.name))),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
      <PosterHeader
        title={title}
        art={poster}
        tall
        lead={t("pages.heroSkins.lead", { name: h.name, n: g.total })}
        crumbs={[
          { name: t("nav.heroes.label"), href: "/heroes" },
          { name: h.name, href: `/heroes/${h.slug}` },
          {
            name: t("pages.heroDetail.tab.skins"),
            siblings: neighbours.map((x) => ({ name: x.name, href: `/heroes/${x.slug}/skins` })),
          },
        ]}
      >
        <div className="mt-5 space-y-3 text-sm text-chalk-400">
          {byAvailability.size > 0 && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1">
              {[...byAvailability].map(([availability, n]) => (
                <div key={availability} className="flex gap-1.5">
                  <dt>{tr("skinAvailability", availability)}</dt>
                  <dd className="font-semibold tabular-nums text-chalk-100">{n}</dd>
                </div>
              ))}
            </dl>
          )}
          {recent && (
            <p>{t("pages.heroSkins.latest", { skin: recent.name, date: formatRelease(recent.release!, LOCALE_INTL[locale]) })}</p>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {presentRarities(g.skins.map((s) => s.rarity)).map((r) => (
              <li key={r.key} className="flex items-center gap-1.5 text-xs text-chalk-300">
                <RarityGem color={r.color} />
                {tr("skinRarity", r.key)}
              </li>
            ))}
          </ul>
          <p>
            <Link href={`/heroes/${h.slug}`} className="font-semibold text-gold-400 underline-offset-4 hover:underline">
              ← {t("pages.heroDetail.titleSheet", { name: h.name })}
            </Link>
          </p>
        </div>
      </PosterHeader>

      <HeroSubLayout slug={slug} locale={locale} current={`/heroes/${slug}/skins`} className="py-10">
        <ol className={`grid gap-x-6 gap-y-8 md:grid-cols-2 ${ENTRANCE}`}>
          {g.skins.map((s, i) => {
            const r = rarity(s.rarity);
            const origin = !s.rarity;
            const priceText = price(s);
            return (
              <li key={anchors[i]} id={anchors[i]} className="scroll-mt-24">
                <SkinCard
                  name={s.name}
                  illustration={s.illustration}
                  portrait={s.portrait}
                  color={r.color}
                  first={i === 0}
                  altIllustration={altIllustration(s.name)}
                  altPortrait={altPortrait(s.name)}
                >
                  <p
                    className={`font-heading text-sm font-bold uppercase ${origin ? "text-chalk-500" : ""}`}
                    style={origin ? undefined : { color: r.color }}
                  >
                    {tr("skinRarity", r.key)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {s.release && (
                      <Info label={t("skinsUI.release")}>
                        {DATE_ISO.test(s.release) ? (
                          <time dateTime={s.release}>{formatRelease(s.release, LOCALE_INTL[locale])}</time>
                        ) : (
                          s.release
                        )}
                      </Info>
                    )}
                    {s.availability && (
                      <Info label={t("skinsUI.availability")}>{tr("skinAvailability", s.availability)}</Info>
                    )}
                    {s.label && <Info label={t("skinsUI.obtained")}>{tr("skinLabel", s.label)}</Info>}
                    {priceText && <Info label={t("pages.heroSkins.price")}>{priceText}</Info>}
                  </dl>
                  {collaborationOf(s) && (
                    <p className="mt-3 text-xs text-chalk-500">
                      {t("pages.heroSkins.collaboration", { franchise: collaborationOf(s)! })}
                    </p>
                  )}
                </SkinCard>
              </li>
            );
          })}
          {g.others.map((a, k) => (
            <li key={anchors[g.skins.length + k]} id={anchors[g.skins.length + k]} className="scroll-mt-24">
              <SkinCard
                name={a.name}
                illustration={a.illustration}
                portrait={null}
                color={rarity(null).color}
                first={g.skins.length === 0 && k === 0}
                altIllustration={altIllustration(a.name)}
                altPortrait=""
              >
                <p className="mt-2 text-sm text-chalk-500">{t("pages.heroSkins.illustrationOnly")}</p>
              </SkinCard>
            </li>
          ))}
        </ol>

        <nav
          aria-label={t("pages.heroSkins.others")}
          className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-night-800 pt-6 text-sm"
        >
          <Link href={`/heroes/${previous.slug}/skins`} className="text-chalk-300 hover:text-gold-400">
            ← {titleGallery(t, locale, previous.name)}
          </Link>
          <Link href="/skins" className="font-semibold text-gold-400 hover:text-gold-500">
            {t("pages.skins.title")}
          </Link>
          <Link href={`/heroes/${next.slug}/skins`} className="text-chalk-300 hover:text-gold-400">
            {titleGallery(t, locale, next.name)} →
          </Link>
        </nav>
      </HeroSubLayout>
    </>
  );
}

/**
 * A skin's card: the illustration in 16/9 with the name on it, the shop
 * portrait as a medallion, a blade in the rarity's colour along the foot.
 * Without an illustration, the portrait fills the frame.
 */
function SkinCard({
  name,
  illustration,
  portrait,
  color,
  first,
  altIllustration,
  altPortrait,
  children,
}: {
  name: string;
  illustration: string | null;
  portrait: string | null;
  color: string;
  first: boolean;
  altIllustration: string;
  altPortrait: string;
  children: React.ReactNode;
}) {
  return (
    <article className="group flex h-full flex-col">
      <div className="bevel relative aspect-video overflow-hidden bg-night-800 transition-[translate] duration-200 group-hover:-translate-y-0.5">
        {illustration ? (
          <Image
            src={illustration}
            alt={altIllustration}
            fill
            preload={first}
            sizes="(min-width: 1280px) 40vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          portrait && (
            <Image
              src={portrait}
              alt={altPortrait}
              fill
              preload={first}
              sizes="(min-width: 768px) 180px, 45vw"
              className="object-contain"
            />
          )
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
        {illustration && portrait && (
          <span className="bevel-sm absolute right-3 top-3 overflow-hidden bg-night-900 shadow-[0_4px_14px_rgb(0_0_0/0.5)]">
            <Image src={portrait} alt={altPortrait} width={56} height={91} className="block h-[5.7rem] w-14 object-cover" />
            <RarityBlade color={color} />
          </span>
        )}
        {/* The name on the art, never under it. */}
        <h2 className="display-caps absolute inset-x-0 bottom-0 px-4 pb-3.5 text-[clamp(1.9rem,1.3rem+1.8vw,2.9rem)] text-chalk-100 sm:px-5">
          {name}
        </h2>
        <RarityBlade color={color} className="h-1" />
      </div>
      <div className="flex-1 px-1 pt-3">{children}</div>
    </article>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-chalk-500">{label}</dt>
      <dd className="mt-0.5 text-chalk-100">{children}</dd>
    </div>
  );
}

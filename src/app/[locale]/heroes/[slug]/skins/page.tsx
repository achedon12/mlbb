import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug, sync } from "@/lib/data";
import { serializeJsonLd } from "@/lib/html";
import { rarity, presentRarities } from "@/lib/rarities";
import { site } from "@/lib/site";
import { formatRelease, CURRENCIES, type SkinFull } from "@/lib/skins";
import { anchorsGallery, elide, heroGallery, heroesWithSkins, titleGallery, type HeroGallery } from "@/lib/hero-skins";
import type { Hero } from "@/lib/types";

/**
 * A hero's skin gallery: each skin with its illustration, its
 * shop portrait, its rarity, its release, its availability and its price,
 * all rendered by the server. The hero page showcase shows one skin at a time;
 * here, everything is read — and indexed — at once.
 */

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export const dynamicParams = false;

/** One gallery per hero that has at least one skin or illustration. */
export function generateStaticParams() {
  return heroesWithSkins.map((h) => ({ slug: h.slug }));
}

/** Machine-readable date: day, month or year ("201X" is not one). */
const DATE_ISO = /^\d{4}(-\d{2}){0,2}$/;

/** Most recent catalog skin among those whose date can be read. */
function newest(g: HeroGallery): SkinFull | null {
  return g.skins.filter((s) => DATE_ISO.test(s.release ?? "")).sort((a, b) => b.release!.localeCompare(a.release!))[0] ?? null;
}

function description(t: T, locale: Locale, h: Hero, g: HeroGallery): string {
  const base = t("pages.heroSkins.metaDescription", { nom: h.name, n: g.total });
  const recent = newest(g);
  if (!recent) return base;
  return `${base} ${t("pages.heroSkins.latest", { skin: recent.name, date: formatRelease(recent.release!, locale) })}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return {};
  const t = createT(locale);
  const g = heroGallery(h);
  const el = elide(locale, h.name);
  return metaPage(locale, {
    title: t(el ? "pages.heroSkins.metaTitleElision" : "pages.heroSkins.metaTitle", { nom: h.name, n: g.total }),
    description: description(t, locale, h, g),
    path: `/heroes/${slug}/skins`,
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
}

export default async function HeroSkinsPage({ params }: Params) {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) notFound();
  const g = heroGallery(h);
  if (g.total === 0) notFound();

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
  const altIllustration = (skin: string) => t("pages.heroSkins.altIllustration", { skin, nom: h.name });
  const altPortrait = (skin: string) => t("pages.heroSkins.altPortrait", { skin, nom: h.name });
  const price = (s: SkinFull) =>
    Object.entries(s.price)
      .map(([m, v]) => {
        // "other" carries a text ("Twilight Pass"), not an amount.
        if (m === "other") return v;
        const amount = /^\d+$/.test(v) ? count.format(Number(v)) : v;
        return `${amount} ${CURRENCIES[m] ? t(`skinsUI.${CURRENCIES[m]}`) : m}`;
      })
      .join(" / ");

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
      <PageHeader
        title={title}
        lead={t("pages.heroSkins.lead", { nom: h.name, n: g.total })}
        crumbs={[
          { name: t("nav.heroes.label"), href: "/heroes" },
          { name: h.name, href: `/heroes/${h.slug}` },
          {
            name: t("pages.heroDetail.tab.skins"),
            siblings: neighbours.map((x) => ({ name: x.name, href: `/heroes/${x.slug}/skins` })),
          },
        ]}
      >
        <div className="mt-6 space-y-3 text-sm text-chalk-500">
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
            <p>{t("pages.heroSkins.latest", { skin: recent.name, date: formatRelease(recent.release!, locale) })}</p>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {presentRarities(g.skins.map((s) => s.rarity)).map((r) => (
              <li key={r.name} className="flex items-center gap-1.5 text-xs">
                <span aria-hidden className="size-2.5 border-2" style={{ borderColor: r.color }} />
                {tr("skinRarity", r.key ?? r.name)}
              </li>
            ))}
          </ul>
          <p>
            <Link href={`/heroes/${h.slug}`} className="font-semibold text-gold-400 underline-offset-4 hover:underline">
              ← {t("pages.heroDetail.titleSheet", { nom: h.name })}
            </Link>
          </p>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <ol className="grid gap-6 md:grid-cols-2">
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
                    className={`mt-1 text-xs font-semibold uppercase tracking-wide ${origin ? "text-chalk-500" : ""}`}
                    style={origin ? undefined : { color: r.color }}
                  >
                    {tr("skinRarity", r.key ?? r.name)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {s.release && (
                      <Info label={t("skinsUI.release")}>
                        {DATE_ISO.test(s.release) ? (
                          <time dateTime={s.release}>{formatRelease(s.release, locale)}</time>
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
      </div>
    </>
  );
}

/**
 * A skin's card: the illustration in 16/9, the shop portrait as a
 * medallion, a rule in the rarity's color. Without an illustration, the
 * portrait fills the frame.
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
    <article className="bevel flex h-full flex-col overflow-hidden border border-night-700/70 bg-night-900/60">
      <div className="relative aspect-video bg-night-800">
        {illustration ? (
          <Image
            src={illustration}
            alt={altIllustration}
            fill
            preload={first}
            sizes="(min-width: 1152px) 552px, (min-width: 768px) 50vw, 100vw"
            className="object-cover object-top"
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
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
        {illustration && portrait && (
          <span
            className="bevel-sm absolute bottom-2 right-2 overflow-hidden border-2 bg-night-900"
            style={{ borderColor: color }}
          >
            <Image src={portrait} alt={altPortrait} width={56} height={91} className="block h-[5.7rem] w-14 object-cover" />
          </span>
        )}
      </div>
      <div className="flex-1 p-4">
        <h2 className="font-heading text-xl font-bold text-chalk-100">{name}</h2>
        {children}
      </div>
    </article>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
      <dd className="mt-0.5 text-chalk-100">{children}</dd>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/link";
import { heroArt } from "@/components/hero-art";
import { Dex } from "@/components/mascot";
import { ArtTile, ENTRANCE, PosterHeader } from "@/components/poster-header";
import { Score, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { heroListData, metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import { STALE_DAYS, type FreeRotation } from "@/lib/free-rotation";
import { currentFreeRotation, PATH_FREE_ROTATION } from "@/lib/free-rotation-server";
import { longDate } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { rankingFull } from "@/lib/tier-list";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = PATH_FREE_ROTATION;

function description(t: T, locale: Locale, rotation: FreeRotation): string {
  if (rotation.state !== "current") return t("pages.seo.freeRotation.descriptionEmpty");
  const names = rotation.heroes.flatMap((slug) => heroesBySlug.get(slug)?.name ?? []);
  return t("pages.seo.freeRotation.description", {
    date: longDate(locale, rotation.weekStart),
    n: names.length,
    heroes: names.slice(0, 4).join(", "),
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.freeRotation.title"),
    description: description(t, locale, currentFreeRotation()),
    path: PATH,
    keywords: ["free heroes", "free hero rotation", "weekly free heroes", "Mobile Legends", "MLBB"],
  });
}

/**
 * The week's free heroes, from the editorial file. A missing or stale list
 * is said in words — when it was last filled, and where the game shows it —
 * rather than showing an old week as if it were this one.
 *
 * The week's heroes stand as a row of posters, their official artwork
 * cropped tall; without a list, Dex says why, over a poster of the patch's
 * strongest heroes.
 */
export default async function FreeRotationPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const rotation = currentFreeRotation();
  const heroes = rotation.state === "current" ? rotation.heroes.flatMap((slug) => heroesBySlug.get(slug) ?? []) : [];
  const title = t("pages.freeRotation.title");

  const structuredData =
    rotation.state === "current"
      ? heroListData(locale, {
          name: title,
          description: description(t, locale, rotation),
          path: PATH,
          heroes: heroes.map((h) => ({ name: h.name, slug: h.slug })),
          changed: rotation.updated ?? rotation.weekStart,
        })
      : null;

  const facts =
    rotation.state === "current"
      ? [
          t("pages.freeRotation.week", { date: longDate(locale, rotation.weekStart) }),
          rotation.updated && t("pages.freeRotation.updated", { date: longDate(locale, rotation.updated) }),
        ]
      : [];

  // The poster: the week's heroes, or, without a list, the patch's strongest.
  const poster = (heroes.length > 0 ? heroes.map((h) => h.slug) : rankingFull.slice(0, 5).map((e) => e.hero.slug))
    .slice(0, 5)
    .map(heroArt);

  return (
    <>
      {structuredData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      )}
      <PosterHeader
        title={title}
        lead={t("pages.freeRotation.lead")}
        crumbs={[{ name: t("pages.heroes.title"), href: "/heroes" }, { name: title }]}
        meta={facts}
        art={poster}
        aside={
          heroes.length > 0 && (
            <p className="hidden text-right lg:block">
              <Score value={heroes.length} className="text-[clamp(5rem,3rem+5vw,8.5rem)]" />
              <span className="sr-only"> {t("pages.freeRotation.teaser", { n: heroes.length })}</span>
            </p>
          )
        }
      />

      <div className="page-wrap space-y-12 pb-14 pt-8 sm:space-y-16">
        {rotation.state === "current" ? (
          <section aria-labelledby="rotation-title">
            <SectionTitle id="rotation-title" lead={t("pages.freeRotation.listLead", { n: heroes.length })}>
              {t("pages.freeRotation.listTitle")}
            </SectionTitle>
            {/* A row of posters: the artwork cropped tall, the name over its foot. */}
            <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5", ENTRANCE)}>
              {heroes.map((h, i) => (
                <li key={h.slug}>
                  <ArtTile
                    href={`/heroes/${h.slug}`}
                    art={heroArt(h.slug)}
                    name={h.name}
                    heading="h3"
                    kicker={h.roles.map((r) => t(`roles.${r}`)).join(" · ")}
                    aspect="aspect-[3/4.4]"
                    position={i % 2 ? "60% 20%" : "42% 20%"}
                    sizes="(min-width: 1280px) 16vw, (min-width: 640px) 30vw, 46vw"
                    fallback={
                      h.images.portrait && (
                        <Image src={h.images.portrait} alt="" fill sizes="(min-width: 640px) 16vw, 46vw" className="object-cover object-top" />
                      )
                    }
                  />
                </li>
              ))}
            </ul>
            {rotation.source && (
              <p className="mt-4 text-xs text-chalk-500">
                <a href={rotation.source} rel="noopener" className="underline transition-colors hover:text-gold-400">
                  {t("pages.freeRotation.source")}
                </a>
              </p>
            )}
          </section>
        ) : (
          <div role="status" className={cn("dex-says max-w-3xl", ENTRANCE)}>
            <Dex pose="triste" height={150} />
            <div className="dex-bubble">
              <p className="font-heading text-xl font-bold text-chalk-100">{t("pages.freeRotation.unavailableTitle")}</p>
              <p className="mt-2 text-sm leading-relaxed text-chalk-300">
                {rotation.state === "stale"
                  ? t("pages.freeRotation.stale", { date: longDate(locale, rotation.weekStart), days: STALE_DAYS })
                  : t("pages.freeRotation.empty")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-chalk-300">{t("pages.freeRotation.inGame")}</p>
            </div>
          </div>
        )}

        <div aria-hidden className="eclat-rule" />

        <section aria-labelledby="rotation-how" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-14">
          <div className="max-w-3xl">
            <SectionTitle id="rotation-how">{t("pages.freeRotation.howTitle")}</SectionTitle>
            <div className="space-y-3 leading-relaxed text-chalk-300">
              <p>{t("pages.freeRotation.how1")}</p>
              <p>{t("pages.freeRotation.how2")}</p>
            </div>
          </div>
          {/* Where to go from here: three doors, the first one the catalogue. */}
          <ul className="grid gap-2">
            {[
              { href: "/heroes", label: t("pages.freeRotation.heroesLink") },
              { href: "/tier-list", label: t("pages.freeRotation.tierListLink") },
              { href: "/tools/server-time", label: t("pages.freeRotation.resetLink") },
            ].map((l, i) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "card-link eclat-under group flex items-center justify-between gap-3 px-5 py-4 font-heading text-lg font-bold uppercase",
                    i === 0 ? "text-gold-400" : "text-chalk-100",
                  )}
                >
                  {l.label}
                  <span aria-hidden className="text-gold-400 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

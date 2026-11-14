import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { heroListData, metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import { STALE_DAYS, type FreeRotation } from "@/lib/free-rotation";
import { currentFreeRotation, PATH_FREE_ROTATION } from "@/lib/free-rotation-server";
import { longDate } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";

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

  return (
    <>
      {structuredData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      )}
      <PageHeader
        title={title}
        lead={t("pages.freeRotation.lead")}
        crumbs={[{ name: t("pages.heroes.title"), href: "/heroes" }, { name: title }]}
        meta={facts}
      />

      <div className="page-wrap space-y-8 pb-10 pt-6 sm:space-y-14">
        {rotation.state === "current" ? (
          <section aria-labelledby="rotation-title">
            <SectionTitle id="rotation-title" lead={t("pages.freeRotation.listLead", { n: heroes.length })}>
              {t("pages.freeRotation.listTitle")}
            </SectionTitle>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {heroes.map((h) => (
                <li key={h.slug}>
                  <Link
                    href={`/heroes/${h.slug}`}
                    className="bevel group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60"
                  >
                    <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="icon" decorative />
                    <span className="min-w-0">
                      <span className="block truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                        {h.name}
                      </span>
                      <span className="block truncate text-xs text-chalk-500">
                        {h.roles.map((r) => t(`roles.${r}`)).join(" · ")}
                      </span>
                    </span>
                  </Link>
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
          <Card role="status" className="max-w-3xl">
            <p className="flex items-start gap-2 font-heading text-lg font-bold text-chalk-100">
              <CalendarClock size={18} aria-hidden className="mt-1 shrink-0 text-gold-400" />
              {t("pages.freeRotation.unavailableTitle")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-chalk-300">
              {rotation.state === "stale"
                ? t("pages.freeRotation.stale", { date: longDate(locale, rotation.weekStart), days: STALE_DAYS })
                : t("pages.freeRotation.empty")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-chalk-300">{t("pages.freeRotation.inGame")}</p>
          </Card>
        )}

        <section aria-labelledby="rotation-how" className="max-w-3xl">
          <SectionTitle id="rotation-how">{t("pages.freeRotation.howTitle")}</SectionTitle>
          <div className="space-y-3 leading-relaxed text-chalk-300">
            <p>{t("pages.freeRotation.how1")}</p>
            <p>{t("pages.freeRotation.how2")}</p>
          </div>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/heroes" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
              {t("pages.freeRotation.heroesLink")} →
            </Link>
            <Link href="/tier-list" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
              {t("pages.freeRotation.tierListLink")} →
            </Link>
            <Link href="/tools/server-time" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
              {t("pages.freeRotation.resetLink")} →
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}

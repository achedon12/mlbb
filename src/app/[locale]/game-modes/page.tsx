import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { WikiCredit } from "@/components/wiki-credit";
import { modes } from "@/lib/data";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { ACCENT_MODE_DEFAULT, ACCENTS_MODES } from "@/lib/modes";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.modes.title"),
    description: t("pages.modes.metaDescription"),
    share: t("pages.modes.ogDescription"),
    path: "/game-modes",
  });
}

export default async function GameModesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const list = modes(locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("pages.modes.listLd"),
    numberOfItems: list.length,
    itemListElement: list.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.name,
      url: `${site.url}/${locale}/game-modes/${m.slug}`,
      description: t(`modeSheet.${m.slug}.text`),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <PageHeader
        title={t("pages.modes.title")}
        lead={t("pages.modes.lead")}
      />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-5">
          {list.map((mode) => {
            const [dark, light] = ACCENTS_MODES[mode.slug] ?? ACCENT_MODE_DEFAULT;
            return (
              <Link
                key={mode.slug}
                href={`/game-modes/${mode.slug}`}
                className="bevel group relative isolate block overflow-hidden border border-night-700/70 transition-colors hover:border-night-600"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 -z-20"
                  style={{ background: `linear-gradient(115deg, ${dark} 0%, #0a0e1a 55%, #06080f 100%)` }}
                />
                {mode.image && (
                  <Image
                    aria-hidden
                    src={mode.image}
                    alt=""
                    width={360}
                    height={360}
                    className="pointer-events-none absolute -right-6 top-1/2 -z-10 h-[130%] w-auto -translate-y-1/2 object-contain opacity-25 blur-[1px] transition duration-500 group-hover:opacity-35 sm:-right-2 sm:opacity-30"
                  />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0 -z-10 bg-gradient-to-r from-night-950/85 via-night-950/45 to-transparent"
                />

                <div className="flex min-h-[180px] flex-col justify-end gap-3 p-6 sm:min-h-[200px] sm:p-8">
                  <p
                    className="font-heading text-[0.7rem] font-bold uppercase tracking-[0.2em]"
                    style={{ color: light }}
                  >
                    {t(`modeSheet.${mode.slug}.tagline`)}
                  </p>
                  <h2 className="font-heading text-2xl font-bold text-chalk-100 sm:text-3xl">{mode.name}</h2>
                  <p className="max-w-xl text-sm leading-relaxed text-chalk-300">
                    {t(`modeSheet.${mode.slug}.text`)}
                  </p>
                  <span
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-0.5"
                    style={{ color: light }}
                  >
                    {t("pages.modes.discover")}
                    <ArrowRight size={16} aria-hidden />
                  </span>
                </div>

                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ background: `linear-gradient(90deg, ${light}, transparent)` }}
                />
              </Link>
            );
          })}
        </div>

        <WikiCredit t={t} href="https://mobilelegends.fandom.com/wiki/Game_Modes" />
      </div>
    </>
  );
}

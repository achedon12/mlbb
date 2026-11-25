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
import motion from "@/components/catalogue-motion.module.css";
import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.modes.title"),
    description: t("pages.modes.metaDescription"),
    share: t("pages.modes.ogDescription"),
    path: "/game-modes",
    card: true,
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

      <div className="page-wrap py-10 sm:py-14">
        {/*
          Each mode as a poster: its own artwork shown whole on the right,
          its name in the display face. The first, Classic — the rules every
          other mode starts from — takes the full width.
        */}
        <ul className={cn("grid gap-3 sm:gap-4 lg:grid-cols-2", motion.rise)}>
          {list.map((mode, i) => {
            const lead = i === 0;
            return (
              <li key={mode.slug} className={cn(lead && "lg:col-span-2")}>
                <Link
                  href={`/game-modes/${mode.slug}`}
                  className={cn(
                    "bevel-lg group relative isolate flex h-full overflow-hidden bg-night-900 hover:bg-night-850",
                    motion.lift,
                    lead ? "min-h-[20rem] sm:min-h-[24rem]" : "min-h-[15rem] sm:min-h-[17rem]",
                  )}
                >
                  <span aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(115deg,var(--color-night-800),var(--color-night-900)_55%,var(--color-night-950))]" />
                  {mode.image && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -z-10 transition-transform duration-500 group-hover:scale-[1.04]",
                        lead ? "-right-4 bottom-0 top-4 w-[62%] sm:right-4 sm:w-[48%]" : "-right-6 bottom-2 top-6 w-[58%] sm:w-[50%]",
                      )}
                    >
                      <Image
                        src={mode.image}
                        alt=""
                        fill
                        priority={lead}
                        sizes={lead ? "(min-width: 640px) 45vw, 60vw" : "(min-width: 1024px) 25vw, 55vw"}
                        className="object-contain object-right-bottom drop-shadow-[0_18px_30px_rgb(0_0_0/calc(0.6*var(--shadow-strength)))]"
                      />
                    </span>
                  )}
                  <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-night-950/90 via-night-950/40 to-transparent" />
                  <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gold-400 opacity-0 transition-opacity group-hover:opacity-100" />

                  <span className="flex max-w-[34rem] flex-col justify-end gap-3 p-6 sm:p-8">
                    <span className="font-heading text-base font-bold uppercase text-gold-400">{t(`modeSheet.${mode.slug}.tagline`)}</span>
                    <h2
                      className={cn(
                        "display-caps break-words text-chalk-100 transition-colors group-hover:text-gold-300",
                        lead ? "text-[clamp(3rem,2rem+4vw,6rem)]" : "text-[clamp(2.4rem,1.8rem+2vw,3.6rem)]",
                      )}
                    >
                      {mode.name}
                    </h2>
                    <span aria-hidden className="eclat h-[3px] w-20" />
                    <span className="max-w-md text-sm leading-relaxed text-chalk-300 sm:text-base">{t(`modeSheet.${mode.slug}.text`)}</span>
                    <span className="mt-1 inline-flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400 transition-transform group-hover:translate-x-0.5">
                      {t("pages.modes.discover")}
                      <ArrowRight size={16} aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <WikiCredit t={t} href="https://mobilelegends.fandom.com/wiki/Game_Modes" />
      </div>
    </>
  );
}

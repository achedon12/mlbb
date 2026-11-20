import type { Metadata } from "next";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { spellSheets, textChoice, usage } from "@/lib/usage-sheets";
import { artOf } from "@/components/sheet-poster";
import motion from "@/components/catalogue-motion.module.css";
import { cn } from "@/lib/utils";
import Image from "next/image";

/**
 * Battle spells index: each one leads to its page (heroes that take it,
 * associated emblems). The page was missing from the menu and from the "mlbb
 * battle spells" search.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.spellsList.metaTitle", { n: spellSheets.length }),
    description: t("pages.spellsList.metaDescription"),
    path: "/spells",
    card: true,
  });
}

export default async function SpellsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  // The spells most taken first: the eye meets Flicker and Retribution before Arrival.
  const list = spellSheets
    .map((s) => ({ s, heroes: usage("spell", s.slug) }))
    .sort((a, b) => b.heroes.length - a.heroes.length);
  return (
    <>
      <PageHeader
        title={t("pages.spellsList.title")}
        lead={t("pages.spellsList.lead", { n: spellSheets.length })}
      />
      <div className="page-wrap py-10 sm:py-14">
        <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 2xl:grid-cols-6", motion.rise)}>
          {list.map(({ s, heroes }, i) => {
            const art = artOf(heroes[0]?.slug);
            const name = textChoice(t, s.slug, "name", s.name)!;
            return (
              <li key={s.slug} className={cn(i === 0 && "col-span-2 row-span-2 sm:col-span-1 sm:row-span-1")}>
                <Link
                  href={`/spells/${s.slug}`}
                  className={cn("bevel-lg group relative isolate flex aspect-[4/5] h-full flex-col overflow-hidden bg-night-900 p-4 sm:p-5", motion.lift, i === 0 && "max-sm:aspect-[5/4]")}
                >
                  {/* The hero who takes the spell the most, in the background. */}
                  {art && (
                    <span aria-hidden className={cn("absolute inset-0 -z-10", motion.art)}>
                      <Image src={art} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover object-[60%_20%] opacity-45" />
                    </span>
                  )}
                  <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-night-950 via-night-950/70 to-night-950/10" />
                  <span aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[3px] bg-gold-400 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="flex items-start justify-between gap-2">
                    <span className={cn("relative size-16 sm:size-20", motion.zoom)}>
                      {s.image ? (
                        <Image src={s.image} alt="" width={80} height={80} className="size-full object-contain drop-shadow-[0_8px_14px_rgb(0_0_0/0.6)]" />
                      ) : (
                        <span className="display-caps grid size-full place-items-center bg-night-800 text-2xl text-chalk-500">{name.charAt(0)}</span>
                      )}
                    </span>
                    {s.cooldown !== null && (
                      <span className="text-right">
                        <span className="sr-only">{t("pages.spellsList.cooldown", { s: s.cooldown })}</span>
                        <span aria-hidden className="score score-outline text-[2.1rem] sm:text-[2.5rem]">
                          {s.cooldown}
                          <span className="text-[0.5em]">s</span>
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="mt-auto">
                    <span className="display-caps block break-words text-[1.75rem] text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-[2.1rem]">
                      {name}
                    </span>
                    {heroes.length > 0 && (
                      <span className="mt-1.5 block text-sm text-chalk-300">{t("pages.sheets.nHeroes", { n: heroes.length })}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

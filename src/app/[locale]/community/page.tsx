import Image from "next/image";
import { ArrowRight, Users } from "lucide-react";
import type { Metadata } from "next";
import { CATEGORY_ART, DiscordAlternative, Rules, SearchForm, ThreadList, Unavailable, ago, count } from "@/components/community/parts";
import Link from "@/components/link";
import { heroArt, heroPortrait, StageHeader } from "@/components/stage";
import { SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { CATEGORIES, type Category } from "@/lib/community/constants";
import { categoryStats, listThreads } from "@/lib/community/store";
import { requestTime } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { cn } from "@/lib/utils";

/**
 * Community hub: the forum's categories with their activity, the latest
 * threads across all of them, the teammate finder. Rendered on each request,
 * indexable: it is the entry point of the section.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.community.seo.title"),
    description: t("pages.community.seo.description"),
    path: "/community",
    keywords: ["forum", "community", "Mobile Legends", "MLBB", "teammates"],
  });
}

/**
 * Where each category sits in the grid of six columns: the general
 * category leads, wide and tall; builds beside it; the three of the game
 * share a row; the site's own feedback closes on a low strip.
 */
const LAYOUT: Record<Category, string> = {
  general: "lg:col-span-4 lg:row-span-2 min-h-60 lg:min-h-[23rem]",
  "heroes-builds": "lg:col-span-2 lg:row-span-2 min-h-60 lg:min-h-[23rem]",
  "ranked-help": "lg:col-span-2 min-h-52",
  esports: "lg:col-span-2 min-h-52",
  guides: "sm:col-span-2 lg:col-span-2 min-h-52",
  "site-feedback": "sm:col-span-2 lg:col-span-6 min-h-36",
};

/** Heroes shown on the teammate finder's door: a squad, one per lane. */
const SQUAD = ["chou", "fanny", "kagura", "layla", "tigreal"];

export default async function CommunityPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const now = await requestTime();
  const data = databaseConfigured()
    ? await Promise.all([categoryStats(), listThreads({ sort: "latest", page: 1 })]).catch(() => null)
    : null;
  const squadArt = heroArt("gusion");

  return (
    <>
      <StageHeader
        title={t("pages.community.title")}
        lead={t("pages.community.lead")}
        art={heroArt("layla")}
        artPosition="62% 22%"
        dex="salut"
        details={{ label: t("pages.community.rules.title"), content: <Rules t={t} /> }}
      >
        <p className="mt-4 hidden max-w-md font-heading text-lg font-semibold leading-snug text-gold-300 lg:block">
          {t("pages.community.hostLine")}
        </p>
        <div className="mt-5">
          <SearchForm t={t} locale={locale} />
        </div>
      </StageHeader>
      <div className="stage-enter page-wrap space-y-14 py-10 sm:space-y-20 sm:py-14">
        {!data ? (
          <Unavailable t={t} />
        ) : (
          <>
            <section aria-labelledby="categories-title">
              <SectionTitle id="categories-title">{t("pages.community.categoriesTitle")}</SectionTitle>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {CATEGORIES.map((c, i) => {
                  const stats = data[0].get(c);
                  const art = heroArt(CATEGORY_ART[c].hero);
                  const strip = c === "site-feedback";
                  return (
                    <li key={c} className={cn("flex", LAYOUT[c])}>
                      <Link
                        href={`/community/${c}`}
                        className="art-tile card-link group flex w-full flex-col justify-end bg-night-800 p-5 sm:p-6"
                      >
                        {art && (
                          <span aria-hidden className="absolute inset-0 -z-10">
                            <Image
                              src={art}
                              alt=""
                              fill
                              priority={i < 2}
                              sizes={i === 0 ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 34vw, (min-width: 640px) 50vw, 100vw"}
                              className="art-tile-img object-cover"
                              style={{ objectPosition: strip ? "50% 30%" : CATEGORY_ART[c].position }}
                            />
                            <span
                              className={cn(
                                "absolute inset-0",
                                strip
                                  ? "bg-linear-to-r from-night-950 via-night-950/85 to-night-950/30"
                                  : "bg-linear-to-t from-night-950 via-night-950/70 to-night-950/5",
                              )}
                            />
                          </span>
                        )}
                        <span
                          className={cn(
                            "display-caps block text-chalk-100 transition-colors group-hover:text-gold-300",
                            i === 0 ? "text-[clamp(2.5rem,1.8rem+2.6vw,4.25rem)]" : "text-[2.15rem] sm:text-[2.4rem]",
                          )}
                        >
                          {t(`pages.community.categories.${c}.name`)}
                        </span>
                        <span className={cn("mt-2 block max-w-md text-sm leading-relaxed text-chalk-300", i === 0 && "sm:text-base")}>
                          {t(`pages.community.categories.${c}.description`)}
                        </span>
                        <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-chalk-400">
                          <span className="bevel-sm bg-night-950/80 px-2 py-1 font-heading text-sm font-bold uppercase text-gold-400">
                            {count(t, locale, "pages.community.threadCount", stats?.threads ?? 0)}
                          </span>
                          {stats?.lastPostAt && <span>{t("pages.community.lastActivity", { when: ago(locale, stats.lastPostAt, now) })}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div aria-hidden className="eclat-rule" />

            <div className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14">
              <section aria-labelledby="latest-title" className="min-w-0">
                <SectionTitle id="latest-title">{t("pages.community.latestTitle")}</SectionTitle>
                <ThreadList threads={data[1].threads.slice(0, 10)} t={t} locale={locale} now={now} showCategory emptyText={t("pages.community.emptyAll")} />
              </section>
              <TeammatesDoor t={t} art={squadArt} />
            </div>
          </>
        )}

        {!data && (
          <div className="grid gap-6 lg:grid-cols-2">
            <TeammatesDoor t={t} art={squadArt} />
          </div>
        )}
        <DiscordAlternative t={t} text={t("pages.community.discordText")} />
      </div>
    </>
  );
}

/** The door to the teammate finder: an artwork, a squad of portraits, one call to action. */
function TeammatesDoor({ t, art }: { t: T; art: string | null }) {
  return (
    <section aria-labelledby="teammates-title" className="min-w-0">
      <div className="art-tile bevel-lg flex min-h-[26rem] flex-col justify-end bg-night-800 p-6 sm:p-8">
        {art && (
          <span aria-hidden className="absolute inset-0 -z-10">
            <Image src={art} alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="art-tile-img object-cover object-[60%_20%]" />
            <span className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/80 to-night-950/10" />
          </span>
        )}
        <ul aria-hidden className="mb-5 flex -space-x-2">
          {SQUAD.map((slug) => {
            const portrait = heroPortrait(slug);
            return (
              <li key={slug} className="bevel-sm relative h-20 w-14 overflow-hidden bg-night-700 shadow-[0_0_0_2px_var(--color-night-950)] sm:h-24 sm:w-16">
                {portrait && <Image src={portrait} alt="" fill sizes="64px" className="object-cover object-top" />}
              </li>
            );
          })}
        </ul>
        <h2 id="teammates-title" className="type-section flex items-center gap-3 text-chalk-100">
          <Users size={30} aria-hidden className="shrink-0 text-gold-400" />
          {t("pages.community.teammatesTitle")}
        </h2>
        <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
        <p className="mt-3 max-w-md text-sm leading-relaxed text-chalk-300 sm:text-base">{t("pages.community.teammatesLead")}</p>
        <Link href="/community/teammates" className="btn btn-primary mt-5 self-start">
          {t("pages.community.teammatesCta")}
          <ArrowRight size={17} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

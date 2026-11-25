import Image from "next/image";
import { ArrowRight, Trophy } from "lucide-react";
import Link from "@/components/link";
import { FreeRotationTeaser } from "@/components/free-rotation-teaser";
import { HeroPortrait } from "@/components/hero-portrait";
import { heroName, monthLabel, monthText } from "@/components/event-month";
import { StatusBadge, tournamentDates } from "@/components/esports-parts";
import { ActionLink, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug, illustrations } from "@/lib/data";
import { proMeta, sortedTournaments, tournamentStatus, type ProHero } from "@/lib/esports";
import type { EventSkin } from "@/lib/events";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { cn } from "@/lib/utils";

/** Tournaments listed: the live or next ones first, then the latest results. */
const TOURNAMENTS = 3;
/** Skins of the month shown beside the StarLight one: three share its height at most. */
const OTHER_SKINS = 3;

/**
 * Wide artwork when the gallery has it, the shop portrait otherwise; the
 * hero's own portrait for a skin whose visual is provisional, never shown
 * on the home page.
 */
function skinArt(s: EventSkin): { src: string; wide: boolean } | null {
  const wide = illustrations[s.hero]?.[s.name];
  if (wide) return { src: wide, wide: true };
  if (s.image && !s.provisional) return { src: s.image, wide: s.image.includes("/illustrations/") };
  const hero = heroesBySlug.get(s.hero);
  return hero?.images.portrait ? { src: hero.images.portrait, wide: false } : null;
}

const skinHref = (s: EventSkin) => (s.anchor ? `/heroes/${s.hero}/skins#${s.anchor}` : `/heroes/${s.hero}/skins`);

/**
 * What is happening in the game right now, side by side: the month's skins
 * (StarLight, Collector and the other releases, then what is announced
 * next) and the esports scene (live and upcoming tournaments, the latest
 * champions, the heroes the pros pick and ban). The week's free heroes sit
 * above them, on one line, and only while the list is current.
 */
export function HomeLive({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  return (
    <section aria-labelledby="home-live" className={className}>
      <SectionTitle id="home-live" lead={t("home.live.lead")}>
        {t("home.live.title")}
      </SectionTitle>
      <FreeRotationTeaser locale={locale} className="mb-6 max-w-md" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <MonthBlock locale={locale} t={t} />
        <EsportsBlock locale={locale} t={t} />
      </div>
    </section>
  );
}

function MonthBlock({ locale, t }: { locale: Locale; t: T }) {
  const current = referenceDate.slice(0, 7);
  const months = eventMonths();
  // The current month, or the latest one with releases when the wiki has not listed it yet.
  const month = months.find((m) => m.month === current) ?? months.find((m) => m.month < current);
  const announced = months.filter((m) => m.month > current).reverse();
  if (!month) return null;

  const lead = month.starlight[0] ?? month.collector[0];
  const others = [...month.starlight, ...month.collector, ...month.others.event, ...month.others.shop, ...month.others.pass]
    .filter((s) => s !== lead)
    .slice(0, OTHER_SKINS);
  const art = lead ? skinArt(lead) : null;
  const next = announced[0];
  const nextSkin = next?.starlight[0] ?? next?.collector[0];

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="type-subtitle text-chalk-100">{t("home.live.skinsOf", { month: monthText(locale, month.month) })}</h3>
        <ActionLink href="/events" className="shrink-0 text-sm">
          {t("home.live.allEvents")}
        </ActionLink>
      </div>

      {/*
        One composition with no hole: the lead skin as the large card and,
        from `sm`, the other releases stacked beside it, sharing its height
        between them (one fills it all, three share it). On a phone they
        follow it as wide bands.
      */}
      {lead && (
        <div className={cn("mt-4 grid gap-3", others.length > 0 && "sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
          <Link
            href={skinHref(lead)}
            className="scheme-dark bevel-lg group relative block aspect-video overflow-hidden bg-night-900 sm:aspect-auto sm:h-full sm:min-h-[20rem]"
          >
            {art && (
              <Image
                src={art.src}
                alt={t("home.live.skinAlt", { skin: lead.name, hero: heroName(lead.hero) })}
                fill
                sizes={others.length > 0 ? "(min-width: 1024px) 30rem, (min-width: 640px) 62vw, 100vw" : "(min-width: 1024px) 45rem, 100vw"}
                className={
                  art.wide
                    ? "object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                    : "object-contain object-right transition-transform duration-500 group-hover:scale-[1.03]"
                }
              />
            )}
            <span className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/30 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
              <span className="block font-heading text-base font-bold uppercase text-gold-400">
                {month.starlight[0] === lead ? t("home.live.starlight") : t("home.live.collector")}
              </span>
              <span className="display-caps mt-1 block pr-[0.12em] text-[clamp(2rem,1.2rem+2.6vw,3.25rem)] text-chalk-100 transition-colors group-hover:text-gold-300">
                {lead.name}
              </span>
              <span className="mt-1 block text-sm text-chalk-300">{heroName(lead.hero)}</span>
            </span>
          </Link>

          {others.length > 0 && (
            <ul className="flex flex-col gap-3">
              {others.map((s) => {
                const src = skinArt(s)?.src ?? null;
                return (
                  <li key={`${s.hero}-${s.name}`} className="flex min-h-24 flex-1 flex-col">
                    <Link href={skinHref(s)} className="scheme-dark bevel group relative block flex-1 overflow-hidden bg-night-900">
                      {src && (
                        <Image
                          src={src}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 15rem, (min-width: 640px) 31vw, 100vw"
                          className="object-cover object-[50%_25%] transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      )}
                      {/* The names sit on the art, over the night closing in from the foot. */}
                      <span className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/50 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 p-3">
                        <span className="block truncate font-heading text-lg font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-300">
                          {s.name}
                        </span>
                        <span className="block truncate text-xs text-chalk-300">{heroName(s.hero)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {next && (
        <Link
          href={`/events/${next.month}`}
          className="card-link group mt-3 flex items-center gap-3 p-2.5"
        >
          <HeroPortrait
            source={nextSkin ? (heroesBySlug.get(nextSkin.hero)?.images.icon ?? null) : null}
            name={nextSkin ? heroName(nextSkin.hero) : monthLabel(locale, next.month)}
            size="icon"
            decorative
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-chalk-500">
              {t("home.live.announced", { month: monthText(locale, next.month) })}
            </span>
            <span className="block truncate font-semibold text-chalk-100 transition-colors group-hover:text-gold-400">
              {nextSkin
                ? t("pages.events.skinOf", { skin: nextSkin.name, hero: heroName(nextSkin.hero) })
                : t("home.live.announcedCount", { n: next.total })}
            </span>
          </span>
          <ArrowRight size={16} aria-hidden className="shrink-0 text-gold-400" />
        </Link>
      )}
    </div>
  );
}

function EsportsBlock({ locale, t }: { locale: Locale; t: T }) {
  const now = new Date();
  const list = sortedTournaments(now).slice(0, TOURNAMENTS);
  const meta = proMeta(now, 4);
  if (list.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="type-subtitle text-chalk-100">{t("home.live.esports")}</h3>
        <ActionLink href="/esports" className="shrink-0 text-sm">
          {t("home.live.allEsports")}
        </ActionLink>
      </div>
      <ul className="mt-3 space-y-2">
        {list.map((x) => (
          <li key={x.slug}>
            <Link
              href={`/esports/${x.slug}`}
              className="card-link group flex items-start justify-between gap-3 p-3 sm:p-4"
            >
              <span className="min-w-0">
                <span className="block font-heading text-lg font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-400 sm:text-xl">
                  {x.name}
                </span>
                <span className="mt-0.5 block text-sm text-chalk-400">{tournamentDates(t, locale, x)}</span>
                {x.champion && (
                  <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gold-400">
                    <Trophy size={14} aria-hidden />
                    {t("pages.esports.card.champion", { team: x.champion })}
                  </span>
                )}
              </span>
              <StatusBadge status={tournamentStatus(x, now)} t={t} />
            </Link>
          </li>
        ))}
      </ul>

      {meta.games > 0 && (
        <div className="card mt-3 grid grid-cols-2 gap-4 p-3 sm:p-4">
          <ProList title={t("home.live.proPicked")} heroes={meta.picked} />
          <ProList title={t("home.live.proBanned")} heroes={meta.banned} />
          <p className="col-span-2 text-xs text-chalk-500">{t("home.live.proNote", { games: meta.games })}</p>
        </div>
      )}
    </div>
  );
}

function ProList({ title, heroes }: { title: string; heroes: ProHero[] }) {
  return (
    <div className="min-w-0">
      <h4 className="font-heading font-bold uppercase text-chalk-300">{title}</h4>
      <ul className="mt-2 flex gap-1.5">
        {heroes.map((h) => {
          const hero = heroesBySlug.get(h.slug);
          if (!hero) return null;
          return (
            <li key={h.slug}>
              <Link href={`/heroes/${h.slug}`} title={hero.name} className="flex transition-transform hover:-translate-y-0.5">
                <HeroPortrait source={hero.images.icon ?? hero.images.portrait} name={hero.name} size="small" className="sm:size-10" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

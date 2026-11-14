import Image from "next/image";
import { ArrowRight, Trophy } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { heroName, monthLabel, monthText } from "@/components/event-month";
import { StatusBadge, tournamentDates } from "@/components/esports-parts";
import { SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug, illustrations } from "@/lib/data";
import { proMeta, sortedTournaments, tournamentStatus, type ProHero } from "@/lib/esports";
import type { EventSkin } from "@/lib/events";
import { eventMonths, referenceDate } from "@/lib/events-server";

/** Tournaments listed: the live or next ones first, then the latest results. */
const TOURNAMENTS = 3;
/** Skins of the month shown besides the StarLight one. */
const OTHER_SKINS = 4;

/** Wide artwork when the gallery has it, the shop portrait otherwise. */
function skinArt(s: EventSkin): { src: string; wide: boolean } | null {
  const wide = illustrations[s.hero]?.[s.name];
  if (wide) return { src: wide, wide: true };
  if (s.image) return { src: s.image, wide: s.image.includes("/illustrations/") };
  const hero = heroesBySlug.get(s.hero);
  return hero?.images.portrait ? { src: hero.images.portrait, wide: false } : null;
}

const skinHref = (s: EventSkin) => (s.anchor ? `/heroes/${s.hero}/skins#${s.anchor}` : `/heroes/${s.hero}/skins`);

/**
 * What is happening in the game right now, side by side: the month's skins
 * (StarLight, Collector and the other releases, then what is announced
 * next) and the esports scene (live and upcoming tournaments, the latest
 * champions, the heroes the pros pick and ban).
 */
export function HomeLive({ locale }: { locale: Locale }) {
  const t = createT(locale);
  return (
    <section aria-labelledby="home-live" className="mx-auto max-w-6xl px-4 py-8 sm:py-16">
      <SectionTitle id="home-live" lead={t("home.live.lead")}>
        {t("home.live.title")}
      </SectionTitle>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
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
      <h3 className="flex items-baseline justify-between gap-3 font-heading text-lg font-bold text-chalk-100">
        {t("home.live.skinsOf", { month: monthText(locale, month.month) })}
        <Link href="/events" className="shrink-0 text-sm font-semibold text-gold-400 hover:text-gold-500">
          {t("home.live.allEvents")}
        </Link>
      </h3>

      {lead && (
        <Link
          href={skinHref(lead)}
          className="bevel group relative mt-3 block aspect-video overflow-hidden border border-night-700/70 bg-night-900"
        >
          {art && (
            <Image
              src={art.src}
              alt={t("home.live.skinAlt", { skin: lead.name, hero: heroName(lead.hero) })}
              fill
              sizes="(min-width: 1024px) 34rem, 100vw"
              className={
                art.wide
                  ? "object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  : "object-contain object-right transition-transform duration-500 group-hover:scale-[1.03]"
              }
            />
          )}
          <span className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/20 to-transparent" />
          <span className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
            <span className="block text-xs font-semibold text-gold-400">
              {month.starlight[0] === lead ? t("home.live.starlight") : t("home.live.collector")}
            </span>
            <span className="block font-heading text-xl font-bold leading-tight text-chalk-100 sm:text-2xl">
              {lead.name}
            </span>
            <span className="block text-sm text-chalk-300">{heroName(lead.hero)}</span>
          </span>
        </Link>
      )}

      {others.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {others.map((s) => {
            const portrait = s.image && !s.image.includes("/illustrations/") ? s.image : skinArt(s)?.src ?? null;
            return (
              <li key={`${s.hero}-${s.name}`}>
                <Link href={skinHref(s)} className="group block">
                  <span className="bevel-sm relative block aspect-[240/390] overflow-hidden border border-night-700/70 bg-night-900">
                    {portrait && (
                      <Image
                        src={portrait}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 8rem, 22vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold text-chalk-200 transition-colors group-hover:text-gold-400">
                    {s.name}
                  </span>
                  <span className="block truncate text-xs text-chalk-500">{heroName(s.hero)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {next && (
        <Link
          href={`/events/${next.month}`}
          className="bevel-sm group mt-3 flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2.5 transition-colors hover:border-gold-500/60"
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
      <h3 className="flex items-baseline justify-between gap-3 font-heading text-lg font-bold text-chalk-100">
        {t("home.live.esports")}
        <Link href="/esports" className="shrink-0 text-sm font-semibold text-gold-400 hover:text-gold-500">
          {t("home.live.allEsports")}
        </Link>
      </h3>
      <ul className="mt-3 space-y-2">
        {list.map((x) => (
          <li key={x.slug}>
            <Link
              href={`/esports/${x.slug}`}
              className="bevel group flex items-start justify-between gap-3 border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60 sm:p-4"
            >
              <span className="min-w-0">
                <span className="block font-heading font-bold leading-tight text-chalk-100 transition-colors group-hover:text-gold-400 sm:text-lg">
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
        <div className="bevel mt-3 grid grid-cols-2 gap-4 border border-night-700/70 bg-night-900/60 p-3 sm:p-4">
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
      <h4 className="text-sm font-semibold text-chalk-300">{title}</h4>
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

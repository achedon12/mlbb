import Image from "next/image";
import { Trophy } from "lucide-react";
import Link from "@/components/link";
import { Face } from "@/components/home/face";
import { heroName, monthLabel, monthText } from "@/components/event-month";
import { tournamentDates } from "@/components/esports-parts";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug, illustrations } from "@/lib/data";
import { proMeta, sortedTournaments, tournamentStatus, type ProHero } from "@/lib/esports";
import type { EventSkin } from "@/lib/events";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { currentFreeRotation, PATH_FREE_ROTATION } from "@/lib/free-rotation-server";
import { cn } from "@/lib/utils";

/** Tournaments listed: the live or next ones first, then the latest results. */
const TOURNAMENTS = 3;
/** Other releases of the month named under the poster. */
const OTHER_SKINS = 4;
/** Free heroes shown as faces; the rest is a count. */
const FREE_SHOWN = 6;

const STATUS_COLOR = { live: "text-blood-400", upcoming: "text-azure-400", finished: "text-chalk-500" } as const;

/**
 * The skin's art: the wide official artwork when the gallery has it, drawn
 * edge to edge; the shop portrait otherwise (never a provisional visual).
 */
function skinArt(s: EventSkin): { src: string; wide: boolean } | null {
  const wide = illustrations[s.hero]?.[s.name];
  if (wide) return { src: wide, wide: true };
  if (s.image && !s.provisional) return { src: s.image, wide: s.image.includes("/illustrations/") };
  return null;
}

const skinHref = (s: EventSkin) => (s.anchor ? `/heroes/${s.hero}/skins#${s.anchor}` : `/heroes/${s.hero}/skins`);

/**
 * What is happening in the game this month. First a poster across the whole
 * screen: the month's StarLight skin (or its Collector one), its name set
 * over the art. A wide artwork fills the band; a shop portrait stands at
 * the right over a blurred, darkened copy of itself, so a narrow image
 * still holds a full-width frame. Under the poster, two typographic lists:
 * the month's other releases with what is announced next and the week's
 * free heroes, and the esports scene (live and upcoming tournaments, the
 * latest champions, the heroes the pros pick and ban).
 */
export function HomeLive({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const current = referenceDate.slice(0, 7);
  const months = eventMonths();
  // The current month, or the latest one with releases when the wiki has not listed it yet.
  const month = months.find((m) => m.month === current) ?? months.find((m) => m.month < current);
  const lead = month ? (month.starlight[0] ?? month.collector[0]) : undefined;
  const art = lead ? skinArt(lead) : null;

  return (
    <section aria-labelledby="home-live" className={className}>
      {lead && month ? (
        <Link href={skinHref(lead)} className="scheme-dark group relative isolate block overflow-hidden bg-night-950">
          {art && (
            <div aria-hidden className="absolute inset-0 -z-10">
              {art.wide ? (
                <Image
                  src={art.src}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover object-[60%_25%] transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <>
                  <Image src={art.src} alt="" fill sizes="(min-width: 1024px) 18rem, 50vw" className="scale-110 object-cover opacity-45 blur-2xl" />
                  <div className="absolute inset-y-0 right-[calc(max(0px,(100vw-100rem)/2)+clamp(1rem,0.4rem+2.4vw,3rem))] w-[min(46vw,20rem)] sm:w-[min(40vw,22rem)]">
                    <Image
                      src={art.src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 18rem, 50vw"
                      className="object-cover object-top transition-transform duration-500 [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] group-hover:scale-[1.02]"
                    />
                  </div>
                </>
              )}
              <div className="absolute inset-0 bg-linear-to-r from-night-950 via-night-950/70 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-night-950 to-transparent" />
            </div>
          )}
          <div className="page-wrap flex min-h-[28rem] flex-col justify-end py-14 sm:min-h-[36rem] lg:min-h-[clamp(36rem,80svh,48rem)] lg:py-20">
            <h2 id="home-live" className="max-w-[min(100%,40rem)] text-chalk-100 max-sm:pr-[38vw]">
              <span className="block font-heading text-lg font-bold uppercase text-gold-400 sm:text-xl">
                {month.starlight[0] === lead
                  ? t("home.rail.starlight", { month: monthText(locale, month.month) })
                  : t("home.live.collector")}
              </span>
              <span className="display-caps mt-2 block break-words pr-[0.1em] text-[clamp(3rem,1rem+7vw,8rem)] leading-[0.84] transition-colors group-hover:text-gold-300">
                {lead.name}
              </span>
            </h2>
            <p className="mt-4 text-lg text-chalk-200">{heroName(lead.hero)}</p>
            {art && <span className="sr-only">{t("home.live.skinAlt", { skin: lead.name, hero: heroName(lead.hero) })}</span>}
          </div>
        </Link>
      ) : (
        <div className="page-wrap pt-20">
          <h2 id="home-live" className="type-section text-chalk-100">
            {t("home.live.title")}
          </h2>
        </div>
      )}

      <div className="page-wrap grid gap-x-16 gap-y-14 py-16 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <MonthList locale={locale} t={t} lead={lead} />
        <EsportsList locale={locale} t={t} />
      </div>
    </section>
  );
}

function MonthList({ locale, t, lead }: { locale: Locale; t: T; lead: EventSkin | undefined }) {
  const current = referenceDate.slice(0, 7);
  const months = eventMonths();
  const month = months.find((m) => m.month === current) ?? months.find((m) => m.month < current);
  const next = months.filter((m) => m.month > current).reverse()[0];
  const nextSkin = next?.starlight[0] ?? next?.collector[0];
  const rotation = currentFreeRotation();
  const free = rotation.state === "current" ? rotation.heroes.flatMap((slug) => heroesBySlug.get(slug) ?? []) : [];
  const others = month
    ? [...month.starlight, ...month.collector, ...month.others.event, ...month.others.shop, ...month.others.pass]
        .filter((s) => s !== lead)
        .slice(0, OTHER_SKINS)
    : [];

  return (
    <div className="min-w-0">
      {month && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-night-800 pb-2">
            <h3 className="font-heading text-xl font-bold uppercase text-chalk-100">
              {t("home.live.skinsOf", { month: monthText(locale, month.month) })}
            </h3>
            <Link href="/events" className="text-sm font-semibold text-gold-400 hover:text-gold-300">
              {t("home.live.allEvents")}
            </Link>
          </div>
          <ul>
            {others.map((s) => (
              <li key={`${s.hero}-${s.name}`} className="border-b border-night-800">
                <Link href={skinHref(s)} className="group flex min-h-12 items-baseline justify-between gap-4 py-3">
                  <span className="font-heading text-lg font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
                    {s.name}
                  </span>
                  <span className="shrink-0 text-sm text-chalk-400">{heroName(s.hero)}</span>
                </Link>
              </li>
            ))}
            {next && (
              <li className="border-b border-night-800">
                <Link href={`/events/${next.month}`} className="group block py-3">
                  <span className="block text-sm text-chalk-500">{t("home.live.announced", { month: monthText(locale, next.month) })}</span>
                  <span className="block font-semibold text-chalk-100 transition-colors group-hover:text-gold-300">
                    {nextSkin
                      ? t("pages.events.skinOf", { skin: nextSkin.name, hero: heroName(nextSkin.hero) })
                      : monthLabel(locale, next.month)}
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </>
      )}
      {free.length > 0 && (
        <Link href={PATH_FREE_ROTATION} className="group mt-8 block">
          <span className="block font-heading text-lg font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
            {t("pages.freeRotation.teaser", { n: free.length })}
          </span>
          <span aria-hidden className="mt-3 flex items-center gap-2">
            {free.slice(0, FREE_SHOWN).map((h) => (
              <Face key={h.slug} source={h.images.icon ?? h.images.portrait} name={h.name} size="md" />
            ))}
            {free.length > FREE_SHOWN && <span className="pl-1 font-heading font-bold text-gold-400">+{free.length - FREE_SHOWN}</span>}
          </span>
        </Link>
      )}
    </div>
  );
}

function EsportsList({ locale, t }: { locale: Locale; t: T }) {
  const now = new Date();
  const list = sortedTournaments(now).slice(0, TOURNAMENTS);
  const meta = proMeta(now, 5);
  if (list.length === 0) return null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-night-800 pb-2">
        <h3 className="font-heading text-xl font-bold uppercase text-chalk-100">{t("home.live.esports")}</h3>
        <Link href="/esports" className="text-sm font-semibold text-gold-400 hover:text-gold-300">
          {t("home.live.allEsports")}
        </Link>
      </div>
      <ul>
        {list.map((x) => {
          const status = tournamentStatus(x, now);
          return (
            <li key={x.slug} className="border-b border-night-800">
              <Link href={`/esports/${x.slug}`} className="group grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
                <span className="min-w-0">
                  <span className="block font-heading text-2xl font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-300">
                    {x.name}
                  </span>
                  {x.champion && (
                    <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gold-400">
                      <Trophy size={14} aria-hidden />
                      {t("pages.esports.card.champion", { team: x.champion })}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-3 text-sm sm:justify-end">
                  <span className={cn("font-semibold", STATUS_COLOR[status])}>{t(`pages.esports.status.${status}`)}</span>
                  <span className="text-chalk-400">{tournamentDates(t, locale, x)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {meta.games > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <ProLine title={t("home.live.proPicked")} heroes={meta.picked} />
          <ProLine title={t("home.live.proBanned")} heroes={meta.banned} />
          <p className="text-xs text-chalk-500 sm:col-span-2">{t("home.live.proNote", { games: meta.games })}</p>
        </div>
      )}
    </div>
  );
}

function ProLine({ title, heroes }: { title: string; heroes: ProHero[] }) {
  return (
    <div className="min-w-0">
      <h4 className="font-heading font-bold uppercase text-chalk-300">{title}</h4>
      <ul className="mt-2 flex gap-2">
        {heroes.map((h) => {
          const hero = heroesBySlug.get(h.slug);
          if (!hero) return null;
          return (
            <li key={h.slug}>
              <Link href={`/heroes/${h.slug}`} title={hero.name} className="flex transition-transform hover:-translate-y-0.5">
                <Face source={hero.images.icon ?? hero.images.portrait} name={hero.name} size="md" />
                <span className="sr-only">{hero.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

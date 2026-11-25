import Image from "next/image";
import Link from "@/components/link";
import { heroName, monthText } from "@/components/event-month";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { illustrations } from "@/lib/data";
import type { EventSkin } from "@/lib/events";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { cn } from "@/lib/utils";

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
 * The month in the game, as one poster across the whole screen: the month's
 * StarLight skin (or its Collector one), its name set over the art like a
 * season page, and two calls to action — the skin and the month's events.
 * A wide artwork fills the frame; a shop portrait stands at the right over
 * a blurred, darkened copy of itself, so a narrow image still holds a full
 * frame. Always dark: words over art.
 */
export function HomeLive({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const current = referenceDate.slice(0, 7);
  const months = eventMonths();
  // The current month, or the latest one with releases when the wiki has not listed it yet.
  const month = months.find((m) => m.month === current) ?? months.find((m) => m.month < current);
  const lead = month ? (month.starlight[0] ?? month.collector[0]) : undefined;
  if (!month || !lead) return null;
  const art = skinArt(lead);

  return (
    <section aria-labelledby="home-live" className={cn("scheme-dark relative isolate overflow-hidden bg-night-950", className)}>
      {art && (
        <div aria-hidden className="absolute inset-0 -z-10">
          {art.wide ? (
            <Image src={art.src} alt="" fill sizes="100vw" className="object-cover object-[62%_25%]" />
          ) : (
            <>
              <Image src={art.src} alt="" fill sizes="(min-width: 1024px) 22rem, 50vw" className="scale-110 object-cover opacity-50 blur-2xl" />
              <div className="absolute inset-y-0 right-[calc(max(0px,(100vw-100rem)/2)+clamp(1rem,0.4rem+2.4vw,3rem))] w-[min(46vw,24rem)]">
                <Image
                  src={art.src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 22rem, 50vw"
                  className="object-cover object-top [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]"
                />
              </div>
            </>
          )}
          <div className="absolute inset-y-0 left-0 w-full bg-linear-to-r from-night-950/85 via-night-950/35 to-transparent lg:w-[60%]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-night-950/90 to-transparent" />
        </div>
      )}
      <div className="page-wrap flex min-h-[34rem] flex-col justify-end py-14 sm:min-h-[40rem] lg:min-h-[clamp(40rem,92svh,58rem)] lg:py-20">
        <h2 id="home-live" className={cn("max-w-[min(100%,48rem)] text-chalk-100", art && !art.wide && "max-sm:pr-[40vw]")}>
          <span className="block font-heading text-lg font-bold uppercase text-gold-300 sm:text-2xl">
            {month.starlight[0] === lead
              ? t("home.rail.starlight", { month: monthText(locale, month.month) })
              : t("home.live.collector")}
          </span>{" "}
          <span className="display-caps mt-2 block break-words pr-[0.1em] text-[clamp(3.25rem,0.8rem+8.5vw,10rem)] leading-[0.82] [text-shadow:0_2px_30px_rgb(6_8_15_/_0.5)]">
            {lead.name}
          </span>
        </h2>
        <p className="mt-4 text-lg text-chalk-200 sm:text-xl">{t("home.live.skinOfHero", { hero: heroName(lead.hero) })}</p>
        {art && <span className="sr-only">{t("home.live.skinAlt", { skin: lead.name, hero: heroName(lead.hero) })}</span>}
        <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href={skinHref(lead)} className="btn btn-primary px-7">
            {t("home.live.seeSkin")}
          </Link>
          <Link href="/events" className="inline-flex min-h-11 items-center font-semibold text-chalk-100 underline decoration-1 underline-offset-4 hover:text-gold-300">
            {t("home.live.allEvents")}
          </Link>
        </p>
      </div>
    </section>
  );
}

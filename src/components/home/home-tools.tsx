import { ArrowRight, CalendarCheck } from "lucide-react";
import Link from "@/components/link";
import { SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { BASE, type Entry } from "@/lib/sections";

/** The tools a draft is prepared with: given room to say what they do. */
const MAIN = ["/draft", "/tools/matchups", "/tools/build", "/tools/damage-calculator"];
/** Daily games: a reason to come back every day, grouped apart. */
const DAILY = ["/mlbbdle", "/quiz"];
/** Pages of the tools family that have their own block on the home page. */
const ELSEWHERE = ["/builds", "/bot"];

/**
 * Tools, taken from the menu: a tool added to the sections appears here with
 * no other change. The four draft tools get a card with their description,
 * the two daily games their own panel, every other tool a compact link.
 */
const TOOLS = BASE.filter(
  (e) => (e.href.startsWith("/tools/") || ["/draft", "/compare", "/quiz", "/mlbbdle"].includes(e.href)) && !ELSEWHERE.includes(e.href),
);

export function HomeTools({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const pick = (hrefs: string[]) => hrefs.flatMap((h) => TOOLS.filter((e) => e.href === h));
  const main = pick(MAIN);
  const daily = pick(DAILY);
  const rest = TOOLS.filter((e) => !MAIN.includes(e.href) && !DAILY.includes(e.href));

  return (
    <section aria-labelledby="home-tools" className="border-y border-night-700/70 bg-night-900/30">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-16">
        <SectionTitle id="home-tools" lead={t("home.toolsLead")}>
          {t("home.toolsTitle")}
        </SectionTitle>

        <div className="grid gap-3 lg:grid-cols-[2fr_1fr] lg:gap-4">
          <ul className="grid grid-cols-2 gap-2 sm:gap-3">
            {main.map((e) => (
              <li key={e.href}>
                <ToolCard entry={e} label={t(`nav.${e.key}.label`)} desc={t(`nav.${e.key}.desc`)} />
              </li>
            ))}
          </ul>

          {daily.length > 0 && (
            <div className="bevel border border-gold-500/40 bg-linear-to-b from-gold-500/10 to-transparent p-4">
              <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-chalk-100">
                <CalendarCheck size={18} aria-hidden className="text-gold-400" />
                {t("home.daily.title")}
              </h3>
              <p className="mt-1 text-sm text-chalk-400">{t("home.daily.lead")}</p>
              <ul className="mt-3 space-y-2">
                {daily.map(({ href, key, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="bevel-sm group flex items-center gap-3 border border-night-700/70 bg-night-950/60 p-3 transition-colors hover:border-gold-500/60"
                    >
                      <Icon size={20} aria-hidden className="shrink-0 text-gold-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                          {t(`nav.${key}.label`)}
                        </span>
                        <span className="block text-xs text-chalk-500">{t(`nav.${key}.desc`)}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-gold-400">{t("home.daily.play")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {rest.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
            {rest.map(({ href, key, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex items-center gap-2 py-1.5 text-sm text-chalk-300">
                  <Icon size={15} aria-hidden className="shrink-0 text-gold-400/80" />
                  <span className="truncate underline-offset-4 transition-colors group-hover:text-gold-400 group-hover:underline">
                    {t(`nav.${key}.label`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ToolCard({ entry: { href, icon: Icon }, label, desc }: { entry: Entry; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="bevel group flex h-full flex-col items-start gap-2 border border-night-700/70 bg-night-900/60 p-3 sm:flex-row sm:gap-3 transition-[border-color,translate] hover:-translate-y-0.5 hover:border-gold-500/60 sm:p-4"
    >
      <span className="bevel-sm grid size-10 shrink-0 place-items-center bg-gold-500/15 text-gold-400">
        <Icon size={20} aria-hidden />
      </span>
      <span className="min-w-0 w-full flex-1">
        <span className="block font-heading text-base font-bold text-chalk-100 transition-colors group-hover:text-gold-400 sm:text-lg">
          {label}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-chalk-500 sm:line-clamp-none sm:text-sm">{desc}</span>
      </span>
      <ArrowRight size={16} aria-hidden className="mt-1 hidden shrink-0 text-chalk-600 transition-colors group-hover:text-gold-400 sm:block" />
    </Link>
  );
}

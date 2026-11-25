import { ArrowRight } from "lucide-react";
import Link from "@/components/link";
import { SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { BASE, type Entry } from "@/lib/sections";

/** The tools a draft is prepared with: given room to say what they do. */
const MAIN = ["/draft", "/tools/matchups", "/tools/build", "/tools/damage-calculator"];
/** Pages of the tools family that have their own block on the home page (the daily games, the builds, the bot). */
const ELSEWHERE = ["/mlbbdle", "/quiz", "/builds", "/bot"];

/**
 * Tools, taken from the menu: a tool added to the sections appears here with
 * no other change. The four draft tools get a card with their description,
 * every other tool a compact link; the two daily games have their own block
 * (`HomeDaily`).
 */
const TOOLS = BASE.filter(
  (e) => (e.href.startsWith("/tools/") || ["/draft", "/compare", "/quiz", "/mlbbdle"].includes(e.href)) && !ELSEWHERE.includes(e.href),
);

export function HomeTools({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const pick = (hrefs: string[]) => hrefs.flatMap((h) => TOOLS.filter((e) => e.href === h));
  const main = pick(MAIN);
  const rest = TOOLS.filter((e) => !MAIN.includes(e.href));

  return (
    <section aria-labelledby="home-tools" className={className}>
      <div>
        <SectionTitle id="home-tools" lead={t("home.toolsLead")}>
          {t("home.toolsTitle")}
        </SectionTitle>

        <ul className="grid grid-cols-2 gap-2 sm:gap-3">
          {main.map((e) => (
            <li key={e.href}>
              <ToolCard entry={e} label={t(`nav.${e.key}.label`)} desc={t(`nav.${e.key}.desc`)} />
            </li>
          ))}
        </ul>

        {rest.length > 0 && (
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
            {rest.map(({ href, key, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex min-h-11 items-center gap-2 py-1.5 text-sm text-chalk-300">
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
      className="card-link eclat-under group flex h-full flex-col items-start gap-2 p-3 sm:flex-row sm:gap-3 sm:p-4"
    >
      <span className="bevel-sm grid size-10 shrink-0 place-items-center bg-gold-400 text-night-950">
        <Icon size={20} aria-hidden />
      </span>
      <span className="min-w-0 w-full flex-1">
        <span className="block font-heading text-lg font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-400 sm:text-xl">
          {label}
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-snug text-chalk-400 sm:line-clamp-none sm:text-sm">{desc}</span>
      </span>
      <ArrowRight size={16} aria-hidden className="mt-1 hidden shrink-0 text-chalk-600 transition-colors group-hover:text-gold-400 sm:block" />
    </Link>
  );
}

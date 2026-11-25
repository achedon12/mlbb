import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { BASE } from "@/lib/sections";

/** The tools a draft is prepared with: given room to say what they do. */
const MAIN = ["/draft", "/tools/matchups", "/tools/build", "/tools/damage-calculator"];
/** Pages of the tools family that have their own block on the home page (the daily games, the builds, the bot). */
const ELSEWHERE = ["/mlbbdle", "/quiz", "/builds", "/bot"];

/**
 * Tools, taken from the menu: a tool added to the sections appears here with
 * no other change. The two daily games have their own block (`HomeDaily`).
 */
const TOOLS = BASE.filter(
  (e) => (e.href.startsWith("/tools/") || ["/draft", "/compare", "/quiz", "/mlbbdle"].includes(e.href)) && !ELSEWHERE.includes(e.href),
);

/**
 * « Préparer sa partie »: the title at the left, then the tools as a
 * typographic list in columns — the four draft tools by name and one line,
 * the others by name only. No pictograms: the names say it. The six roles
 * follow (`roles`, from the page), as a row of the game's own role emblems.
 */
export function HomeTools({ locale, className, roles }: { locale: Locale; className?: string; roles?: React.ReactNode }) {
  const t = createT(locale);
  const pick = (hrefs: string[]) => hrefs.flatMap((h) => TOOLS.filter((e) => e.href === h));
  const main = pick(MAIN);
  const rest = TOOLS.filter((e) => !MAIN.includes(e.href));

  return (
    <section aria-labelledby="home-tools" className={className}>
      <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <h2 id="home-tools" className="display-caps text-[clamp(2.6rem,1.6rem+3vw,4.5rem)] leading-[0.88] text-chalk-100">
            {t("home.toolsTitle")}
          </h2>
          <p className="mt-4 max-w-xs text-chalk-300">{t("home.toolsLead")}</p>
        </div>

        <div className="min-w-0">
          <ul className="grid gap-x-10 border-t border-night-800 sm:grid-cols-2">
            {main.map((e) => (
              <li key={e.href} className="border-b border-night-800">
                <Link href={e.href} className="group block py-4">
                  <span className="block font-heading text-2xl font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-300">
                    {t(`nav.${e.key}.label`)}
                  </span>
                  <span className="mt-1 block text-sm text-chalk-400">{t(`nav.${e.key}.desc`)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {rest.length > 0 && (
            <ul className="mt-6 grid grid-cols-2 gap-x-10 sm:grid-cols-3">
              {rest.map(({ href, key }) => (
                <li key={href} className="min-w-0">
                  <Link
                    href={href}
                    className="inline-flex min-h-11 items-center font-semibold text-chalk-200 underline decoration-night-600 decoration-1 underline-offset-4 transition-colors hover:text-gold-300 hover:decoration-current"
                  >
                    {t(`nav.${key}.label`)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {roles}
    </section>
  );
}

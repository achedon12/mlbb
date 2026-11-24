import { ArrowBigUp, Lock, MessageSquare, Pin, Search } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { DexNote } from "@/components/stage";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { threadPath, type Category } from "@/lib/community/constants";
import type { ThreadSummary } from "@/lib/community/store";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { plural } from "@/lib/player-format";
import { DiscordInvite } from "@/components/discord-invite";
import { cn } from "@/lib/utils";

/**
 * Server parts of the community pages: thread rows, hero tags, dates, the
 * Discord link, the empty and unavailable states hosted by Dex. No script:
 * these render as HTML only.
 */

/**
 * The artwork of each forum category: a hero whose official art says what
 * the category is about (the tank who welcomes, the duelist of builds, the
 * climber of ranked…), and where in the frame the face sits.
 */
export const CATEGORY_ART: Record<Category, { hero: string; position: string }> = {
  general: { hero: "tigreal", position: "50% 22%" },
  "heroes-builds": { hero: "alucard", position: "50% 20%" },
  "ranked-help": { hero: "lancelot", position: "55% 20%" },
  esports: { hero: "ling", position: "50% 18%" },
  guides: { hero: "kagura", position: "50% 20%" },
  "site-feedback": { hero: "harith", position: "50% 25%" },
};

/** "3 hours ago", in the page's language, from the request time. */
export function ago(locale: Locale, date: Date, now: number): string {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(LOCALE_INTL[locale], { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return format.format(Math.trunc(seconds / size), unit);
  }
  return format.format(0, "minute");
}

export const isoDate = (date: Date) => date.toISOString();

/** A count with the language's plural form: `count(t, locale, "pages.community.replies", 3)`. */
export function count(t: T, locale: Locale, key: string, n: number, variables: Record<string, string | number> = {}): string {
  return t(`${key}.${plural(n, locale)}`, { n, ...variables });
}

/** The roster for the pickers: slug and name, alphabetical. */
export function heroOptions(): { slug: string; name: string }[] {
  return allHeroes.map((h) => ({ slug: h.slug, name: h.name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Hero tags of a thread, each a link to the hero's page. */
export function HeroTags({ slugs, size = "mini" }: { slugs: string[]; size?: "mini" | "micro" }) {
  const heroes = slugs.flatMap((s) => heroesBySlug.get(s) ?? []);
  if (heroes.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {heroes.map((h) => (
        <li key={h.slug}>
          <Link
            href={`/heroes/${h.slug}`}
            className="bevel-sm inline-flex min-h-8 items-center gap-1.5 bg-night-800 py-0.5 pl-0.5 pr-2.5 font-heading text-sm font-semibold text-chalk-200 transition-colors hover:bg-night-700 hover:text-gold-300"
          >
            <HeroPortrait source={h.images.icon} name={h.name} size={size} decorative />
            {h.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Threads as rows: the score in the display face on the left (gold once a
 * thread has votes), the title in the condensed face, the heroes it is
 * about as small portraits, the replies on the right. Each row lifts on
 * hover; the title is the row's one link, so the list reads in order.
 */
export function ThreadList({
  threads,
  t,
  locale,
  now,
  showCategory = false,
  emptyText,
}: {
  threads: ThreadSummary[];
  t: T;
  locale: Locale;
  now: number;
  showCategory?: boolean;
  emptyText: string;
}) {
  if (threads.length === 0) {
    return (
      <DexNote pose="dodo" height={120} title={t("pages.community.emptyDex")}>
        {emptyText}
      </DexNote>
    );
  }
  const number = new Intl.NumberFormat(LOCALE_INTL[locale]);
  return (
    <ul className="space-y-2">
      {threads.map((th) => {
        const heroes = th.heroes.flatMap((s) => heroesBySlug.get(s) ?? []);
        return (
          <li
            key={th.id}
            className={cn(
              "bevel group relative flex gap-3 bg-night-900 p-3 transition-[translate,background-color] duration-200 hover:-translate-y-0.5 hover:bg-night-850 sm:gap-4 sm:p-4",
              th.pinned && "shadow-[inset_3px_0_0_var(--color-gold-400)]",
            )}
          >
            <div className="flex w-11 shrink-0 flex-col items-center pt-0.5" title={count(t, locale, "pages.communityUI.votes", th.score)}>
              <ArrowBigUp size={18} aria-hidden className={th.score > 0 ? "text-gold-400" : "text-chalk-600"} />
              <span aria-hidden className={cn("score mt-0.5 text-[1.65rem]", th.score > 0 ? "" : "text-chalk-500")}>
                {number.format(th.score)}
              </span>
              <span className="sr-only">{count(t, locale, "pages.communityUI.votes", th.score)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-start gap-1.5">
                {th.pinned && <Pin size={15} className="mt-1 shrink-0 text-gold-400" aria-label={t("pages.community.pinned")} />}
                {th.locked && <Lock size={15} className="mt-1 shrink-0 text-chalk-500" aria-label={t("pages.community.locked")} />}
                <Link
                  href={threadPath(th)}
                  className="min-w-0 break-words font-heading text-lg font-bold leading-tight text-chalk-100 transition-colors hover:text-gold-300 sm:text-xl"
                >
                  {th.title}
                </Link>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-chalk-500">
                {showCategory && (
                  <>
                    <Link href={`/community/${th.category}`} className="font-semibold text-gold-400 hover:text-gold-300">
                      {t(`pages.community.categories.${th.category}.name`)}
                    </Link>
                    <span aria-hidden>·</span>
                  </>
                )}
                <span className="text-chalk-300">{th.authorName}</span>
                <span aria-hidden>·</span>
                <time dateTime={isoDate(th.lastPostAt)}>{ago(locale, th.lastPostAt, now)}</time>
                {heroes.length > 0 && (
                  <span className="flex items-center gap-1 pl-1">
                    {heroes.slice(0, 5).map((h) => (
                      <HeroPortrait key={h.slug} source={h.images.icon} name={h.name} size="micro" decorative />
                    ))}
                    <span className="sr-only">{heroes.map((h) => h.name).join(", ")}</span>
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end pt-0.5 text-chalk-400">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={15} aria-hidden />
                <span aria-hidden className="font-heading text-lg font-bold tabular-nums text-chalk-200">
                  {number.format(th.replyCount)}
                </span>
              </span>
              <span className="sr-only">{count(t, locale, "pages.community.replies", th.replyCount)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The MLBBDex Discord server, as the other place to find people. */
export function DiscordAlternative({ t, text }: { t: T; text: string }) {
  return <DiscordInvite t={t} context="teammates" text={text} />;
}

/** Shown in place of the community when the database is not set up or does not answer. */
export function Unavailable({ t }: { t: T }) {
  return (
    <DexNote role="alert" pose="triste" height={130} className="max-w-2xl">
      {t("pages.community.unavailable")}
    </DexNote>
  );
}

export function SearchForm({ t, locale, query = "", category }: { t: T; locale: Locale; query?: string; category?: string }) {
  return (
    <form role="search" action={`/${locale}/community/search`} method="get" className="flex max-w-xl gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{t("pages.community.searchLabel")}</span>
        <Search size={17} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-chalk-500" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={100}
          placeholder={t("pages.community.searchPlaceholder")}
          className="field h-11 pl-10 text-sm"
        />
      </label>
      {category && <input type="hidden" name="category" value={category} />}
      <button type="submit" className="btn btn-secondary shrink-0 px-4">
        <Search size={16} aria-hidden className="sm:hidden" />
        <span className="max-sm:sr-only">{t("pages.community.search")}</span>
      </button>
    </form>
  );
}

export function Rules({ t }: { t: T }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-chalk-400">
      <li>{t("pages.community.rules.respect")}</li>
      <li>{t("pages.community.rules.noSpam")}</li>
      <li>{t("pages.community.rules.privacy")}</li>
      <li>{t("pages.community.rules.newAccounts")}</li>
      <li>{t("pages.community.rules.report")}</li>
    </ul>
  );
}

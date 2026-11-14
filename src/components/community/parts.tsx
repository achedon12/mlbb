import { ArrowBigUp, Lock, MessageSquare, Pin, Search } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { threadPath } from "@/lib/community/constants";
import type { ThreadSummary } from "@/lib/community/store";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { communityInvite } from "@/lib/bot/public";
import { DiscordMark } from "@/components/bot/discord-mark";

/**
 * Server parts of the community pages: thread rows, hero tags, dates, the
 * Discord link. No script: these render as HTML only.
 */

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
            className="bevel-sm inline-flex min-h-8 items-center gap-1.5 border border-night-700 bg-night-900/70 py-0.5 pl-0.5 pr-2 text-xs text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
          >
            <HeroPortrait source={h.images.icon} name={h.name} size={size} decorative />
            {h.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
    return <p className="border border-dashed border-night-700 p-6 text-sm text-chalk-400">{emptyText}</p>;
  }
  const number = new Intl.NumberFormat(LOCALE_INTL[locale]);
  return (
    <ul className="divide-y divide-night-800 border-y border-night-800">
      {threads.map((th) => (
        <li key={th.id} className="flex gap-3 py-3.5 sm:gap-4">
          <div className="flex w-10 shrink-0 flex-col items-center pt-0.5 text-chalk-500" title={t("pages.communityUI.votes", { n: th.score })}>
            <ArrowBigUp size={18} aria-hidden />
            <span className="text-sm tabular-nums text-chalk-300">{number.format(th.score)}</span>
            <span className="sr-only">{t("pages.communityUI.votes", { n: th.score })}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-start gap-1.5">
              {th.pinned && <Pin size={15} className="mt-1 shrink-0 text-gold-400" aria-label={t("pages.community.pinned")} />}
              {th.locked && <Lock size={15} className="mt-1 shrink-0 text-chalk-500" aria-label={t("pages.community.locked")} />}
              <Link href={threadPath(th)} className="min-w-0 break-words font-semibold text-chalk-100 transition-colors hover:text-gold-400">
                {th.title}
              </Link>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-chalk-500">
              {showCategory && (
                <>
                  <Link href={`/community/${th.category}`} className="text-chalk-400 hover:text-gold-400">
                    {t(`pages.community.categories.${th.category}.name`)}
                  </Link>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>{th.authorName}</span>
              <span aria-hidden>·</span>
              <time dateTime={isoDate(th.lastPostAt)}>{ago(locale, th.lastPostAt, now)}</time>
              {th.heroes.length > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate">{th.heroes.map((s) => heroesBySlug.get(s)?.name ?? s).join(", ")}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-1 pt-0.5 text-sm text-chalk-400">
            <MessageSquare size={15} className="mt-0.5" aria-hidden />
            <span className="tabular-nums">{number.format(th.replyCount)}</span>
            <span className="sr-only">{t("pages.community.replies", { n: th.replyCount })}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The MLBBDex Discord server, as the other place to find people. */
export function DiscordAlternative({ t, text }: { t: T; text: string }) {
  const invite = communityInvite();
  if (!invite) return null;
  return (
    <aside className="bevel flex flex-wrap items-center justify-between gap-4 border border-blurple-500/40 bg-blurple-500/10 p-4 sm:p-5">
      <p className="flex min-w-0 items-center gap-3 text-sm text-chalk-200">
        <span aria-hidden className="bevel-sm grid size-10 shrink-0 place-items-center bg-blurple-500/25 text-chalk-100">
          <DiscordMark />
        </span>
        <span className="min-w-0">{text}</span>
      </p>
      <a
        href={invite}
        rel="noopener"
        target="_blank"
        className="bevel-sm inline-flex min-h-11 items-center bg-blurple-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-blurple-600"
      >
        {t("pages.community.discordJoin")}
      </a>
    </aside>
  );
}

/** Shown in place of the community when the database is not set up or does not answer. */
export function Unavailable({ t }: { t: T }) {
  return (
    <p role="alert" className="border border-blood-500/40 p-4 text-chalk-300">
      {t("pages.community.unavailable")}
    </p>
  );
}

export function SearchForm({ t, locale, query = "", category }: { t: T; locale: Locale; query?: string; category?: string }) {
  return (
    <form role="search" action={`/${locale}/community/search`} method="get" className="flex max-w-xl gap-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t("pages.community.searchLabel")}</span>
        <input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={100}
          placeholder={t("pages.community.searchPlaceholder")}
          className="bevel-sm block h-11 w-full border border-night-700 bg-night-900 px-3 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500"
        />
      </label>
      {category && <input type="hidden" name="category" value={category} />}
      <button
        type="submit"
        className="bevel-sm inline-flex h-11 items-center gap-2 border border-night-700 px-3 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60"
      >
        <Search size={16} aria-hidden />
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

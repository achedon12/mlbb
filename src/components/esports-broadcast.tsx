import Image from "next/image";
import { Trophy } from "lucide-react";
import Link from "@/components/link";
import { heroArt } from "@/components/editorial-poster";
import { StatusBadge, tournamentDates } from "@/components/esports-parts";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import { tournamentStatus, type Tournament } from "@/lib/esports";
import { cn } from "@/lib/utils";

/**
 * The broadcast pieces of the esports pages: a team's crest (the site has no
 * team logos, so a bevelled shield with the team's initials, gold for a
 * champion), the hero a tournament is shown with and its card.
 */

/** "Aurora Gaming PH" → "AG", "ONIC" → "ON": two letters for the crest. */
export function teamInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function TeamCrest({
  name,
  size = "md",
  champion = false,
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  champion?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "crest shrink-0",
        size === "sm" && "crest-sm",
        size === "lg" && "crest-lg",
        size === "xl" && "!h-36 !w-32 !pb-5 !text-6xl",
        className,
      )}
      style={{ ["--crest" as string]: champion ? "var(--color-gold-400)" : "var(--color-night-600)", color: champion ? undefined : "var(--color-chalk-100)" }}
    >
      {teamInitials(name)}
    </span>
  );
}

/** Heroes of a tournament by presence (picks and bans), highest first. */
export function topHeroes(turn: Pick<Tournament, "heroes">, n = 8) {
  return [...turn.heroes]
    .filter((h) => heroesBySlug.has(h.slug))
    .sort((a, b) => b.picks + b.bans - (a.picks + a.bans) || a.slug.localeCompare(b.slug))
    .slice(0, n);
}

/** The artwork a tournament is shown with: its most present hero that has one. */
export function tournamentArt(turn: Pick<Tournament, "heroes">, avoid?: Set<string>): { slug: string; art: string } | null {
  const order = topHeroes(turn, 40).map((h) => h.slug);
  for (const pass of [true, false]) {
    for (const slug of order) {
      if (pass && avoid?.has(slug)) continue;
      const art = heroArt(slug);
      if (art) {
        avoid?.add(slug);
        return { slug, art };
      }
    }
  }
  return null;
}

/**
 * A tournament as a broadcast card: the art of its most present hero, its
 * short name set big, its status, dates and — when it is over — its
 * champion with a gold crest.
 */
export function TournamentCard({
  turn,
  t,
  locale,
  now,
  art,
}: {
  turn: Tournament;
  t: T;
  locale: Locale;
  now: Date;
  art: string | null;
}) {
  const dates = tournamentDates(t, locale, turn);
  const status = tournamentStatus(turn, now);
  return (
    <Link
      href={`/esports/${turn.slug}`}
      className={cn("group card-link relative flex h-full min-h-72 flex-col justify-end overflow-hidden p-5 sm:p-6", art && "scheme-dark", status === "live" && "eclat-under is-active")}
    >
      {art && (
        <span aria-hidden className="absolute inset-0">
          <Image
            src={art}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-[50%_25%] opacity-75 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/70 to-night-950/10" />
        </span>
      )}
      <span className="relative block">
        <StatusBadge status={status} t={t} />
        <span className="display-caps mt-3 block text-5xl text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-6xl">
          {turn.shortName}
        </span>
        <span className="mt-1 block font-heading text-lg font-bold text-chalk-200">{turn.name}</span>
        <span className="mt-2 block text-sm text-chalk-300">
          {[dates, turn.teamCount ? t("pages.esports.card.teams", { n: turn.teamCount }) : null].filter(Boolean).join(" · ")}
        </span>
        {turn.champion && (
          <span className="mt-4 flex items-center gap-3">
            <TeamCrest name={turn.champion} size="sm" champion />
            <span className="flex items-center gap-1.5 font-heading font-bold uppercase text-gold-400">
              <Trophy size={15} aria-hidden />
              {t("pages.esports.card.champion", { team: turn.champion })}
            </span>
          </span>
        )}
        <span className="mt-3 block text-xs text-chalk-400">
          {turn.games ? t("pages.esports.card.games", { n: turn.games }) : t("pages.esports.card.noGames")}
        </span>
      </span>
    </Link>
  );
}

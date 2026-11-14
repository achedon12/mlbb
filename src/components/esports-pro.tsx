import Link from "@/components/link";
import { LightImage } from "@/components/light-image";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import {
  gameLineups,
  hasPlayerPage,
  hasTeamPage,
  playerBySlug,
  teamBySlug,
  teamSlugByName,
  type ProGame,
  type ProMatch,
  type ProRole,
} from "@/lib/esports-players";
import { heroIcon } from "@/lib/statistics-table";
import { cn } from "@/lib/utils";

/**
 * Pieces of the player and team pages: links that only exist when the target
 * page does, the role label, and a game's draft with the player of each hero.
 */

export function percentText(locale: Locale, value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
}

export const roleText = (t: T, role: ProRole | null) => (role ? t(`pages.esports.pro.roles.${role}`) : "—");

export const teamName = (slug: string) => teamBySlug.get(slug)?.name ?? slug;
export const playerName = (slug: string) => playerBySlug.get(slug)?.name ?? slug;
export const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;

const linkStyle = "transition-colors hover:text-gold-400";

/** A team by slug, linked to its page when it has one. */
export function TeamLink({ slug, className }: { slug: string; className?: string }) {
  if (!hasTeamPage(slug)) return <span className={className}>{teamName(slug)}</span>;
  return (
    <Link href={`/esports/teams/${slug}`} prefetch={false} className={cn(linkStyle, className)}>
      {teamName(slug)}
    </Link>
  );
}

/** A team by the name the tournament pages show, linked when it has a page. */
export function TeamNameLink({ name, className }: { name: string; className?: string }) {
  const slug = teamSlugByName.get(name);
  return slug ? <TeamLink slug={slug} className={className} /> : <span className={className}>{name}</span>;
}

/** A player by slug, linked to their page when they have one. */
export function PlayerLink({ slug, className }: { slug: string; className?: string }) {
  if (!hasPlayerPage(slug)) return <span className={className}>{playerName(slug)}</span>;
  return (
    <Link href={`/esports/players/${slug}`} prefetch={false} className={cn(linkStyle, className)}>
      {playerName(slug)}
    </Link>
  );
}

/** A hero icon with its name for assistive technologies; the source name when unknown. */
export function HeroIcon({ slug, size = 28, ban = false }: { slug: string; size?: number; ban?: boolean }) {
  const hero = heroesBySlug.get(slug);
  if (!hero) return <span className="text-xs text-chalk-300">{slug}</span>;
  return (
    <LightImage
      src={heroIcon(slug)}
      alt={hero.name}
      width={size}
      height={size}
      className={cn("bevel-sm shrink-0 bg-night-800 object-cover", ban && "opacity-60 grayscale")}
    />
  );
}

/**
 * One game: for each team, the five heroes above the players who played them
 * (lane order), then the bans. Without a full draft, the heroes cannot be
 * credited: the picks are shown alone.
 */
export function ProGameDraft({ match: m, game: g, index, t }: { match: ProMatch; game: ProGame; index: number; t: T }) {
  const lineups = gameLineups(m, g);
  const side = (i: 0 | 1) => (i === 0 ? g.team1Side : g.team1Side === "blue" ? "red" : g.team1Side === "red" ? "blue" : null);
  return (
    <div className="border-t border-night-800 pt-3">
      <p className="text-xs text-chalk-500">
        {t("pages.esports.drafts.game", { n: index + 1 })}
        {g.duration && <> · {g.duration}</>} ·{" "}
        <span className="text-chalk-300">{t("pages.esports.drafts.won", { team: teamName(m.teams[g.winner - 1]) })}</span>
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {([0, 1] as const).map((i) => {
          const colour = side(i);
          const players = g.picks[i].length === 5 ? lineups[i] : null;
          return (
            <div key={i} className="min-w-0">
              <p className="flex items-center gap-2 text-sm">
                {colour && (
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", colour === "blue" ? "bg-azure-400" : "bg-blood-500")}
                  />
                )}
                <span className={cn("truncate", g.winner === i + 1 ? "font-semibold text-chalk-100" : "text-chalk-300")}>
                  {teamName(m.teams[i])}
                </span>
                {colour && <span className="sr-only">({t(`pages.esports.drafts.${colour}`)})</span>}
              </p>
              <ul aria-label={t("pages.esports.drafts.picks")} className="mt-1.5 grid grid-cols-5 gap-1">
                {g.picks[i].map((hero, slot) => (
                  <li key={slot} className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                    <HeroIcon slug={hero} size={32} />
                    {players?.[slot] && (
                      <PlayerLink slug={players[slot]} className="w-full truncate text-[0.65rem] text-chalk-500" />
                    )}
                  </li>
                ))}
              </ul>
              {g.bans[i].length > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[0.65rem] uppercase tracking-wide text-chalk-500">{t("pages.esports.drafts.bans")}</span>
                  <ul aria-label={t("pages.esports.drafts.bans")} className="flex gap-1">
                    {g.bans[i].map((hero, j) => (
                      <li key={j} className="flex">
                        <HeroIcon slug={hero} size={20} ban />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

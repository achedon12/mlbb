"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { useLocale, useT } from "@/i18n/provider";
import { nextMatches, type RunMatches } from "@/lib/profile-actions";
import { GAME_LANE, formatDateMatch, formatCount, plural } from "@/lib/player-format";
import type { MatchShown } from "@/lib/player-profile";
import { cn } from "@/lib/utils";

/**
 * Dernieres parties du joueur, page apres page.
 *
 * La premiere page arrive avec le profil, rendue cote serveur ; les suivantes
 * sont demandees a une action serveur avec le seul curseur de pagination, et
 * s'ajoutent a la liste sans recharger le reste du profil.
 */
export function RecentMatches({
  season,
  initials,
  next: nextInitial,
}: {
  season: number;
  initials: MatchShown[];
  next: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const [matches, setMatches] = useState(initials);
  const [next, setNext] = useState(nextInitial);
  const [error, setError] = useState<"expired" | "unavailable" | null>(null);
  const [inProgress, start] = useTransition();

  const load = () => {
    const cursor = next;
    if (!cursor) return;
    start(async () => {
      const run: RunMatches = await nextMatches(season, cursor).catch(() => ({ state: "unavailable" }));
      if (run.state !== "ok") {
        setError(run.state);
        return;
      }
      setError(null);
      setMatches((before) => {
        const views = new Set(before.map((p) => p.id));
        return [...before, ...run.matches.filter((p) => !views.has(p.id))];
      });
      // Un curseur qui ne bouge pas redemanderait la meme page sans fin.
      setNext(run.next && run.next !== cursor ? run.next : null);
    });
  };

  if (matches.length === 0) {
    return <p className="mt-6 text-sm text-chalk-500">{t("pages.accountProfile.gamesEmpty")}</p>;
  }

  return (
    <div className="mt-6">
      <ol aria-label={t("pages.accountProfile.gamesTitle")} className="divide-y divide-night-800 border-y border-night-800">
        {matches.map((p) => (
          <RowMatch key={p.id} match={p} />
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {t(`pages.accountProfile.gamesShown.${plural(matches.length, locale)}`, { n: matches.length })}
      </p>

      {error && (
        <p role="alert" className="bevel-sm mt-4 border border-blood-500/40 bg-blood-500/10 px-4 py-3 text-sm text-blood-500">
          {error === "expired" ? (
            <>
              {t("pages.accountProfile.expiredText")}{" "}
              <Link href="/login" className="font-semibold underline underline-offset-4">
                {t("pages.accountProfile.signInAgain")}
              </Link>
            </>
          ) : (
            t("pages.accountProfile.loadError")
          )}
        </p>
      )}

      {next ? (
        <button
          type="button"
          onClick={load}
          disabled={inProgress || error === "expired"}
          className="bevel-sm mt-5 flex w-full items-center justify-center gap-2 border border-night-700 px-6 py-2.5 text-sm font-semibold text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400 disabled:opacity-60 sm:w-auto"
        >
          {inProgress ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden />
          ) : (
            <ChevronDown size={16} aria-hidden />
          )}
          {inProgress ? t("pages.accountProfile.loading") : t("pages.accountProfile.seeMore")}
        </button>
      ) : (
        <p className="mt-4 text-xs text-chalk-500">{t("pages.accountProfile.allShown")}</p>
      )}
    </div>
  );
}

function RowMatch({ match: p }: { match: MatchShown }) {
  const t = useT();
  const locale = useLocale();
  const issue = p.win === null ? "unknown" : p.win ? "win" : "loss";
  const color = p.win === null ? "text-chalk-400" : p.win ? "text-emerald-400" : "text-blood-500";
  const lane = p.lane !== null ? GAME_LANE[p.lane] : undefined;

  return (
    <li className="flex items-center gap-3 py-3">
      {/* Liseré de couleur : un repere de plus, l'issue est aussi ecrite en toutes lettres. */}
      <span
        aria-hidden
        className={cn(
          "w-1 shrink-0 self-stretch",
          p.win === null ? "bg-night-700" : p.win ? "bg-emerald-400" : "bg-blood-500",
        )}
      />
      <HeroPortrait source={p.hero.portrait} name={p.hero.name} size="icon" decorative />

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          {p.hero.slug ? (
            <Link
              href={`/heroes/${p.hero.slug}`}
              className="truncate font-semibold text-chalk-100 transition-colors hover:text-gold-400"
            >
              {p.hero.name}
            </Link>
          ) : (
            <span className="truncate font-semibold text-chalk-100">{p.hero.name}</span>
          )}
          {p.mvp && (
            <span className="bevel-sm shrink-0 bg-gold-500 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-night-950">
              {t("pages.accountProfile.mvp")}
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-chalk-500">
          {lane && <span>{t(`lanes.${lane}`)}</span>}
          {p.note !== null && <span>{t("pages.accountProfile.rating", { n: formatCount(p.note, locale, 1) })}</span>}
          {p.date !== null && <DateMatch seconds={p.date} />}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-semibold", color)}>{t(`pages.accountProfile.outcome.${issue}`)}</p>
        <p className="mt-0.5 text-xs tabular-nums text-chalk-300">
          <span aria-hidden>{`${p.eliminations} / ${p.deaths} / ${p.assists}`}</span>
          <span className="sr-only">
            {t("pages.accountProfile.kda", { k: p.eliminations, d: p.deaths, a: p.assists })}
          </span>
        </p>
      </div>
    </li>
  );
}

const nothingToHear = () => () => {};

/**
 * Date d'une partie. Faux au rendu serveur et a l'hydratation, vrai ensuite :
 * l'heure locale n'apparait qu'une fois le fuseau du lecteur connu, sans
 * desaccord entre le HTML du serveur et celui du navigateur.
 */
function DateMatch({ seconds }: { seconds: number }) {
  const locale = useLocale();
  const hydrate = useSyncExternalStore(nothingToHear, () => true, () => false);
  return (
    <time dateTime={new Date(seconds * 1000).toISOString()}>{formatDateMatch(seconds, locale, hydrate)}</time>
  );
}

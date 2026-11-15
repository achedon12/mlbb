"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LightImage } from "@/components/light-image";
import { heroIcon } from "@/lib/statistics-table";
import { cn } from "@/lib/utils";

/** One game, as the server sends it: slugs, and its caption already written. */
export interface DraftGameLine {
  /** "Game 2 · 14:32". */
  caption: string;
  /** "Team Liquid ID wins". */
  won: string;
  winner: 1 | 2;
  team1Side: "blue" | "red" | null;
  picks: [string[], string[]];
  bans: [string[], string[]];
}

export interface DraftLabels {
  picks: string;
  bans: string;
  blue: string;
  red: string;
  show: string;
  hide: string;
}

/**
 * The games of one drafted match: picks and bans, side by side.
 *
 * A tournament lists ten matches, some forty games and nine hundred hero
 * icons: rendered on the server, they made 540 KB of HTML and as much RSC
 * payload, for a section most readers only skim. The page now sends each
 * match's games as slugs (a few hundred bytes); the latest matches are drawn
 * on the server as before, the older ones only when the reader opens them.
 */
export function DraftGames({
  teams,
  games,
  names,
  labels,
  open: initiallyOpen,
}: {
  teams: [string, string];
  games: DraftGameLine[];
  /** Name of each hero of these games, by slug; a slug missing here is shown as is. */
  names: Record<string, string>;
  labels: DraftLabels;
  open: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      {!initiallyOpen && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
        >
          {open ? labels.hide : labels.show}
          <ChevronDown size={16} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
        </button>
      )}
      {open && (
        <ol className="mt-3 space-y-3">
          {games.map((g, i) => {
            const other = g.team1Side === "blue" ? "red" : g.team1Side === "red" ? "blue" : null;
            return (
              <li key={i} className="border-t border-night-800 pt-3">
                <p className="text-xs text-chalk-500">
                  {g.caption} · <span className="text-chalk-300">{g.won}</span>
                </p>
                <DraftSide team={teams[0]} side={g.team1Side} picks={g.picks[0]} bans={g.bans[0]} won={g.winner === 1} names={names} labels={labels} />
                <DraftSide team={teams[1]} side={other} picks={g.picks[1]} bans={g.bans[1]} won={g.winner === 2} names={names} labels={labels} />
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

function DraftSide({
  team,
  side,
  picks,
  bans,
  won,
  names,
  labels,
}: {
  team: string;
  side: "blue" | "red" | null;
  picks: string[];
  bans: string[];
  won: boolean;
  names: Record<string, string>;
  labels: DraftLabels;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <p className="flex w-full min-w-0 items-center gap-2 text-sm sm:w-40">
        {side && (
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", side === "blue" ? "bg-azure-400" : "bg-blood-500")}
          />
        )}
        <span className={cn("truncate", won ? "font-semibold text-chalk-100" : "text-chalk-300")}>{team}</span>
        {side && <span className="sr-only">({labels[side]})</span>}
      </p>
      <HeroStrip label={labels.picks} heroes={picks} names={names} />
      <HeroStrip label={labels.bans} heroes={bans} names={names} ban />
    </div>
  );
}

function HeroStrip({
  label,
  heroes,
  names,
  ban = false,
}: {
  label: string;
  heroes: string[];
  names: Record<string, string>;
  ban?: boolean;
}) {
  if (heroes.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 text-[0.65rem] uppercase tracking-wide text-chalk-500">{label}</span>
      <ul className={cn("flex gap-1", ban && "opacity-60 grayscale")}>
        {heroes.map((h, i) => (
          <li key={`${h}-${i}`} title={names[h] ?? h} className="flex">
            {names[h] ? (
              <LightImage src={heroIcon(h)} alt={names[h]} width={24} height={24} className="bevel-sm size-6 bg-night-800 object-cover" />
            ) : (
              <span className="text-xs text-chalk-300">{h}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

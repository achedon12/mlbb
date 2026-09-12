"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw, Settings2, SkipForward, Undo2 } from "lucide-react";
import { ChampRecherche } from "@/components/champ-recherche";
import { VignetteHeros } from "@/components/choix-heros";
import { DraftSummary, useNumberFormats, type NumberFormats } from "@/components/draft-summary";
import { classesPuce } from "@/components/puce";
import { useT } from "@/i18n/fournisseur";
import type { T } from "@/i18n/t";
import { TAILLE_EQUIPE, type MesuresRang, type TypeDegats } from "@/lib/composition";
import { LANES, ROLES } from "@/lib/draft";
import {
  bansPerSide,
  botMove,
  CONTROLS,
  DEFAULT_SETTINGS,
  DRAFT_FORMATS,
  draftState,
  expandTurns,
  FIXED_TIMER,
  GAME_TIMERS,
  isDraftRank,
  pickLanes,
  play,
  playedBy,
  rankBans,
  rankForFormat,
  rankPicks,
  readSimulation,
  sequence,
  SIDES,
  TIMER_SETTINGS,
  timeoutMove,
  turnTimer,
  unavailableHeroes,
  undo,
  writeSimulation,
  type BotContext,
  type BotMove,
  type BotReason,
  type Choice,
  type MetaEntry,
  type Settings,
  type Side,
  type SimulationHero,
  type Turn,
} from "@/lib/draft-simulation";
import type { RangMesure } from "@/lib/rangs-mesure";
import type { Lane, Role } from "@/lib/types";
import { cleRecherche, cn } from "@/lib/utils";

/**
 * Draft simulator: settings, board of both teams, roster grid, bot and
 * timer, then the summary. Every rule comes from `lib/draft-simulation`; this
 * component only shows it and plays it. The rank's measurements come
 * separately (`/composition/<rank>.json`), as for the team analyzer.
 */

/** Requests already made, per rank: going back to a rank reloads nothing. */
const requests = new Map<RangMesure, Promise<MesuresRang>>();

function loadMeasures(rank: RangMesure): Promise<MesuresRang> {
  let request = requests.get(rank);
  if (!request) {
    request = fetch(`/composition/${rank}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<MesuresRang>;
    });
    // A failure is not kept: going back to the rank tries again.
    request.catch(() => requests.delete(rank));
    requests.set(rank, request);
  }
  return request;
}

/** Time the bot waits before playing: long enough to see its move land, short enough not to drag. */
const BOT_DELAY = 550;

const newSeed = () => 1 + Math.floor(Math.random() * (2 ** 31 - 2));

const label = "text-xs uppercase tracking-wide text-chalk-500";
const heading3 = "font-heading text-lg font-bold text-chalk-100";
const button =
  "bevel-sm inline-flex min-h-11 items-center gap-2 border border-night-700 px-3 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400 disabled:pointer-events-none disabled:opacity-40";
const sideColor: Record<Side, { text: string; border: string; fill: string }> = {
  blue: { text: "text-azure-500", border: "border-azure-500", fill: "bg-azure-500" },
  red: { text: "text-blood-500", border: "border-blood-500", fill: "bg-blood-500" },
};

export function DraftSimulator({
  heroes,
  ranks,
  meta,
  damageLabels,
  active,
}: {
  heroes: SimulationHero[];
  ranks: RangMesure[];
  meta: Partial<Record<RangMesure, MetaEntry[]>>;
  damageLabels: Record<TypeDegats, string>;
  /** False while the tab is hidden: no bot, no timer, no address rewrite. */
  active: boolean;
}) {
  const t = useT();
  const formats = useNumberFormats();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [started, setStarted] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  /** Reason of every bot or timer move, by turn index. */
  const [reasons, setReasons] = useState<Record<number, BotMove>>({});
  const [loaded, setLoaded] = useState<Partial<Record<RangMesure, MesuresRang | "error">>>({});
  const [search, setSearch] = useState("");
  const [laneFilter, setLaneFilter] = useState<Lane | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  const known = useMemo(() => new Set(heroes.map((h) => h.slug)), [heroes]);
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const nameOf = (slug: string) => bySlug.get(slug)?.nom ?? slug;
  const turns = useMemo(() => expandTurns(sequence(settings.format, settings.rank)), [settings.format, settings.rank]);
  const state = draftState(turns, choices);
  const turn = started ? state.current : null;
  const player = turn ? playedBy(settings, turn) : null;
  const mine = player === "player";
  const isBan = turn?.action === "ban";

  const measuresState = loaded[settings.rank];
  const measures = measuresState && measuresState !== "error" ? measuresState : null;
  const ctx = useMemo<BotContext>(
    () => ({ catalog: heroes, measures, meta: meta[settings.rank] ?? [], seed: settings.seed }),
    [heroes, measures, meta, settings.rank, settings.seed],
  );

  // First mount: the address gives the settings and, when there is one, the
  // draft to resume. Afterwards every change is written back to it.
  const mounted = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (!mounted.current) {
      mounted.current = true;
      const read = readSimulation(window.location.search, known, ranks);
      if (read) {
        /* eslint-disable react-hooks/set-state-in-effect -- reading the URL after mount */
        setSettings(read.settings);
        if (read.choices.length > 0) {
          setChoices(read.choices);
          setStarted(true);
        }
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    window.history.replaceState(null, "", `?${writeSimulation(window.location.search, settings, started ? choices : [])}`);
  }, [active, settings, choices, started, known, ranks]);

  useEffect(() => {
    if (!active) return;
    const rank = settings.rank;
    loadMeasures(rank).then(
      (m) => setLoaded((c) => ({ ...c, [rank]: m })),
      () => setLoaded((c) => ({ ...c, [rank]: "error" })),
    );
  }, [active, settings.rank]);

  // The bot waits for the rank's measurements (or their failure): without
  // them it would only play on the tier list and the wiki.
  useEffect(() => {
    if (!active || !turn || player !== "bot" || measuresState === undefined) return;
    const timeout = window.setTimeout(() => {
      const move = botMove(turns, choices, ctx);
      const next = move ? play(turns, choices, move.slug, known) : null;
      if (!move || !next) return;
      setChoices(next);
      setReasons((r) => ({ ...r, [turn.index]: move }));
    }, BOT_DELAY);
    return () => window.clearTimeout(timeout);
  }, [active, turn, player, measuresState, turns, choices, ctx, known]);

  function playerMove(slug: Choice) {
    if (!turn || !mine) return;
    const next = play(turns, choices, slug, known);
    if (!next) return;
    setChoices(next);
    // A move replayed after an undo no longer carries the timer's reason.
    setReasons((r) => {
      const copy = { ...r };
      delete copy[turn.index];
      return copy;
    });
    setSearch("");
  }

  function expire() {
    if (!turn) return;
    const move = timeoutMove(turns, choices, heroes, settings.seed);
    const next = move ? play(turns, choices, move.slug, known) : null;
    if (!move || !next) return;
    setChoices(next);
    setReasons((r) => ({ ...r, [turn.index]: move }));
  }

  function start() {
    setSettings((s) => ({ ...s, seed: newSeed() }));
    setChoices([]);
    setReasons({});
    setStarted(true);
  }

  function backToSettings() {
    setStarted(false);
    setChoices([]);
    setReasons({});
  }

  const isHuman = (tr: Turn) => playedBy(settings, tr) === "player";
  const previous = undo(turns, choices, isHuman);

  /**
   * Simultaneous bans: the bot's stay hidden until the end of the round, as
   * in the game. When the player holds both sides there is nothing to hide.
   */
  const hidden = (i: number) => {
    const tr = turns[i];
    return !!turn?.simultaneous && tr.simultaneous && tr.step === turn.step && !isHuman(tr);
  };

  // Cheap enough per render; the React Compiler memoizes what is worth it.
  const excluded = turn ? unavailableHeroes(turns, choices, turn) : new Set<string>();
  const results = useMemo(() => {
    const term = cleRecherche(search.trim());
    return heroes
      .filter((h) => !laneFilter || h.lanes.includes(laneFilter))
      .filter((h) => !role || h.roles.includes(role))
      .filter((h) => !term || cleRecherche(h.nom).includes(term))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [heroes, laneFilter, role, search]);

  const hints = !turn || !mine ? [] : turn.action === "ban" ? rankBans(turns, choices, turn, ctx) : rankPicks(turns, choices, turn, ctx);

  if (!started) {
    return (
      <SettingsScreen
        settings={settings}
        ranks={ranks}
        onChange={(v) => setSettings((s) => ({ ...s, ...v }))}
        onStart={start}
      />
    );
  }

  const banCount = bansPerSide(settings.format, settings.rank);
  const timer = turn && mine ? turnTimer(settings.timer, turn.action) : null;
  const sideName = (s: Side) => t(`pages.draftSimulatorUI.sides.${s}`);
  const turnText = (tr: Turn) =>
    t(`pages.draftSimulatorUI.turnAction.${tr.action}`, { k: tr.number, n: tr.action === "ban" ? banCount : TAILLE_EQUIPE });

  // Live region: the last move, then whose turn it is.
  const announce: string[] = [];
  const last = choices.length - 1;
  if (last >= 0) {
    const tr = turns[last];
    const c = choices[last];
    if (hidden(last)) announce.push(t("pages.draftSimulatorUI.announce.hidden", { side: sideName(tr.side) }));
    else if (c === null) announce.push(t("pages.draftSimulatorUI.announce.empty", { side: sideName(tr.side) }));
    else {
      announce.push(
        t("pages.draftSimulatorUI.announce.played", {
          side: sideName(tr.side),
          action: t(`pages.draftSimulatorUI.actions.${tr.action}`),
          name: nameOf(c),
        }),
      );
    }
  }
  if (turn) {
    announce.push(
      t("pages.draftSimulatorUI.announce.turn", {
        i: turn.index + 1,
        n: turns.length,
        side: sideName(turn.side),
        action: turnText(turn),
        who: t(mine ? "pages.draftSimulatorUI.yourTurn" : "pages.draftSimulatorUI.botTurn"),
      }),
    );
  } else announce.push(t("pages.draftSimulatorUI.announce.done"));

  const log = Object.entries(reasons)
    .map(([i, move]) => ({ i: Number(i), move }))
    .filter(({ i }) => i < choices.length && !hidden(i))
    .sort((a, b) => b.i - a.i);

  return (
    <div className="space-y-8">
      <p aria-live="polite" className="sr-only">
        {announce.join(" ")}
      </p>

      {/* -- Current turn and controls ---------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className={label}>
            {t(`pages.draftSimulatorUI.formats.${settings.format}`)} · {t(`measuredRanks.${settings.rank}`)}
          </p>
          <p className="font-heading text-xl font-bold text-chalk-100">
            {turn ? (
              <>
                <span className={sideColor[turn.side].text}>{sideName(turn.side)}</span> · {turnText(turn)}
                <span className="ml-2 align-middle text-sm font-medium text-chalk-500">
                  ({t(mine ? "pages.draftSimulatorUI.yourTurn" : "pages.draftSimulatorUI.botTurn")})
                </span>
              </>
            ) : (
              t("pages.draftSimulatorUI.finished")
            )}
          </p>
        </div>
        {turn && timer !== null && active && (
          <Countdown key={`${turn.index}:${choices.join(",")}`} seconds={timer} onEnd={expire} />
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={previous.length === choices.length} onClick={() => setChoices(previous)}>
            <Undo2 size={15} aria-hidden />
            {t("pages.draftSimulatorUI.undo")}
          </button>
          <button type="button" className={button} onClick={start}>
            <RotateCcw size={15} aria-hidden />
            {t("pages.draftSimulatorUI.restart")}
          </button>
          <button type="button" className={button} onClick={backToSettings}>
            <Settings2 size={15} aria-hidden />
            {t("pages.draftSimulatorUI.changeSettings")}
          </button>
        </div>
      </div>

      {turn?.simultaneous && <p className="-mt-4 text-sm text-chalk-500">{t("pages.draftSimulatorUI.simultaneous")}</p>}

      {/* -- Both teams ------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {SIDES.map((side) => (
          <TeamColumn
            key={side}
            side={side}
            turns={turns}
            choices={choices}
            turn={turn}
            bySlug={bySlug}
            lanes={pickLanes(state.picks[side], heroes)}
            isPlayer={isHuman(turns.find((tr) => tr.side === side)!)}
            hidden={hidden}
          />
        ))}
      </div>

      {turn ? (
        <>
          {/* -- Hints for the player ----------------------------------- */}
          {mine && hints.length > 0 && (
            <section aria-labelledby="hints-title">
              <h3 id="hints-title" className={heading3}>
                {t(isBan ? "pages.draftSimulatorUI.hints.ban" : "pages.draftSimulatorUI.hints.pick")}
              </h3>
              <p className="mt-1 text-sm text-chalk-500">
                {t(isBan ? "pages.draftSimulatorUI.hints.banIntro" : "pages.draftSimulatorUI.hints.pickIntro", {
                  rank: t(`measuredRanks.${settings.rank}`),
                })}
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {hints.map((c) => {
                  const h = bySlug.get(c.slug);
                  return (
                    <li key={c.slug}>
                      <button
                        type="button"
                        onClick={() => playerMove(c.slug)}
                        aria-label={t(isBan ? "pages.draftSimulatorUI.banHero" : "pages.draftSimulatorUI.pickHero", { name: nameOf(c.slug) })}
                        className="bevel-sm flex min-h-11 w-full items-center gap-3 border border-night-700/70 bg-night-900/60 p-2 text-left transition-colors hover:border-gold-500/60"
                      >
                        {h && <VignetteHeros heros={h} />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-heading font-bold text-chalk-100">{nameOf(c.slug)}</span>
                          <span className="block text-xs leading-snug text-chalk-300">
                            {reasonText(c.reason, c.lane, t, formats, nameOf, settings.rank)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* -- Roster ------------------------------------------------- */}
          <section aria-labelledby="grid-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="grid-title" className={heading3}>
                {t("pages.draftSimulatorUI.heroGrid")}
              </h3>
              {mine && isBan && (
                <button type="button" className={button} onClick={() => playerMove(null)}>
                  <SkipForward size={15} aria-hidden />
                  {t("pages.draftSimulatorUI.skipBan")}
                </button>
              )}
              {!mine && (
                <p className="text-sm text-chalk-500">
                  {measuresState === undefined ? t("teamUI.loading") : t("pages.draftSimulatorUI.botThinking")}
                </p>
              )}
            </div>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                // Enter confirms the search when it leaves a single playable hero.
                const playable = results.filter((h) => !excluded.has(h.slug));
                if (playable.length === 1) playerMove(playable[0].slug);
              }}
            >
              <ChampRecherche dense valeur={search} onChange={setSearch} libelle={t("pages.draftSimulatorUI.search")} />
            </form>
            <ChoiceRow
              legend={t("draftUI.laneFilter")}
              all={t("draftUI.allLanes")}
              values={LANES}
              selected={laneFilter}
              labelOf={(l) => t(`lanes.${l}`)}
              onChange={setLaneFilter}
            />
            <ChoiceRow
              legend={t("draftUI.roleFilter")}
              all={t("draftUI.allRoles")}
              values={ROLES}
              selected={role}
              labelOf={(r) => t(`roles.${r}`)}
              onChange={setRole}
            />
            <p aria-live="polite" className="text-xs text-chalk-500">
              {t("draftUI.account", { n: results.length })}
            </p>
            <ul className="grid max-h-[60vh] grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
              {results.map((h) => {
                const taken = excluded.has(h.slug);
                return (
                  <li key={h.slug}>
                    <button
                      type="button"
                      disabled={taken || !mine}
                      onClick={() => playerMove(h.slug)}
                      aria-label={
                        taken
                          ? t("pages.draftSimulatorUI.unavailable", { name: h.nom })
                          : t(isBan ? "pages.draftSimulatorUI.banHero" : "pages.draftSimulatorUI.pickHero", { name: h.nom })
                      }
                      className={cn(
                        "bevel-sm flex min-h-11 w-full flex-col items-center gap-1 border border-night-700/70 p-1.5 text-center transition-colors",
                        "enabled:hover:border-gold-500/60 enabled:hover:bg-night-850 disabled:cursor-not-allowed",
                        taken && "opacity-30 grayscale",
                        !taken && !mine && "opacity-60",
                      )}
                    >
                      <VignetteHeros heros={h} />
                      <span className="w-full truncate text-[0.7rem] text-chalk-100">{h.nom}</span>
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && (
                <li className="col-span-full py-6 text-center text-sm text-chalk-500">{t("draftUI.noHero")}</li>
              )}
            </ul>
          </section>
        </>
      ) : (
        <DraftSummary
          blue={state.picks.blue}
          red={state.picks.red}
          heroes={heroes}
          measures={measures}
          failed={measuresState === "error"}
          rank={settings.rank}
          damageLabels={damageLabels}
          query={writeSimulation("", settings, choices)}
          onReplay={start}
          onSettings={backToSettings}
        />
      )}

      {/* -- Choices explained ------------------------------------------ */}
      {(settings.bot || log.length > 0) && (
        <section aria-labelledby="log-title">
          <h3 id="log-title" className={heading3}>
            {t("pages.draftSimulatorUI.log.title")}
          </h3>
          <p className="mt-1 text-sm text-chalk-500">{t("pages.draftSimulatorUI.log.intro")}</p>
          {log.length > 0 ? (
            <ol className="mt-3 space-y-1.5">
              {log.map(({ i, move }) => {
                const tr = turns[i];
                return (
                  <li key={i} className="flex gap-2 text-sm leading-snug text-chalk-300">
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", sideColor[tr.side].fill)} />
                    <span>
                      {t(move.lane ? "pages.draftSimulatorUI.log.lineLane" : "pages.draftSimulatorUI.log.line", {
                        side: sideName(tr.side),
                        action: t(`pages.draftSimulatorUI.actions.${tr.action}`),
                        name: move.slug ? nameOf(move.slug) : t("pages.draftSimulatorUI.emptyBan"),
                        lane: move.lane ? t(`lanes.${move.lane}`) : "",
                        reason: reasonText(move.reason, move.lane, t, formats, nameOf, settings.rank),
                      })}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-chalk-500">{t("pages.draftSimulatorUI.log.empty")}</p>
          )}
        </section>
      )}
    </div>
  );
}

/** The reason for a choice, in one line, in the page language. */
function reasonText(
  r: BotReason,
  lane: Lane | null,
  t: T,
  f: NumberFormats,
  nameOf: (slug: string) => string,
  rank: RangMesure,
): string {
  switch (r.type) {
    case "meta":
      return t("pages.draftSimulatorUI.reasons.meta", { tier: r.tier, ban: f.integer(r.banRate), rank: t(`measuredRanks.${rank}`) });
    case "strength":
      return t("pages.draftSimulatorUI.reasons.strength", { rate: f.decimal(r.winRate) });
    case "counter":
      return r.points === null
        ? t("pages.draftSimulatorUI.reasons.counterWiki", { names: r.targets.map(nameOf).join(", ") })
        : t("pages.draftSimulatorUI.reasons.counter", { names: r.targets.map(nameOf).join(", "), pts: f.signed(r.points) });
    case "duo":
      return r.points === null
        ? t("pages.draftSimulatorUI.reasons.duoWiki", { names: r.partners.map(nameOf).join(", ") })
        : t("pages.draftSimulatorUI.reasons.duo", { names: r.partners.map(nameOf).join(", "), pts: f.signed(r.points) });
    case "lane":
      return lane
        ? t("pages.draftSimulatorUI.reasons.lane", { lane: t(`lanes.${lane}`) })
        : t("pages.draftSimulatorUI.reasons.fallback");
    default:
      return t(`pages.draftSimulatorUI.reasons.${r.type}`);
  }
}

// -- Settings -------------------------------------------------------------

function SettingsScreen({
  settings,
  ranks,
  onChange,
  onStart,
}: {
  settings: Settings;
  ranks: RangMesure[];
  onChange: (v: Partial<Settings>) => void;
  onStart: () => void;
}) {
  const t = useT();
  const formatRanks = settings.format === "ranked" ? ranks.filter((r) => isDraftRank(r)) : ranks;
  const botUseless = settings.control === "both";
  const botOn = settings.bot && !botUseless;

  return (
    <section aria-labelledby="settings-title" className="space-y-7">
      <div>
        <h2 id="settings-title" className="font-heading text-2xl font-bold text-chalk-100">
          {t("pages.draftSimulatorUI.settings.title")}
        </h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
      </div>

      <fieldset>
        <legend className={label}>{t("pages.draftSimulatorUI.settings.format")}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {DRAFT_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={settings.format === f}
              onClick={() => onChange({ format: f, rank: rankForFormat(f, settings.rank) })}
              className={cn(
                "bevel-sm min-h-11 border px-4 py-3 text-left transition-colors",
                settings.format === f ? "border-gold-500 bg-night-850" : "border-night-700 hover:border-gold-500/60",
              )}
            >
              <span className="block font-heading font-bold text-chalk-100">{t(`pages.draftSimulatorUI.formats.${f}`)}</span>
              <span className="mt-0.5 block text-xs leading-snug text-chalk-500">
                {t(`pages.draftSimulatorUI.formatHelp.${f}`, { n: bansPerSide(f, rankForFormat(f, settings.rank)) })}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <ChoiceRow
          legend={t("pages.draftSimulatorUI.settings.rank")}
          values={formatRanks}
          selected={settings.rank}
          labelOf={(r) => t(`measuredRanks.${r}`)}
          onChange={(r) => r && onChange({ rank: r })}
        />
        {settings.format === "ranked" && (
          <p className="mt-2 text-xs text-chalk-500">
            {t("pages.draftSimulatorUI.settings.rankHelp", { n: bansPerSide("ranked", settings.rank) })}
          </p>
        )}
      </div>

      <ChoiceRow
        legend={t("pages.draftSimulatorUI.settings.side")}
        values={CONTROLS}
        selected={settings.control}
        labelOf={(c) => t(`pages.draftSimulatorUI.controls.${c}`)}
        onChange={(c) => c && onChange({ control: c })}
      />

      <div>
        <button
          type="button"
          role="switch"
          aria-checked={botOn}
          disabled={botUseless}
          onClick={() => onChange({ bot: !settings.bot })}
          className="inline-flex min-h-11 items-center gap-3 disabled:opacity-50"
        >
          <span
            aria-hidden
            className={cn("relative block h-6 w-11 shrink-0 rounded-full transition-colors", botOn ? "bg-gold-500" : "bg-night-700")}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 block size-5 rounded-full bg-chalk-100 transition-transform motion-reduce:transition-none",
                botOn && "translate-x-5",
              )}
            />
          </span>
          <span className="text-sm font-semibold text-chalk-100">{t("pages.draftSimulatorUI.settings.bot")}</span>
        </button>
        <p className="mt-1 max-w-2xl text-xs text-chalk-500">
          {botUseless ? t("pages.draftSimulatorUI.settings.botBoth") : t("pages.draftSimulatorUI.settings.botHelp")}
        </p>
      </div>

      <div>
        <ChoiceRow
          legend={t("pages.draftSimulatorUI.settings.timer")}
          values={TIMER_SETTINGS}
          selected={settings.timer}
          labelOf={(m) => t(`pages.draftSimulatorUI.timers.${m}`, { n: FIXED_TIMER, ban: GAME_TIMERS.ban, pick: GAME_TIMERS.pick })}
          onChange={(m) => m && onChange({ timer: m })}
        />
        <p className="mt-2 max-w-2xl text-xs text-chalk-500">{t("pages.draftSimulatorUI.settings.timerHelp")}</p>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="bevel-sm inline-flex min-h-11 items-center gap-2 bg-gold-500 px-5 py-2.5 font-semibold text-night-950 transition-colors hover:bg-gold-400"
      >
        <Play size={16} aria-hidden />
        {t("pages.draftSimulatorUI.settings.start")}
      </button>
    </section>
  );
}

/**
 * Row of choices 44 px high: the shared chips, lower, are hard to hit with a
 * finger on a board where every turn counts. With `all`, one more button
 * resets the filter.
 */
function ChoiceRow<V extends string>({
  legend,
  all,
  values,
  selected,
  labelOf,
  onChange,
}: {
  legend: string;
  all?: string;
  values: readonly V[];
  selected: V | null;
  labelOf: (v: V) => string;
  onChange: (v: V | null) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden className={cn("mr-1 w-full sm:w-auto", label)}>
        {legend}
      </span>
      {all !== undefined && (
        <button
          type="button"
          aria-pressed={selected === null}
          onClick={() => onChange(null)}
          className={cn(classesPuce(selected === null), "min-h-11")}
        >
          {all}
        </button>
      )}
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={selected === v}
          onClick={() => onChange(all !== undefined && selected === v ? null : v)}
          className={cn(classesPuce(selected === v), "min-h-11")}
        >
          {labelOf(v)}
        </button>
      ))}
    </fieldset>
  );
}

// -- Board ----------------------------------------------------------------

function TeamColumn({
  side,
  turns,
  choices,
  turn,
  bySlug,
  lanes,
  isPlayer,
  hidden,
}: {
  side: Side;
  turns: Turn[];
  choices: Choice[];
  turn: Turn | null;
  bySlug: Map<string, SimulationHero>;
  lanes: Map<string, Lane>;
  /** True when the player holds this side. */
  isPlayer: boolean;
  hidden: (i: number) => boolean;
}) {
  const t = useT();
  const color = sideColor[side];
  const bans = turns.filter((tr) => tr.side === side && tr.action === "ban");
  const picks = turns.filter((tr) => tr.side === side && tr.action === "pick");
  const onTurn = turn?.side === side;
  const current = "ring-2 ring-gold-500 motion-safe:animate-pulse";

  return (
    <section
      aria-labelledby={`side-${side}`}
      className={cn("bevel-sm min-w-0 border bg-night-900/60 p-2 transition-colors sm:p-3", onTurn ? color.border : "border-night-700/70")}
    >
      <h3
        id={`side-${side}`}
        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-heading text-sm font-bold text-chalk-100 sm:text-base"
      >
        <span aria-hidden className={cn("size-2.5 rounded-full", color.fill)} />
        <span className={color.text}>{t(`pages.draftSimulatorUI.sides.${side}`)}</span>
        <span className="text-xs font-medium text-chalk-500">{t(isPlayer ? "pages.draftSimulatorUI.you" : "pages.draftSimulatorUI.bot")}</span>
      </h3>

      <p className={cn("mt-2", label)}>{t("pages.draftSimulatorUI.bans")}</p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {bans.map((tr) => {
          const played = tr.index < choices.length;
          const c = choices[tr.index];
          const masked = played && hidden(tr.index);
          const h = played && c && !masked ? bySlug.get(c) : null;
          const slotState = h
            ? h.nom
            : masked
              ? t("pages.draftSimulatorUI.hiddenBan")
              : played
                ? t("pages.draftSimulatorUI.emptyBan")
                : turn?.index === tr.index
                  ? t("pages.draftSimulatorUI.inProgress")
                  : t("pages.draftSimulatorUI.upcoming");
          return (
            <li key={tr.index} title={slotState}>
              <span className="sr-only">
                {t("pages.draftSimulatorUI.banSlot", { k: tr.number })} : {slotState}
              </span>
              <span
                aria-hidden
                className={cn(
                  "bevel-sm grid size-8 place-items-center overflow-hidden border text-xs text-chalk-500",
                  h ? "border-transparent" : "border-dashed border-night-600",
                  turn?.index === tr.index && current,
                )}
              >
                {h ? (
                  <span className="grayscale">
                    <VignetteHeros heros={h} petite />
                  </span>
                ) : masked ? (
                  "?"
                ) : played ? (
                  "—"
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <p className={cn("mt-3", label)}>{t("pages.draftSimulatorUI.picks")}</p>
      <ol className="mt-1 space-y-1">
        {picks.map((tr) => {
          const c = choices[tr.index];
          const h = c ? bySlug.get(c) : null;
          const lane = c ? lanes.get(c) : undefined;
          const inProgress = turn?.index === tr.index;
          return (
            <li
              key={tr.index}
              className={cn(
                "bevel-sm flex min-h-11 items-center gap-2 border px-1.5 py-1",
                h ? "border-night-700/70" : "border-dashed border-night-700",
                inProgress && current,
              )}
            >
              <span className="sr-only">{t("pages.draftSimulatorUI.pickSlot", { k: tr.number })} :</span>
              {h ? (
                <>
                  <VignetteHeros heros={h} petite />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-chalk-100 sm:text-sm">{h.nom}</span>
                    {lane && <span className="block truncate text-[0.65rem] text-chalk-500 sm:text-xs">{t(`lanes.${lane}`)}</span>}
                  </span>
                </>
              ) : (
                <span className="truncate text-xs text-chalk-500">
                  {inProgress ? t("pages.draftSimulatorUI.inProgress") : t("pages.draftSimulatorUI.toPick")}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Countdown of one turn. It mounts afresh every turn (its key changes); at
 * zero it applies the game rule once: empty ban or random pick.
 */
function Countdown({ seconds, onEnd }: { seconds: number; onEnd: () => void }) {
  const t = useT();
  const [left, setLeft] = useState(seconds);
  const end = useRef(onEnd);
  useEffect(() => {
    end.current = onEnd;
  });
  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const r = Math.max(0, seconds - Math.floor((Date.now() - startedAt) / 1000));
      setLeft(r);
      if (r === 0) {
        window.clearInterval(id);
        end.current();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [seconds]);

  return (
    <span
      role="timer"
      aria-label={t("pages.draftSimulatorUI.timerLabel", { n: left })}
      className={cn(
        "bevel-sm inline-flex min-h-11 min-w-16 items-center justify-center border px-3 font-heading text-xl font-bold tabular-nums",
        left <= 5 ? "border-blood-500 text-blood-500" : "border-night-700 text-chalk-100",
      )}
    >
      {t("pages.draftSimulatorUI.seconds", { n: left })}
    </span>
  );
}

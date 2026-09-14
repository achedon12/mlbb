import { describe, expect, it } from "vitest";
import type { MeasuresRank } from "@/lib/composition";
import type { DraftHero } from "@/lib/draft";
import {
  botMove,
  DEFAULT_SETTINGS,
  draftState,
  expandTurns,
  matchupsBetween,
  measuredAdvantage,
  play,
  playedBy,
  rankForFormat,
  RANKED_BANS,
  rankPicks,
  readSimulation,
  replay,
  sequence,
  timeoutMove,
  turnTimer,
  undo,
  unavailableHeroes,
  writeAssistant,
  writeSimulation,
  type BotContext,
  type Choice,
  type Settings,
  type Turn,
} from "@/lib/draft-simulation";
import type { Lane } from "@/lib/types";

const hero = (slug: string, lanes: Lane[], o: Partial<DraftHero> = {}): DraftHero => ({
  slug,
  name: slug.toUpperCase(),
  lanes,
  roles: ["Fighter"],
  icon: null,
  win: 50,
  strongAgainst: [],
  weakAgainst: [],
  synergies: [],
  ...o,
});

/** Twenty-five heroes, five per lane: enough for a whole draft. */
const ROSTER_LANES: Lane[] = ["Gold", "Jungle", "Mid", "Exp", "Roam"];
const roster: DraftHero[] = ROSTER_LANES.flatMap((lane) =>
  Array.from({ length: 5 }, (_, i) => hero(`${lane.toLowerCase()}-${i}`, [lane])),
);
const known = new Set(roster.map((h) => h.slug));

const emptyMeasures = (o: Partial<MeasuresRank> = {}): MeasuresRank => ({
  rank: "mythic",
  stats: {},
  buckets: [],
  duration: {},
  teammates: {},
  weak: {},
  ...o,
});

const outline = (turns: Turn[]) => turns.map((t) => `${t.side[0]}${t.action[0]}`).join(" ");

/** A whole legal draft for the given table: empty bans, one hero per lane on each side. */
function finished(turns: Turn[]): Choice[] {
  const blue = ["gold-0", "jungle-0", "mid-0", "exp-0", "roam-0"];
  const red = ["gold-1", "jungle-1", "mid-1", "exp-1", "roam-1"];
  return turns.map((t) => (t.action === "ban" ? null : (t.side === "blue" ? blue : red)[t.number - 1]));
}

describe("format tables", () => {
  it("ranked: simultaneous bans by rank, then picks 1-2-2-2-2-1", () => {
    expect(sequence("ranked", "mythic")).toEqual([
      { side: "both", action: "ban", count: 5 },
      { side: "blue", action: "pick", count: 1 },
      { side: "red", action: "pick", count: 2 },
      { side: "blue", action: "pick", count: 2 },
      { side: "red", action: "pick", count: 2 },
      { side: "blue", action: "pick", count: 2 },
      { side: "red", action: "pick", count: 1 },
    ]);
    expect(RANKED_BANS).toEqual({ epic: 3, legend: 4, mythic: 5, honor: 5, glory: 5 });
    expect(expandTurns(sequence("ranked", "epic"))).toHaveLength(6 + 10);
    expect(expandTurns(sequence("ranked", "legend"))).toHaveLength(8 + 10);
    expect(expandTurns(sequence("ranked", "glory"))).toHaveLength(10 + 10);
  });

  it("tournament: ten alternating bans, blue first", () => {
    const turns = expandTurns(sequence("tournament", "all"));
    expect(outline(turns)).toBe("bb rb bb rb bb rb bb rb bb rb bp rp rp bp bp rp rp bp bp rp");
    expect(turns.every((t) => !t.simultaneous)).toBe(true);
  });

  it("a simultaneous step unfolds into blue then red bans, numbered per side", () => {
    const turns = expandTurns(sequence("ranked", "epic"));
    expect(outline(turns.slice(0, 6))).toBe("bb bb bb rb rb rb");
    expect(turns.slice(0, 6).map((t) => t.number)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(turns.slice(0, 6).every((t) => t.simultaneous)).toBe(true);
    expect(turns[6]).toMatchObject({ side: "blue", action: "pick", number: 1, simultaneous: false });
  });

  it("ranked has no draft below Epic", () => {
    expect(rankForFormat("ranked", "all")).toBe("mythic");
    expect(rankForFormat("tournament", "all")).toBe("all");
  });

  it("timers: off, 30 s, or the game's (25 s to ban, 30 s to pick)", () => {
    expect(turnTimer("off", "ban")).toBeNull();
    expect(turnTimer("30", "ban")).toBe(30);
    expect(turnTimer("game", "ban")).toBe(25);
    expect(turnTimer("game", "pick")).toBe(30);
  });
});

describe("playing a draft", () => {
  const turns = expandTurns(sequence("ranked", "epic"));

  it("a side may ban the hero the other side banned during simultaneous bans", () => {
    let choices: Choice[] = [];
    for (const slug of ["gold-0", "gold-1", "gold-2", "gold-0"]) choices = play(turns, choices, slug, known)!;
    expect(choices).toEqual(["gold-0", "gold-1", "gold-2", "gold-0"]);
    // But not the same hero twice on its own side.
    expect(play(turns, choices, "gold-0", known)).toBeNull();
  });

  it("both sides' bans apply once the round is over", () => {
    const choices = ["gold-0", "gold-1", "gold-2", "jungle-0", "jungle-1", "jungle-2"];
    expect([...unavailableHeroes(turns, choices, turns[6])].sort()).toEqual([
      "gold-0",
      "gold-1",
      "gold-2",
      "jungle-0",
      "jungle-1",
      "jungle-2",
    ]);
    expect(play(turns, choices, "gold-1", known)).toBeNull();
    expect(play(turns, choices, "gold-3", known)).toEqual([...choices, "gold-3"]);
  });

  it("only a ban may stay empty; an unknown hero is refused", () => {
    const bans = ["gold-0", null, "gold-2", null, null, null];
    expect(replay(turns, bans, known)).toEqual(bans);
    expect(play(turns, bans, null, known)).toBeNull();
    expect(play(turns, bans, "unknown", known)).toBeNull();
  });

  it("the state sorts bans and picks by side and knows the current turn", () => {
    const choices = ["gold-0", null, "gold-2", "gold-3", "gold-4", null, "jungle-0", "roam-0"];
    const state = draftState(turns, choices);
    expect(state.bans).toEqual({ blue: ["gold-0", null, "gold-2"], red: ["gold-3", "gold-4", null] });
    expect(state.picks).toEqual({ blue: ["jungle-0"], red: ["roam-0"] });
    expect(state.current).toMatchObject({ side: "red", action: "pick", number: 2 });
    expect(draftState(turns, replay(turns, finished(turns), known)).current).toBeNull();
  });

  it("replay stops at the first illegal move", () => {
    expect(replay(turns, ["gold-0", "gold-0", "gold-1"], known)).toEqual(["gold-0"]);
  });

  it("undo goes back to the player's last move, over the bot's", () => {
    const isHuman = (t: Turn) => playedBy({ bot: true, control: "blue" }, t) === "player";
    const choices = ["gold-0", "gold-1", "gold-2", "gold-3", "gold-4", null, "jungle-0", "roam-0", "roam-1"];
    expect(undo(turns, choices, isHuman)).toEqual(choices.slice(0, 6));
    expect(undo(turns, [], isHuman)).toEqual([]);
    expect(playedBy({ bot: false, control: "blue" }, turns[3])).toBe("player");
    expect(playedBy({ bot: true, control: "both" }, turns[3])).toBe("player");
    expect(playedBy({ bot: true, control: "blue" }, turns[3])).toBe("bot");
  });
});

describe("shareable address", () => {
  const settings: Settings = { format: "tournament", rank: "glory", control: "red", bot: false, timer: "game", seed: 42 };

  it("writes then reads back the draft and its settings", () => {
    const choices: Choice[] = ["gold-0", null, "jungle-0"];
    const query = writeSimulation("?x=1", settings, choices);
    expect(query).toBe("x=1&mode=simulator&format=tournament&rank=glory&side=red&bot=0&timer=game&seed=42&draft=gold-0,_,jungle-0");
    expect(readSimulation(`?${query}`, known, ["all", "glory"])).toEqual({ settings, choices });
  });

  it("without ?mode=simulator the page stays on the draft assistant", () => {
    expect(readSimulation("?format=ranked", known, ["mythic"])).toBeNull();
    expect(writeAssistant("?x=1&mode=simulator&draft=gold-0&seed=3")).toBe("x=1");
  });

  it("unknown values fall back to the default settings", () => {
    const read = readSimulation("?mode=simulator&format=blitz&rank=bronze&side=green&timer=9&seed=-4", known, ["mythic"]);
    expect(read).toEqual({ settings: DEFAULT_SETTINGS, choices: [] });
  });

  it("in ranked, a rank without draft becomes Mythic", () => {
    expect(readSimulation("?mode=simulator&format=ranked&rank=all", known, ["all", "mythic"])?.settings.rank).toBe("mythic");
  });
});

describe("bot", () => {
  const meta = [
    "gold-0",
    "jungle-0",
    "mid-0",
    "roam-0",
    "exp-0",
    "gold-1",
    "jungle-1",
    "mid-1",
    "roam-1",
    "exp-1",
    "gold-2",
    "jungle-2",
  ].map((slug) => ({ slug, tier: "S" as const, banRate: 20, winRate: 52 }));
  const ctx = (o: Partial<BotContext> = {}): BotContext => ({ catalog: roster, measures: null, meta, seed: 7, ...o });

  function botDraft(turns: Turn[], c: BotContext): Choice[] {
    let choices: Choice[] = [];
    for (;;) {
      const move = botMove(turns, choices, c);
      if (!move) return choices;
      const next = play(turns, choices, move.slug, known);
      if (!next) throw new Error(`refused move: ${move.slug}`);
      choices = next;
    }
  }

  it("bans from the top of the rank's tier list, and says so", () => {
    const turns = expandTurns(sequence("tournament", "mythic"));
    const move = botMove(turns, [], ctx())!;
    expect(meta.slice(0, 3).map((e) => e.slug)).toContain(move.slug);
    expect(move.reason).toEqual({ type: "meta", tier: "S", banRate: 20 });
  });

  it("plays a whole draft without an illegal move and covers the five lanes of each side", () => {
    const turns = expandTurns(sequence("ranked", "mythic"));
    const choices = botDraft(turns, ctx());
    expect(choices).toHaveLength(turns.length);
    const { picks } = draftState(turns, choices);
    for (const side of ["blue", "red"] as const) {
      expect(new Set(picks[side].map((s) => s.split("-")[0])).size).toBe(5);
    }
  });

  it("is reproducible: same seed, same draft", () => {
    const turns = expandTurns(sequence("tournament", "mythic"));
    expect(botDraft(turns, ctx())).toEqual(botDraft(turns, ctx()));
  });

  it("picks the measured counter to an enemy pick, and gives the points", () => {
    const turns = expandTurns(sequence("tournament", "mythic"));
    // Empty bans, then blue takes gold-0; red answers.
    const choices: Choice[] = [...Array(10).fill(null), "gold-0"];
    const measures = emptyMeasures({ weak: { "gold-0": [["jungle-3", -3.2]] } });
    const [best] = rankPicks(turns, choices, turns[choices.length], ctx({ measures }));
    expect(best.slug).toBe("jungle-3");
    expect(best.reason).toEqual({ type: "counter", targets: ["gold-0"], points: 3.2 });
    expect(best.lane).toBe("Jungle");
  });

  it("prefers a measured duo with its own picks", () => {
    const turns = expandTurns(sequence("tournament", "mythic"));
    const choices: Choice[] = [...Array(10).fill(null), "gold-0", "gold-1", "roam-1"];
    const measures = emptyMeasures({ teammates: { "gold-0": [["mid-4", 2.1]] } });
    const [best] = rankPicks(turns, choices, turns[choices.length], ctx({ measures }));
    expect(best).toMatchObject({ slug: "mid-4", reason: { type: "duo", partners: ["gold-0"], points: 2.1 } });
  });

  it("falls back on wiki relations when nothing is measured", () => {
    const catalog = roster.map((h) => (h.slug === "roam-2" ? { ...h, strongAgainst: ["gold-0"] } : h));
    const turns = expandTurns(sequence("tournament", "mythic"));
    const choices: Choice[] = [...Array(10).fill(null), "gold-0"];
    const [best] = rankPicks(turns, choices, turns[choices.length], ctx({ catalog }));
    expect(best).toMatchObject({ slug: "roam-2", reason: { type: "counter", targets: ["gold-0"], points: null } });
  });

  it("on timeout, a ban stays empty and a pick is drawn among open lanes", () => {
    const turns = expandTurns(sequence("tournament", "mythic"));
    expect(timeoutMove(turns, [], roster, 3)).toEqual({ slug: null, reason: { type: "skipped" }, lane: null });
    const choices: Choice[] = [...Array(10).fill(null), "gold-0", "gold-1", "jungle-1"];
    const move = timeoutMove(turns, choices, roster, 3)!;
    expect(move.reason).toEqual({ type: "random" });
    expect(move.slug?.startsWith("gold-")).toBe(false);
    expect(play(turns, choices, move.slug, known)).not.toBeNull();
  });
});

describe("summary", () => {
  const measures = emptyMeasures({
    // gold-0 (blue) loses 3 points to gold-1 (red); jungle-1 (red) loses 1 point to jungle-0 (blue).
    weak: { "gold-0": [["gold-1", -3]], "jungle-1": [["jungle-0", -1]], "gold-1": [["gold-0", -1]] },
    teammates: { "gold-0": [["jungle-0", 2]] },
  });

  it("reads each matchup both ways, from the blue side", () => {
    expect(matchupsBetween(["gold-0", "jungle-0"], ["gold-1", "jungle-1"], measures)).toEqual([
      { blue: "gold-0", red: "gold-1", points: -1 },
      { blue: "jungle-0", red: "jungle-1", points: 1 },
    ]);
  });

  it("gives a bounded index in points, and the number of measurements behind it", () => {
    const a = measuredAdvantage(["gold-0", "jungle-0"], ["gold-1", "jungle-1"], measures);
    expect(a).toEqual({ counters: 0, duos: { blue: 2, red: 0 }, total: 2, blueShare: 0.6, measures: 3 });
    const crushed = measuredAdvantage(["gold-0"], ["gold-1"], emptyMeasures({ weak: { "gold-1": [["gold-0", -40]] } }));
    expect(crushed.blueShare).toBe(0.95);
  });
});

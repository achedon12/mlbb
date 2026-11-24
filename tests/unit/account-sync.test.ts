import { describe, expect, it } from "vitest";
import {
  cleanData,
  cleanStats,
  emptyData,
  liveMonths,
  mergeCount,
  mergeData,
  mergeFavourites,
  mergeStats,
  mergeStreak,
  progressOf,
  publicView,
  readSyncMeta,
  reconcile,
  sameData,
  type SyncData,
} from "@/lib/account-sync";
import type { StatsQuiz } from "@/lib/quiz";

const NOW = Date.parse("2026-11-24T12:00:00Z");
const stats = (o: Partial<StatsQuiz>): StatsQuiz => ({ joues: 0, serie: 0, meilleure: 0, dernier: null, distribution: [], ...o });
type Partly = Omit<Partial<SyncData>, "quiz" | "mlbbdle"> & { quiz?: Partial<SyncData["quiz"]>; mlbbdle?: Partial<SyncData["mlbbdle"]> };
const data = (o: Partly = {}): SyncData => {
  const e = emptyData();
  return {
    ...e,
    ...o,
    quiz: { ...e.quiz, ...o.quiz },
    mlbbdle: { ...e.mlbbdle, ...o.mlbbdle },
  };
};

describe("streaks", () => {
  it("joins two runs that touch: Monday on the phone, Tuesday on the laptop", () => {
    expect(mergeStreak({ serie: 5, dernier: "2026-11-23" }, { serie: 1, dernier: "2026-11-24" })).toEqual({ serie: 6, dernier: "2026-11-24" });
  });

  it("joins overlapping runs into their union", () => {
    expect(mergeStreak({ serie: 4, dernier: "2026-11-22" }, { serie: 3, dernier: "2026-11-24" })).toEqual({ serie: 6, dernier: "2026-11-24" });
    // One run inside the other: the longer one.
    expect(mergeStreak({ serie: 10, dernier: "2026-11-24" }, { serie: 2, dernier: "2026-11-23" })).toEqual({ serie: 10, dernier: "2026-11-24" });
  });

  it("keeps the most recent run when a day is missing between them", () => {
    expect(mergeStreak({ serie: 9, dernier: "2026-11-21" }, { serie: 2, dernier: "2026-11-24" })).toEqual({ serie: 2, dernier: "2026-11-24" });
  });

  it("is the same whichever side is which, and the same merged twice", () => {
    const a = { serie: 3, dernier: "2026-11-20" };
    const b = { serie: 4, dernier: "2026-11-24" };
    const once = mergeStreak(a, b);
    expect(mergeStreak(b, a)).toEqual(once);
    expect(mergeStreak(once, b)).toEqual(once);
  });

  it("treats an empty side as nothing", () => {
    expect(mergeStreak({ serie: 0, dernier: null }, { serie: 3, dernier: "2026-11-24" })).toEqual({ serie: 3, dernier: "2026-11-24" });
    expect(mergeStreak({ serie: 3, dernier: "2026-11-24" }, { serie: 0, dernier: null })).toEqual({ serie: 3, dernier: "2026-11-24" });
  });
});

describe("counters", () => {
  it("adds what this side gained since the agreed copy", () => {
    expect(mergeCount(10, 12, 15)).toBe(17);
    // Nothing gained here: the other side's value.
    expect(mergeCount(10, 10, 15)).toBe(15);
  });

  it("without an agreed copy, keeps the larger: never counted twice, never lost", () => {
    expect(mergeCount(null, 12, 7)).toBe(12);
    expect(mergeCount(null, 3, 7)).toBe(7);
  });

  it("merges a day's stats: counts, distribution, streak and record", () => {
    const base = stats({ joues: 3, serie: 3, meilleure: 3, dernier: "2026-11-22", distribution: [0, 1, 2] });
    const local = stats({ joues: 4, serie: 4, meilleure: 4, dernier: "2026-11-23", distribution: [0, 1, 3] });
    const remote = stats({ joues: 4, serie: 1, meilleure: 6, dernier: "2026-11-24", distribution: [0, 2, 2] });
    const merged = mergeStats(base, local, remote);
    expect(merged.distribution).toEqual([0, 2, 3]);
    expect(merged.joues).toBe(5);
    expect(merged.dernier).toBe("2026-11-24");
    expect(merged.serie).toBe(5);
    expect(merged.meilleure).toBe(6);
  });

  it("never reports fewer days than the distribution holds", () => {
    const merged = mergeStats(null, stats({ joues: 2, distribution: [0, 2] }), stats({ joues: 2, distribution: [0, 0, 2] }));
    expect(merged.joues).toBe(4);
  });
});

describe("favourites", () => {
  it("first sync: the union, this side's order first", () => {
    expect(mergeFavourites(null, ["layla", "miya"], ["miya", "alucard"])).toEqual(["layla", "miya", "alucard"]);
  });

  it("three ways: a removal here stays removed, an addition elsewhere appears", () => {
    const base = ["layla", "miya"];
    expect(mergeFavourites(base, ["layla"], ["layla", "miya", "tigreal"])).toEqual(["layla", "tigreal"]);
  });

  it("three ways: a removal elsewhere goes when this side did not touch it", () => {
    expect(mergeFavourites(["layla", "miya"], ["layla", "miya"], ["layla"])).toEqual(["layla"]);
  });

  it("three ways: re-added here after a removal elsewhere is kept", () => {
    expect(mergeFavourites(["layla"], ["layla", "miya"], [])).toEqual(["miya"]);
  });
});

describe("cleaning", () => {
  it("drops what is not progress", () => {
    const clean = cleanData(
      {
        favourites: ["layla", "Layla!", "layla", 3, "<script>"],
        quiz: { daily: { joues: -4, serie: 2.7, meilleure: "x", dernier: "2026-02-30", distribution: [1, -1, "a"] } },
        reminders: ["2026-12", "2026-13", "2020-01", "2026-12"],
        extra: { anything: true },
      },
      NOW,
    );
    expect(clean.favourites).toEqual(["layla"]);
    expect(clean.quiz.daily).toEqual({ joues: 1, serie: 0, meilleure: 0, dernier: null, distribution: [1, 0, 0] });
    expect(clean.reminders).toEqual(["2026-12"]);
    expect(clean).not.toHaveProperty("extra");
  });

  it("reads garbage as empty, never throws", () => {
    for (const raw of [null, undefined, 3, "x", [], { quiz: 3, mlbbdle: [] }]) expect(sameData(cleanData(raw, NOW), emptyData())).toBe(true);
    expect(cleanStats({ serie: 5 })).toEqual(stats({}));
  });

  it("keeps a month a couple of days after it opened, not after", () => {
    expect(liveMonths(["2026-11", "2026-12"], Date.parse("2026-11-02T00:00:00Z"))).toEqual(["2026-11", "2026-12"]);
    expect(liveMonths(["2026-11", "2026-12"], Date.parse("2026-11-10T00:00:00Z"))).toEqual(["2026-12"]);
  });

  it("reads back what the browser remembers, or nothing", () => {
    expect(readSyncMeta(null)).toBeNull();
    expect(readSyncMeta("{bad")).toBeNull();
    expect(readSyncMeta(JSON.stringify({ updatedAt: "x" }))).toBeNull();
    const meta = readSyncMeta(JSON.stringify({ account: "k", updatedAt: "2026-11-24T00:00:00.000Z", base: { favourites: ["layla"] } }));
    expect(meta?.account).toBe("k");
    expect(meta?.base.favourites).toEqual(["layla"]);
  });
});

describe("reconcile", () => {
  const remote = (d: SyncData, updatedAt = "2026-11-24T10:00:00.000Z") => ({ data: d, updatedAt });
  const phone = data({ favourites: ["layla"], quiz: { daily: stats({ joues: 5, serie: 5, meilleure: 5, dernier: "2026-11-23", distribution: [0, 0, 5] }) } });
  const laptop = data({ favourites: ["miya"], quiz: { daily: stats({ joues: 1, serie: 1, meilleure: 1, dernier: "2026-11-24", distribution: [0, 1] }) } });

  it("first sign-in on a browser with progress and no account copy: sends it all", () => {
    const r = reconcile(phone, null, null, "acc", NOW);
    expect(r).toMatchObject({ upload: true, firstMerge: true, deleted: false });
    expect(r.result).toEqual(phone);
  });

  it("first sign-in, nothing played anywhere: nothing sent", () => {
    expect(reconcile(emptyData(), null, null, "acc", NOW).upload).toBe(false);
  });

  it("first sign-in on a second device: merges both, loses nothing, joins the streak", () => {
    const r = reconcile(laptop, null, remote(phone), "acc", NOW);
    expect(r.firstMerge).toBe(true);
    expect(r.upload).toBe(true);
    expect(r.result.favourites).toEqual(["miya", "layla"]);
    expect(r.result.quiz.daily.serie).toBe(6);
    expect(r.result.quiz.daily.meilleure).toBe(6);
    // The larger count per score: at least as many days as the distribution holds.
    expect(r.result.quiz.daily.joues).toBe(6);
    expect(r.result.quiz.daily.distribution).toEqual([0, 1, 5]);
  });

  it("nothing changed anywhere: nothing to do", () => {
    const meta = { account: "acc", updatedAt: "2026-11-24T10:00:00.000Z", base: phone };
    expect(reconcile(phone, meta, remote(phone), "acc", NOW)).toMatchObject({ upload: false, firstMerge: false, deleted: false, result: phone });
  });

  it("changed here only: sends the local copy", () => {
    const meta = { account: "acc", updatedAt: "2026-11-24T10:00:00.000Z", base: phone };
    const local = { ...phone, favourites: ["layla", "tigreal"] };
    expect(reconcile(local, meta, remote(phone), "acc", NOW)).toMatchObject({ upload: true, result: local });
  });

  it("changed elsewhere only: takes the account copy", () => {
    const meta = { account: "acc", updatedAt: "2026-11-24T09:00:00.000Z", base: phone };
    const newer = { ...phone, favourites: ["layla", "tigreal"] };
    const r = reconcile(phone, meta, remote(newer), "acc", NOW);
    expect(r.upload).toBe(false);
    expect(r.result).toEqual(newer);
  });

  it("changed on both sides: three-way merge, sent", () => {
    const meta = { account: "acc", updatedAt: "2026-11-24T09:00:00.000Z", base: phone };
    const here = { ...phone, favourites: ["tigreal"] };
    const there = { ...phone, favourites: ["layla", "miya"] };
    const r = reconcile(here, meta, remote(there), "acc", NOW);
    expect(r.result.favourites).toEqual(["tigreal", "miya"]);
    expect(r.upload).toBe(true);
  });

  it("the account copy was deleted elsewhere: nothing sent back, the browser keeps its own", () => {
    const meta = { account: "acc", updatedAt: "2026-11-24T09:00:00.000Z", base: phone };
    expect(reconcile(phone, meta, null, "acc", NOW)).toMatchObject({ deleted: true, upload: false, result: phone });
  });

  it("a browser last synced with another account merges instead of dropping its progress", () => {
    const meta = { account: "other", updatedAt: "2026-11-24T09:00:00.000Z", base: phone };
    const r = reconcile(phone, meta, remote(laptop), "acc", NOW);
    expect(r.firstMerge).toBe(true);
    expect(r.result.favourites).toEqual(["layla", "miya"]);
  });

  it("merging is stable: merging the result again changes nothing", () => {
    const once = mergeData(null, laptop, phone, NOW);
    expect(sameData(mergeData(once, once, once, NOW), once)).toBe(true);
    expect(sameData(mergeData(null, once, phone, NOW), once)).toBe(true);
  });
});

describe("progress and badges", () => {
  it("counts a streak only while it is alive", () => {
    const d = data({ quiz: { daily: stats({ joues: 8, serie: 8, meilleure: 8, dernier: "2026-11-20" }) } });
    expect(progressOf(d, "2026-11-21").quiz.streak).toBe(8);
    expect(progressOf(d, "2026-11-24").quiz.streak).toBe(0);
    expect(progressOf(d, "2026-11-24").quiz.bestStreak).toBe(8);
  });

  it("awards the milestones", () => {
    const d = data({
      favourites: ["a", "b", "c", "d", "e"],
      quiz: { daily: stats({ joues: 10, serie: 7, meilleure: 7, dernier: "2026-11-24", distribution: [0, 0, 0, 10] }) },
      mlbbdle: {
        classic: stats({ joues: 8, serie: 2, meilleure: 2, dernier: "2026-11-24", distribution: [0, 1, 7] }),
        skill: stats({ joues: 2, serie: 1, meilleure: 1, dernier: "2026-11-24", distribution: [0, 0, 2] }),
      },
    });
    const p = progressOf(d, "2026-11-24");
    expect(p.badges).toEqual(["streak7", "mlbbdle10", "firstTry", "quiz10", "allGames", "favourites5"]);
    expect(p.quiz.bestScore).toBe(3);
    expect(p.mlbbdle).toMatchObject({ solved: 10, fewestGuesses: 1 });
  });

  it("no badge for a newcomer", () => {
    expect(progressOf(emptyData(), "2026-11-24").badges).toEqual([]);
  });
});

describe("public view", () => {
  const d = data({ favourites: ["layla"], quiz: { daily: stats({ joues: 3, serie: 3, meilleure: 3, dernier: "2026-11-24" }) } });

  it("shows only the name when nothing is chosen", () => {
    expect(publicView({ name: "P", avatar: "https://x", fields: [], data: d, today: "2026-11-24" })).toEqual({ name: "P", avatar: null });
  });

  it("shows exactly the chosen fields", () => {
    const view = publicView({ name: "P", avatar: "https://x", fields: ["quiz", "avatar"], data: d, today: "2026-11-24" });
    expect(Object.keys(view).sort()).toEqual(["avatar", "name", "quiz"]);
    expect(view.avatar).toBe("https://x");
    expect(view.quiz?.streak).toBe(3);
  });

  it("ignores a field it does not know", () => {
    const view = publicView({ name: "P", avatar: null, fields: ["reminders", "id"], data: d, today: "2026-11-24" });
    expect(view).toEqual({ name: "P", avatar: null });
  });
});

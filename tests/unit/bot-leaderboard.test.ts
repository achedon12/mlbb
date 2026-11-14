import { describe, expect, it } from "vitest";
import { periodStart, rank, type ResultRow } from "@/lib/bot/leaderboard";

const row = (id: string, day: string, score: number, name = `user${id}`): ResultRow => ({
  discordUserId: id,
  discordUserName: name,
  day,
  score,
});

describe("daily game leaderboards", () => {
  it("ranks MLBBdle by days solved, then by fewest guesses on average", () => {
    const entries = rank("mlbbdle-classic", [
      row("1", "2026-11-13", 3),
      row("1", "2026-11-14", 5),
      row("2", "2026-11-14", 1),
      row("3", "2026-11-13", 2),
      row("3", "2026-11-14", 2),
    ]);
    expect(entries.map((e) => [e.discordUserId, e.rank, e.score, e.plays])).toEqual([
      ["3", 1, 2, 2],
      ["1", 2, 4, 2],
      ["2", 3, 1, 1],
    ]);
  });

  it("ranks the quiz by total points", () => {
    const entries = rank("quiz", [row("1", "2026-11-13", 4), row("1", "2026-11-14", 4), row("2", "2026-11-14", 7)]);
    expect(entries.map((e) => [e.discordUserId, e.score])).toEqual([
      ["1", 8],
      ["2", 7],
    ]);
  });

  it("shares a rank between equals and skips the next one", () => {
    const entries = rank("quiz", [row("b", "d", 5), row("a", "d", 5), row("c", "d", 3)]);
    expect(entries.map((e) => [e.discordUserId, e.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ]);
  });

  it("shows the latest name of a renamed player, and keeps the top ten", () => {
    const entries = rank("quiz", [row("1", "2026-11-13", 1, "old"), row("1", "2026-11-14", 1, "new")]);
    expect(entries[0].discordUserName).toBe("new");
    const many = Array.from({ length: 30 }, (_, i) => row(String(i).padStart(2, "0"), "d", i));
    expect(rank("quiz", many)).toHaveLength(10);
  });

  it("counts a week as the day and the six before", () => {
    expect(periodStart("day", "2026-11-14")).toBe("2026-11-14");
    expect(periodStart("week", "2026-11-14")).toBe("2026-11-08");
    expect(periodStart("all", "2026-11-14")).toBeNull();
  });
});

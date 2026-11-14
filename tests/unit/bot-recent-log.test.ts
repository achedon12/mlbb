import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRows, recentLogRows } from "@/lib/bot/recent-log";

const row = (t: string, level: string, message: string, extra: object = {}) => JSON.stringify({ t, level, message, ...extra });

describe("recent log rows", () => {
  it("keeps errors and the bot's warnings, message only", () => {
    const text = [
      row("2026-11-14T08:00:00Z", "error", "push failed", { stack: "secret stack" }),
      row("2026-11-14T08:01:00Z", "warning", "discord bot: unexpected answer", { issues: ["x"] }),
      row("2026-11-14T08:02:00Z", "warning", "something else"),
      row("2026-11-14T08:03:00Z", "info", "discord bot: retention"),
      "not json",
    ].join("\n");
    expect(parseRows(text)).toEqual([
      { t: "2026-11-14T08:00:00Z", level: "error", message: "push failed" },
      { t: "2026-11-14T08:01:00Z", level: "warning", message: "discord bot: unexpected answer" },
    ]);
  });

  it("reads today's and yesterday's files, newest first", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mlbbdex-logs-"));
    try {
      await writeFile(join(dir, "erreurs-2026-11-13.log"), row("2026-11-13T22:00:00Z", "error", "old") + "\n");
      await writeFile(join(dir, "erreurs-2026-11-14.log"), row("2026-11-14T09:00:00Z", "error", "new") + "\n");
      await writeFile(join(dir, "evenements-2026-11-14.log"), row("2026-11-14T09:30:00Z", "warning", "database backup failed") + "\n");
      const rows = await recentLogRows(10, new Date("2026-11-14T10:00:00Z"), dir);
      expect(rows.map((r) => r.message)).toEqual(["database backup failed", "new", "old"]);
      expect(await recentLogRows(10, new Date(), join(dir, "missing"))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

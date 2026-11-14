import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backupDate,
  backupName,
  KEEP,
  listBackups,
  needsCatchUp,
  pgEnv,
  readStatus,
  rotate,
  runBackup,
  SCHEDULE,
  startBackups,
  TIMEZONE,
  type Dumper,
} from "@/lib/db-backup";

/** Daily database backups: names, rotation to three, atomic writes, the lock, the schedule. */

vi.mock("@/lib/log", () => ({ log: vi.fn(async () => undefined), logError: vi.fn(async () => undefined) }));

const URL_ = "postgresql://mlbbdex:s%40cret@postgres:5432/mlbbdex?schema=public";
let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "mlbbdex-backup-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const day = (d: number, h = 3) => new Date(Date.UTC(2026, 10, d, h, 30, 0));
const writeDump: Dumper = async (file) => writeFile(file, "PGDMP fake dump");

describe("names", () => {
  it("names a backup by its UTC date and reads the date back", () => {
    expect(backupName(day(14))).toBe("mlbbdex-20261114-033000.dump");
    expect(backupDate("mlbbdex-20261114-033000.dump")?.toISOString()).toBe("2026-11-14T03:30:00.000Z");
    expect(backupDate("status.json")).toBeNull();
    expect(backupDate(".mlbbdex-20261114-033000.dump.partial")).toBeNull();
  });
});

describe("pgEnv", () => {
  it("passes the connection as libpq variables, Prisma's own parameters dropped", () => {
    expect(pgEnv(URL_)).toEqual({ PGHOST: "postgres", PGPORT: "5432", PGUSER: "mlbbdex", PGPASSWORD: "s@cret", PGDATABASE: "mlbbdex" });
    expect(pgEnv("postgres://u:p@db/x?sslmode=require")).toMatchObject({ PGPORT: "5432", PGSSLMODE: "require" });
    expect(() => pgEnv("mysql://u:p@db/x")).toThrow();
  });
});

describe("rotation", () => {
  it("keeps the three newest backups and deletes the rest, other files untouched", async () => {
    for (const d of [10, 11, 12, 13, 14]) await writeFile(join(dir, backupName(day(d))), "x");
    await writeFile(join(dir, "status.json"), "{}");
    await writeFile(join(dir, ".mlbbdex-20261109-033000.dump.partial"), "half");
    const removed = await rotate(dir, KEEP);
    expect(removed.sort()).toEqual([".mlbbdex-20261109-033000.dump.partial", backupName(day(10)), backupName(day(11))].sort());
    expect((await listBackups(dir)).map((b) => b.name)).toEqual([backupName(day(14)), backupName(day(13)), backupName(day(12))]);
    expect(await readdir(dir)).toContain("status.json");
  });

  it("lists nothing from a missing folder", async () => {
    expect(await listBackups(join(dir, "missing"))).toEqual([]);
  });
});

describe("runBackup", () => {
  it("writes the dump under its final name only once complete, then rotates", async () => {
    for (const d of [10, 11, 12]) await writeFile(join(dir, backupName(day(d))), "x");
    let seenDuring: string[] = [];
    const dump: Dumper = async (file, env) => {
      seenDuring = await readdir(dir);
      expect(file.endsWith(".partial")).toBe(true);
      expect(env.PGPASSWORD).toBe("s@cret");
      await writeDump(file, env);
    };
    const result = await runBackup({ trigger: "admin", dir, databaseUrl: URL_, dump, now: () => day(14) });
    expect(result).toMatchObject({ ok: true, removed: [backupName(day(10))] });
    // While pg_dump runs, the new backup is not listed (and the lock is held).
    expect(seenDuring).not.toContain(backupName(day(14)));
    expect(seenDuring).toContain(".backup.lock");
    const files = await readdir(dir);
    expect(files.filter((f) => f.endsWith(".dump"))).toHaveLength(3);
    expect(files).not.toContain(".backup.lock");
    expect(await readStatus(dir)).toMatchObject({ ok: true, file: backupName(day(14)), trigger: "admin" });
  });

  it("leaves no file behind when pg_dump fails, and records the failure", async () => {
    const dump: Dumper = async (file) => {
      await writeFile(file, "half");
      throw new Error("pg_dump exited with 1: connection refused");
    };
    const result = await runBackup({ trigger: "schedule", dir, databaseUrl: URL_, dump, now: () => day(14) });
    expect(result).toEqual({ ok: false, error: "pg_dump exited with 1: connection refused" });
    expect((await readdir(dir)).sort()).toEqual(["status.json"]);
    expect(await readStatus(dir)).toMatchObject({ ok: false, trigger: "schedule" });
  });

  it("refuses an empty dump", async () => {
    const result = await runBackup({ trigger: "schedule", dir, databaseUrl: URL_, dump: async (f) => writeFile(f, ""), now: () => day(14) });
    expect(result.ok).toBe(false);
    expect(await listBackups(dir)).toEqual([]);
  });

  it("runs once at a time, in this process and across processes", async () => {
    let release = () => {};
    const slow: Dumper = (file) => new Promise((resolve) => (release = () => void writeFile(file, "x").then(resolve)));
    const first = runBackup({ trigger: "admin", dir, databaseUrl: URL_, dump: slow, now: () => day(14) });
    await vi.waitFor(async () => expect(await readdir(dir)).toContain(".backup.lock"));
    expect(await runBackup({ trigger: "admin", dir, databaseUrl: URL_, dump: writeDump })).toEqual({ ok: false, error: "already_running" });
    release();
    expect((await first).ok).toBe(true);

    // Another process's lock, fresh: refused. Stale (a crashed run): taken over.
    await writeFile(join(dir, ".backup.lock"), "{}");
    expect(await runBackup({ trigger: "admin", dir, databaseUrl: URL_, dump: writeDump, now: () => new Date() })).toEqual({
      ok: false,
      error: "already_running",
    });
    const old = new Date(Date.now() - 3600_000);
    await utimes(join(dir, ".backup.lock"), old, old);
    expect((await runBackup({ trigger: "admin", dir, databaseUrl: URL_, dump: writeDump, now: () => new Date() })).ok).toBe(true);
  });

  it("fails cleanly without a database", async () => {
    expect(await runBackup({ trigger: "admin", dir, databaseUrl: "", dump: writeDump })).toMatchObject({ ok: false });
  });
});

describe("schedule", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("registers one backup a day at 03:30 UTC, without overlap", async () => {
    const schedule = vi.fn();
    const run = vi.fn(async () => ({ ok: false as const, error: "x" }));
    await writeFile(join(dir, backupName(day(14))), "x");
    await startBackups({ schedule, dir, now: () => day(14, 12), run });
    expect(schedule).toHaveBeenCalledWith(SCHEDULE, expect.any(Function), { timezone: TIMEZONE, name: "database-backup", noOverlap: true });
    expect(SCHEDULE).toBe("30 3 * * *");
    await schedule.mock.calls[0][1]();
    expect(run).toHaveBeenCalledWith({ trigger: "schedule", dir });
    // A backup from this morning: nothing to catch up.
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("makes one shortly after startup when the last is too old or missing", async () => {
    const run = vi.fn(async () => ({ ok: false as const, error: "x" }));
    await startBackups({ schedule: vi.fn(), dir, now: () => day(14), run });
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(run).toHaveBeenCalledWith({ trigger: "startup", dir });
  });

  it("knows when a backup is due", () => {
    expect(needsCatchUp(undefined, day(14))).toBe(true);
    expect(needsCatchUp({ name: "", size: 1, createdAt: day(13).toISOString() }, day(14, 4))).toBe(false);
    expect(needsCatchUp({ name: "", size: 1, createdAt: day(12).toISOString() }, day(14, 4))).toBe(true);
  });

  it("is a valid node-cron expression", async () => {
    const cron = await import("node-cron");
    expect(cron.validate(SCHEDULE)).toBe(true);
  });
});

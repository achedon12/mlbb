import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { expiredLogFiles, LOG_RETENTION_DAYS, pruneLogs } from "@/lib/log";

const NOW = Date.UTC(2026, 10, 15, 12);

describe("log retention", () => {
  it("keeps errors 30 days and events 6 months", () => {
    expect(LOG_RETENTION_DAYS).toEqual({ erreurs: 30, evenements: 180 });
  });

  it("deletes a day file once its last entry is past the retention", () => {
    // 15 November 2026, noon: a file of 15 October ended 30.5 days ago.
    expect(expiredLogFiles(["erreurs-2026-10-15.log"], NOW)).toEqual(["erreurs-2026-10-15.log"]);
    // 16 October ended 29.5 days ago: kept.
    expect(expiredLogFiles(["erreurs-2026-10-16.log"], NOW)).toEqual([]);
    // Exactly at the limit: the file of 14 October ended at midnight on the
    // 15th, 30 days before midnight on 14 November.
    expect(expiredLogFiles(["erreurs-2026-10-14.log"], Date.UTC(2026, 10, 14))).toEqual(["erreurs-2026-10-14.log"]);
    expect(expiredLogFiles(["erreurs-2026-10-14.log"], Date.UTC(2026, 10, 14) - 1)).toEqual([]);
  });

  it("keeps events longer than errors", () => {
    const names = ["erreurs-2026-08-01.log", "evenements-2026-08-01.log", "evenements-2026-05-18.log", "evenements-2026-05-19.log"];
    // 1 August: past 30 days, within 180. 18 May ended 180.5 days ago.
    expect(expiredLogFiles(names, NOW)).toEqual(["erreurs-2026-08-01.log", "evenements-2026-05-18.log"]);
  });

  it("leaves alone anything that is not a day file", () => {
    const names = ["notes.txt", "erreurs-2020-01-01.log.gz", "erreurs-latest.log", "autres-2020-01-01.log", "erreurs-2020-13-45.log", ".gitkeep"];
    expect(expiredLogFiles(names, NOW)).toEqual([]);
  });

  describe("pruneLogs", () => {
    let folder: string | null = null;
    afterEach(async () => {
      if (folder) await rm(folder, { recursive: true, force: true });
      folder = null;
    });

    it("deletes the expired files of the folder and keeps the rest", async () => {
      folder = await mkdtemp(join(tmpdir(), "logs-"));
      for (const name of ["erreurs-2026-01-01.log", "erreurs-2026-11-15.log", "evenements-2026-01-01.log", "evenements-2026-10-01.log", "readme.txt"]) {
        await writeFile(join(folder, name), "{}\n");
      }
      expect((await pruneLogs(folder, NOW)).sort()).toEqual(["erreurs-2026-01-01.log", "evenements-2026-01-01.log"]);
      expect((await readdir(folder)).sort()).toEqual(["erreurs-2026-11-15.log", "evenements-2026-10-01.log", "readme.txt"]);
      // Nothing left to delete the second time.
      expect(await pruneLogs(folder, NOW)).toEqual([]);
    });

    it("does nothing, without throwing, when the folder does not exist", async () => {
      expect(await pruneLogs(join(tmpdir(), "no-such-logs-folder-for-sure"), NOW)).toEqual([]);
    });
  });
});

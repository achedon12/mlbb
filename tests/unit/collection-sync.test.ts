import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  MAX_BACKUP_BYTES,
  backupName,
  keepKnown,
  mergeOwnership,
  readBackup,
  readSyncMeta,
  reconcile,
  sameOwnership,
  unionOwnership,
  writeBackup,
  type SyncMeta,
} from "@/lib/collection-sync";
import { shortcutOf } from "@/components/collection-tools";

const o = (heros: string[], skins: string[]) => ({ heros, skins });
const remote = (heros: string[], skins: string[], updatedAt = "2026-11-14T10:00:00.000Z") => ({ heros, skins, updatedAt });
const meta = (p: Partial<SyncMeta> = {}): SyncMeta => ({
  account: "acc",
  updatedAt: "2026-11-14T10:00:00.000Z",
  base: o([], []),
  pending: false,
  ...p,
});

describe("set operations", () => {
  it("compares sets regardless of order and duplicates", () => {
    expect(sameOwnership(o(["b", "a"], ["2", "1"]), o(["a", "b", "a"], ["1", "2"]))).toBe(true);
    expect(sameOwnership(o(["a"], []), o(["a"], ["1"]))).toBe(false);
  });

  it("unions and sorts", () => {
    expect(unionOwnership(o(["miya"], ["2"]), o(["alice", "miya"], ["1"]))).toEqual(o(["alice", "miya"], ["1", "2"]));
  });

  it("merges three ways: each side's own changes win, untouched entries follow the other side", () => {
    const base = o(["miya"], ["1", "2"]);
    // Here: unticked skin 2, ticked skin 3. Elsewhere: unticked Miya, ticked skin 4.
    const local = o(["miya"], ["1", "3"]);
    const other = o([], ["1", "2", "4"]);
    expect(mergeOwnership(base, local, other)).toEqual(o([], ["1", "3", "4"]));
  });

  it("keeps a removal made here even though the other side still has the entry", () => {
    expect(mergeOwnership(o([], ["1"]), o([], []), o([], ["1"]))).toEqual(o([], []));
  });

  it("drops ids the catalogue does not know", () => {
    expect(keepKnown(o(["miya", "ghost"], ["1", "9"]), new Set(["miya"]), new Set(["1"]))).toEqual(o(["miya"], ["1"]));
  });
});

describe("reconcile", () => {
  it("first sync on a browser: the union of both copies, sent back", () => {
    const r = reconcile(o(["miya"], ["1"]), null, remote(["alice"], ["2"]), "acc");
    expect(r).toEqual({ result: o(["alice", "miya"], ["1", "2"]), upload: true, fromElsewhere: true });
  });

  it("first sync with no account copy yet: the browser's, sent", () => {
    expect(reconcile(o([], ["1"]), null, null, "acc")).toEqual({ result: o([], ["1"]), upload: true, fromElsewhere: false });
  });

  it("first sync where the account already holds everything: nothing to send", () => {
    expect(reconcile(o([], ["1"]), null, remote([], ["1", "2"]), "acc")).toMatchObject({ upload: false, fromElsewhere: true });
  });

  it("a browser synced with another account takes this account's copy, unmixed", () => {
    const r = reconcile(o([], ["1"]), meta({ account: "other" }), remote([], ["2"]), "acc");
    expect(r).toEqual({ result: o([], ["2"]), upload: false, fromElsewhere: true });
  });

  it("nothing changed anywhere: nothing to do", () => {
    const r = reconcile(o([], ["1"]), meta({ base: o([], ["1"]) }), remote([], ["1"]), "acc");
    expect(r).toEqual({ result: o([], ["1"]), upload: false, fromElsewhere: false });
  });

  it("changed on another device only: the account copy, flagged", () => {
    const r = reconcile(o([], ["1"]), meta({ base: o([], ["1"]) }), remote([], ["1", "2"], "2026-11-14T11:00:00.000Z"), "acc");
    expect(r).toEqual({ result: o([], ["1", "2"]), upload: false, fromElsewhere: true });
  });

  it("changed here only (offline edits): sent as they are", () => {
    const r = reconcile(o([], ["1", "3"]), meta({ base: o([], ["1"]), pending: true }), remote([], ["1"]), "acc");
    expect(r).toEqual({ result: o([], ["1", "3"]), upload: true, fromElsewhere: false });
  });

  it("changed on both sides: merged from the last agreed version, and sent", () => {
    const r = reconcile(
      o([], ["3"]),
      meta({ base: o([], ["1"]), pending: true }),
      remote([], ["1", "2"], "2026-11-14T11:00:00.000Z"),
      "acc",
    );
    expect(r).toEqual({ result: o([], ["2", "3"]), upload: true, fromElsewhere: true });
  });

  it("the account copy was emptied elsewhere while nothing changed here: emptied here too", () => {
    const r = reconcile(o([], ["1"]), meta({ base: o([], ["1"]) }), remote([], [], "2026-11-14T11:00:00.000Z"), "acc");
    expect(r.result).toEqual(o([], []));
  });
});

describe("sync memory", () => {
  it("reads back what the browser stored, and nothing else", () => {
    const m = meta({ base: o(["miya"], ["1"]), pending: true });
    expect(readSyncMeta(JSON.stringify(m))).toEqual(m);
    expect(readSyncMeta(null)).toBeNull();
    expect(readSyncMeta("{oops")).toBeNull();
    expect(readSyncMeta(JSON.stringify({ updatedAt: 3 }))).toBeNull();
    expect(readSyncMeta(JSON.stringify({ account: "a", base: { heros: [1, "x"] } }))).toEqual({
      account: "a",
      updatedAt: null,
      base: o(["x"], []),
      pending: false,
    });
  });
});

describe("backup file", () => {
  const heroes = new Set(["miya", "alice"]);
  const skins = new Set(["1", "2", "3"]);

  it("round-trips through the file format", () => {
    const text = writeBackup(o(["miya"], ["2", "1", "1"]), new Date("2026-11-14T12:00:00Z"));
    expect(JSON.parse(text)).toEqual({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: "2026-11-14T12:00:00.000Z",
      heroes: ["miya"],
      skins: ["1", "2"],
    });
    expect(readBackup(text, heroes, skins)).toEqual({ ok: true, collection: o(["miya"], ["1", "2"]), ignored: 0 });
  });

  it("names the file after the day", () => {
    expect(backupName(new Date("2026-11-14T23:00:00Z"))).toBe("mlbbdex-collection-2026-11-14.json");
  });

  it("accepts the browser save itself", () => {
    expect(readBackup(JSON.stringify({ heros: ["alice"], skins: ["3"] }), heroes, skins)).toMatchObject({ ok: true, collection: o(["alice"], ["3"]) });
  });

  it("drops and counts entries the catalogue does not know", () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, heroes: ["miya", "ghost"], skins: ["1", "99", 4] });
    expect(readBackup(text, heroes, skins)).toEqual({ ok: true, collection: o(["miya"], ["1"]), ignored: 2 });
  });

  it("refuses what is not a backup", () => {
    expect(readBackup("not json", heroes, skins)).toEqual({ ok: false, reason: "json" });
    expect(readBackup("[]", heroes, skins)).toEqual({ ok: false, reason: "format" });
    expect(readBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 2, heroes: [], skins: [] }), heroes, skins)).toEqual({
      ok: false,
      reason: "version",
    });
    expect(readBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, heroes: "miya", skins: [] }), heroes, skins)).toEqual({
      ok: false,
      reason: "format",
    });
    expect(readBackup(JSON.stringify({ heros: ["ghost"], skins: [] }), heroes, skins)).toEqual({ ok: false, reason: "empty" });
    expect(readBackup(" ".repeat(MAX_BACKUP_BYTES + 1), heroes, skins)).toEqual({ ok: false, reason: "size" });
  });
});

describe("keyboard shortcuts", () => {
  type Fake = { key?: string; code?: string; ctrlKey?: boolean; target: unknown };
  const key = (p: Fake) =>
    ({ key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, ...p }) as unknown as KeyboardEvent;
  const field = { closest: () => ({}) };
  const body = { closest: () => null };

  it("reads the bound keys, digits by their physical key too", () => {
    expect(shortcutOf(key({ key: "/", target: body }))).toBe("/");
    expect(shortcutOf(key({ key: "H", target: body }))).toBe("h");
    expect(shortcutOf(key({ key: "&", code: "Digit1", target: body }))).toBe("1");
    expect(shortcutOf(key({ key: "x", target: body }))).toBeNull();
  });

  it("stays out of the way while typing and of modified keys", () => {
    expect(shortcutOf(key({ key: "/", target: field }))).toBeNull();
    expect(shortcutOf(key({ key: "n", ctrlKey: true, target: body }))).toBeNull();
  });
});

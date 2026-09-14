import { afterEach, describe, expect, it, vi } from "vitest";
import { historyMatches } from "@/lib/mlbb-auth";
import { pageHistory, matchRaw } from "./player-samples";

/**
 * History pagination, simulated service: each page answers according to its
 * cursor. The token changes in every test, since the response cache is keyed
 * by token.
 */
const CURSORS = ["4143043017340290910", "4143043017340290911", "4143043017340290912"];

/** Three pages of twenty, then one of five; the second repeats the last match of the first. */
const series = (start: number, n: number, hid: number, lid: number, res: 0 | 1, ts: number) =>
  Array.from({ length: n }, (_, i) => matchRaw(start + i, hid, lid, res, ts - i));
const PAGES: Record<string, string> = {
  "": pageHistory(series(0, 20, 84, 4, 1, 1774857999), CURSORS[0]),
  [CURSORS[0]]: pageHistory(series(19, 20, 20, 3, 0, 1774850000), CURSORS[1]),
  [CURSORS[1]]: pageHistory(series(39, 20, 17, 4, 1, 1774840000), CURSORS[2]),
  [CURSORS[2]]: pageHistory(series(59, 5, 36, 2, 0, 1774830000), null),
};

type ApiResponse = Response | Promise<Response>;

function service(answer: (cursor: string) => ApiResponse | undefined) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const cursor = new URL(url).searchParams.get("last_cursor") ?? "";
      calls.push(cursor);
      return Promise.resolve(answer(cursor) ?? new Response(PAGES[cursor], { status: 200 }));
    }),
  );
  return calls;
}

let n = 0;
const token = () => `history-token-${++n}`;

afterEach(() => vi.unstubAllGlobals());

describe("historyMatches", () => {
  it("chains pages up to the cap, without duplicates", async () => {
    const calls = service(() => undefined);
    const r = await historyMatches(token(), 40);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    // 65 entries, one of them repeated from one page to the next.
    expect(r.data.matches).toHaveLength(64);
    expect(new Set(r.data.matches.map((p) => p.id)).size).toBe(64);
    expect(r.data.end).toBe(true);
    // Cursors passed on intact, despite their 19 digits.
    expect(calls).toEqual(["", ...CURSORS]);
  });

  it("stops at the requested count and reports it", async () => {
    const calls = service(() => undefined);
    const r = await historyMatches(token(), 40, 30);
    expect(r).toMatchObject({ status: "ok", data: { end: false } });
    if (r.status === "ok") expect(r.data.matches).toHaveLength(30);
    expect(calls).toHaveLength(2);
  });

  it("keeps what was read when a later page is missing", async () => {
    service((c) => (c === CURSORS[0] ? new Response("", { status: 502 }) : undefined));
    const r = await historyMatches(token(), 40);
    expect(r).toMatchObject({ status: "ok", data: { end: false } });
    if (r.status === "ok") expect(r.data.matches).toHaveLength(20);
  });

  it("does not wait for a slow page beyond the budget", async () => {
    service((c) => (c === CURSORS[0] ? new Promise<Response>(() => {}) : undefined));
    const start = Date.now();
    const r = await historyMatches(token(), 40, 100, 50);
    expect(Date.now() - start).toBeLessThan(2000);
    if (r.status === "ok") expect(r.data.matches).toHaveLength(20);
    else expect.unreachable();
  });

  it("reports an expired session and an unavailable first page", async () => {
    service(() => new Response("", { status: 401 }));
    expect(await historyMatches(token(), 40)).toEqual({ status: "expired" });
    service(() => new Response('{"code":10407,"data":null}', { status: 200 }));
    expect(await historyMatches(token(), 40)).toEqual({ status: "unavailable" });
    expect(await historyMatches(token(), 0)).toEqual({ status: "unavailable" });
  });

  it("does not loop on a cursor that does not move", async () => {
    const loop = pageHistory([matchRaw(1, 84, 4, 1, 1774857999)], CURSORS[0]);
    const calls = service(() => new Response(loop, { status: 200 }));
    const r = await historyMatches(token(), 40);
    expect(r).toMatchObject({ status: "ok", data: { end: true } });
    expect(calls).toHaveLength(2);
  });
});

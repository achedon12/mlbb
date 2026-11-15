import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import CacheHandler from "../../cache-handler.mjs";
import { nodeFs } from "next/dist/server/lib/node-fs-methods";

/**
 * The response cache writes to disk whatever anyone requests: it must keep
 * only successful pages, and stay within its cap whatever the traffic.
 */
const ROOT = mkdtempSync(join(tmpdir(), "cache-handler-"));
let build = 0;
let dist: string;
let pages: string;

/** A fresh `.next` folder with its own build id, hence its own store. */
function freshBuild() {
  build += 1;
  const next = join(ROOT, `next-${build}`);
  dist = join(next, "server");
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(next, "BUILD_ID"), `build-${build}`);
  pages = join(next, "cache", "pages", `build-${build}`);
  return next;
}

const handler = () =>
  new CacheHandler({ fs: nodeFs, serverDistDir: dist, dev: false, flushToDisk: false, maxMemoryCacheSize: 0, revalidatedTags: [] });

const key = (path: string) => `/route-cache/APP_PAGE/${"a".repeat(64)}/$${path}`;
const page = (status = 200, size = 10) => ({
  kind: "APP_PAGE",
  html: `<html>${"x".repeat(size)}</html>`,
  rscData: Buffer.from("0:{}"),
  headers: {},
  postponed: undefined,
  status,
  segmentData: new Map(),
});
const setContext = { cacheControl: { revalidate: false }, isFallback: false, isRoutePPREnabled: false };
const getContext = { kind: "APP_PAGE", isFallback: false, isRoutePPREnabled: false };

/** Pages kept on disk, by their path. */
function stored(): string[] {
  const found: string[] = [];
  const visit = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) visit(path);
      else if (e.name.endsWith(".html")) found.push(path.slice(path.indexOf("/$/") + 2, -".html".length));
    }
  };
  visit(pages);
  return found.sort();
}

beforeEach(() => {
  delete process.env.PAGE_CACHE_MAX_BYTES;
  delete process.env.PAGE_CACHE_MAX_ENTRIES;
});
afterEach(() => {
  delete process.env.PAGE_CACHE_MAX_BYTES;
  delete process.env.PAGE_CACHE_MAX_ENTRIES;
});
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("response cache", () => {
  it("keeps a rendered page on disk and reads it back", async () => {
    freshBuild();
    const cache = handler();
    await cache.set(key("/it/heroes/sun"), page(), setContext);
    expect(stored()).toEqual(["/it/heroes/sun"]);
    const hit = await handler().get(key("/it/heroes/sun"), getContext);
    expect((hit?.value as { html?: string } | undefined)?.html).toContain("<html>");
  });

  it("deletes the pages of previous builds on start", async () => {
    const next = freshBuild();
    const old = join(next, "cache", "pages", "an-old-build");
    mkdirSync(old, { recursive: true });
    writeFileSync(join(old, "page.html"), "<html></html>");
    const cache = handler();
    expect(existsSync(old)).toBe(false);
    await cache.set(key("/fr/esports/players/light"), page(), setContext);
    expect(stored()).toEqual(["/fr/esports/players/light"]);
  });

  it("never writes a 404 or an error to disk", async () => {
    freshBuild();
    const cache = handler();
    for (let i = 0; i < 20; i++) await cache.set(key(`/ru/esports/players/aaaa${i}`), page(404), setContext);
    await cache.set(key("/ru/heroes/broken"), page(500), setContext);
    expect(stored()).toEqual([]);
    expect(existsSync(pages) ? readdirSync(pages) : []).toEqual([]);
  });

  it("never writes a redirect, and drops a page that stops succeeding", async () => {
    freshBuild();
    const cache = handler();
    await cache.set(key("/fr/heroes/page/1"), page(307), setContext);
    expect(stored()).toEqual([]);
    await cache.set(key("/fr/community/general/1-a"), page(), setContext);
    expect(stored()).toEqual(["/fr/community/general/1-a"]);
    await cache.set(key("/fr/community/general/1-a"), page(404), setContext);
    expect(stored()).toEqual([]);
    expect(await handler().get(key("/fr/community/general/1-a"), getContext)).toBeFalsy();
  });

  it("keeps fetch results off the disk", async () => {
    const next = freshBuild();
    const cache = handler();
    await cache.set("fetch-key", { kind: "FETCH", data: { headers: {}, body: "{}", status: 200, url: "x" }, revalidate: 60 }, {
      fetchCache: true,
      tags: [],
    });
    expect(existsSync(join(next, "cache", "pages", `build-${build}`, "cache"))).toBe(false);
    expect(existsSync(join(next, "cache", "fetch-cache"))).toBe(false);
  });

  it("evicts the least recently used pages past the entry cap", async () => {
    freshBuild();
    process.env.PAGE_CACHE_MAX_ENTRIES = "10";
    const cache = handler();
    for (let i = 0; i < 10; i++) await cache.set(key(`/th/p${i}`), page(), setContext);
    // Read the oldest again: it becomes the most recent.
    await cache.get(key("/th/p0"), getContext);
    await cache.set(key("/th/p10"), page(), setContext);
    const left = stored();
    expect(left.length).toBeLessThanOrEqual(9);
    expect(left).toContain("/th/p0");
    expect(left).toContain("/th/p10");
    expect(left).not.toContain("/th/p1");
  });

  it("evicts past the byte cap", async () => {
    freshBuild();
    process.env.PAGE_CACHE_MAX_BYTES = String(50 * 1024);
    const cache = handler();
    for (let i = 0; i < 20; i++) await cache.set(key(`/pt/big${i}`), page(200, 10 * 1024), setContext);
    const left = stored();
    // About 11 KB per page: the cap holds four of them.
    expect(left.length).toBeGreaterThan(0);
    expect(left.length).toBeLessThanOrEqual(4);
    expect(left).toContain("/pt/big19");
  });

  it("counts the pages a previous process of the same build left", async () => {
    freshBuild();
    const first = handler();
    for (let i = 0; i < 5; i++) await first.set(key(`/es/q${i}`), page(), setContext);
    // A restart: a new process reads the folder back.
    CacheHandler.stores.clear();
    process.env.PAGE_CACHE_MAX_ENTRIES = "5";
    const second = handler();
    await second.set(key("/es/q5"), page(), setContext);
    expect(stored().length).toBeLessThanOrEqual(5);
    expect(stored()).toContain("/es/q5");
  });
});

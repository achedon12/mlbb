import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_SECTIONS } from "@/i18n/translations";

/**
 * The shared client catalog does not carry the page sections
 * (`PAGE_SECTIONS`): each page adds those of its client components through
 * `messagesPage(locale, [...])`. This test follows each page's imports down to
 * the modules run in the browser, collects the keys they reference and checks
 * that the page provides every page section needed.
 * Without it, an omission would only show on screen, as a raw key.
 */
const ROOT = resolve(__dirname, "../..");
const SRC = join(ROOT, "src");
const COMMON = ["pages.notFound"];

function files(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? files(path) : /\.(tsx?|mjs)$/.test(name) ? [path] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const cache = new Map<string, string>();
const read = (f: string) => cache.get(f) ?? (cache.set(f, readFileSync(f, "utf8")), cache.get(f)!);
const imports = (f: string) =>
  [...read(f).matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)]
    .map((m) => resolveImport(f, m[1] ?? m[2]))
    .filter((x): x is string => x !== null);
const isClient = (f: string) => /^\s*["']use client["']/.test(read(f));

/** Page sections referenced by the modules run in the browser, from `entry`. */
function requiredSections(entry: string): Map<string, string> {
  const needs = new Map<string, string>();
  const seen = new Set<string>();
  const stack: [string, boolean][] = [[entry, false]];
  while (stack.length) {
    const [f, side] = stack.pop()!;
    const client = side || isClient(f);
    const keyView = `${f}|${client}`;
    if (seen.has(keyView)) continue;
    seen.add(keyView);
    if (client) {
      const s = read(f);
      const keys = [
        ...s.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g),
        ...s.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\$\{/g),
        ...s.matchAll(/\bt\(\s*[^()]*?\?\s*["']([a-zA-Z0-9_.]+)["']\s*:\s*["']([a-zA-Z0-9_.]+)["']/g),
        ...s.matchAll(/`((?:pages|emblemData)\.[a-zA-Z0-9_.]*)\$\{/g),
      ].flatMap((m) => m.slice(1).filter(Boolean));
      for (const key of keys) {
        const [head, sub] = key.split(".");
        if (!PAGE_SECTIONS.includes(head)) continue;
        const section = head === "pages" && sub ? `pages.${sub}` : head;
        if (!COMMON.includes(section)) needs.set(section, relative(ROOT, f));
      }
    }
    for (const next of imports(f)) stack.push([next, client]);
  }
  return needs;
}

/** Sections added by a page: literals passed to `messagesPage(…, [...])`. */
const provided = (f: string) =>
  [...read(f).matchAll(/messagesPage\([^,]+,\s*\[([^\]]*)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]),
  );

const pages = files(join(SRC, "app")).filter((f) => /\/(page|layout|not-found|error|global-error)\.tsx$/.test(f));

describe("client catalog per page", () => {
  it("the layout renders no client component that references a page section", () => {
    const layout = join(SRC, "app/[locale]/layout.tsx");
    expect([...requiredSections(layout)]).toEqual([]);
  });

  it("each page provides the page sections of its client components", () => {
    const missing = pages.flatMap((page) => {
      const data = provided(page);
      return [...requiredSections(page)]
        .filter(([section]) => !data.some((d) => section === d || section.startsWith(`${d}.`)))
        .map(([section, source]) => `${relative(ROOT, page)}: ${section} (referenced by ${source})`);
    });
    expect(missing).toEqual([]);
  });
});

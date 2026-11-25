import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_COLORS,
  THEME_KEY,
  THEME_PREFERENCES,
  THEME_SCRIPT,
  inkStyle,
  parseTheme,
  themeAttribute,
  themeColorFor,
} from "@/lib/theme";

/**
 * The theme preference (Auto / Light / Dark): the stored value read back,
 * what it writes on the page, the script that applies it before the first
 * paint, and the CSS that both themes rest on (globals.css).
 */

describe("parseTheme", () => {
  it("reads a forced theme", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("defaults to auto for anything else", () => {
    for (const raw of [null, undefined, "", "auto", "Light", "DARK", "sepia", "1", 1, {}, '"light"']) {
      expect(parseTheme(raw)).toBe("auto");
    }
  });

  it("offers the three positions, auto first", () => {
    expect(THEME_PREFERENCES).toEqual(["auto", "light", "dark"]);
  });
});

describe("themeAttribute", () => {
  it("writes data-theme only for a forced theme", () => {
    expect(themeAttribute("auto")).toBeNull();
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
  });
});

describe("themeColorFor", () => {
  const LIGHT = "(prefers-color-scheme: light)";
  const DARK = "(prefers-color-scheme: dark)";

  it("follows each tag's media on auto", () => {
    expect(themeColorFor("auto", LIGHT)).toBe(THEME_COLORS.light);
    expect(themeColorFor("auto", DARK)).toBe(THEME_COLORS.dark);
    expect(themeColorFor("auto", null)).toBe(THEME_COLORS.dark);
  });

  it("gives both tags the forced theme's ground", () => {
    expect(themeColorFor("light", DARK)).toBe(THEME_COLORS.light);
    expect(themeColorFor("dark", LIGHT)).toBe(THEME_COLORS.dark);
  });

  it("uses the grounds of globals.css", () => {
    expect(THEME_COLORS).toEqual({ dark: "#06080f", light: "#f4f1ea" });
  });
});

describe("THEME_SCRIPT", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Runs the inline script against a stored value (or a storage that throws). */
  function run(stored: string | null | Error) {
    const attributes: Record<string, string> = {};
    const metas = [{ content: THEME_COLORS.light }, { content: THEME_COLORS.dark }];
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => {
        if (stored instanceof Error) throw stored;
        return key === THEME_KEY ? stored : null;
      },
    });
    vi.stubGlobal("document", {
      documentElement: { setAttribute: (name: string, value: string) => (attributes[name] = value) },
      querySelectorAll: () => metas,
    });
    new Function(THEME_SCRIPT)();
    return { attributes, metas: metas.map((m) => m.content) };
  }

  it("applies a forced theme and its bar colour", () => {
    expect(run("light")).toEqual({ attributes: { "data-theme": "light" }, metas: [THEME_COLORS.light, THEME_COLORS.light] });
    expect(run("dark")).toEqual({ attributes: { "data-theme": "dark" }, metas: [THEME_COLORS.dark, THEME_COLORS.dark] });
  });

  it("leaves the page to CSS on auto, a bad value or a blocked storage", () => {
    const untouched = { attributes: {}, metas: [THEME_COLORS.light, THEME_COLORS.dark] };
    expect(run(null)).toEqual(untouched);
    expect(run("sepia")).toEqual(untouched);
    expect(run(new Error("SecurityError"))).toEqual(untouched);
  });
});

describe("inkStyle", () => {
  it("passes a data colour through --ink", () => {
    expect(inkStyle("#b06bff")).toEqual({ "--ink": "#b06bff" });
  });
});

describe("globals.css", () => {
  const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

  /** The custom properties declared in the first block that follows `selector`. */
  function declarations(selector: string): Map<string, string> {
    const start = css.indexOf(selector);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    const open = css.indexOf("{", start + selector.length - 1);
    const close = css.indexOf("}", open);
    const out = new Map<string, string>();
    for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g)) out.set(m[1], m[2].trim());
    return out;
  }

  /** Every `--color-*` / `--*-color-*` value of the @theme blocks (the dark theme). */
  function themeValues(): Map<string, string> {
    const out = new Map<string, string>();
    for (const block of css.matchAll(/@theme(?: static)? \{([\s\S]*?)\n\}/g)) {
      for (const m of block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) out.set(m[1], m[2].trim());
    }
    return out;
  }

  const system = declarations(':root:not([data-theme="dark"]) {');
  const forced = declarations(':root[data-theme="light"] {');
  const dark = declarations("  .draft-slot {");

  it("writes the same light palette for the system preference and the forced choice", () => {
    expect(system.size).toBeGreaterThan(20);
    expect([...forced]).toEqual([...system]);
  });

  it("gives back, in the always-dark areas, the dark value of every colour the light theme changes", () => {
    const theme = themeValues();
    for (const name of system.keys()) {
      if (!name.includes("color")) continue;
      expect(theme.get(name), name).toBeDefined();
      expect(dark.get(name), name).toBe(theme.get(name));
    }
  });

  it("keeps the ink of the bright fills dark in both themes", () => {
    expect(system.has("--text-color-night-950")).toBe(false);
    expect(themeValues().get("--text-color-night-950")).toBe("#06080f");
  });

  it("paints the page with the grounds of THEME_COLORS", () => {
    expect(system.get("--color-night-950")).toBe(THEME_COLORS.light);
    expect(themeValues().get("--color-night-950")).toBe(THEME_COLORS.dark);
  });
});

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import manifest from "@/app/manifest";

/**
 * The web app manifest names generated files (`scripts/app-icons.mjs`,
 * `scripts/app-screenshots.mjs`): a renamed or forgotten one would break
 * installation without any build error.
 */
const app = manifest();
const file = (src: string) => join("public", src);

describe("web app manifest", () => {
  it("has what browsers require to install the site", () => {
    expect(app.id).toBe("/");
    expect(app.start_url).toBe("/");
    expect(app.scope).toBe("/");
    expect(app.display).toBe("standalone");
    expect(app.name).toBeTruthy();
    expect(app.short_name).toBe("MLBBDex");
    expect(app.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(app.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("offers 192 and 512 icons for both the any and maskable purposes", () => {
    for (const purpose of ["any", "maskable"]) {
      const sizes = app.icons!.filter((i) => (i.purpose ?? "any") === purpose).map((i) => i.sizes);
      expect(sizes).toContain("192x192");
      expect(sizes).toContain("512x512");
    }
  });

  it("points every icon, shortcut icon and screenshot at an existing file of the stated size", async () => {
    const images = [
      ...app.icons!,
      ...app.shortcuts!.flatMap((s) => s.icons ?? []),
      ...app.screenshots!,
    ].filter((i) => i.src.startsWith("/icons/") || i.src.startsWith("/screenshots/"));
    expect(images.length).toBeGreaterThan(10);
    for (const image of images) {
      expect(existsSync(file(image.src)), image.src).toBe(true);
      const { width, height } = await sharp(file(image.src)).metadata();
      expect(`${width}x${height}`, image.src).toBe(image.sizes);
    }
  });

  it("has shortcuts to sections that exist", () => {
    expect(app.shortcuts!.map((s) => s.url)).toEqual(["/tier-list", "/heroes", "/mlbbdle", "/builds"]);
    for (const shortcut of app.shortcuts!) {
      expect(existsSync(join("src/app/[locale]", shortcut.url, "page.tsx")), shortcut.url).toBe(true);
    }
  });

  it("has narrow and wide screenshots", () => {
    const forms = new Set(app.screenshots!.map((s) => s.form_factor));
    expect(forms).toEqual(new Set(["narrow", "wide"]));
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFolder } from "@/lib/content";

describe("readFolder", () => {
  const folder = mkdtempSync(join(tmpdir(), "mlbb-content-"));
  writeFileSync(join(folder, "2026-01-02-no-title.md"), "---\ndate: \"2026-01-02\"\n---\nBody.\n");
  writeFileSync(join(folder, "2026-01-01-titled.md"), "---\ntitle: Hello\ndate: \"2026-01-01\"\n---\nBody.\n");
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it("names an article without a title in the reader's language", () => {
    const title = (locale: "en" | "fr" | "it" | "es") =>
      readFolder(folder, locale).find((a) => a.slug === "no-title")?.title;
    expect(title("en")).toBe("Untitled");
    expect(title("fr")).toBe("Sans titre");
    expect(title("it")).toBe("Senza titolo");
    expect(title("es")).toBe("Sin título");
  });

  it("keeps the written title and sorts from newest to oldest", () => {
    expect(readFolder(folder, "fr").map((a) => [a.slug, a.title])).toEqual([
      ["no-title", "Sans titre"],
      ["titled", "Hello"],
    ]);
  });
});

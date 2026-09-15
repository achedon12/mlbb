import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFolder } from "@/lib/content";
import type { Locale } from "@/i18n/config";
import id from "@/i18n/messages/id.json";

const UNTITLED_ID = id.articleUI.untitled;

describe("readFolder", () => {
  const folder = mkdtempSync(join(tmpdir(), "mlbb-content-"));
  writeFileSync(join(folder, "2026-01-02-no-title.md"), "---\ndate: \"2026-01-02\"\n---\nBody.\n");
  writeFileSync(join(folder, "2026-01-01-titled.md"), "---\ntitle: Hello\ndate: \"2026-01-01\"\n---\nBody.\n");
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it("names an article without a title in the reader's language", () => {
    const title = (locale: Locale) =>
      readFolder(folder, locale).find((a) => a.slug === "no-title")?.title;
    expect(title("en")).toBe("Untitled");
    expect(title("fr")).toBe("Sans titre");
    expect(title("it")).toBe("Senza titolo");
    expect(title("es")).toBe("Sin título");
    expect(title("id")).toBe(UNTITLED_ID);
  });

  it("keeps the written title and sorts from newest to oldest", () => {
    expect(readFolder(folder, "fr").map((a) => [a.slug, a.title])).toEqual([
      ["no-title", "Sans titre"],
      ["titled", "Hello"],
    ]);
  });
});

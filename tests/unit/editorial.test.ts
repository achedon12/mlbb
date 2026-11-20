import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { AuthorNote, AuthorNoteView } from "@/components/author-note";
import { AuthorProfile } from "@/components/author-profile";
import { LocaleProvider } from "@/i18n/provider";
import { messagesClient } from "@/i18n/translations";
import type { Locale } from "@/i18n/config";
import { allHeroes, patchDetails } from "@/lib/data";
import { editorialFolder, editorialProblems, readAuthor, readNote, type AuthorNote as Note } from "@/lib/editorial";

const folders: string[] = [];
afterAll(() => folders.forEach((f) => rmSync(f, { recursive: true, force: true })));

/** A throwaway editorial folder holding the given files. */
function folder(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "editorial-"));
  folders.push(root);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), content);
  }
  return root;
}

const AUTHOR = `---
nom: "Pseudo"
role: "Code et avis"
rang: "Gloire mythique"
heros: ["layla", "miya"]
contact: "auteur@example.org"
date: "2026-11-01"
---

<!-- consigne du modèle -->
Pourquoi le site.
`;

const NOTE = `---
date: 2026-11-15
titre: "Un titre"
---

Mon avis.
`;

const known = {
  versions: new Set(Object.keys(patchDetails)),
  heroes: new Set(allHeroes.map((x) => x.slug)),
};

describe("readAuthor", () => {
  it("reads a complete profile, without the templates' comments", () => {
    const profile = readAuthor(folder({ "auteur.md": AUTHOR }));
    expect(profile).toMatchObject({
      name: "Pseudo",
      role: "Code et avis",
      rank: "Gloire mythique",
      heroes: ["layla", "miya"],
      contact: "mailto:auteur@example.org",
      updated: "2026-11-01",
      body: "Pourquoi le site.",
    });
  });

  it("shows nothing without a file, a name, a text, or while it is a draft", () => {
    expect(readAuthor(folder({}))).toBeNull();
    expect(readAuthor(folder({ "auteur.md": AUTHOR.replace('nom: "Pseudo"', 'nom: ""') }))).toBeNull();
    expect(readAuthor(folder({ "auteur.md": AUTHOR.replace("Pourquoi le site.", "") }))).toBeNull();
    expect(readAuthor(folder({ "auteur.md": AUTHOR.replace("---\nnom", "---\nbrouillon: true\nnom") }))).toBeNull();
  });

  it("drops a contact that is neither an e-mail nor an https link", () => {
    const profile = readAuthor(folder({ "auteur.md": AUTHOR.replace("auteur@example.org", "javascript:alert(1)") }));
    expect(profile?.contact).toBeNull();
  });

  it("names the file when its header cannot be read", () => {
    const root = folder({ "auteur.md": "---\nnom: [\n---\nTexte" });
    expect(() => readAuthor(root)).toThrow(/auteur\.md/);
  });
});

describe("readNote", () => {
  it("signs a note with the profile's name and rank", () => {
    const root = folder({ "auteur.md": AUTHOR, "patchs/2.1.88.md": NOTE });
    expect(readNote("patchs", "2.1.88", root)).toEqual({
      kind: "patchs",
      key: "2.1.88",
      title: "Un titre",
      date: "2026-11-15",
      name: "Pseudo",
      rank: "Gloire mythique",
      body: "Mon avis.",
    });
  });

  it("keeps the note's own signature and rank", () => {
    const root = folder({ "tier-list/2.1.88.md": NOTE.replace("---\n\n", 'auteur: "Autre"\nrang: "Mythique"\n---\n\n') });
    expect(readNote("tier-list", "2.1.88", root)).toMatchObject({ name: "Autre", rank: "Mythique" });
  });

  it("shows nothing for another patch, a draft, no date, no text or no signature", () => {
    const root = folder({ "auteur.md": AUTHOR, "patchs/2.1.88.md": NOTE });
    expect(readNote("patchs", "2.1.90", root)).toBeNull();
    expect(readNote("tier-list", "2.1.88", root)).toBeNull();
    expect(readNote("patchs", "../auteur", root)).toBeNull();
    expect(readNote("patchs", "2.1.88", folder({ "auteur.md": AUTHOR, "patchs/2.1.88.md": NOTE.replace("date: 2026-11-15", "brouillon: true\ndate: 2026-11-15") }))).toBeNull();
    expect(readNote("patchs", "2.1.88", folder({ "auteur.md": AUTHOR, "patchs/2.1.88.md": NOTE.replace("date: 2026-11-15\n", "") }))).toBeNull();
    expect(readNote("patchs", "2.1.88", folder({ "auteur.md": AUTHOR, "patchs/2.1.88.md": NOTE.replace("Mon avis.", "<!-- rien -->") }))).toBeNull();
    // No profile and no `auteur`: an unsigned opinion never shows.
    expect(readNote("patchs", "2.1.88", folder({ "patchs/2.1.88.md": NOTE }))).toBeNull();
  });
});

describe("templates", () => {
  const templates = join(editorialFolder(), "_modeles");

  it("show nothing when copied in place unchanged", () => {
    const names = readdirSync(templates);
    expect(names.sort()).toEqual(["auteur.md", "patch.md", "tier-list.md"]);
    const root = folder({});
    mkdirSync(join(root, "patchs"));
    mkdirSync(join(root, "tier-list"));
    copyFileSync(join(templates, "auteur.md"), join(root, "auteur.md"));
    copyFileSync(join(templates, "patch.md"), join(root, "patchs", "2.1.88.md"));
    copyFileSync(join(templates, "tier-list.md"), join(root, "tier-list", "2.1.88.md"));
    expect(readAuthor(root)).toBeNull();
    expect(readNote("patchs", "2.1.88", root)).toBeNull();
    expect(readNote("tier-list", "2.1.88", root)).toBeNull();
  });

  it("are never read from their own folder", () => {
    expect(readNote("patchs", "patch", editorialFolder())).toBeNull();
  });
});

describe("the editorial folder", () => {
  it("has no file that would be hidden or shown wrong", () => {
    expect(editorialProblems(known)).toEqual([]);
  });

  it("reports what keeps a text from showing", () => {
    const root = folder({
      "auteur.md": AUTHOR.replace('["layla", "miya"]', '["layla", "inconnu"]'),
      "patchs/9.9.99.md": NOTE,
      "tier-list/2.1.88.md": NOTE.replace("date: 2026-11-15", "date: 15/11/2026"),
    });
    const problems = editorialProblems({ versions: new Set(["2.1.88"]), heroes: known.heroes }, root);
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toMatch(/unknown hero slug "inconnu"/);
    expect(problems.join("\n")).toMatch(/no patch 9\.9\.99/);
    expect(problems.join("\n")).toMatch(/"date"/);
  });
});

const decode = (html: string) =>
  html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const render = (element: ReactElement, locale: Locale = "fr") =>
  decode(renderToStaticMarkup(h(LocaleProvider, { locale, messages: messagesClient(locale), children: element })));

describe("the signed note", () => {
  const note: Note = {
    kind: "patchs",
    key: "2.1.88",
    title: null,
    date: "2026-11-15",
    name: "Pseudo",
    rank: "Gloire mythique",
    body: "Mon **avis**, et [Layla](/heroes/layla).",
  };

  it("renders the text and its signature: name, rank and date", () => {
    const html = render(h(AuthorNoteView, { note, locale: "fr", profile: true }));
    expect(html).toContain("L'avis de l'auteur sur le patch 2.1.88");
    expect(html).toContain("<strong>avis</strong>");
    expect(html).toContain('href="/fr/heroes/layla"');
    expect(html).toContain('href="/fr/about#auteur"');
    expect(html).toContain("Rang Gloire mythique");
    expect(html).toContain('dateTime="2026-11-15"');
    expect(html).not.toContain("non traduit");
  });

  it("stays in French in another language, and says so", () => {
    const html = render(h(AuthorNoteView, { note, locale: "en", profile: false }), "en");
    expect(html).toContain('lang="fr"');
    expect(html).toContain("Mon <strong>avis</strong>");
    expect(html).not.toContain("/about#auteur");
    expect(html).toMatch(/<p class="mt-4 text-xs text-chalk-500">[^<]+<\/p>/);
  });

  it("renders nothing when the patch has no text", () => {
    expect(render(h(AuthorNote, { kind: "patchs", version: "0.0.1", locale: "fr" }))).toBe("");
    expect(render(h(AuthorNote, { kind: "tier-list", version: "0.0.1", locale: "fr" }))).toBe("");
  });

  it("the about page's profile renders nothing until the author fills it", () => {
    const html = render(h(AuthorProfile, { locale: "fr" }));
    expect(html === "").toBe(readAuthor() === null);
  });
});

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Signed texts of the site's author, written by hand in French.
 *
 * `content/fr/editorial/` holds them, in Markdown with a YAML header:
 *
 * - `auteur.md`: who makes the site (name, role, rank, favourite heroes,
 *   contact) and, in the body, why;
 * - `patchs/<version>.md`: the author's opinion on one patch, shown on that
 *   patch's notes;
 * - `tier-list/<version>.md`: the author's reading of the tier list while
 *   that patch is live, shown on `/tier-list`.
 *
 * Nothing here is generated or translated: a text appears only once its file
 * exists, has a body and a signature, and is not marked `brouillon: true`.
 * `_modeles/` holds the commented templates and is never read. Read when a
 * page renders, like `lore-overrides.ts`: a page rendered on demand finds the
 * files in the standalone folder (`outputFileTracingIncludes`).
 *
 * Guide for the author: `docs/editorial.md`.
 */

/** The language the texts are written in; the other languages show them as they are, marked. */
export const EDITORIAL_LOCALE = "fr";

export type NoteKind = "patchs" | "tier-list";
export const NOTE_KINDS: readonly NoteKind[] = ["patchs", "tier-list"];

export interface AuthorProfile {
  name: string;
  role: string | null;
  rank: string | null;
  /** Hero slugs, in the author's order. */
  heroes: string[];
  /** `https://…` or `mailto:…` address, or null. */
  contact: string | null;
  /** Day the profile was last reviewed (`YYYY-MM-DD`), or null. */
  updated: string | null;
  /** Body: why the site exists, in the author's words (Markdown). */
  body: string;
}

export interface AuthorNote {
  kind: NoteKind;
  /** The patch version the text is about. */
  key: string;
  title: string | null;
  /** Day the text was written or last revised (`YYYY-MM-DD`). */
  date: string;
  /** Signature: the text's own `auteur`, or the profile's name. */
  name: string;
  /** The author's rank when writing, or the profile's. */
  rank: string | null;
  body: string;
}

/** Folder of the signed texts. */
export function editorialFolder(root = path.join(process.cwd(), "content")): string {
  return path.join(root, EDITORIAL_LOCALE, "editorial");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A patch version as the patch list writes it, used as a file name. */
const KEY = /^\d+(?:\.\d+)+$/;

/** HTML comments are the templates' instructions: they never reach the page. */
const withoutComments = (text: string) => text.replace(/<!--[\s\S]*?-->/g, "").trim();

/** A YAML field as text: empty, missing or a placeholder left as is reads as nothing. */
function text(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "string" && typeof value !== "number") return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function read(file: string): { data: Record<string, unknown>; body: string } | null {
  if (!fs.existsSync(file)) return null;
  try {
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    return { data, body: withoutComments(content) };
  } catch (e) {
    // A broken header stops the build with the file's name rather than
    // silently hiding the text.
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}

const isDraft = (data: Record<string, unknown>) => data.brouillon === true;

/** Only web and mail addresses: a typo must not become a link to anywhere. */
function contactOf(value: unknown): string | null {
  const s = text(value);
  if (!s) return null;
  if (/^https:\/\/\S+$/i.test(s) || /^mailto:\S+@\S+$/i.test(s)) return s;
  if (/^\S+@\S+\.\S+$/.test(s)) return `mailto:${s}`;
  return null;
}

/**
 * The author's profile, or null while `auteur.md` is missing, unsigned
 * (no `nom`), empty or a draft: the page then shows nothing in its place.
 */
export function readAuthor(folder = editorialFolder()): AuthorProfile | null {
  const file = read(path.join(folder, "auteur.md"));
  if (!file || isDraft(file.data)) return null;
  const name = text(file.data.nom);
  if (!name || !file.body) return null;
  const heroes = Array.isArray(file.data.heros) ? file.data.heros.map((h) => text(h)).filter((h): h is string => !!h) : [];
  const updated = text(file.data.date);
  return {
    name,
    role: text(file.data.role),
    rank: text(file.data.rang),
    heroes,
    contact: contactOf(file.data.contact),
    updated: updated && DATE.test(updated) ? updated : null,
    body: file.body,
  };
}

/**
 * The author's text on a patch (`patchs/<version>.md`) or on the tier list of
 * a patch (`tier-list/<version>.md`), or null when there is none to show: no
 * file, a draft, an empty body, no valid date or no signature.
 */
export function readNote(kind: NoteKind, key: string, folder = editorialFolder()): AuthorNote | null {
  if (!KEY.test(key)) return null;
  const file = read(path.join(folder, kind, `${key}.md`));
  if (!file || isDraft(file.data) || !file.body) return null;
  const date = text(file.data.date);
  if (!date || !DATE.test(date)) return null;
  const profile = readAuthor(folder);
  const name = text(file.data.auteur) ?? profile?.name ?? null;
  if (!name) return null;
  return {
    kind,
    key,
    title: text(file.data.titre),
    date,
    name,
    rank: text(file.data.rang) ?? profile?.rank ?? null,
    body: file.body,
  };
}

/**
 * What is wrong with the folder, file by file, for the test that guards it:
 * a text that would not show, or would show with a broken detail, is named
 * here rather than silently left out.
 */
export function editorialProblems(
  known: { versions: Set<string>; heroes: Set<string> },
  folder = editorialFolder(),
): string[] {
  const problems: string[] = [];
  if (!fs.existsSync(folder)) return problems;

  const author = path.join(folder, "auteur.md");
  const profile = read(author);
  if (profile && !isDraft(profile.data)) {
    if (!text(profile.data.nom)) problems.push(`${author}: "nom" is empty, the profile stays hidden`);
    if (!profile.body) problems.push(`${author}: no text under the header, the profile stays hidden`);
    const heroes = profile.data.heros;
    if (heroes !== undefined && heroes !== null && !Array.isArray(heroes)) problems.push(`${author}: "heros" must be a list`);
    for (const h of Array.isArray(heroes) ? heroes : []) {
      if (!known.heroes.has(String(h))) problems.push(`${author}: unknown hero slug "${h}"`);
    }
    if (text(profile.data.contact) && !contactOf(profile.data.contact)) {
      problems.push(`${author}: "contact" must be an https:// address or an e-mail`);
    }
    const updated = text(profile.data.date);
    if (updated && !DATE.test(updated)) problems.push(`${author}: "date" must read YYYY-MM-DD`);
  }

  const signature = readAuthor(folder)?.name ?? null;
  for (const kind of NOTE_KINDS) {
    const dir = path.join(folder, kind);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith(".md") || name.startsWith("_")) continue;
      const file = path.join(dir, name);
      const key = name.slice(0, -".md".length);
      const note = read(file);
      if (!note || isDraft(note.data)) continue;
      if (!KEY.test(key)) problems.push(`${file}: the file name must be a patch version, such as 2.1.88.md`);
      else if (!known.versions.has(key)) problems.push(`${file}: no patch ${key} in the patch list`);
      if (!note.body) problems.push(`${file}: no text under the header`);
      const date = text(note.data.date);
      if (!date || !DATE.test(date)) problems.push(`${file}: "date" is missing or does not read YYYY-MM-DD`);
      if (!text(note.data.auteur) && !signature) {
        problems.push(`${file}: no signature: fill "auteur" here, or publish auteur.md`);
      }
    }
  }
  return problems;
}

/**
 * Patch list and patch notes read from Liquipedia.
 *
 * The Fandom wiki stopped following the game in the autumn of 2026 (no page
 * for 2.2.23, none for the hotfixes): Liquipedia is the source of truth for
 * which patches exist, when each one was released and which one is live. Its
 * patch pages are structured wikitext — an `{{Infobox patch}}` with the
 * release date, one `{{Herobc/New}}` per hero, one `{{Gameplaybc}}` per item,
 * talent or battlefield change — read through `action=query`, without any
 * render: this module turns them into the same shape as the Fandom notes
 * (`patches.json` details), so the site shows both the same way.
 *
 * Everything here is pure (no network), so that the parsing is tested on
 * fixtures; the requests live in `fetchLiquipediaPatches`, which takes the
 * client as an argument.
 */
import { compareVersions, readVersion } from "./patch-version.mjs";
import { toAnchor } from "./patch-notes.mjs";

// ─────────────────────────────────────────────────────────────
// Wikitext templates
// ─────────────────────────────────────────────────────────────

/** Index just past the `}}` closing the template opened at `start`, or -1. */
function templateEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i += 1) {
    const two = text.slice(i, i + 2);
    if (two === "{{") {
      depth += 1;
      i += 1;
    } else if (two === "}}") {
      depth -= 1;
      i += 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Splits on `separator` outside nested templates and links. */
function splitTopLevel(text, separator) {
  const out = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const two = text.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth += 1;
      current += two;
      i += 1;
    } else if ((two === "}}" || two === "]]") && depth > 0) {
      depth -= 1;
      current += two;
      i += 1;
    } else if (text[i] === separator && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += text[i];
    }
  }
  out.push(current);
  return out;
}

/**
 * Top-level templates of a wikitext, in order: name, named parameters,
 * positional parameters, and where they sit in the text.
 */
export function templates(text) {
  const found = [];
  let i = 0;
  while ((i = text.indexOf("{{", i)) !== -1) {
    const end = templateEnd(text, i);
    if (end === -1) break;
    const [head, ...rest] = splitTopLevel(text.slice(i + 2, end - 2), "|");
    const params = {};
    const positional = [];
    for (const piece of rest) {
      const eq = piece.indexOf("=");
      const key = eq === -1 ? null : piece.slice(0, eq).trim();
      if (key !== null && /^[\w -]+$/.test(key)) params[key.toLowerCase()] = piece.slice(eq + 1).trim();
      else positional.push(piece.trim());
    }
    found.push({ name: head.trim(), params, positional, start: i, end });
    i = end;
  }
  return found;
}

const isTemplate = (t, name) => t.name.toLowerCase() === name.toLowerCase();

// ─────────────────────────────────────────────────────────────
// Inline wikitext → text and HTML
// ─────────────────────────────────────────────────────────────

const TAG_LABELS = { buff: "▲ Buff", nerf: "▼ Nerf", adjust: "◆ Adjusted", new: "✚ New", revamp: "✚ Revamp" };
const escape = (s) => s.replace(/&(?![a-z]+;|#\d+;)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inline templates: hero and skill icons keep their name, the rest goes. */
function inlineTemplates(text, html) {
  let out = "";
  let last = 0;
  for (const t of templates(text)) {
    out += text.slice(last, t.start);
    last = t.end;
    const name = t.name.toLowerCase();
    if (name === "heroicon" || name === "itemicon" || name === "spellicon") out += t.positional[0] ?? "";
    else if (name === "ai") out += t.positional[1] ?? t.positional[0] ?? "";
    else if (name === "textid") {
      const label = TAG_LABELS[(t.positional[0] ?? "").toLowerCase()];
      if (label) out += html ? `<strong>${label}</strong>` : "";
    }
    // HiddenSort, bgcolortext, images, notes: nothing to show.
  }
  return out + text.slice(last);
}

/** Removes every match, again until none is left (no fragment can rebuild one). */
function stripAll(text, re) {
  let prev;
  let s = text;
  do {
    prev = s;
    s = s.replace(re, "");
  } while (s !== prev);
  return s;
}

/**
 * One inline wikitext fragment, as plain text (`html: false`, for structured
 * fields) or as safe HTML (bold, italics and line breaks kept, the rest
 * escaped). ">>" becomes "→", the notation of the other notes on the site.
 */
export function inline(text, { html = false } = {}) {
  let s = stripAll(String(text ?? ""), /<!--[\s\S]*?-->/g)
    // U+3164, a blank the page uses to pad lines.
    .replace(/ㅤ/g, "")
    .replace(/<\/?(?:h\d|div|span|center|small|big|nowiki)[^>]*>/gi, "")
    // "{{HeroIcon|Kaja}} [[Kaja]]": the icon, then the name; the name is enough.
    .replace(/\{\{HeroIcon\|[^{}]*\}\}\s*(?=\[\[)/gi, "");
  s = inlineTemplates(s, html);
  s = s
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]*)\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\]/g, "")
    .replace(/\s*>>\s*/g, " → ")
    // "Icefield Companions . Hero Feature", "breaking the enemy's wound..".
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/(?<!\.)\.\.(?!\.)/g, ".");
  // Line breaks: kept as markers through the escaping.
  s = s.replace(/<br\s*\/?>/gi, "\n");
  if (!html) {
    return stripAll(s, /<[^>]*>/g)
      .replace(/'''(.*?)'''/g, "$1")
      .replace(/''(.*?)''/g, "$1")
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  // Escape first, then turn the wiki emphasis and the <strong> of TextID back on.
  return escape(s)
    .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, "<strong>$1</strong>")
    .replace(/'''(.*?)'''/g, "<b>$1</b>")
    .replace(/''(.*?)''/g, "<i>$1</i>")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Lines of a change list: blank lines and <br> separate them. */
const lines = (text) => inline(text).split("\n").map((l) => l.trim()).filter(Boolean);

/**
 * A change line: before / after when it has one arrow, plain text otherwise
 * (same reading as the Fandom notes, `patch-parser.mjs`).
 */
export function change(line) {
  const parts = line.split(/\s*→\s*/);
  if (parts.length !== 2) return { text: line };
  const sep = parts[0].indexOf(":");
  if (sep === -1) return { label: null, before: parts[0].trim(), after: parts[1].trim() };
  return { label: parts[0].slice(0, sep).trim(), before: parts[0].slice(sep + 1).trim(), after: parts[1].trim() };
}

// ─────────────────────────────────────────────────────────────
// Infobox and heroes
// ─────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Comments out, an unclosed one included: the wiki hides it to the end of the page. */
const withoutComments = (text) => String(text).replace(/<!--[\s\S]*?(?:-->|$)/g, "");

/** `{{Infobox patch}}`: release date, neighbours and highlights. */
export function infobox(wikitext) {
  const box = templates(withoutComments(wikitext)).find((t) => isTemplate(t, "Infobox patch"));
  if (!box) return null;
  const release = box.params.release?.trim() ?? "";
  return {
    release: ISO_DATE.test(release) ? release : null,
    previous: readVersion(box.params.previous) ?? null,
    next: readVersion(box.params.next) ?? null,
    highlights: Object.keys(box.params)
      .filter((k) => /^highlight\d+$/.test(k))
      .sort((a, b) => Number(a.slice(9)) - Number(b.slice(9)))
      .map((k) => inline(box.params[k]))
      .filter(Boolean),
  };
}

const TYPES = new Set(["buff", "nerf", "adjust"]);
const typeOf = (raw) => {
  const t = String(raw ?? "").trim().toLowerCase();
  return TYPES.has(t) ? t : null;
};

/** Skill slots of `{{Herobc/New}}`, in the order of the game's kit. */
const SLOT = /^(attributes|passive|skill(\d+)|ultimate(\d*))$/;
function slotCategory(key) {
  const m = SLOT.exec(key);
  if (!m) return null;
  if (m[1] === "attributes") return null;
  if (m[1] === "passive") return "Passive";
  if (m[2]) return `Skill ${m[2]}`;
  return m[3] ? `Ultimate ${m[3]}` : "Ultimate";
}

/** Skills of a hero block, in the order the page lists them. */
function slots(t) {
  return Object.keys(t.params)
    .filter((k) => SLOT.test(k) && t.params[k].trim())
    .map((k) => ({
      key: k,
      category: slotCategory(k),
      name: inline(t.params[`${k}name`]) || null,
      type: typeOf(t.params[`${k}type`]),
      text: t.params[k],
    }));
}

/** A `{{Herobc/New}}` with `type = Revamp` or `New`: a showcase, not a balance change. */
const isShowcase = (t) => /^(revamp|new)/i.test(t.params.type ?? "");

/** A hero's balance changes, in the Fandom notes' shape (`HeroAdjustment` without its slug). */
export function heroAdjustment(t) {
  return {
    name: inline(t.params.hero),
    type: typeOf(t.params.type),
    intro: lines(t.params.note).join(" "),
    sections: slots(t).map((s) => ({
      name: s.key === "attributes" ? "Attributes" : (s.name ?? s.category),
      category: s.key === "attributes" ? null : s.category,
      type: s.type,
      changes: lines(s.text).map(change),
    })),
  };
}

/** A new or revamped hero, in the shape of the Fandom showcase (`NewHero` without its slug). */
export function heroShowcase(t) {
  const name = inline(t.params.hero);
  const epithet = inline(t.params.herotitle) || null;
  const note = lines(t.params.note);
  const featureAt = note.findIndex((l) => /^Hero Feature:/i.test(l));
  const feature = featureAt === -1 ? null : note[featureAt].replace(/^Hero Feature:\s*/i, "");
  return {
    name,
    epithet,
    anchor: toAnchor(`${t.params.type ?? "hero"} ${epithet ?? ""} ${name}`),
    lore: note.filter((_, i) => i !== featureAt),
    feature,
    skills: slots(t)
      .filter((s) => s.key !== "attributes")
      .map((s) => ({ role: s.category, name: s.name, description: lines(s.text) })),
  };
}

// ─────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────

/** "'''I.'''Revamped Hero" → "I. Revamped Hero", like the Fandom headings. */
const headingTitle = (raw) => inline(raw).replace(/^([IVXLC]+|[A-Z]|\d+)\.\s*/, "$1. ").trim();

/** Paragraphs and lists of a free-form block, as HTML. */
function blockHtml(text) {
  const out = [];
  for (const para of text.split(/\n\s*\n/)) {
    const rows = para.split("\n").filter((l) => l.trim());
    if (!rows.length) continue;
    let list = null;
    let paragraph = [];
    const flush = () => {
      const body = paragraph.map((l) => inline(l, { html: true })).filter(Boolean).join("<br>");
      if (body.replace(/<br>/g, "").trim()) out.push(`<p>${body.replace(/\n/g, "<br>")}</p>`);
      paragraph = [];
    };
    for (const row of rows) {
      const item = /^([*#])\s*(.*)$/.exec(row);
      if (item) {
        flush();
        const tag = item[1] === "*" ? "ul" : "ol";
        if (!list || list.tag !== tag) {
          if (list) out.push(`<${list.tag}>${list.items.join("")}</${list.tag}>`);
          list = { tag, items: [] };
        }
        const body = inline(item[2], { html: true }).replace(/\n/g, "<br>");
        if (body) list.items.push(`<li>${body}</li>`);
      } else {
        if (list) {
          out.push(`<${list.tag}>${list.items.join("")}</${list.tag}>`);
          list = null;
        }
        paragraph.push(row);
      }
    }
    if (list) out.push(`<${list.tag}>${list.items.join("")}</${list.tag}>`);
    flush();
  }
  return out.join("\n");
}

/** A `{{Gameplaybc}}` (item, talent, spell, battlefield effect): heading, note, change. */
function gameplayHtml(t) {
  const title = inline(t.params.title || t.params.link || "");
  const tag = TAG_LABELS[(t.params.type ?? "").trim().toLowerCase()];
  const parts = [];
  if (title) parts.push(`<p><b>${escape(title)}</b>${tag ? ` <strong>${tag}</strong>` : ""}</p>`);
  const note = inline(t.params.note, { html: true });
  if (note) parts.push(`<p><i>${note.replace(/\n/g, "<br>")}</i></p>`);
  const body = blockHtml(t.params.adjustment ?? "");
  if (body) parts.push(body);
  return parts.join("\n");
}

/** A hero block outside the hero sections (a mode's balance, say): rendered as text. */
function heroHtml(t) {
  const a = heroAdjustment(t);
  const tag = TAG_LABELS[a.type ?? ""];
  const parts = [`<p><b>${escape(a.name)}</b>${tag ? ` <strong>${tag}</strong>` : ""}</p>`];
  if (a.intro) parts.push(`<p><i>${escape(a.intro)}</i></p>`);
  for (const s of a.sections) {
    const rows = s.changes.map((c) => ("text" in c ? c.text : `${c.label ? `${c.label}: ` : ""}${c.before} → ${c.after}`));
    parts.push(`<p><b>${escape(s.category ? `${s.category}: ${s.name}` : s.name)}</b><br>${rows.map(escape).join("<br>")}</p>`);
  }
  return parts.join("\n");
}

/** Body of a section: free text, sub-headings and templates, in page order. */
function bodyHtml(raw, anchors) {
  // "<h4>Bug Fixes</h4>" is a sub-heading too.
  const text = raw.replace(/<h([3-5])>(.*?)<\/h\1>/gi, (_, n, t) => `\n${"=".repeat(Number(n))}${t}${"=".repeat(Number(n))}\n`);
  const out = [];
  let last = 0;
  const flushText = (chunk) => {
    // Sub-headings (=== and ====) inside the section.
    const pieces = chunk.split(/^(={3,5})\s*(.+?)\s*\1\s*$/m);
    for (let i = 0; i < pieces.length; i += 3) {
      const html = blockHtml(pieces[i] ?? "");
      if (html) out.push(html);
      if (pieces[i + 1]) {
        const level = Math.min(pieces[i + 1].length, 4);
        const title = headingTitle(pieces[i + 2]);
        if (title) out.push(`<h${level} id="${anchors(title)}">${escape(title)}</h${level}>`);
      }
    }
  };
  // Block templates break the text; inline ones (icons, tags) stay in it.
  for (const t of templates(text)) {
    const block = isTemplate(t, "Gameplaybc") ? gameplayHtml(t) : isTemplate(t, "Herobc/New") ? heroHtml(t) : null;
    if (block === null) continue;
    flushText(text.slice(last, t.start));
    last = t.end;
    out.push(block);
  }
  flushText(text.slice(last));
  return out.join("\n");
}

const HERO_SECTION = /hero/i;

/**
 * A Liquipedia patch page, in the shape of `patches.json` details: table of
 * contents, sections (the hero sections taken over by the site's components,
 * like the Fandom notes), new or revamped heroes and hero adjustments.
 */
export function liquipediaDetail(page, { version, title, link }) {
  const wikitext = withoutComments(page);
  const info = infobox(wikitext) ?? { release: null, highlights: [] };
  const seen = new Set();
  const anchors = (text) => {
    const base = toAnchor(text) || "section";
    let anchor = base;
    for (let n = 2; seen.has(anchor); n += 1) anchor = `${base}-${n}`;
    seen.add(anchor);
    return anchor;
  };

  // The infobox and the designers' quote are taken out of the body.
  const all = templates(wikitext);
  const quote = all.find((t) => isTemplate(t, "Quote"));
  let body = wikitext;
  for (const t of [...all].reverse()) {
    if (isTemplate(t, "Infobox patch") || t === quote) body = body.slice(0, t.start) + body.slice(t.end);
  }

  const sections = [];
  if (info.highlights.length) {
    sections.push({
      anchor: null,
      title: null,
      html: `<p>Highlights of patch ${escape(version)}:</p>\n<ul>${info.highlights.map((h) => `<li>${escape(h)}</li>`).join("")}</ul>`,
      role: null,
    });
  }
  if (quote) {
    const raw = String(quote.params.quote ?? "").replace(/^'*\s*From The Designers,?\s*'*\s*/i, "");
    const text = inline(raw, { html: true })
      .split(/\n\s*\n|\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const titleQuote = "From The Designers";
    if (text.length) sections.push({ anchor: anchors(titleQuote), title: titleQuote, html: text.map((l) => `<p>${l}</p>`).join("\n"), role: null });
  }

  const adjustments = [];
  const newHeroes = [];
  // Level-2 headings only: "==Title==", not "===Sub===".
  const pieces = body.split(/^==(?!=)\s*(.*?[^=\s])\s*==\s*$/m);
  for (let i = 1; i < pieces.length; i += 2) {
    const sectionTitle = headingTitle(pieces[i]);
    const text = pieces[i + 1] ?? "";
    const heroes = templates(text).filter((t) => isTemplate(t, "Herobc/New"));
    const showcases = heroes.filter(isShowcase);
    const balance = heroes.filter((t) => !isShowcase(t));
    const anchor = anchors(sectionTitle);

    // A hero section the site renders with its own components; whatever text
    // sits between the hero blocks (a bug fix line) would be lost, so a
    // section with no hero block stays free text.
    if (HERO_SECTION.test(sectionTitle) && heroes.length && (showcases.length === heroes.length || balance.length === heroes.length)) {
      const role = showcases.length ? "newHeroes" : "adjustments";
      if (role === "newHeroes") newHeroes.push(...showcases.map(heroShowcase));
      else adjustments.push(...balance.map(heroAdjustment));
      // The component shows every hero of the patch: a second section of the
      // same kind only adds its heroes.
      if (!sections.some((s) => s.role === role)) sections.push({ anchor, title: sectionTitle, html: "", role });
      continue;
    }
    sections.push({ anchor, title: sectionTitle, html: bodyHtml(text, anchors), role: null });
  }

  const toc = sections.flatMap((s) => {
    if (!s.title) return [];
    const subs = [...s.html.matchAll(/<h3 id="([^"]+)">(.*?)<\/h3>/g)].map((m) => ({ level: 3, title: m[2].replace(/&amp;/g, "&"), anchor: m[1] }));
    return [{ level: 2, title: s.title, anchor: s.anchor }, ...subs];
  });

  const balanceCount = { buff: 0, nerf: 0, adjust: 0 };
  for (const a of adjustments) if (a.type) balanceCount[a.type] += 1;

  return {
    version,
    title,
    date: info.release,
    link,
    source: "liquipedia",
    liquipedia: link,
    toc,
    sections,
    newHeroes,
    adjustments,
    balance: balanceCount,
  };
}

// ─────────────────────────────────────────────────────────────
// Patch list and merge with the Fandom wiki
// ─────────────────────────────────────────────────────────────

/** Version of a Liquipedia patch page: "Patch 2.2.16a" → "2.2.16a"; null for other pages. */
export function liquipediaVersion(title) {
  const m = /^Patch (\S+)$/.exec(String(title));
  return m ? readVersion(m[1]) : null;
}

/**
 * Liquipedia patch list from its page titles and infoboxes. A page with no
 * release date, or one in the future, announces a patch that is not live yet:
 * it is left out, so that it never shows as the live patch.
 */
export function liquipediaList(pages, { today, url }) {
  const byVersion = new Map();
  for (const p of pages) {
    const version = liquipediaVersion(p.title);
    if (!version || !p.release || p.release > today) continue;
    if (!byVersion.has(version)) byVersion.set(version, { version, title: p.title, link: url(p.title), date: p.release });
  }
  return [...byVersion.values()].sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Both lists merged by version. A Fandom entry keeps its title and link (its
 * notes are the ones shown when they exist) and takes Liquipedia's release
 * date; a version only Liquipedia knows (2.2.23, the hotfixes) is added with
 * Liquipedia's page. Nothing is dropped: a Fandom version missing from
 * Liquipedia stays, with no date, and a version of the previous list that
 * neither wiki answered for this run (an outage) stays as it was.
 */
export function mergeLists(fandom, liquipedia, previous = []) {
  const lp = new Map(liquipedia.map((p) => [p.version, p]));
  const merged = new Map();
  for (const f of fandom) {
    const l = lp.get(f.version);
    merged.set(f.version, { ...f, date: l?.date ?? f.date ?? null, liquipedia: l?.link ?? null });
  }
  for (const l of liquipedia) {
    if (!merged.has(l.version)) merged.set(l.version, { version: l.version, title: l.title, link: l.link, date: l.date, liquipedia: l.link });
  }
  // Same page under another version number (an older reading of its title): not a second patch.
  const titles = new Set([...merged.values()].map((p) => p.title));
  for (const p of previous) {
    if (!merged.has(p.version) && !titles.has(p.title)) merged.set(p.version, { date: null, liquipedia: null, ...p });
  }
  return [...merged.values()].sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Details of one version, from what each wiki gave. The Fandom notes stay
 * when they exist (richer HTML, the site's history); Liquipedia gives the
 * release date and, when the Fandom page lists no hero change (2.1.90's
 * did not), the hero adjustments. A version with Liquipedia notes only is
 * shown from them.
 */
export function mergeDetail(fandom, liquipedia) {
  if (!fandom) return liquipedia ?? null;
  const merged = { ...fandom, source: "fandom", date: liquipedia?.date ?? fandom.date ?? null, liquipedia: liquipedia?.link ?? null };
  if (liquipedia && !fandom.adjustments.length && liquipedia.adjustments.length) {
    merged.adjustments = liquipedia.adjustments;
    merged.balance = liquipedia.balance;
    merged.adjustmentsSource = "liquipedia";
    if (!merged.sections.some((s) => s.role === "adjustments")) {
      const lpSection = liquipedia.sections.find((s) => s.role === "adjustments");
      merged.sections = [...merged.sections, lpSection];
      merged.toc = [...merged.toc, { level: 2, title: lpSection.title, anchor: lpSection.anchor }];
    }
  }
  return merged;
}

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

/** Bump when `infobox` reads differently: cached pages are then read again. */
export const CACHE_VERSION = 1;

/**
 * Every Liquipedia patch page with its release date. One request lists the
 * pages with their latest revision; only pages changed since the cache are
 * downloaded again (ten per request), so a run where nothing moved costs a
 * single request. `client` is `scripts/liquipedia.mjs` (`api`, `contents`).
 */
export async function liquipediaPages(client, cache) {
  const listed = [];
  let next;
  do {
    const res = await client.api({
      action: "query",
      generator: "allpages",
      gapprefix: "Patch ",
      gapfilterredir: "nonredirects",
      gaplimit: "500",
      prop: "revisions",
      rvprop: "ids",
      ...(next ? { gapcontinue: next } : {}),
    });
    for (const p of res.query?.pages ?? []) {
      if (liquipediaVersion(p.title)) listed.push({ title: p.title, revid: p.revisions?.[0]?.revid ?? null });
    }
    next = res.continue?.gapcontinue;
  } while (next);

  const known = cache.version === CACHE_VERSION ? (cache.pages ?? {}) : {};
  const stale = listed.filter((p) => known[p.title]?.revid !== p.revid).map((p) => p.title);
  if (stale.length) console.log(`  ${stale.length} Liquipedia patch pages to read`);
  for (const [title, c] of await client.contents(stale)) {
    known[title] = { revid: c.revid, release: infobox(c.text)?.release ?? null };
  }
  const kept = listed.filter((p) => known[p.title]);
  cache.version = CACHE_VERSION;
  cache.pages = Object.fromEntries(kept.map((p) => [p.title, known[p.title]]));
  return kept.map((p) => ({ title: p.title, release: known[p.title].release }));
}

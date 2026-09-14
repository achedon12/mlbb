/**
 * Fetching patch note content.
 *
 * The wiki renders its own wikitext to HTML: we ask it for the rendering
 * rather than write a wikitext parser, then clean up what only makes sense
 * on the wiki — edit links, infoboxes, navigation, internal anchors.
 *
 * The result is plain HTML: headings, paragraphs, lists, tables.
 */
import { parse } from "node-html-parser";

/** Elements of no use outside the wiki. */
const TO_DELETE = [
  ".mw-editsection",
  ".navbox",
  ".portable-infobox",
  ".infobox",
  ".toc",
  ".reference",
  ".references",
  ".mw-references-wrap",
  "script",
  "style",
  ".noprint",
  ".mw-empty-elt",
  "#toc",
  ".hatnote",
];

export function cleanRender(html, origin) {
  const root = parse(html);

  for (const picker of TO_DELETE) {
    for (const node of root.querySelectorAll(picker)) node.remove();
  }

  // The wiki's relative links would point nowhere once copied: make them
  // absolute, and mark them as external.
  for (const link of root.querySelectorAll("a")) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("/wiki/")) {
      link.setAttribute("href", `https://mobilelegends.fandom.com${href}`);
    } else if (href.startsWith("#") || href === "") {
      // Anchor to a removed section: keep the text, not the link.
      link.replaceWith(link.innerHTML);
      continue;
    }
    link.setAttribute("rel", "noreferrer nofollow");
    link.setAttribute("target", "_blank");
  }

  // The wiki's images are lazy-loaded through a custom attribute; without the
  // wiki's script, they would stay empty. Remove them.
  for (const image of root.querySelectorAll("img")) image.remove();

  // The wiki's classes mean nothing in our stylesheet.
  for (const node of root.querySelectorAll("[class]")) {
    node.removeAttribute("class");
  }
  for (const node of root.querySelectorAll("[style]")) {
    node.removeAttribute("style");
  }
  // The wiki's ids serve its own anchors; we replace them with ours
  // further down.
  for (const node of root.querySelectorAll("[id]")) node.removeAttribute("id");

  // Every heading gets an anchor: without it, a table of contents cannot
  // point anywhere, and a patch note runs to tens of thousands of
  // characters.
  const seen = new Set();
  for (const title of root.querySelectorAll("h2, h3, h4")) {
    const text = title.text.trim();
    if (!text) continue;

    let anchor = toAnchor(text);
    // Two sections can share the same name within a page.
    let suffix = 2;
    while (seen.has(anchor)) anchor = `${toAnchor(text)}-${suffix++}`;
    seen.add(anchor);

    title.setAttribute("id", anchor);
  }

  const content = root.querySelector(".mw-parser-output") ?? root;
  const text = content.innerHTML
    .replace(/<div[^>]*>|<\/div>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { html: text, origin };
}

/**
 * Splits the cleaned HTML into top-level sections.
 *
 * Each h2 heading opens a section that runs until the next h2, keeping its
 * h3 subheadings. The split lets the page compose: render some sections as
 * is, replace others with a rich component.
 */
export function splitSections(html) {
  const root = parse(html);
  const sections = [];
  let current = null;

  for (const node of root.childNodes) {
    if (node.rawTagName === "h2") {
      current = {
        anchor: node.getAttribute("id") ?? null,
        title: node.text.trim(),
        html: "",
      };
      sections.push(current);
      continue;
    }

    // Content before the first h2: put it in an untitled section.
    if (!current) {
      current = { anchor: null, title: null, html: "" };
      sections.push(current);
    }

    current.html += node.toString();
  }

  return sections
    .map((s) => ({ ...s, html: s.html.trim() }))
    .filter((s) => s.title || s.html);
}

/**
 * Extracts the structured presentation of new heroes from a section.
 *
 * The wiki follows a regular grammar: a subheading names the hero, a
 * paragraph tells its story and its "Hero feature", then each skill is a
 * bold paragraph — role and name — followed by a list of descriptions. We
 * turn it into data for a polished display.
 */
export function newHeroes(sectionHtml) {
  const root = parse(sectionHtml);
  const heroes = [];
  let current = null;

  for (const node of root.childNodes) {
    const tag = node.rawTagName;

    if (tag === "h3") {
      // "New Hero: Fallen Scarlet - Hirara" → epithet "Fallen Scarlet",
      // name "Hirara".
      const raw = node.text.trim().replace(/^New Hero\s*:\s*/i, "");
      const chunks = raw.split(/\s[-–—]\s/);
      const name = (chunks.length > 1 ? chunks.pop() : raw).trim();
      const epithet = chunks.join(" - ").trim() || null;
      current = {
        name,
        epithet,
        anchor: node.getAttribute("id") ?? null,
        lore: [],
        feature: null,
        skills: [],
      };
      heroes.push(current);
      continue;
    }

    if (!current) continue;

    if (tag === "p") {
      const bold = node.querySelector("b");
      const label = bold ? bold.text.replace(/\s+/g, " ").trim() : "";

      if (bold && /(Passive|Skill|Combo|Ultimate|Ult\b)/i.test(label)) {
        // "Passive - Twin Fans: Ukifune" → role then skill name.
        const cut = label.search(/\s[-–—]\s/);
        const role = (cut >= 0 ? label.slice(0, cut) : label).trim();
        const name =
          cut >= 0 ? label.slice(cut).replace(/^\s[-–—]\s/, "").trim() : null;
        current.skills.push({ role, name, description: [] });
        continue;
      }

      // Story paragraph: lines are separated by <br>, and the last one often
      // announces the "Hero feature".
      for (const block of node.innerHTML.split(/<br\s*\/?>/i)) {
        const row = parse(block).text.replace(/\s+/g, " ").trim();
        if (!row) continue;
        const feature = row.match(/^Hero feature\s*:\s*(.+)$/i);
        if (feature) current.feature = feature[1].trim();
        else current.lore.push(row);
      }
      continue;
    }

    if (tag === "ul") {
      const last = current.skills.at(-1);
      if (!last) continue;
      for (const item of node.querySelectorAll("li")) {
        const text = item.text.replace(/\s+/g, " ").trim();
        if (text) last.description.push(text);
      }
    }
  }

  return heroes;
}

/** Stable anchor id, derived from the heading. */
function toAnchor(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Page table of contents, two levels.
 *
 * It is built after cleanup, so on the anchors actually present in the
 * document: a table of contents pointing at nothing would be worse than none.
 */
export function toc(html) {
  return parse(html)
    .querySelectorAll("h2, h3")
    .map((t) => ({
      level: t.rawTagName === "h2" ? 2 : 3,
      title: t.text.trim(),
      anchor: t.getAttribute("id") ?? null,
    }))
    .filter((t) => t.anchor && t.title.length > 0 && t.title.length < 120);
}

/**
 * Hero and item infoboxes from Liquipedia: base stats, item price and status.
 *
 * Liquipedia's editors update the `{{Infobox hero}}` attributes after each
 * patch, where the Fandom data module (`Module:Hero/data`) stopped following
 * them: in November 2026 the site applied 15 of the 117 attribute changes of
 * the 2026 patch notes, Liquipedia 93. Its item pages also say which items
 * left the game (`status=Removed`).
 *
 * Requests go through `liquipedia.mjs`, which follows the API terms
 * (identified User-Agent, one request every two seconds or more, gzip). Only
 * `action=query` is used: the revision ids of every page in batches of 50,
 * then the wikitext of the pages whose revision changed since the last run.
 * The cache keeps the parsed fields only, so a run where nothing changed
 * costs three or four requests.
 */

export const CACHE_VERSION = 1;

/**
 * Top-level fields of the first `{{<name> ...}}` template, by counting braces
 * and brackets: values nest other templates (`{{Recipe ...}}`) and links whose
 * pipes are not field separators.
 */
export function infoboxFields(text, name) {
  const start = String(text ?? "").search(new RegExp(`\\{\\{\\s*${name}\\b`, "i"));
  if (start < 0) return null;
  const fields = {};
  let depth = 0;
  let links = 0;
  let current = null;
  const flush = () => {
    if (current === null) return;
    const eq = current.indexOf("=");
    if (eq > 0) {
      const key = current.slice(0, eq).trim().toLowerCase();
      if (key && !(key in fields)) fields[key] = current.slice(eq + 1).replace(/<!--[\s\S]*?-->/g, "").trim();
    }
  };
  for (let i = start; i < text.length; i += 1) {
    const two = text.slice(i, i + 2);
    if (two === "{{") { depth += 1; i += 1; if (depth > 1 && current !== null) current += "{{"; continue; }
    if (two === "}}") {
      depth -= 1; i += 1;
      if (depth === 0) { flush(); return fields; }
      if (current !== null) current += "}}";
      continue;
    }
    if (two === "[[") { links += 1; i += 1; if (current !== null) current += "[["; continue; }
    if (two === "]]") { links -= 1; i += 1; if (current !== null) current += "]]"; continue; }
    const c = text[i];
    if (c === "|" && depth === 1 && links === 0) { flush(); current = ""; continue; }
    if (current !== null) current += c;
  }
  return fields;
}

/** A plain number ("2500", "7.5"), as a string without trailing zeros; null otherwise. */
export function plainNumber(value) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(value ?? ""));
  return m ? String(Number(m[1])) : null;
}

/**
 * Level-1 attributes of `{{Infobox hero}}`, under the field names of
 * `heroes.json` (those of the Fandom module). Liquipedia has no level-15
 * values: they are rebuilt from the growth (see `hero-stats.mjs`).
 */
const HERO_FIELDS = {
  hp: "hp1",
  hpreg: "hp_regen1",
  mana: "mana1",
  phyatk: "physical_atk1",
  phydef: "physical_def1",
  magdef: "magic_def1",
  movespeed: "movement_spd",
};

export function heroStatsFromInfobox(text) {
  const f = infoboxFields(text, "Infobox hero");
  if (!f) return null;
  const out = {};
  for (const [lp, key] of Object.entries(HERO_FIELDS)) {
    const v = plainNumber(f[lp]);
    if (v !== null) out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Price and status of `{{Infobox item}}`; the status is lower-cased ("available", "removed"). */
export function itemFromInfobox(text) {
  const f = infoboxFields(text, "Infobox item");
  if (!f) return null;
  const price = plainNumber(f.itemcost);
  return {
    price: price === null ? null : Number(price),
    status: f.status ? f.status.trim().toLowerCase() : null,
  };
}

/**
 * Parsed infoboxes of `titles`, through the cache. `kind` names the cache
 * section ("heroes", "items"), `parse` turns a wikitext into the stored value.
 * Returns a Map title → { title (as on the wiki), revid, data }, without the
 * pages Liquipedia does not have.
 */
export async function liquipediaInfoboxes(client, titles, cache, kind, parse) {
  if (cache.version !== CACHE_VERSION) {
    for (const k of Object.keys(cache)) delete cache[k];
    cache.version = CACHE_VERSION;
  }
  const known = (cache[kind] ??= {});
  const revisions = await client.revisions(titles);
  const stale = [...new Set([...revisions.values()].filter((r) => r && known[r.title]?.revid !== r.revid).map((r) => r.title))];
  if (stale.length) console.log(`  ${stale.length} Liquipedia ${kind} pages to read`);
  for (const [title, page] of await client.contents(stale)) {
    known[title] = { revid: page.revid, timestamp: page.timestamp, data: parse(page.text) };
  }
  const out = new Map();
  for (const [asked, r] of revisions) {
    if (r && known[r.title]) out.set(asked, { title: r.title, ...known[r.title] });
  }
  // Pages no longer asked for leave the cache.
  const wanted = new Set([...out.values()].map((v) => v.title));
  for (const t of Object.keys(known)) if (!wanted.has(t)) delete known[t];
  return out;
}

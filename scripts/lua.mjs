/**
 * Reading the wiki's Lua tables.
 *
 * The wiki's data lives in Scribunto modules that end with
 * `return { ... }`. They are not JSON files, but their shape is
 * regular: bracketed keys, literal values, nested tables.
 *
 * So the table is read by hand rather than by embedding a Lua interpreter.
 * The parsing is deliberately lenient: the wiki is edited by humans
 * and contains trailing commas, comments and empty fields.
 */

export function analyzeTableLua(source) {
  const text = removeComments(source);
  const start = text.indexOf("return");
  if (start === -1) throw new Error("No `return` found in the module.");

  const reader = { text, i: text.indexOf("{", start) };
  if (reader.i === -1) throw new Error("No table found after `return`.");

  return readTable(reader);
}

/** Strips Lua comments without touching those inside a string. */
function removeComments(source) {
  let output = "";
  let inString = false;
  let delimiter = "";

  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    const previous = source[i - 1];

    if (inString) {
      output += c;
      if (c === delimiter && previous !== "\\") inString = false;
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      delimiter = c;
      output += c;
      continue;
    }

    // Block comment --[[ ... ]] or line comment -- ...
    if (c === "-" && source[i + 1] === "-") {
      if (source.slice(i + 2, i + 4) === "[[") {
        const end = source.indexOf("]]", i + 4);
        i = end === -1 ? source.length : end + 1;
      } else {
        const end = source.indexOf("\n", i);
        i = end === -1 ? source.length : end - 1;
      }
      continue;
    }

    output += c;
  }

  return output;
}

function skipSpaces(l) {
  while (l.i < l.text.length && /\s/.test(l.text[l.i])) l.i += 1;
}

function readTable(l) {
  l.i += 1; // skip the {
  const table = {};
  let hint = 1;

  for (;;) {
    skipSpaces(l);
    const c = l.text[l.i];

    if (c === undefined) break;
    if (c === "}") {
      l.i += 1;
      break;
    }
    if (c === "," || c === ";") {
      l.i += 1;
      continue;
    }

    let key = null;

    if (c === "[") {
      // Explicit key: ["name"] or [12]
      l.i += 1;
      skipSpaces(l);
      key = String(readValue(l));
      skipSpaces(l);
      if (l.text[l.i] === "]") l.i += 1;
      skipSpaces(l);
      if (l.text[l.i] === "=") l.i += 1;
    } else if (/[A-Za-z_]/.test(c)) {
      // Bare key: name = value. May also be a value (true, nil...),
      // so decide only after seeing whether an equals sign follows.
      const start = l.i;
      while (l.i < l.text.length && /[A-Za-z0-9_]/.test(l.text[l.i])) l.i += 1;
      const word = l.text.slice(start, l.i);
      skipSpaces(l);

      if (l.text[l.i] === "=" && l.text[l.i + 1] !== "=") {
        key = word;
        l.i += 1;
      } else {
        l.i = start;
      }
    }

    skipSpaces(l);
    const value = readValue(l);
    if (value === undefined) continue;

    if (key === null) {
      table[hint] = value;
      hint += 1;
    } else {
      table[key] = value;
    }
  }

  return table;
}

function readValue(l) {
  skipSpaces(l);
  const c = l.text[l.i];

  if (c === undefined) return undefined;
  if (c === "{") return readTable(l);
  if (c === '"' || c === "'") return readString(l, c);

  if (l.text.startsWith("[[", l.i)) {
    // Long string [[ ... ]]
    const end = l.text.indexOf("]]", l.i + 2);
    const value = l.text.slice(l.i + 2, end === -1 ? undefined : end);
    l.i = end === -1 ? l.text.length : end + 2;
    return value;
  }

  const start = l.i;
  while (l.i < l.text.length && !/[,;}\]]/.test(l.text[l.i])) l.i += 1;
  const raw = l.text.slice(start, l.i).trim();

  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "nil" || raw === "") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function readString(l, delimiter) {
  l.i += 1;
  let output = "";

  while (l.i < l.text.length) {
    const c = l.text[l.i];

    if (c === "\\") {
      const next = l.text[l.i + 1];
      output += { n: "\n", t: "\t", r: "\r" }[next] ?? next;
      l.i += 2;
      continue;
    }
    if (c === delimiter) {
      l.i += 1;
      break;
    }

    output += c;
    l.i += 1;
  }

  return output;
}

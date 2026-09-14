/**
 * Lecture des tables Lua du wiki.
 *
 * Les donnees du wiki vivent dans des modules Scribunto qui se terminent par
 * `return { ... }`. Ce ne sont pas des fichiers JSON, mais leur forme est
 * reguliere : cles entre crochets, valeurs litterales, tables imbriquees.
 *
 * On lit donc la table a la main plutot que d'embarquer un interpreteur Lua.
 * L'analyse est volontairement tolerante : le wiki est edite par des humains
 * et contient des virgules en trop, des commentaires et des champs vides.
 */

export function analyzeTableLua(source) {
  const text = removeComments(source);
  const start = text.indexOf("return");
  if (start === -1) throw new Error("Aucun `return` trouve dans le module.");

  const reader = { text, i: text.indexOf("{", start) };
  if (reader.i === -1) throw new Error("Aucune table trouvee apres `return`.");

  return readTable(reader);
}

/** Retire les commentaires Lua sans toucher a ceux qui sont dans une chaine. */
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

    // Commentaire de bloc --[[ ... ]] ou de ligne -- ...
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
  l.i += 1; // passe le {
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
      // Cle explicite : ["nom"] ou [12]
      l.i += 1;
      skipSpaces(l);
      key = String(readValue(l));
      skipSpaces(l);
      if (l.text[l.i] === "]") l.i += 1;
      skipSpaces(l);
      if (l.text[l.i] === "=") l.i += 1;
    } else if (/[A-Za-z_]/.test(c)) {
      // Cle nue : nom = valeur. Peut aussi etre une valeur (true, nil...),
      // on ne decide qu'apres avoir vu s'il y a un signe egal.
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
    // Chaine longue [[ ... ]]
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

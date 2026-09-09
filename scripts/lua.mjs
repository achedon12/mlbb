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

export function analyserTableLua(source) {
  const texte = retirerCommentaires(source);
  const depart = texte.indexOf("return");
  if (depart === -1) throw new Error("Aucun `return` trouve dans le module.");

  const lecteur = { texte, i: texte.indexOf("{", depart) };
  if (lecteur.i === -1) throw new Error("Aucune table trouvee apres `return`.");

  return lireTable(lecteur);
}

/** Retire les commentaires Lua sans toucher a ceux qui sont dans une chaine. */
function retirerCommentaires(source) {
  let sortie = "";
  let dansChaine = false;
  let delimiteur = "";

  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    const precedent = source[i - 1];

    if (dansChaine) {
      sortie += c;
      if (c === delimiteur && precedent !== "\\") dansChaine = false;
      continue;
    }

    if (c === '"' || c === "'") {
      dansChaine = true;
      delimiteur = c;
      sortie += c;
      continue;
    }

    // Commentaire de bloc --[[ ... ]] ou de ligne -- ...
    if (c === "-" && source[i + 1] === "-") {
      if (source.slice(i + 2, i + 4) === "[[") {
        const fin = source.indexOf("]]", i + 4);
        i = fin === -1 ? source.length : fin + 1;
      } else {
        const fin = source.indexOf("\n", i);
        i = fin === -1 ? source.length : fin - 1;
      }
      continue;
    }

    sortie += c;
  }

  return sortie;
}

function sauterEspaces(l) {
  while (l.i < l.texte.length && /\s/.test(l.texte[l.i])) l.i += 1;
}

function lireTable(l) {
  l.i += 1; // passe le {
  const table = {};
  let indice = 1;

  for (;;) {
    sauterEspaces(l);
    const c = l.texte[l.i];

    if (c === undefined) break;
    if (c === "}") {
      l.i += 1;
      break;
    }
    if (c === "," || c === ";") {
      l.i += 1;
      continue;
    }

    let cle = null;

    if (c === "[") {
      // Cle explicite : ["nom"] ou [12]
      l.i += 1;
      sauterEspaces(l);
      cle = String(lireValeur(l));
      sauterEspaces(l);
      if (l.texte[l.i] === "]") l.i += 1;
      sauterEspaces(l);
      if (l.texte[l.i] === "=") l.i += 1;
    } else if (/[A-Za-z_]/.test(c)) {
      // Cle nue : nom = valeur. Peut aussi etre une valeur (true, nil...),
      // on ne decide qu'apres avoir vu s'il y a un signe egal.
      const debut = l.i;
      while (l.i < l.texte.length && /[A-Za-z0-9_]/.test(l.texte[l.i])) l.i += 1;
      const mot = l.texte.slice(debut, l.i);
      sauterEspaces(l);

      if (l.texte[l.i] === "=" && l.texte[l.i + 1] !== "=") {
        cle = mot;
        l.i += 1;
      } else {
        l.i = debut;
      }
    }

    sauterEspaces(l);
    const valeur = lireValeur(l);
    if (valeur === undefined) continue;

    if (cle === null) {
      table[indice] = valeur;
      indice += 1;
    } else {
      table[cle] = valeur;
    }
  }

  return table;
}

function lireValeur(l) {
  sauterEspaces(l);
  const c = l.texte[l.i];

  if (c === undefined) return undefined;
  if (c === "{") return lireTable(l);
  if (c === '"' || c === "'") return lireChaine(l, c);

  if (l.texte.startsWith("[[", l.i)) {
    // Chaine longue [[ ... ]]
    const fin = l.texte.indexOf("]]", l.i + 2);
    const valeur = l.texte.slice(l.i + 2, fin === -1 ? undefined : fin);
    l.i = fin === -1 ? l.texte.length : fin + 2;
    return valeur;
  }

  const debut = l.i;
  while (l.i < l.texte.length && !/[,;}\]]/.test(l.texte[l.i])) l.i += 1;
  const brut = l.texte.slice(debut, l.i).trim();

  if (brut === "true") return true;
  if (brut === "false") return false;
  if (brut === "nil" || brut === "") return null;
  if (/^-?\d+(\.\d+)?$/.test(brut)) return Number(brut);
  return brut;
}

function lireChaine(l, delimiteur) {
  l.i += 1;
  let sortie = "";

  while (l.i < l.texte.length) {
    const c = l.texte[l.i];

    if (c === "\\") {
      const suivant = l.texte[l.i + 1];
      sortie += { n: "\n", t: "\t", r: "\r" }[suivant] ?? suivant;
      l.i += 2;
      continue;
    }
    if (c === delimiteur) {
      l.i += 1;
      break;
    }

    sortie += c;
    l.i += 1;
  }

  return sortie;
}

/**
 * Traduit les donnees de contenu vers les autres langues.
 *
 * Chaque jeu de donnees a une langue source (le francais pour ce qui est
 * extrait du wiki puis traduit, l'anglais pour les objets bruts et les patchs) ;
 * on en derive les trois autres langues. Tout est mis en cache
 * (`scripts/traductions-donnees.json`, clef source+cible+texte) : une phrase
 * deja traduite ne repart jamais sur le reseau. Ce script ne tourne qu'a la
 * main ou en CI ; l'application ne traduit rien.
 *
 * `node scripts/traduire-donnees.mjs patchs combos` ne traite que les jeux
 * nommes ; sans argument, tous.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pause, traduireLot } from "./traduction-google.mjs";
import { traduireHtml } from "./traduction-html.mjs";
import { existsSync } from "node:fs";

const LANGUES = ["en", "fr", "it", "es"];
const CACHE = "scripts/traductions-donnees.json";

const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
const enregistrer = () => writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");

/**
 * Lots d'au plus dix textes, bornes aussi en longueur : tout part dans l'URL,
 * et un paragraphe de patch encode (marqueurs compris) peut peser plusieurs Ko.
 */
function lots(textes) {
  const groupes = [];
  let courant = [];
  let taille = 0;
  for (const t of textes) {
    const poids = encodeURIComponent(t).length;
    if (courant.length >= 10 || (courant.length && taille + poids > 6000)) {
      groupes.push(courant);
      courant = [];
      taille = 0;
    }
    courant.push(t);
    taille += poids;
  }
  if (courant.length) groupes.push(courant);
  return groupes;
}

async function preparer(textes, sl, tl) {
  const uniques = [...new Set(textes.map((t) => String(t).trim()).filter(Boolean))];
  const manquants = uniques.filter((t) => !(`${sl}|${tl}|${t}` in cache));
  const groupes = lots(manquants);
  for (const [i, lot] of groupes.entries()) {
    const sorties = await traduireLot(lot, sl, tl);
    lot.forEach((o, k) => (cache[`${sl}|${tl}|${o}`] = sorties[k] ?? o));
    process.stdout.write(`\r    ${sl}->${tl} ${i + 1}/${groupes.length} lots`);
    // Un long passage (les patchs) ne perd pas tout sur une coupure reseau.
    if (i % 50 === 49) await enregistrer();
    await pause(200);
  }
  if (groupes.length) process.stdout.write("\n");
}

const tr = (sl, tl) => (t) => (t ? (cache[`${sl}|${tl}|${String(t).trim()}`] ?? t) : t);

/** Textes a traduire d'un jeu : ceux que sa reconstruction demande, dans l'ordre. */
const collecter = (rebuild) => (d) => {
  const out = [];
  rebuild(d, (x) => {
    if (x) out.push(x);
    return x;
  });
  return out;
};

// ── Configuration par jeu de donnees ───────────────────────────────
function histoiresTextes(d) {
  const out = [];
  for (const h of Object.values(d)) {
    if (h.accroche) out.push(h.accroche);
    out.push(...(h.lore ?? []), ...(h.anecdotes ?? []));
    if (h.fiche) {
      for (const c of ["titre", "espece", "genre", "age", "origine"]) if (h.fiche[c]) out.push(h.fiche[c]);
      out.push(...(h.fiche.affiliations ?? []), ...(h.fiche.relations ?? []), ...(h.fiche.pouvoirs ?? []));
    }
  }
  return out;
}
function histoiresRebuild(d, t) {
  const tl_ = (liste) => (liste ?? []).map(t);
  const o = {};
  for (const [slug, h] of Object.entries(d)) {
    const f = h.fiche;
    o[slug] = {
      accroche: t(h.accroche),
      lore: tl_(h.lore),
      anecdotes: tl_(h.anecdotes),
      fiche: f
        ? {
            nomComplet: f.nomComplet,
            titre: t(f.titre),
            espece: t(f.espece),
            genre: t(f.genre),
            age: t(f.age),
            origine: t(f.origine),
            anniversaire: f.anniversaire,
            affiliations: tl_(f.affiliations),
            relations: tl_(f.relations),
            pouvoirs: tl_(f.pouvoirs),
          }
        : null,
    };
  }
  return o;
}

function competencesTextes(d) {
  const out = [];
  for (const l of Object.values(d)) for (const c of l) if (c?.description) out.push(c.description);
  return out;
}
const competencesRebuild = (d, t) =>
  Object.fromEntries(
    Object.entries(d).map(([s, l]) => [s, l.map((c) => (c ? { nom: c.nom, description: t(c.description) } : c))]),
  );

function modesTextes(d) {
  const out = [];
  for (const m of d) {
    if (m.description) out.push(m.description);
    for (const s of m.sections ?? []) {
      out.push(s.titre);
      for (const e of s.elements ?? []) out.push(e.texte);
    }
  }
  return out;
}
const modesRebuild = (d, t) =>
  d.map((m) => ({
    ...m,
    description: t(m.description),
    sections: (m.sections ?? []).map((s) => ({
      titre: t(s.titre),
      elements: (s.elements ?? []).map((e) => ({ type: e.type, texte: t(e.texte) })),
    })),
  }));

const CHAMPS_OBJET = ["resume", "bonus", "unique", "passif", "actif", "pourQui"];
function objetsTextes(d) {
  const out = [];
  for (const o of d) for (const c of CHAMPS_OBJET) if (o[c]) out.push(o[c]);
  return out;
}
const objetsRebuild = (d, t) =>
  d.map((o) => ({ ...o, ...Object.fromEntries(CHAMPS_OBJET.map((c) => [c, o[c] ? t(o[c]) : o[c]])) }));

const tierNotesTextes = (d) => Object.values(d);
const tierNotesRebuild = (d, t) => Object.fromEntries(Object.entries(d).map(([s, v]) => [s, t(v)]));

/**
 * Patchs detailles : textes des ajustements, nouveaux heros, titres et HTML
 * libre des sections. Restent tels quels : noms de heros et de competences
 * (ceux du jeu, comme sur les fiches), epithetes (elles designent aussi
 * l'illustration), valeurs avant/apres, ancres et liens.
 */
// Le parseur nomme en francais la sous-section implicite des attributs.
const nomSection = (s) => (s.categorie ? s.nom : s.nom === "Attributs" ? "Attributes" : s.nom);
const patchsRebuild = (d, t) =>
  Object.fromEntries(
    Object.entries(d).map(([version, p]) => [
      version,
      {
        ...p,
        sommaire: p.sommaire.map((s) => ({ ...s, titre: t(s.titre) })),
        sections: p.sections.map((s) => ({ ...s, titre: t(s.titre), html: traduireHtml(s.html, t) })),
        nouveaux: p.nouveaux.map((n) => ({
          ...n,
          lore: n.lore.map(t),
          feature: t(n.feature),
          competences: n.competences.map((c) => ({ ...c, role: t(c.role), description: c.description.map(t) })),
        })),
        ajustements: p.ajustements.map((a) => ({
          ...a,
          intro: t(a.intro),
          sections: a.sections.map((s) => ({
            ...s,
            nom: s.categorie ? s.nom : t(nomSection(s)),
            categorie: t(s.categorie),
            changements: s.changements.map((c) => ("texte" in c ? { ...c, texte: t(c.texte) } : { ...c, libelle: t(c.libelle) })),
          })),
        })),
      },
    ]),
  );

/** Combos : seuls les champs `description` (texte ou liste de textes) se traduisent, ou qu'ils soient. */
function descriptionsRebuild(d, t) {
  if (Array.isArray(d)) return d.map((x) => descriptionsRebuild(x, t));
  if (!d || typeof d !== "object") return d;
  return Object.fromEntries(
    Object.entries(d).map(([k, v]) => {
      if (k !== "description") return [k, descriptionsRebuild(v, t)];
      return [k, typeof v === "string" ? t(v) : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? t(x) : x)) : v];
    }),
  );
}

/**
 * `fichier` : source hors du dossier du jeu (un fichier de synchro qui ne se
 * decoupe pas par langue) ; `extraire` en garde la partie a traduire.
 * `optionnel` : le jeu est saute tant que sa source n'existe pas.
 */
const JEUX = {
  histoires: { source: "fr", textes: histoiresTextes, rebuild: histoiresRebuild },
  competences: { source: "fr", textes: competencesTextes, rebuild: competencesRebuild },
  modes: { source: "fr", textes: modesTextes, rebuild: modesRebuild },
  objets: { source: "en", textes: objetsTextes, rebuild: objetsRebuild },
  "tier-notes": { source: "fr", textes: tierNotesTextes, rebuild: tierNotesRebuild },
  patchs: {
    source: "en",
    fichier: "src/data/jeu/patchs.json",
    extraire: (d) => d.detail,
    textes: collecter(patchsRebuild),
    rebuild: patchsRebuild,
  },
  combos: {
    source: "en",
    fichier: "src/data/jeu/combos.json",
    optionnel: true,
    textes: collecter(descriptionsRebuild),
    rebuild: descriptionsRebuild,
  },
};

const demandes = process.argv.slice(2);
for (const nom of demandes) if (!(nom in JEUX)) throw new Error(`Jeu inconnu : ${nom}`);

for (const [nom, cfg] of Object.entries(JEUX)) {
  if (demandes.length && !demandes.includes(nom)) continue;
  const fichier = cfg.fichier ?? `src/data/jeu/${nom}/${cfg.source}.json`;
  if (!existsSync(fichier)) {
    if (cfg.optionnel) {
      console.log(`${nom} : ${fichier} absent, rien a traduire`);
      continue;
    }
    throw new Error(`Source absente : ${fichier}`);
  }
  const brut = JSON.parse(await readFile(fichier, "utf8"));
  const source = cfg.extraire ? cfg.extraire(brut) : brut;
  const tous = cfg.textes(source);
  console.log(`${nom} (${cfg.source}) : ${new Set(tous.map((x) => String(x).trim())).size} textes uniques`);
  await mkdir(`src/data/jeu/${nom}`, { recursive: true });
  for (const tl of LANGUES.filter((l) => l !== cfg.source)) {
    await preparer(tous, cfg.source, tl);
    const t = tr(cfg.source, tl);
    // Seconde passe : un bloc HTML dont la traduction a perdu ses balises
    // retombe sur ses textes un par un, qu'il faut alors traduire aussi.
    const manquants = [];
    cfg.rebuild(source, (x) => {
      if (x && !(`${cfg.source}|${tl}|${String(x).trim()}` in cache)) manquants.push(x);
      return t(x);
    });
    await preparer(manquants, cfg.source, tl);
    const arbre = cfg.rebuild(source, t);
    await writeFile(`src/data/jeu/${nom}/${tl}.json`, JSON.stringify(arbre, null, 2) + "\n");
    await enregistrer();
    console.log(`  ${nom}/${tl}.json`);
  }
}
console.log("Donnees traduites.");

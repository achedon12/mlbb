import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fr from "@/i18n/messages/fr.json";
import en from "@/i18n/messages/en.json";
import itCatalogue from "@/i18n/messages/it.json";
import es from "@/i18n/messages/es.json";

/**
 * Coherence des catalogues de messages.
 *
 * Les quatre langues portent les memes cles et les memes variables, et toute
 * cle citee dans le code existe : une cle absente s'afficherait telle quelle
 * (« pages.heroes.titre ») au lecteur, une variable manquante resterait entre
 * accolades.
 */
type Noeud = string | Noeud[] | { [cle: string]: Noeud };
const CATALOGUES: Record<string, Noeud> = { fr, en, it: itCatalogue, es } as unknown as Record<string, Noeud>;

function aplatir(noeud: Noeud, prefixe = "", sortie = new Map<string, string>()): Map<string, string> {
  if (typeof noeud === "string") sortie.set(prefixe, noeud);
  else for (const [cle, valeur] of Object.entries(noeud)) aplatir(valeur, prefixe ? `${prefixe}.${cle}` : cle, sortie);
  return sortie;
}

const variables = (texte: string) => [...new Set(texte.match(/\{\w+\}/g) ?? [])].sort().join(" ");

function resoudre(cle: string): Noeud | undefined {
  let courant: Noeud | undefined = CATALOGUES.fr;
  for (const partie of cle.split(".")) {
    if (typeof courant !== "object" || courant === null) return undefined;
    courant = (courant as Record<string, Noeud>)[partie];
  }
  return courant;
}

const plats = Object.fromEntries(Object.entries(CATALOGUES).map(([l, c]) => [l, aplatir(c)]));

/**
 * Cles citees dans le code. On suit `t` et toute fonction obtenue par
 * `creerT(…)` ou `useT()` (`tm`, …) ; les appels a une cle litterale, a une
 * alternative de deux litteraux, et a un gabarit dont on verifie le prefixe
 * fixe (`roles.${r}` suppose un objet `roles`).
 */
function clesDuCode() {
  const litterales: { fichier: string; cle: string }[] = [];
  const prefixes: { fichier: string; prefixe: string }[] = [];
  const fichiers = readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join("src", f));
  for (const fichier of fichiers) {
    const code = readFileSync(fichier, "utf8");
    const noms = new Set(["t"]);
    for (const m of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:creerT|useT|creerTDepuis)\(/g)) noms.add(m[1]);
    const appel = `(?<![\\w.$])(?:${[...noms].join("|")})\\(\\s*`;
    const chaine = `(["'])([^"'\\\`\\s{}]+?)`;
    for (const m of code.matchAll(new RegExp(`${appel}${chaine}\\1\\s*[,)]`, "g"))) litterales.push({ fichier, cle: m[2] });
    for (const m of code.matchAll(new RegExp(`${appel}[^"'\`()]*?\\?\\s*${chaine}\\1\\s*:\\s*(["'])([^"'\\s]+?)\\3\\s*[,)]`, "g"))) {
      litterales.push({ fichier, cle: m[2] }, { fichier, cle: m[4] });
    }
    for (const m of code.matchAll(new RegExp(`${appel}\`([^\`$]*)(\\$\\{)?`, "g"))) {
      if (!m[2]) litterales.push({ fichier, cle: m[1] });
      else if (m[1].includes(".")) prefixes.push({ fichier, prefixe: m[1].slice(0, m[1].lastIndexOf(".")) });
    }
  }
  return { litterales, prefixes };
}

describe("catalogues de messages", () => {
  it("les quatre langues ont exactement les memes cles", () => {
    const reference = [...plats.fr.keys()];
    const ecarts = Object.fromEntries(
      Object.entries(plats)
        .filter(([l]) => l !== "fr")
        .map(([l, cles]) => [
          l,
          {
            manquantes: reference.filter((c) => !cles.has(c)),
            enTrop: [...cles.keys()].filter((c) => !plats.fr.has(c)),
          },
        ]),
    );
    const vide = { manquantes: [], enTrop: [] };
    expect(ecarts).toEqual({ en: vide, it: vide, es: vide });
  });

  it("chaque cle garde les memes variables {x} dans toutes les langues", () => {
    const differences: string[] = [];
    for (const [cle, texte] of plats.fr) {
      for (const [langue, cles] of Object.entries(plats)) {
        const traduit = cles.get(cle);
        if (traduit !== undefined && variables(traduit) !== variables(texte)) {
          differences.push(`${langue} ${cle} : [${variables(traduit)}] au lieu de [${variables(texte)}]`);
        }
      }
    }
    expect(differences).toEqual([]);
  });

  it("toute cle citee dans le code existe", () => {
    const { litterales, prefixes } = clesDuCode();
    // Garde-fou : un balayage qui ne trouve rien ne prouverait rien.
    expect(litterales.length).toBeGreaterThan(200);
    const absentes = litterales
      .filter(({ cle }) => typeof resoudre(cle) !== "string")
      .map(({ fichier, cle }) => `${fichier} : ${cle}`);
    const prefixesAbsents = prefixes
      .filter(({ prefixe }) => {
        const noeud = resoudre(prefixe);
        return typeof noeud !== "object" || noeud === null;
      })
      .map(({ fichier, prefixe }) => `${fichier} : ${prefixe}.*`);
    expect([...new Set([...absentes, ...prefixesAbsents])]).toEqual([]);
  });
});

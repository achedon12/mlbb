import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RUBRIQUES_DE_PAGE } from "@/i18n/traductions";

/**
 * Le catalogue client commun n'emporte pas les rubriques de page
 * (`RUBRIQUES_DE_PAGE`) : chaque page ajoute celles de ses composants client
 * via `messagesPage(locale, [...])`. Ce test suit les imports de chaque page
 * jusqu'aux modules executes dans le navigateur, releve les cles qu'ils citent
 * et verifie que la page fournit toutes les rubriques de page necessaires.
 * Sans lui, un oubli ne se verrait qu'a l'ecran, sous forme de cle brute.
 */
const RACINE = resolve(__dirname, "../..");
const SRC = join(RACINE, "src");
const COMMUNES = ["pages.notFound"];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(tsx?|mjs)$/.test(nom) ? [chemin] : [];
  });
}

function resoudreImport(depuis: string, specif: string): string | null {
  const base = specif.startsWith("@/") ? join(SRC, specif.slice(2)) : specif.startsWith(".") ? resolve(dirname(depuis), specif) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const cache = new Map<string, string>();
const lire = (f: string) => cache.get(f) ?? (cache.set(f, readFileSync(f, "utf8")), cache.get(f)!);
const imports = (f: string) =>
  [...lire(f).matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)]
    .map((m) => resoudreImport(f, m[1] ?? m[2]))
    .filter((x): x is string => x !== null);
const estClient = (f: string) => /^\s*["']use client["']/.test(lire(f));

/** Rubriques de page citees par les modules executes dans le navigateur, depuis `entree`. */
function rubriquesNecessaires(entree: string): Map<string, string> {
  const besoins = new Map<string, string>();
  const vus = new Set<string>();
  const pile: [string, boolean][] = [[entree, false]];
  while (pile.length) {
    const [f, cote] = pile.pop()!;
    const client = cote || estClient(f);
    const cleVue = `${f}|${client}`;
    if (vus.has(cleVue)) continue;
    vus.add(cleVue);
    if (client) {
      const s = lire(f);
      const cles = [
        ...s.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g),
        ...s.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\$\{/g),
        ...s.matchAll(/\bt\(\s*[^()]*?\?\s*["']([a-zA-Z0-9_.]+)["']\s*:\s*["']([a-zA-Z0-9_.]+)["']/g),
        ...s.matchAll(/`((?:pages|emblemData)\.[a-zA-Z0-9_.]*)\$\{/g),
      ].flatMap((m) => m.slice(1).filter(Boolean));
      for (const cle of cles) {
        const [tete, sous] = cle.split(".");
        if (!RUBRIQUES_DE_PAGE.includes(tete)) continue;
        const rubrique = tete === "pages" && sous ? `pages.${sous}` : tete;
        if (!COMMUNES.includes(rubrique)) besoins.set(rubrique, relative(RACINE, f));
      }
    }
    for (const suivant of imports(f)) pile.push([suivant, client]);
  }
  return besoins;
}

/** Rubriques ajoutees par une page : litteraux passes a `messagesPage(…, [...])`. */
const fournies = (f: string) =>
  [...lire(f).matchAll(/messagesPage\([^,]+,\s*\[([^\]]*)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]),
  );

const pages = fichiers(join(SRC, "app")).filter((f) => /\/(page|layout|not-found|error|global-error)\.tsx$/.test(f));

describe("catalogue client par page", () => {
  it("la mise en page ne rend aucun composant client qui cite une rubrique de page", () => {
    const layout = join(SRC, "app/[locale]/layout.tsx");
    expect([...rubriquesNecessaires(layout)]).toEqual([]);
  });

  it("chaque page fournit les rubriques de page de ses composants client", () => {
    const manques = pages.flatMap((page) => {
      const donnees = fournies(page);
      return [...rubriquesNecessaires(page)]
        .filter(([rubrique]) => !donnees.some((d) => rubrique === d || rubrique.startsWith(`${d}.`)))
        .map(([rubrique, source]) => `${relative(RACINE, page)} : ${rubrique} (cite par ${source})`);
    });
    expect(manques).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fr from "@/i18n/messages/fr.json";
import en from "@/i18n/messages/en.json";
import itCatalog from "@/i18n/messages/it.json";
import es from "@/i18n/messages/es.json";

/**
 * Message catalog consistency.
 *
 * The four locales carry the same keys and the same variables, and every key
 * referenced in the code exists: a missing key would be shown as is
 * ("pages.heroes.title") to the reader, a missing variable would stay between
 * braces.
 */
type Node = string | Node[] | { [key: string]: Node };
const CATALOGUES: Record<string, Node> = { fr, en, it: itCatalog, es } as unknown as Record<string, Node>;

function flatten(node: Node, prefix = "", output = new Map<string, string>()): Map<string, string> {
  if (typeof node === "string") output.set(prefix, node);
  else for (const [key, value] of Object.entries(node)) flatten(value, prefix ? `${prefix}.${key}` : key, output);
  return output;
}

/**
 * Variables specific to one language's grammar, mapped back to the one they
 * replace: in French, the page computes the elision ("d'Aamon", "de Gusion")
 * and passes it as {deNom}, where the other locales write {nom}.
 */
const EQUIVALENT: Record<string, string> = { "{deNom}": "{nom}" };
const variables = (text: string) =>
  [...new Set((text.match(/\{\w+\}/g) ?? []).map((v) => EQUIVALENT[v] ?? v))].sort().join(" ");

function resolve(key: string): Node | undefined {
  let current: Node | undefined = CATALOGUES.fr;
  for (const match of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, Node>)[match];
  }
  return current;
}

const flat = Object.fromEntries(Object.entries(CATALOGUES).map(([l, c]) => [l, flatten(c)]));

/**
 * Keys referenced in the code. It follows `t` and any function obtained from
 * `creerT(…)` or `useT()` (`tm`, …); calls with a literal key, with a choice
 * between two literals, and with a template whose fixed prefix is checked
 * (`roles.${r}` implies a `roles` object).
 */
function keysOfCode() {
  const literal: { file: string; key: string }[] = [];
  const prefixes: { file: string; prefix: string }[] = [];
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join("src", f));
  for (const file of files) {
    const code = readFileSync(file, "utf8");
    const names = new Set(["t"]);
    for (const m of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:creerT|useT|creerTDepuis)\(/g)) names.add(m[1]);
    const call = `(?<![\\w.$])(?:${[...names].join("|")})\\(\\s*`;
    const string = `(["'])([^"'\\\`\\s{}]+?)`;
    for (const m of code.matchAll(new RegExp(`${call}${string}\\1\\s*[,)]`, "g"))) literal.push({ file, key: m[2] });
    for (const m of code.matchAll(new RegExp(`${call}[^"'\`()]*?\\?\\s*${string}\\1\\s*:\\s*(["'])([^"'\\s]+?)\\3\\s*[,)]`, "g"))) {
      literal.push({ file, key: m[2] }, { file, key: m[4] });
    }
    for (const m of code.matchAll(new RegExp(`${call}\`([^\`$]*)(\\$\\{)?`, "g"))) {
      if (!m[2]) literal.push({ file, key: m[1] });
      else if (m[1].includes(".")) prefixes.push({ file, prefix: m[1].slice(0, m[1].lastIndexOf(".")) });
    }
  }
  return { literal, prefixes };
}

describe("message catalogs", () => {
  it("all four locales have exactly the same keys", () => {
    const reference = [...flat.fr.keys()];
    const gaps = Object.fromEntries(
      Object.entries(flat)
        .filter(([l]) => l !== "fr")
        .map(([l, keys]) => [
          l,
          {
            missing: reference.filter((c) => !keys.has(c)),
            extra: [...keys.keys()].filter((c) => !flat.fr.has(c)),
          },
        ]),
    );
    const empty = { missing: [], extra: [] };
    expect(gaps).toEqual({ en: empty, it: empty, es: empty });
  });

  it("each key keeps the same {x} variables in every locale", () => {
    const differences: string[] = [];
    for (const [key, text] of flat.fr) {
      for (const [locale, keys] of Object.entries(flat)) {
        const translated = keys.get(key);
        if (translated !== undefined && variables(translated) !== variables(text)) {
          differences.push(`${locale} ${key}: [${variables(translated)}] instead of [${variables(text)}]`);
        }
      }
    }
    expect(differences).toEqual([]);
  });

  it("every key referenced in the code exists", () => {
    const { literal, prefixes } = keysOfCode();
    // Safeguard: a scan that finds nothing would prove nothing.
    expect(literal.length).toBeGreaterThan(200);
    const missing = literal
      .filter(({ key }) => typeof resolve(key) !== "string")
      .map(({ file, key }) => `${file}: ${key}`);
    const prefixesMissing = prefixes
      .filter(({ prefix }) => {
        const node = resolve(prefix);
        return typeof node !== "object" || node === null;
      })
      .map(({ file, prefix }) => `${file}: ${prefix}.*`);
    expect([...new Set([...missing, ...prefixesMissing])]).toEqual([]);
  });
});

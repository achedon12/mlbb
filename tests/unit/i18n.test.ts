import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
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
 * and passes it as {ofName}, where the other locales write {name}.
 */
const EQUIVALENT: Record<string, string> = { "{ofName}": "{name}" };
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
 * Keys referenced in one source file. It follows `t`, any function obtained
 * from `createT(…)`, `createTFrom(…)` or `useT()` (`tm`, …), any parameter or
 * prop typed as a translator (`sr: T`, `sr: ReturnType<typeof createT>`) and
 * direct calls such as `createT(locale)("key")`; calls with a literal key,
 * with a choice between two literals, and with a template whose fixed prefix
 * is checked (`roles.${r}` implies a `roles` object).
 */
function keysOfSource(code: string) {
  const literal: string[] = [];
  const prefixes: string[] = [];
  const suffixes: { prefix: string; suffix: string }[] = [];
  const names = new Set(["t"]);
  for (const m of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:createT|createTFrom|useT)\(/g)) names.add(m[1]);
  if (/import[^;]*\bT\b[^;]*from\s*["']@\/i18n\//.test(code) || /\btypeof createT\b/.test(code)) {
    for (const m of code.matchAll(/(\w+)\??\s*:\s*(?:T|ReturnType<typeof createT>)(?![\w<.])/g)) names.add(m[1]);
  }
  const call = `(?:(?<![\\w.$])(?:${[...names].join("|")})|(?<![\\w.$])createT\\([^()]*\\))\\(\\s*`;
  const string = `(["'])([^"'\\\`\\s{}]+?)`;
  for (const m of code.matchAll(new RegExp(`${call}${string}\\1\\s*[,)]`, "g"))) literal.push(m[2]);
  for (const m of code.matchAll(new RegExp(`${call}[^"'\`()]*?\\?\\s*${string}\\1\\s*:\\s*(["'])([^"'\\s]+?)\\3\\s*[,)]`, "g"))) {
    literal.push(m[2], m[4]);
  }
  for (const m of code.matchAll(new RegExp(`${call}\`([^\`$]*)(\\$\\{)?`, "g"))) {
    if (!m[2]) literal.push(m[1]);
    else if (m[1].includes(".")) prefixes.push(m[1].slice(0, m[1].lastIndexOf(".")));
  }
  // `emblemData.${key}.name`: a fixed tail after the variable part must exist
  // under at least one child of the prefix. Such keys are often built into a
  // variable before the call, so every template starting with a catalog
  // section is checked, not only the translator's argument.
  for (const m of code.matchAll(/`([A-Za-z]\w*(?:\.[\w-]+)*)\.\$\{[^}`]*\}((?:\.[\w-]+)+)`/g)) {
    if (!Object.hasOwn(CATALOGUES.fr as object, m[1].split(".")[0])) continue;
    suffixes.push({ prefix: m[1], suffix: m[2].slice(1) });
  }
  return { literal, prefixes, suffixes };
}

/** Keys referenced across `src/`. */
function keysOfCode() {
  const literal: { file: string; key: string }[] = [];
  const prefixes: { file: string; prefix: string }[] = [];
  const suffixes: { file: string; prefix: string; suffix: string }[] = [];
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join("src", f));
  for (const file of files) {
    const found = keysOfSource(readFileSync(file, "utf8"));
    for (const key of found.literal) literal.push({ file, key });
    for (const prefix of found.prefixes) prefixes.push({ file, prefix });
    for (const x of found.suffixes) suffixes.push({ file, ...x });
  }
  return { literal, prefixes, suffixes };
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

  it("the key scan follows every kind of translator", () => {
    const code = [
      'import type { T } from "@/i18n/translations";',
      'const t = createT(locale); t("fixture.plain");',
      'const tm = createT(locale); tm("fixture.createT");',
      'const tf = createTFrom(messages); tf("fixture.createTFrom");',
      'const tu = useT(); tu(open ? "fixture.yes" : "fixture.no");',
      'function Impact({ sr }: { sr: ReturnType<typeof createT> }) { return sr(`fixture.prefix.${x}`); }',
      'function label(tr: T) { return tr("fixture.typed"); }',
      "const n = t(`emblemData.${key}.name`);",
      "const key = `emblemData.${slug}.bestFor`;",
      'createT(locale)("fixture.direct");',
      'other("fixture.ignored"); obj.t("fixture.method");',
    ].join("\n");
    const { literal, prefixes } = keysOfSource(code);
    expect(literal.sort()).toEqual(
      [
        "fixture.createT",
        "fixture.createTFrom",
        "fixture.direct",
        "fixture.no",
        "fixture.plain",
        "fixture.typed",
        "fixture.yes",
      ].sort(),
    );
    expect(prefixes).toEqual(["fixture.prefix", "emblemData"]);
    expect(keysOfSource(code).suffixes).toEqual([
      { prefix: "emblemData", suffix: "name" },
      { prefix: "emblemData", suffix: "bestFor" },
    ]);
  });

  it("every key referenced in the code exists", () => {
    const { literal, prefixes, suffixes } = keysOfCode();
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
    const suffixesMissing = suffixes
      .filter(({ prefix, suffix }) => {
        const node = resolve(prefix);
        if (typeof node !== "object" || node === null) return true;
        return !Object.keys(node).some((child) => typeof resolve(`${prefix}.${child}.${suffix}`) === "string");
      })
      .map(({ file, prefix, suffix }) => `${file}: ${prefix}.*.${suffix}`);
    expect([...new Set([...missing, ...prefixesMissing, ...suffixesMissing])]).toEqual([]);
  });

  it("variables passed with a literal key are the key's placeholders", () => {
    // Every {x} of any locale: the French elision variant ({ofName}) must be passed too.
    const placeholders = (key: string) => {
      const out = new Set<string>();
      for (const catalog of Object.values(flat)) {
        for (const m of (catalog.get(key) ?? "").matchAll(/\{(\w+)\}/g)) out.add(m[1]);
      }
      return out;
    };
    const problems: string[] = [];
    let checked = 0;
    const files = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f))
      .map((f) => join("src", f));
    for (const file of files) {
      const code = readFileSync(file, "utf8");
      const names = new Set(["t"]);
      for (const m of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:createT|createTFrom|useT)\(/g)) names.add(m[1]);
      for (const m of code.matchAll(/(\w+)\??\s*:\s*(?:T|ReturnType<typeof createT>)(?![\w<.])/g)) names.add(m[1]);
      const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const keysOf = (node: ts.Expression): string[] | null => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
        if (ts.isParenthesizedExpression(node)) return keysOf(node.expression);
        if (ts.isConditionalExpression(node)) {
          const [a, b] = [keysOf(node.whenTrue), keysOf(node.whenFalse)];
          return a && b ? [...a, ...b] : null;
        }
        return null;
      };
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && node.arguments.length >= 2 && ts.isIdentifier(node.expression) && names.has(node.expression.text)) {
          const keys = keysOf(node.arguments[0]);
          const values = node.arguments[1];
          if (keys && ts.isObjectLiteralExpression(values) && !values.properties.some(ts.isSpreadAssignment)) {
            const given = values.properties.map((p) => p.name?.getText(source).replace(/^["']|["']$/g, "") ?? "");
            const expected = new Set(keys.flatMap((k) => [...placeholders(k)]));
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
            checked += 1;
            for (const g of given) if (!expected.has(g)) problems.push(`${file}:${line} ${keys.join("|")}: {${g}} passed but not in the text`);
            for (const e of expected) {
              if (!given.includes(e)) {
                problems.push(`${file}:${line} ${keys.join("|")}: {${e}} in the text but not passed`);
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    // Safeguard: a scan that finds nothing would prove nothing.
    expect(checked).toBeGreaterThan(300);
    expect(problems).toEqual([]);
  });
});

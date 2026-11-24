import { describe, expect, it } from "vitest";
import {
  DECORATIONS,
  INPUT_MAX,
  PRESETS,
  STYLES,
  decorate,
  measure,
  parseShared,
  pickRandom,
  sanitize,
  sharedQuery,
  stylize,
} from "@/lib/nicknames";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** Characters a copied nickname must never contain: invisible, private, unassigned, lone surrogates. */
const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Cn}]/u;

describe("stylize", () => {
  it("maps letters and digits into the mathematical block", () => {
    expect(stylize("Abc 12", "bold")).toBe("𝐀𝐛𝐜 𝟏𝟐");
    expect(stylize("Layla", "doubleStruck")).toBe("𝕃𝕒𝕪𝕝𝕒");
    expect(stylize("Gusion", "monospace")).toBe("𝙶𝚞𝚜𝚒𝚘𝚗");
  });

  it("fills the holes of the mathematical block with the pre-existing letters", () => {
    // U+1D455 (italic h) is reserved: the right letter is U+210E.
    expect(stylize("h", "italic")).toBe("ℎ");
    expect(stylize("BEFHILMRego", "script")).toBe("ℬℰℱℋℐℒℳℛℯℊℴ");
    expect(stylize("CHIRZ", "fraktur")).toBe("ℭℌℑℜℨ");
    expect(stylize("CHNPQRZ", "doubleStruck")).toBe("ℂℍℕℙℚℝℤ");
  });

  it("only produces assigned, visible characters, in every style", () => {
    for (const style of STYLES) {
      expect(FORBIDDEN.test(stylize(ALPHABET, style)), style).toBe(false);
    }
  });

  it("changes the look in every style", () => {
    for (const style of STYLES) expect(stylize("Abc", style), style).not.toBe("Abc");
  });

  it("keeps one distinct character per letter in the two-case styles", () => {
    const singleCase = ["smallCaps", "superscript", "negativeCircled", "squared", "strikethrough", "underline"];
    for (const style of STYLES.filter((s) => !singleCase.includes(s))) {
      expect(new Set(Array.from(stylize(ALPHABET.slice(0, 52), style))).size, style).toBe(52);
    }
  });

  it("keeps anything that is not an ASCII letter or digit", () => {
    for (const style of STYLES.filter((s) => s !== "strikethrough" && s !== "underline")) {
      expect(stylize("é-ß_!★Ж", style), style).toBe("é-ß_!★Ж");
    }
  });

  it("handles single-case styles and styles without digits", () => {
    expect(stylize("ab", "squared")).toBe("🄰🄱");
    expect(stylize("Ab", "negativeCircled")).toBe("🅐🅑");
    expect(stylize("a0", "circled")).toBe("ⓐ⓪");
    expect(stylize("x9", "italic")).toBe("𝑥9");
    expect(stylize("Aq1", "superscript")).toBe("ᵃq¹");
    expect(stylize("Xq", "smallCaps")).toBe("xǫ");
    expect(stylize("Z9", "fullWidth")).toBe("Ｚ９");
  });

  it("puts no combining line on spaces", () => {
    expect(stylize("a b", "strikethrough")).toBe("a\u0336 b\u0336");
    expect(stylize("é", "underline")).toBe("é\u0332");
  });
});

describe("sanitize", () => {
  it("removes controls, invisible format characters and fake blanks", () => {
    expect(sanitize("a\u200bb\u200dc\u202ede")).toBe("abcde");
    // Hangul filler and blank Braille pattern: the "invisible nickname" tricks.
    expect(sanitize("\u3164\u2800Nana\u3164")).toBe("Nana");
    expect(sanitize("\ue000x\ufe0f")).toBe("x");
  });

  it("collapses spaces and trims the ends", () => {
    expect(sanitize("  Miya \t\n  Moon  ")).toBe("Miya Moon");
  });

  it("composes accents and drops a leading orphan accent", () => {
    expect(sanitize("e\u0301")).toBe("é");
    expect(sanitize("\u0301abc")).toBe("abc");
  });

  it("caps the length in code points without cutting a character", () => {
    const output = sanitize("𝐀".repeat(INPUT_MAX + 5));
    expect(Array.from(output)).toHaveLength(INPUT_MAX);
    expect(FORBIDDEN.test(output)).toBe(false);
  });
});

describe("decorations", () => {
  it("only use visible symbols, with no combining mark or default emoji", () => {
    for (const d of DECORATIONS) {
      const text = d.before + d.after;
      expect(FORBIDDEN.test(text), d.key).toBe(false);
      expect(/\p{M}|\p{Emoji_Presentation}|\s/u.test(text), d.key).toBe(false);
    }
  });

  it("have unique keys and start with none", () => {
    expect(new Set(DECORATIONS.map((d) => d.key)).size).toBe(DECORATIONS.length);
    expect(DECORATIONS[0]).toEqual({ key: "none", before: "", after: "" });
  });

  it("wrap the name, and produce nothing for an empty name", () => {
    const javanese = DECORATIONS.find((d) => d.key === "javanese")!;
    expect(decorate("Fanny", javanese)).toBe("꧁Fanny꧂");
    expect(decorate("", javanese)).toBe("");
  });
});

describe("measure", () => {
  it("returns code points and UTF-16 units", () => {
    expect(measure("Ab")).toEqual({ codePoints: 2, utf16Units: 2 });
    expect(measure(stylize("Ab", "bold"))).toEqual({ codePoints: 2, utf16Units: 4 });
    expect(measure(stylize("Ab", "strikethrough"))).toEqual({ codePoints: 4, utf16Units: 4 });
  });
});

describe("pickRandom", () => {
  it("covers the whole range and never picks none", () => {
    expect(pickRandom(() => 0)).toEqual({ style: STYLES[0], decoration: DECORATIONS[1] });
    const last = pickRandom(() => 0.999999999);
    expect(last.style).toBe(STYLES.at(-1));
    expect(last.decoration).toBe(DECORATIONS.at(-1));
  });
});

describe("presets", () => {
  it("pair a known style with a real decoration, each under its own key", () => {
    expect(new Set(PRESETS.map((p) => p.key)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(STYLES).toContain(p.style);
      expect(p.decoration.key).not.toBe("none");
      expect(DECORATIONS).toContain(p.decoration);
    }
  });
});

describe("shared links", () => {
  const stars = DECORATIONS.find((d) => d.key === "stars")!;

  it("round-trip the name, the style and the decoration", () => {
    const query = sharedQuery("Ombre Noire", "fraktur", stars);
    expect(query.startsWith("?")).toBe(true);
    expect(parseShared(query)).toEqual({ name: "Ombre Noire", style: "fraktur", decoration: stars });
  });

  it("leave out the decoration when there is none", () => {
    const query = sharedQuery("Leo", "bold", DECORATIONS[0]);
    expect(query).not.toContain("d=");
    expect(parseShared(query)).toEqual({ name: "Leo", style: "bold", decoration: null });
  });

  it("trust nothing: unknown style and decoration dropped, name sanitized", () => {
    expect(parseShared("?n=%E2%80%8BLeo%E2%80%8B&s=comic&d=skull")).toEqual({ name: "Leo", style: null, decoration: null });
    expect(parseShared("?s=bold")).toBeNull();
    expect(parseShared("?n=%E2%80%8B")).toBeNull();
    expect(parseShared("")).toBeNull();
  });
});

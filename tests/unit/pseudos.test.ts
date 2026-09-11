import { describe, expect, it } from "vitest";
import {
  DECORATIONS,
  SAISIE_MAX,
  STYLES,
  compter,
  decorer,
  nettoyer,
  styliser,
  tirerAuHasard,
} from "@/lib/pseudos";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** Caracteres qu'un pseudo copie ne doit jamais contenir : invisibles, prives, non attribues, surrogats seuls. */
const INTERDITS = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Cn}]/u;

describe("styliser", () => {
  it("convertit lettres et chiffres dans le bloc mathematique", () => {
    expect(styliser("Abc 12", "gras")).toBe("𝐀𝐛𝐜 𝟏𝟐");
    expect(styliser("Layla", "doubleBarre")).toBe("𝕃𝕒𝕪𝕝𝕒");
    expect(styliser("Gusion", "monospace")).toBe("𝙶𝚞𝚜𝚒𝚘𝚗");
  });

  it("comble les trous du bloc mathematique par les lettres deja existantes", () => {
    // U+1D455 (h italique) est reserve : la bonne lettre est U+210E.
    expect(styliser("h", "italique")).toBe("ℎ");
    expect(styliser("BEFHILMRego", "script")).toBe("ℬℰℱℋℐℒℳℛℯℊℴ");
    expect(styliser("CHIRZ", "fraktur")).toBe("ℭℌℑℜℨ");
    expect(styliser("CHNPQRZ", "doubleBarre")).toBe("ℂℍℕℙℚℝℤ");
  });

  it("ne produit que des caracteres attribues et visibles, dans tous les styles", () => {
    for (const style of STYLES) {
      const sortie = styliser(ALPHABET, style);
      expect(INTERDITS.test(sortie), style).toBe(false);
    }
  });

  it("change l'apparence dans chaque style", () => {
    for (const style of STYLES) expect(styliser("Abc", style), style).not.toBe("Abc");
  });

  it("garde un caractere distinct par lettre dans les styles a deux casses", () => {
    for (const style of STYLES.filter((s) => !["petitesCapitales", "exposant", "cercleNoir", "carre", "barre", "souligne"].includes(s))) {
      expect(new Set(Array.from(styliser(ALPHABET.slice(0, 52), style))).size, style).toBe(52);
    }
  });

  it("laisse tel quel ce qui n'est ni lettre ASCII ni chiffre", () => {
    for (const style of STYLES.filter((s) => s !== "barre" && s !== "souligne")) {
      expect(styliser("é-ß_!★Ж", style), style).toBe("é-ß_!★Ж");
    }
  });

  it("gere les styles a une seule casse et sans chiffres", () => {
    expect(styliser("ab", "carre")).toBe("🄰🄱");
    expect(styliser("Ab", "cercleNoir")).toBe("🅐🅑");
    expect(styliser("a0", "cercle")).toBe("ⓐ⓪");
    expect(styliser("x9", "italique")).toBe("𝑥9");
    expect(styliser("Aq1", "exposant")).toBe("ᵃq¹");
    expect(styliser("Xq", "petitesCapitales")).toBe("xǫ");
    expect(styliser("Z9", "pleineChasse")).toBe("Ｚ９");
  });

  it("ne pose pas de trait combinant sur les espaces", () => {
    expect(styliser("a b", "barre")).toBe("a\u0336 b\u0336");
    expect(styliser("é", "souligne")).toBe("é\u0332");
  });
});

describe("nettoyer", () => {
  it("retire controles, formats invisibles et faux blancs", () => {
    expect(nettoyer("a\u200bb\u200dc\u202ede")).toBe("abcde");
    // Remplissage hangeul et braille vide : les pseudos « invisibles ».
    expect(nettoyer("\u3164\u2800Nana\u3164")).toBe("Nana");
    expect(nettoyer("\ue000x\ufe0f")).toBe("x");
  });

  it("fusionne les espaces et coupe les bords", () => {
    expect(nettoyer("  Miya \t\n  Moon  ")).toBe("Miya Moon");
  });

  it("recompose les accents et retire un accent orphelin en tete", () => {
    expect(nettoyer("e\u0301")).toBe("é");
    expect(nettoyer("\u0301abc")).toBe("abc");
  });

  it("borne la longueur en points de code, sans couper un caractere", () => {
    const long = "𝐀".repeat(SAISIE_MAX + 5);
    const sortie = nettoyer(long);
    expect(Array.from(sortie)).toHaveLength(SAISIE_MAX);
    expect(INTERDITS.test(sortie)).toBe(false);
  });
});

describe("decorations", () => {
  it("n'emploient que des symboles visibles, sans combinant ni emoji d'office", () => {
    for (const d of DECORATIONS) {
      const texte = d.avant + d.apres;
      expect(INTERDITS.test(texte), d.cle).toBe(false);
      expect(/\p{M}|\p{Emoji_Presentation}|\s/u.test(texte), d.cle).toBe(false);
    }
  });

  it("ont des cles uniques et commencent par « aucune »", () => {
    expect(new Set(DECORATIONS.map((d) => d.cle)).size).toBe(DECORATIONS.length);
    expect(DECORATIONS[0]).toEqual({ cle: "aucune", avant: "", apres: "" });
  });

  it("entourent le nom, et rien quand le nom est vide", () => {
    const javanais = DECORATIONS.find((d) => d.cle === "javanais")!;
    expect(decorer("Fanny", javanais)).toBe("꧁Fanny꧂");
    expect(decorer("", javanais)).toBe("");
  });
});

describe("compter", () => {
  it("donne points de code et unites UTF-16", () => {
    expect(compter("Ab")).toEqual({ pointsDeCode: 2, unitesUtf16: 2 });
    expect(compter(styliser("Ab", "gras"))).toEqual({ pointsDeCode: 2, unitesUtf16: 4 });
    expect(compter(styliser("Ab", "barre"))).toEqual({ pointsDeCode: 4, unitesUtf16: 4 });
  });
});

describe("tirerAuHasard", () => {
  it("couvre tout l'eventail sans jamais tirer « aucune »", () => {
    expect(tirerAuHasard(() => 0)).toEqual({ style: STYLES[0], decoration: DECORATIONS[1] });
    const fin = tirerAuHasard(() => 0.999999999);
    expect(fin.style).toBe(STYLES.at(-1));
    expect(fin.decoration).toBe(DECORATIONS.at(-1));
  });
});

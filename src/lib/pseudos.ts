/**
 * Generateur de pseudos stylises.
 *
 * Aucune police n'est installee chez le joueur : les « styles » sont d'autres
 * caracteres Unicode qui ressemblent aux lettres latines (symboles
 * mathematiques alphanumeriques, lettres cerclees, pleine chasse…). Seules les
 * lettres ASCII et les chiffres sont convertis ; tout le reste (accents,
 * espaces, symboles, autres ecritures) passe tel quel, pour ne jamais
 * denaturer ce que le joueur a tape.
 *
 * Module pur, sans dependance au navigateur : il est teste tel quel.
 */

/** Styles proposes, dans l'ordre d'affichage. */
export const STYLES = [
  "gras",
  "italique",
  "grasItalique",
  "script",
  "scriptGras",
  "fraktur",
  "frakturGras",
  "doubleBarre",
  "monospace",
  "sans",
  "sansGras",
  "sansItalique",
  "sansGrasItalique",
  "petitesCapitales",
  "cercle",
  "cercleNoir",
  "carre",
  "pleineChasse",
  "exposant",
  "barre",
  "souligne",
] as const;

export type Style = (typeof STYLES)[number];

/**
 * Plage continue de caracteres : premier code des majuscules, des minuscules
 * et des chiffres. `exceptions` couvre les trous du bloc mathematique : une
 * dizaine de lettres existaient deja ailleurs (ℎ, ℬ, ℭ, ℂ…) et leur place
 * dans le bloc est reservee, donc vide — les y chercher donnerait un carre.
 */
interface Plage {
  maj: number;
  /** Absent : les minuscules prennent les majuscules (lettres cerclees noires, carrees). */
  min?: number;
  chiffres?: number;
  exceptions?: Partial<Record<string, number>>;
}

const PLAGES: Partial<Record<Style, Plage>> = {
  gras: { maj: 0x1d400, min: 0x1d41a, chiffres: 0x1d7ce },
  italique: { maj: 0x1d434, min: 0x1d44e, exceptions: { h: 0x210e } },
  grasItalique: { maj: 0x1d468, min: 0x1d482 },
  script: {
    maj: 0x1d49c,
    min: 0x1d4b6,
    exceptions: {
      B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b,
      e: 0x212f, g: 0x210a, o: 0x2134,
    },
  },
  scriptGras: { maj: 0x1d4d0, min: 0x1d4ea },
  fraktur: { maj: 0x1d504, min: 0x1d51e, exceptions: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 } },
  frakturGras: { maj: 0x1d56c, min: 0x1d586 },
  doubleBarre: {
    maj: 0x1d538,
    min: 0x1d552,
    chiffres: 0x1d7d8,
    exceptions: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
  monospace: { maj: 0x1d670, min: 0x1d68a, chiffres: 0x1d7f6 },
  sans: { maj: 0x1d5a0, min: 0x1d5ba, chiffres: 0x1d7e2 },
  sansGras: { maj: 0x1d5d4, min: 0x1d5ee, chiffres: 0x1d7ec },
  sansItalique: { maj: 0x1d608, min: 0x1d622 },
  sansGrasItalique: { maj: 0x1d63c, min: 0x1d656 },
  cercle: { maj: 0x24b6, min: 0x24d0 },
  // Les lettres cerclees noires et carrees n'existent qu'en majuscules.
  cercleNoir: { maj: 0x1f150 },
  carre: { maj: 0x1f130 },
  pleineChasse: { maj: 0xff21, min: 0xff41, chiffres: 0xff10 },
};

/** Chiffres cercles : zero est a part, un a neuf se suivent. */
const CHIFFRES_CERCLES = "⓪①②③④⑤⑥⑦⑧⑨";

/**
 * Petites capitales. Il n'en existe pas pour « x » (on garde la lettre, deja
 * basse) ; pour « q », la petite capitale ꞯ est trop recente pour la plupart
 * des polices, d'ou « ǫ », qui s'en rapproche et s'affiche partout.
 */
const PETITES_CAPITALES = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";

/** Lettres en exposant ; « q » n'en a pas et reste tel quel. */
const EXPOSANTS = "ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ";
const CHIFFRES_EXPOSANTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Diacritiques combinants, poses apres chaque caractere visible. */
const COMBINANTS: Partial<Record<Style, string>> = {
  barre: "\u0336",
  souligne: "\u0332",
};

const A = 0x41;
const A_MIN = 0x61;
const ZERO = 0x30;

/** Rang d'une lettre ASCII (0 a 25) et sa casse, ou `null` pour tout autre caractere. */
function lettre(c: string): { rang: number; maj: boolean } | null {
  const code = c.codePointAt(0)!;
  if (code >= A && code < A + 26) return { rang: code - A, maj: true };
  if (code >= A_MIN && code < A_MIN + 26) return { rang: code - A_MIN, maj: false };
  return null;
}

function chiffre(c: string): number | null {
  const code = c.codePointAt(0)!;
  return code >= ZERO && code < ZERO + 10 ? code - ZERO : null;
}

/** Tableau de caracteres par point de code : `split("")` couperait les caracteres hors BMP. */
const car = (s: string) => Array.from(s);
const TABLE_PETITES = car(PETITES_CAPITALES);
const TABLE_EXPOSANTS = car(EXPOSANTS);
const TABLE_CHIFFRES_EXPOSANTS = car(CHIFFRES_EXPOSANTS);
const TABLE_CHIFFRES_CERCLES = car(CHIFFRES_CERCLES);

function convertir(c: string, style: Style): string {
  const l = lettre(c);
  const d = chiffre(c);
  if (style === "petitesCapitales") return l ? TABLE_PETITES[l.rang] : c;
  if (style === "exposant") {
    if (l) return TABLE_EXPOSANTS[l.rang];
    return d === null ? c : TABLE_CHIFFRES_EXPOSANTS[d];
  }
  const plage = PLAGES[style];
  if (!plage) return c;
  if (l) {
    const exception = plage.exceptions?.[c];
    if (exception !== undefined) return String.fromCodePoint(exception);
    const debut = l.maj || plage.min === undefined ? plage.maj : plage.min;
    return String.fromCodePoint(debut + l.rang);
  }
  if (d !== null) {
    if (style === "cercle") return TABLE_CHIFFRES_CERCLES[d];
    if (plage.chiffres !== undefined) return String.fromCodePoint(plage.chiffres + d);
  }
  return c;
}

/** Ecrit `texte` dans un style ; les caracteres sans equivalent restent tels quels. */
export function styliser(texte: string, style: Style): string {
  const combinant = COMBINANTS[style];
  if (combinant) {
    // Un trait sous une espace ne se voit pas et le jeu pourrait la compter : on la laisse nue.
    return car(texte)
      .map((c) => (/\s/u.test(c) ? c : c + combinant))
      .join("");
  }
  return car(texte)
    .map((c) => convertir(c, style))
    .join("");
}

/**
 * Decorations autour du pseudo. Aucune ne porte de caractere combinant ni
 * d'emoji (le jeu refuserait ou remplacerait ce dernier) ; toutes sont des
 * symboles visibles, sans espace, pour ne pas gaspiller de longueur.
 */
export interface Decoration {
  cle: string;
  avant: string;
  apres: string;
}

export const DECORATIONS: readonly Decoration[] = [
  { cle: "aucune", avant: "", apres: "" },
  { cle: "javanais", avant: "꧁", apres: "꧂" },
  { cle: "crochetsBlancs", avant: "『", apres: "』" },
  { cle: "crochetsNoirs", avant: "【", apres: "】" },
  { cle: "crochetsCreux", avant: "〖", apres: "〗" },
  { cle: "etoiles", avant: "★", apres: "★" },
  { cle: "vagues", avant: "彡★", apres: "★彡" },
  { cle: "couronne", avant: "♛", apres: "♛" },
  { cle: "sceau", avant: "亗", apres: "亗" },
  { cle: "croix", avant: "乂", apres: "乂" },
  { cle: "khanda", avant: "☬", apres: "☬" },
  { cle: "scintille", avant: "✦", apres: "✦" },
  { cle: "fleches", avant: "⫷", apres: "⫸" },
  { cle: "fusil", avant: "︻デ═一", apres: "" },
];

export function decorer(nom: string, decoration: Decoration): string {
  return nom === "" ? "" : `${decoration.avant}${nom}${decoration.apres}`;
}

/** Longueur maximale de la saisie, en points de code : au-dela, plus aucun jeu ne l'accepterait. */
export const SAISIE_MAX = 32;

/**
 * Caracteres retires de la saisie : controles, formats invisibles (espaces
 * sans chasse, marques de direction, jointures), zones privees, codes non
 * attribues, et les « faux blancs » qui servent aux pseudos invisibles
 * (remplissage hangeul, braille vide…). Un pseudo copie depuis la page ne
 * doit rien contenir que le joueur ne voie pas.
 */
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Cn}\p{Zl}\p{Zp}\u115f\u1160\u3164\uffa0\u2800\u180e\ufe00-\ufe0f]/gu;

/** Nettoie la saisie : invisibles retires, espaces fusionnes, longueur bornee. */
export function nettoyer(saisie: string): string {
  const propre = saisie
    .normalize("NFC")
    .replace(INVISIBLES, "")
    .replace(/\s+/gu, " ")
    .trim()
    // Un accent combinant en tete ne s'accroche a rien : il s'afficherait sur un cercle pointille.
    .replace(/^\p{M}+/u, "");
  return car(propre).slice(0, SAISIE_MAX).join("").trimEnd();
}

/**
 * Deux longueurs, faute de savoir laquelle le jeu retient : en points de code
 * (un « 𝐀 » vaut 1) et en unites UTF-16 (le meme « 𝐀 » vaut 2), la mesure
 * native de nombreux moteurs de jeu.
 */
export function compter(texte: string): { pointsDeCode: number; unitesUtf16: number } {
  return { pointsDeCode: car(texte).length, unitesUtf16: texte.length };
}

/**
 * Longueur relevee par un guide tiers (1v9, janvier 2025), faute de source
 * officielle : ni le wiki ni Moonton ne la publient. Elle n'est qu'un repere,
 * jamais une limite imposee a la saisie.
 */
export const LONGUEUR_GUIDE = {
  min: 3,
  max: 16,
  source: "https://1v9.gg/blog/mobile-legends-mlbb-how-to-change-your-name",
} as const;

/** Page du wiki qui liste la carte de renommage parmi les articles de la boutique. */
export const SOURCE_BOUTIQUE = "https://mobilelegends.fandom.com/wiki/Shop";

/** Style et decoration tires au sort ; `hasard` rend un nombre dans [0, 1), comme `Math.random`. */
export function tirerAuHasard(hasard: () => number = Math.random): { style: Style; decoration: Decoration } {
  const indice = (n: number) => Math.min(n - 1, Math.floor(hasard() * n));
  // « aucune » est exclue : un tirage au sort sans decoration decevrait.
  const decorees = DECORATIONS.slice(1);
  return { style: STYLES[indice(STYLES.length)], decoration: decorees[indice(decorees.length)] };
}

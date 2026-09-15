/**
 * Game vocabulary per target language, applied to machine translations.
 *
 * Indonesian players, like the game's Indonesian client, keep most MOBA terms
 * in English: "hero", "skin", "build", "counter", "win rate", "Gold Lane".
 * The translation service renders them literally ("pahlawan", "kulit",
 * "penghitung", "tingkat kemenangan"), which no player searches for. This
 * table puts the players' words back.
 *
 * It is applied when a script writes its output, not to the cache: the cache
 * keeps what the service returned (and any hand correction), so changing a
 * term here only needs a rerun, never a new translation. Hero stories are
 * left out: in a narrative, "pahlawan" or "pembunuh" are ordinary words.
 *
 * Each rule: a pattern (whole words, case-insensitive, an attached `-nya`
 * suffix allowed) and its replacement. A lowercase replacement takes a capital
 * when the translated word had one. `scope: "messages"` limits a rule to the
 * interface catalogue, where the ambiguous word can only mean the game term.
 */
const RULES = {
  id: [
    // Rates first, before their parts are replaced one by one.
    ["tingkat kemenangan", "win rate"],
    ["tingkat larangan", "ban rate"],
    ["tingkat pelarangan", "ban rate"],
    ["tingkat pengambilan", "pick rate"],
    ["tingkat pemilihan", "pick rate"],
    ["tingkat pilih", "pick rate"],
    ["daftar tingkatan", "tier list"],
    ["daftar tingkat", "tier list"],
    ["catatan tempel", "patch notes"],
    ["catatan tambalan", "patch notes"],
    ["server tingkat lanjut", "Advanced Server"],
    ["server MLBB tingkat lanjut", "Advanced Server MLBB"],
    ["penggemar ungu", "buff ungu"],
    ["penggemar oranye", "buff oranye"],
    ["penggemar emas", "buff emas"],
    ["diskon harian", "reset harian"],
    ["diskon mingguan", "reset mingguan"],
    ["diskon berikutnya", "reset berikutnya"],
    ["waktu diskon", "waktu reset"],
    ["pembangunan komunitas", "build komunitas"],
    ["mantra tempur", "Battle Spell"],
    ["mantra pertempuran", "Battle Spell"],
    ["jalur emas", "Gold Lane"],
    ["jalur pengalaman", "EXP Lane"],
    ["jalur exp", "EXP Lane"],
    ["jalur tengah", "Mid Lane"],
    ["penembak jitu", "marksman"],
    ["isi ulang", "cooldown"],
    ["pengisian ulang", "cooldown"],
    ["pahlawan", "hero"],
    ["kulit", "skin"],
    ["lambang", "emblem"],
    ["keterampilan", "skill"],
    ["mantra", "spell"],
    ["penghitung", "counter"],
    ["tambalan", "patch"],
    ["pelayan", "server"],
    ["jalur", "lane"],
    ["kerusakan", "damage"],
    ["tangki", "tank"],
    ["penyihir", "mage"],
    ["penembak", "marksman"],
    ["petarung", "fighter"],
    ["pejuang", "fighter"],
    ["pembunuh", "assassin"],
    ["draf", "draft"],
    ["antek", "minion"],
    ["penyu", "Turtle"],
    ["larangan", "ban", { scope: "messages" }],
    ["pelarangan", "ban", { scope: "messages" }],
    ["bangunan", "build", { scope: "messages" }],
    ["pembuatan", "build", { scope: "messages" }],
    ["objek", "item", { scope: "messages" }],
    ["barang", "item", { scope: "messages" }],
    ["benda", "item", { scope: "messages" }],
    ["olahraga", "esports", { scope: "messages" }],
    // Objectives and tools named after the game: no other sense on the site.
    ["tuhan", "Lord", { scope: "messages" }],
    ["hukuman", "Retribution", { scope: "messages" }],
    ["menggambar", "draw", { scope: "messages" }],
    ["PV", "HP", { caseSensitive: true }],
  ],
};

const compiled = new Map();

function rulesFor(locale, scope) {
  const key = `${locale}|${scope}`;
  if (!compiled.has(key)) {
    const list = (RULES[locale] ?? [])
      .filter(([, , o]) => !o?.scope || o.scope === scope)
      .map(([pattern, replacement, o]) => ({
        re: new RegExp(`(?<![\\p{L}\\p{N}])(${pattern.replace(/ /g, "\\s+")})(nya)?(?![\\p{L}\\p{N}])`, o?.caseSensitive ? "gu" : "giu"),
        replacement,
      }));
    compiled.set(key, list);
  }
  return compiled.get(key);
}

/**
 * Applies a language's game vocabulary to a translated text. `scope` is
 * "messages" for the interface catalogue, "data" for game data and articles.
 * Languages without rules come back unchanged.
 */
export function applyGlossary(text, locale, scope = "data") {
  if (typeof text !== "string" || !RULES[locale]) return text;
  let output = text;
  for (const { re, replacement } of rulesFor(locale, scope)) {
    output = output.replace(re, (match, word, suffix = "") => {
      if (!/^\p{Lu}/u.test(word) || !/^\p{Ll}/u.test(replacement)) return replacement + suffix;
      // "Tingkat Kemenangan" in a title: "Win Rate"; "Tingkat kemenangan": "Win rate".
      const title = word.split(/\s+/).length > 1 && word.split(/\s+/).every((w) => /^\p{Lu}/u.test(w));
      const upper = (w) => w[0].toUpperCase() + w.slice(1);
      return (title ? replacement.split(" ").map(upper).join(" ") : upper(replacement)) + suffix;
    });
  }
  return output;
}

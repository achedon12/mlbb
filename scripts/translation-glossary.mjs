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
 * suffix allowed in Indonesian) and its replacement. A lowercase replacement
 * takes a capital when the translated word had one. `scope: "messages"` limits a rule to the
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

  // Filipino players write Taglish: Tagalog sentences, English game words
  // ("mga hero", "win rate", "build"). The service writes "bayani", "balat",
  // "Panginoon"; docs/glossary/fil.md.
  fil: [
    ["rate ng panalo", "win rate"],
    ["rate ng pagkapanalo", "win rate"],
    ["rate ng pagbabawal", "ban rate"],
    ["rate ng pagpili", "pick rate"],
    ["rate ng tagumpay", "win rate"],
    ["pangunahing pag-atake", "basic attack"],
    ["bilis ng pag-atake", "attack speed"],
    ["bilis ng paggalaw", "movement speed"],
    ["laban ng koponan", "teamfight"],
    ["labanan ng pangkat", "teamfight"],
    ["kasamahan sa koponan", "kakampi"],
    ["listahan ng antas", "tier list"],
    ["listahan ng tier", "tier list"],
    ["mga tala ng patch", "patch notes"],
    ["tala ng patch", "patch notes"],
    ["Advanced na server", "Advance Server"],
    ["Advance server", "Advance Server"],
    ["combat spells", "Battle Spells"],
    ["combat spell", "Battle Spell"],
    ["gintong lane", "Gold Lane"],
    ["bayani", "hero"],
    ["balat", "skin"],
    ["sagisag", "emblem"],
    ["tagabaril", "marksman"],
    ["salamangkero", "mage"],
    ["mamamatay-tao", "assassin"],
    ["manlalaban", "fighter"],
    ["tangke", "tank"],
    ["kasanayan", "skill"],
    ["pinsala", "damage"],
    ["gubat", "jungle"],
    ["Panginoon", "Lord"],
    ["Pagong", "Turtle"],
    ["Parusa", "Retribution", { caseSensitive: true }],
    ["diskwento", "reset", { scope: "messages" }],
    ["mga bagay", "mga item", { scope: "messages" }],
    ["pagbabawal", "ban", { scope: "messages" }],
  ],

  // Thai players read the game's Thai words where the client has them (ป่า,
  // เต่า, ลอร์ด) and English or transliterated ones for the rest (Tier List,
  // Win Rate, บิลด์, สกิน). No word boundary in Thai: long, unambiguous
  // terms only; docs/glossary/th.md.
  th: [
    ["ตำนานมือถือ", "Mobile Legends"],
    ["อัตราการชนะ", "Win Rate"],
    ["อัตราการแบน", "Ban Rate"],
    ["อัตราการเลือก", "Pick Rate"],
    ["อัตราการคัดเลือก", "Pick Rate"],
    ["อัตราชัยชนะ", "Win Rate"],
    ["อัตราแบน", "Ban Rate"],
    ["คนป่า", "สายป่า"],
    ["วัตถุประสงค์", "ออบเจกทีฟ"],
    ["ความไม่ลงรอยกัน", "Discord"],
    ["อมตะในตำนาน", "Mythical Immortal"],
    ["ความรุ่งโรจน์ในตำนาน", "Mythical Glory"],
    ["เกียรติยศในตำนาน", "Mythical Honor"],
    ["เลนที่มีประสบการณ์", "EXP Lane"],
    ["เลนประสบการณ์", "EXP Lane"],
    ["เลนทอง", "Gold Lane"],
    ["เลนกลาง", "Mid Lane"],
    ["คาถาการต่อสู้", "Battle Spell"],
    ["การต่อสู้แบบทีม", "ทีมไฟต์"],
    ["การโจมตีขั้นพื้นฐาน", "การโจมตีปกติ"],
    ["การซิงโครไนซ์", "ซิงก์"],
    ["ไอเท็ม", "ไอเทม"],
    ["ชูตเตอร์", "Marksman"],
    ["เครื่องบินรบ", "Fighter"],
    ["โครงสร้างที่เล่นมากที่สุด", "บิลด์ที่ใช้มากที่สุด"],
    ["รายการระดับ", "Tier List"],
    ["หมายเหตุแพทช์", "แพตช์โน้ต"],
    ["บันทึกแพตช์", "แพตช์โน้ต"],
    ["บันทึกแพทช์", "แพตช์โน้ต"],
    ["เซิร์ฟเวอร์ขั้นสูง", "Advance Server"],
    ["เซิร์ฟเวอร์ Advance", "Advance Server"],
    ["คาถาต่อสู้", "Battle Spell"],
    ["ตราสัญลักษณ์", "Emblem"],
    ["ผิวหนัง", "สกิน"],
    ["ตัวนับ", "เคาน์เตอร์"],
    ["นักยิงปืน", "Marksman"],
    ["มือปืน", "Marksman"],
    ["นักเวทย์", "Mage"],
    ["นักฆ่า", "Assassin"],
    ["นักสู้", "Fighter"],
    ["รถถัง", "Tank"],
    ["ฝ่ายสนับสนุน", "Support"],
    ["ทักษะ", "สกิล"],
    ["แพทช์", "แพตช์"],
    ["การสร้าง", "บิลด์", { scope: "messages" }],
    ["แบบร่าง", "ดราฟต์", { scope: "messages" }],
    ["ส่วนลด", "รีเซ็ต", { scope: "messages" }],
  ],

  // Brazilian players mix Portuguese and English: "herói", "atirador",
  // "tanque", but "build", "counter", "tier list", "skin", "jungle". The
  // service writes "construção", "contador", "pele", even "Lendas Móveis";
  // docs/glossary/pt.md.
  pt: [
    ["Lendas Móveis", "Mobile Legends"],
    ["lista de níveis", "tier list"],
    ["listas de níveis", "tier lists"],
    ["notas de patch", "patch notes"],
    ["notas de atualização", "patch notes"],
    ["servidor avançado", "Advance Server"],
    ["servidor Advance", "Advance Server"],
    ["feitiços de combate", "Feitiços de Batalha"],
    ["feitiço de combate", "Feitiço de Batalha"],
    ["escolhas e proibições", "picks e bans"],
    ["taxa de vitórias", "taxa de vitória"],
    ["taxa de proibição", "taxa de ban"],
    ["taxa de banimento", "taxa de ban"],
    ["taxa de escolha", "taxa de pick"],
    ["taxa de seleção", "taxa de pick"],
    ["lista geral de níveis", "tier list"],
    ["lista completa de níveis", "tier list"],
    ["faixa do meio", "Mid Lane"],
    ["faixa intermediária", "Mid Lane"],
    ["lane do ouro", "Gold Lane"],
    ["lane de experiência", "EXP Lane"],
    ["banimentos", "bans"],
    ["banimento", "ban"],
    ["porta-aviões", "carry"],
    ["lacaios", "minions"],
    ["lacaio", "minion"],
    ["Luz Estelar", "StarLight"],
    ["Luz das estrelas", "StarLight"],
    ["discórdia", "Discord"],
    ["esportes eletrônicos", "esports"],
    ["tempo de espera", "recarga"],
    ["caçadores", "junglers"],
    ["caçador", "jungler"],
    ["pistas", "lanes"],
    ["pista", "lane"],
    ["PV", "HP", { caseSensitive: true }],
    ["objetos", "itens", { scope: "messages" }],
    ["rascunho", "draft", { scope: "messages" }],
    ["contramedidas", "counters", { scope: "messages" }],
    ["peles", "skins"],
    ["pele", "skin"],
    ["selva", "jungle"],
    ["Senhor", "Lorde", { caseSensitive: true }],
    ["Retribuição", "Retribution", { caseSensitive: true }],
    ["Lampejo", "Flicker", { caseSensitive: true }],
    ["construções", "builds", { scope: "messages" }],
    ["construção", "build", { scope: "messages" }],
    ["compilações", "builds", { scope: "messages" }],
    ["compilação", "build", { scope: "messages" }],
    ["contra-ataques", "counters", { scope: "messages" }],
    ["contadores", "counters", { scope: "messages" }],
    ["contador", "counter", { scope: "messages" }],
    ["proibições", "bans", { scope: "messages" }],
    ["proibição", "ban", { scope: "messages" }],
    ["proibir", "banir", { scope: "messages" }],
    ["descontos", "resets", { scope: "messages" }],
    ["desconto", "reset", { scope: "messages" }],
    ["lustres", "buffs", { scope: "messages" }],
    ["lustre", "buff", { scope: "messages" }],
  ],

  // Russian players use the community's words: "контрпик", "тир-лист",
  // "лес", "скин", "патч-ноуты". Russian declines its nouns, so each form
  // the service returns is listed; docs/glossary/ru.md.
  ru: [
    ["Мобильные легенды: Bang Bang", "Mobile Legends: Bang Bang"],
    ["мобильных легенд: Bang Bang", "Mobile Legends: Bang Bang"],
    ["мобильных легенд", "Mobile Legends"],
    ["Мобильные легенды", "Mobile Legends"],
    ["список уровней", "тир-лист"],
    ["списка уровней", "тир-листа"],
    ["списке уровней", "тир-листе"],
    ["списком уровней", "тир-листом"],
    ["списки уровней", "тир-листы"],
    ["уровневый список", "тир-лист"],
    ["уровневого списка", "тир-листа"],
    ["уровневом списке", "тир-листе"],
    ["примечания к патчу", "патч-ноуты"],
    ["примечаний к патчу", "патч-ноутов"],
    ["примечаниях к патчу", "патч-ноутах"],
    ["коэффициент победы", "процент побед"],
    ["коэффициенты побед", "проценты побед"],
    ["коэффициент выигрыша", "процент побед"],
    ["коэффициента выигрыша", "процента побед"],
    ["показатель побед", "процент побед"],
    ["показатели побед", "проценты побед"],
    ["процент выигрышей", "процент побед"],
    ["кража жизни", "вампиризм"],
    ["кражи жизни", "вампиризма"],
    ["кражу жизни", "вампиризм"],
    ["руководство по", "гайд по"],
    ["руководства по", "гайды по"],
    ["путеводитель", "гайд"],
    ["джанглеры", "лесники"],
    ["джанглера", "лесника"],
    ["джанглер", "лесник"],
    ["золотая линия", "Gold Lane"],
    ["золотой линии", "Gold Lane"],
    ["золотую линию", "Gold Lane"],
    ["золотая полоса", "Gold Lane"],
    ["золотой полосе", "Gold Lane"],
    ["линия опыта", "EXP Lane"],
    ["линии опыта", "EXP Lane"],
    ["линию опыта", "EXP Lane"],
    ["полоса опыта", "EXP Lane"],
    ["полосе опыта", "EXP Lane"],
    ["средняя линия", "Mid Lane"],
    ["средней линии", "Mid Lane"],
    ["среднюю линию", "Mid Lane"],
    ["средняя полоса", "Mid Lane"],
    ["Голд Лейн", "Gold Lane"],
    ["Адванс сервер", "Advance Server"],
    ["полоса движения", "линия"],
    ["полосы движения", "линии"],
    ["полосе движения", "линии"],
    ["полосу движения", "линию"],
    ["джунглеров", "лесников"],
    ["джунглеры", "лесники"],
    ["джунглера", "лесника"],
    ["джунглер", "лесник"],
    ["Руководство", "Гайд", { caseSensitive: true }],
    ["расширенный сервер", "Advance Server"],
    ["расширенного сервера", "Advance Server"],
    ["продвинутый сервер", "Advance Server"],
    ["продвинутого сервера", "Advance Server"],
    ["сервер Advance", "Advance Server"],
    ["сервере Advance", "Advance Server"],
    ["сервера Advance", "Advance Server"],
    ["Лейн Голд", "Gold Lane"],
    ["счетчиками", "контрпиками"],
    ["счетчиках", "контрпиках"],
    ["счетчикам", "контрпикам"],
    ["счетчиков", "контрпиков"],
    ["счетчики", "контрпики"],
    ["счетчика", "контрпика"],
    ["счетчик", "контрпик"],
    ["противодействия", "контрпики"],
    ["в джунглях", "в лесу"],
    ["джунглей", "леса"],
    ["джунгли", "лес"],
    ["истребителей", "бойцов"],
    ["истребители", "бойцы"],
    ["истребителя", "бойца"],
    ["истребитель", "боец"],
    ["шутеры", "стрелки"],
    ["шутер", "стрелок"],
    ["Мерцание", "Flicker", { caseSensitive: true }],
    ["Возмездие", "Retribution", { caseSensitive: true }],
    ["Казнь", "Execute", { caseSensitive: true }],
    ["кожа", "скин", { scope: "messages" }],
    ["кожи", "скина", { scope: "messages" }],
    ["кожу", "скин", { scope: "messages" }],
    ["Господин", "Лорд", { scope: "messages" }],
    ["переулки", "линии", { scope: "messages" }],
    ["переулок", "линия", { scope: "messages" }],
    ["дорожки", "линии", { scope: "messages" }],
    ["дорожка", "линия", { scope: "messages" }],
    ["дорожке", "линии", { scope: "messages" }],
    ["дорожку", "линию", { scope: "messages" }],
    ["дорожек", "линий", { scope: "messages" }],
  ],
};

/**
 * A suffix the language attaches to the word itself, kept after the
 * replacement: Indonesian "pahlawannya" becomes "heronya".
 */
const SUFFIX = { id: "nya" };

/**
 * Thai writes no space between words: a Thai term has no word boundary to
 * look for, the letters before and after it are the next words. A pattern
 * starting or ending with Thai letters is matched without a boundary on that
 * side, so only longer, unambiguous Thai terms belong in the table.
 */
const THAI = /\p{sc=Thai}/u;

const compiled = new Map();

function rulesFor(locale, scope) {
  const key = `${locale}|${scope}`;
  if (!compiled.has(key)) {
    const suffix = SUFFIX[locale] ? `(${SUFFIX[locale]})?` : "()";
    const list = (RULES[locale] ?? [])
      .filter(([, , o]) => !o?.scope || o.scope === scope)
      .map(([pattern, replacement, o]) => {
        const before = THAI.test(pattern.at(0)) ? "" : "(?<![\\p{L}\\p{N}])";
        const after = THAI.test(pattern.at(-1)) ? "" : "(?![\\p{L}\\p{N}])";
        return {
          re: new RegExp(`${before}(${pattern.replace(/ /g, "\\s+")})${suffix}${after}`, o?.caseSensitive ? "gu" : "giu"),
          replacement,
        };
      });
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
    output = output.replace(re, (match, word, suffix = "", offset, whole) => {
      let out = replacement;
      if (/^\p{Lu}/u.test(word) && /^\p{Ll}/u.test(replacement)) {
        // "Tingkat Kemenangan" in a title: "Win Rate"; "Tingkat kemenangan": "Win rate".
        const title = word.split(/\s+/).length > 1 && word.split(/\s+/).every((w) => /^\p{Lu}/u.test(w));
        const upper = (w) => w[0].toUpperCase() + w.slice(1);
        out = title ? replacement.split(" ").map(upper).join(" ") : upper(replacement);
      }
      out += suffix;
      // Thai sets a Latin word off with spaces: "เครื่องคำนวณ Win Rate", not "เครื่องคำนวณWin Rate".
      if (/^\p{sc=Latin}/u.test(out) && THAI.test(whole[offset - 1] ?? "")) out = ` ${out}`;
      if (/\p{sc=Latin}$/u.test(out) && THAI.test(whole[offset + match.length] ?? "")) out = `${out} `;
      return out;
    });
  }
  return output;
}

// ── Hero names ─────────────────────────────────────────────────────

/**
 * Hero names stay as the game writes them, in Latin letters, in every
 * language. The service transliterates them into Cyrillic or Thai ("Хуфра",
 * "คูฟรา"), or worse, translates them ("Moskov" becomes Moscow, "Sun" the
 * sun): pages would then name a hero differently from its own card.
 *
 * `names` maps each hero name to the service's rendering of the name alone
 * (cached like any text). A rendering that is a dictionary word in that
 * language is left out: replacing it would rename the sun, a lily or a jaw
 * in a hero's story. A name is only restored in a text whose source names
 * that hero, which keeps an unrelated word that happens to share the letters
 * untouched.
 */
const NOT_A_NAME = {
  ru: ["Alpha", "Atlas", "Aurora", "Chang'e", "Chip", "Jawhead", "Joy", "Lylia", "Moskov", "Saber", "Sun", "Uranus", "Yin"],
  th: ["Bane", "Chang'e", "Chip", "Franco", "Jawhead", "Moskov", "Nana", "Phoveus", "Ruby", "Sun", "Uranus", "Yve"],
};

/**
 * Russian declines names ("Хуфра", "Хуфры", "Хуфрой"): each rendering
 * matches with the case endings its last letter allows. Names ending in
 * -о, -и, -у, -э and the like do not decline.
 */
function russianForms(name) {
  const last = name.at(-1);
  const stem = name.slice(0, -1);
  if (last === "а" || last === "я") return [stem, "(?:а|я|ы|и|е|у|ю|ой|ей|ою|ею)"];
  if (last === "й" || last === "ь") return [stem, "(?:й|ь|я|ю|ем|ём|е|и)"];
  if (/[бвгджзклмнпрстфхцчшщ]/.test(last)) return [name, "(?:а|у|ом|е|ы|ов|ам|ами|ах)?"];
  return [name, ""];
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Compiled restorations for one language, from the name map. */
export function nameRules(names, locale) {
  const skip = new Set(NOT_A_NAME[locale] ?? []);
  const rules = [];
  for (const [name, rendering] of names) {
    if (!rendering || rendering === name || skip.has(name) || /^[\p{sc=Latin}\s.'-]+$/u.test(rendering)) continue;
    let pattern;
    if (/\p{sc=Cyrillic}/u.test(rendering) && !rendering.includes(" ")) {
      const [stem, endings] = russianForms(rendering);
      pattern = `(?<![\\p{L}\\p{N}])${escape(stem)}${endings}(?![\\p{L}\\p{N}])`;
    } else if (THAI.test(rendering)) {
      // A Thai word may follow with no space, but not a vowel sign of the
      // same word: "เวลา" (time) is not "เวล" (Vale) plus "า".
      pattern = `${escape(rendering)}(?![\\u0e30-\\u0e3a\\u0e45-\\u0e4e])`;
    } else {
      pattern = `(?<![\\p{L}\\p{N}])${escape(rendering)}(?![\\p{L}\\p{N}])`;
    }
    rules.push({ name, re: new RegExp(pattern, "gu") });
  }
  // Longest first: "Ю Чжун" before a shorter name it contains.
  return rules.sort((a, b) => b.re.source.length - a.re.source.length);
}

/** Puts back in `text` the hero names its `source` mentions. */
export function restoreNames(text, source, rules) {
  if (typeof text !== "string" || !rules?.length) return text;
  let output = text;
  for (const { name, re } of rules) {
    if (!String(source ?? "").includes(name)) continue;
    output = output.replace(re, (match, offset, whole) => {
      let out = name;
      if (THAI.test(whole[offset - 1] ?? "")) out = ` ${out}`;
      if (THAI.test(whole[offset + match.length] ?? "")) out = `${out} `;
      return out;
    });
  }
  return output;
}

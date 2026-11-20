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

/**
 * French skins: "apparence", the word of the game's French client, which
 * the official community expects ("Nouvelle peau" got the site turned down).
 * The service writes "peau" (the organ) or the anglicism "skin", which is
 * masculine: its articles and adjectives are rewritten to agree with
 * "apparence", a feminine noun. Not in a link, an anchor or a variable ("/skins",
 * "#new-skins", "{skins}"), nor in an English event name ("Skin Label").
 */
const SKIN = "(?<![/#={\"_-])(?<!MLabel\\s)skin";
const SKIN_END = "(?!\\s+(?:Label|Giveaway|Draw|Pack|Box|Shop)\\b)(?![-_])";
const skin = (plural) => `${SKIN}${plural ? "s" : ""}${SKIN_END}`;
const FR_BEFORE = [
  // Determiner + adjective in front: "le nouveau skin" → "la nouvelle apparence".
  ...[
    ["le", "la"],
    ["un", "une"],
    ["ce", "cette"],
    ["du", "de la"],
    ["au", "à la"],
    ["son", "sa"],
    ["mon", "ma"],
    ["ton", "ta"],
    ["votre", "votre"],
    ["leur", "leur"],
  ].flatMap(([d, f]) =>
    [
      ["tout nouveau", "toute nouvelle"],
      ["nouveau", "nouvelle"],
      ["dernier", "dernière"],
      ["premier", "première"],
      ["prochain", "prochaine"],
      ["seul", "seule"],
      ["meilleur", "meilleure"],
    ].map(([a, b]) => [`${d} ${a} ${skin(false)}`, `${f} ${b} apparence`]),
  ),
  ["tous les nouveaux", "toutes les nouvelles"],
  ["tous les", "toutes les"],
  ["tous leurs", "toutes leurs"],
  ["tous vos", "toutes vos"],
  ["tous ses", "toutes ses"],
  ["tous ces", "toutes ces"],
].map(([a, b]) => (a.includes(SKIN) ? [a, b] : [`${a} ${skin(true)}`, `${b} apparences`]));
const FR_ADJECTIVES = [
  ["tout nouveau", "toute nouvelle", "tout nouveaux", "toutes nouvelles"],
  ["nouveau", "nouvelle", "nouveaux", "nouvelles"],
  ["dernier", "dernière", "derniers", "dernières"],
  ["premier", "première", "premiers", "premières"],
  ["prochain", "prochaine", "prochains", "prochaines"],
  ["seul", "seule", "seuls", "seules"],
  ["meilleur", "meilleure", "meilleurs", "meilleures"],
  ["beau", "belle", "beaux", "belles"],
  ["quel", "quelle", "quels", "quelles"],
  ["aucun", "aucune", null, null],
  ["certain", "certaine", "certains", "certaines"],
];
const FR_AFTER = [
  ["exclusif", "exclusive", "exclusifs", "exclusives"],
  ["spécial", "spéciale", "spéciaux", "spéciales"],
  ["original", "originale", "originaux", "originales"],
  ["saisonnier", "saisonnière", "saisonniers", "saisonnières"],
  ["officiel", "officielle", "officiels", "officielles"],
  ["complet", "complète", "complets", "complètes"],
  ...[
    "limité",
    "gratuit",
    "permanent",
    "offert",
    "sorti",
    "daté",
    "connu",
    "annoncé",
    "prévu",
    "possédé",
    "acheté",
    "obtenu",
    "payant",
    "éclatant",
    "coloré",
    "inédit",
    "lancé",
    "affiché",
    "compté",
    "vendu",
    "débloqué",
    "équipé",
  ].map((a) => (a.endsWith("e") ? [a, a, `${a}s`, `${a}s`] : [a, `${a}e`, `${a}s`, `${a}es`])),
];
const FR_FEMININE = new Map(
  FR_AFTER.flatMap(([m, f, mp, fp]) => [
    [m, f],
    [mp, fp],
  ]),
);
const SKIN_FR = [
  // The client's names: painted ("peint") and shining ("resplendissant") skins.
  [`${skin(true)} (?:peints|colorés)`, "apparences colorées"],
  [`${skin(false)} (?:peint|coloré)`, "apparence colorée"],
  [`${skin(true)} (?:resplendissants|éclatants|brillants)`, "apparences éclatantes"],
  [`${skin(false)} (?:resplendissant|éclatant|brillant)`, "apparence éclatante"],
  ...FR_BEFORE,
  ...FR_ADJECTIVES.flatMap(([m, f, mp, fp]) => [
    [`${m} ${skin(false)}`, `${f} apparence`],
    ...(mp ? [[`${mp} ${skin(true)}`, `${fp} apparences`]] : []),
  ]),
  ["(?:le|la) " + skin(false), "l'apparence"],
  ["du " + skin(false), "de l'apparence"],
  ["au " + skin(false), "à l'apparence"],
  ["un " + skin(false), "une apparence"],
  ["(?:ce|cet) " + skin(false), "cette apparence"],
  ["de " + skin(true), "d'apparences"],
  ["de " + skin(false), "d'apparence"],
  [skin(true), "apparences"],
  [skin(false), "apparence"],
  // "Peau", the organ, feminine like "apparence": only the elisions change.
  ["de la peau", "de l'apparence"],
  ["la peau", "l'apparence"],
  ["de peaux", "d'apparences"],
  ["de peau", "d'apparence"],
  ["sa peau", "son apparence"],
  ["peaux", "apparences"],
  ["peau", "apparence"],
  // An article the rules above left masculine: "le skin peint" became "le
  // apparence colorée".
  ["le apparence", "l'apparence"],
  ["un apparence", "une apparence"],
  ["ce apparence", "cette apparence"],
  ["du apparence", "de l'apparence"],
  ["au apparence", "à l'apparence"],
  ["de apparences", "d'apparences"],
  ["de apparence", "d'apparence"],
  // Adjectives after the noun, made to agree, also past a series name: "une
  // apparence Epic gratuit", "les apparences StarLight obtenus".
  [
    `[Aa]pparences? (?:\\p{Lu}[\\p{L}-]*\\s+){0,3}(?:${[...FR_FEMININE.keys()].join("|")})`,
    (words) => words.replace(/\S+$/u, (a) => FR_FEMININE.get(a) ?? a),
    { caseSensitive: true },
  ],
];

const RULES = {
  // French is the source of the interface, but game data taken from the wiki
  // (skills, items, modes, patches) is translated into it from English. French
  // players keep the game's English names for lanes, spells and items, and
  // the site's own words for roles ("Tireur", "Combattant") and stats ("PV").
  fr: [
    // The game's own name is never translated ("Légendes mobiles : Bang
    // Bang"), and keeps its colon without the French space before it.
    ["Légendes mobiles\\s*: Bang Bang", "Mobile Legends: Bang Bang"],
    ["Légendes mobiles", "Mobile Legends"],
    ["Mobile Legends\\s+: Bang Bang", "Mobile Legends: Bang Bang", { caseSensitive: true }],
    // Skins: "apparence", the French client's word, everywhere on the site.
    // "Peau" (the organ, feminine like "apparence") came back for "skin";
    // "skin" (masculine) is the anglicism, rewritten with its articles and
    // adjectives. The client's own names for the painted and shining skins
    // come first. An English event name ("Skin Label") stays as it is.
    ...SKIN_FR,
    // Stats: patch notes abbreviate damage ("DMG Taken +4%"), which came
    // back as "DÉG", "DMG pris", "DMG Prise".
    ["(?:DMG|DÉG|DEG) (?:pris|prise|subis)", "Dégâts subis"],
    ["(?:DMG|DÉG|DEG) infligés", "Dégâts infligés"],
    ["DMG", "Dégâts", { caseSensitive: true }],
    ["DÉG", "Dégâts", { caseSensitive: true }],
    // Battle spells keep their English names, like on the spell pages.
    ["Rétribution", "Retribution", { caseSensitive: true }],
    // Modes and events keep the game's English names, as the modes pages
    // write them: "Brawl", "Card Brawl", "Magic Chess", "StarLight". The
    // service wrote "Bagarre", "Bagarre de cartes", "Échecs magiques",
    // "Lumière des étoiles", next to "Brawl" in the same notes. A brawl or a
    // starlight in lowercase is an ordinary word.
    ["Bagarre de cartes", "Card Brawl"],
    ["Bagarre (?:des ombres|de l'ombre)", "Shadow Brawl"],
    ["Bagarres", "Brawl", { caseSensitive: true }],
    ["Bagarre", "Brawl", { caseSensitive: true }],
    ["Baston", "Brawl", { caseSensitive: true }],
    ["échecs magiques", "Magic Chess"],
    // Only the capitalised name (the pass, the event): "une pluie de lumière
    // stellaire" (Lunox) is prose and stays prose.
    ["(?:Lumière des étoiles|Lumière stellaire)", "StarLight", { caseSensitive: true }],
    ["mode Chaos", "mode Mayhem", { caseSensitive: true }],
    // The other names of the game keep its English too, the French client's
    // being in no source (`translation-official-names.mjs`): Arcade's
    // sub-modes, the pick modes, Classic and Ranked, the ranks, the Lucky Box
    // and the Spell Vamp stat. A capital marks the name: "classique" and
    // "classé" in lowercase are ordinary words.
    ["Boummandre", "Boommander", { caseSensitive: true }],
    ["Échecs TD", "Chess TD", { caseSensitive: true }],
    ["Bagarre et miroir", "Brawl&Mirror", { caseSensitive: true }],
    ["choix à l'aveugle", "Blind Pick"],
    ["Classique", "Classic", { caseSensitive: true }],
    ["(?<=(?:modes?|Classic et|Classic,)\\s)Classé", "Ranked", { caseSensitive: true }],
    ["Classé(?=\\s+et\\s+Classic)", "Ranked", { caseSensitive: true }],
    ["(?:Honneur|Honor) mythique", "Mythical Honor"],
    ["Gloire mythique", "Mythical Glory"],
    ["Immortel mythique", "Mythical Immortal"],
    ["Grand[- ]?Maître", "Grandmaster"],
    ["(?:Coffre|Boîte) (?:chance|chanceuse|de chance|porte-bonheur)", "Lucky Box"],
    ["(?:vampirisme des sorts|vampirisme magique|sort de vampire|vampire des sorts)", "Spell Vamp"],
    // "Tank" came back as an armoured vehicle, "Roaming" as wandering.
    ["semi-chars", "semi-tanks"],
    ["semi-char", "semi-tank"],
    ["demi-chars", "semi-tanks"],
    ["demi-char", "semi-tank"],
    ["chars itinérants", "tanks roamers"],
    ["char itinérant", "tank roamer"],
    ["chars", "tanks"],
    ["char", "tank"],
    ["héros itinérants", "roamers"],
    ["héros itinérant", "roamer"],
    ["tanks errants", "tanks roamers"],
    ["tank errant", "tank roamer"],
    ["bénédictions itinérantes", "Roaming Blessings"],
    ["bénédiction itinérante", "Roaming Blessing"],
    // "Sa configuration itinérante": his roam build.
    ["itinérantes?", "roam"],
    // "Roam" is masculine and no elision before it: not "l'roam".
    ["l'itinérance", "le roam"],
    ["d'itinérance", "de roam"],
    ["Itinérance", "Roam", { caseSensitive: true }],
    ["itinérance", "roam", { caseSensitive: true }],
    // Lanes, as players and the esports pages say them.
    ["voie médiane", "Mid lane"],
    ["voie de l'EXP", "EXP lane"],
    ["voie (?:d'or|dorée|de l'or)", "Gold lane"],
    ["voie (?:d'expérience|de l'expérience|EXP)", "EXP lane"],
    ["voie (?:du milieu|centrale)", "Mid lane"],
    ["couloir (?:d'or|doré)", "Gold lane"],
    ["couloir (?:d'expérience|EXP)", "EXP lane"],
    ["couloir (?:du milieu|central)", "Mid lane"],
    // Any other lane: "lane", feminine like "voie". Not a path a mode
    // offers ("la voie physique").
    ["voies(?!\\s+(?:physiques?|magiques?)\\b)", "lanes"],
    ["(?<!\\ben\\s)voie(?!\\s+(?:physique|magique)\\b)", "lane"],
    ["la EXP lane", "l'EXP lane"],
    // Effects: "Slow Immunity" came back as a slow immunity.
    ["immunité lente", "immunité aux ralentissements"],
    ["immunité au ralentissement", "immunité aux ralentissements"],
    ["immunité de contrôle", "immunité aux contrôles"],
    // Roles, as the site names them.
    ["tireurs d'élite", "tireurs"],
    ["tireur d'élite", "tireur"],
    ["réservoirs", "tanks"],
    ["réservoir", "tank"],
    // Stats: one abbreviation for hit points, the French one.
    ["HP", "PV", { caseSensitive: true }],
    ["PS", "PV", { caseSensitive: true }],
    ["points de vie max", "PV max"],
    // Lane minions are "sbires" everywhere on the site.
    ["serviteurs", "sbires"],
    ["serviteur", "sbire"],
    ["minions", "sbires"],
    ["minion", "sbire"],
    // Jungle monsters keep the players' word.
    ["fluages", "creeps"],
    ["fluage", "creep"],
    ["sorts de bataille", "sorts de combat"],
    ["sort de bataille", "sort de combat"],
  ],
  id: [
    // The game's own name is never translated.
    ["Legenda Seluler\\s*: Bang Bang", "Mobile Legends: Bang Bang"],
    ["Legenda Seluler", "Mobile Legends"],
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
    ["Mobile Legends: ปังปัง", "Mobile Legends: Bang Bang"],
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

  // Spanish and Italian players say "skin" (feminine, "la skin"), as the
  // site's interface does. The service wrote "piel"/"pelle" (the organ) and
  // "aspecto", which also means an aspect: "aspectos destacados" (the
  // highlights) stays.
  es: [
    ["Leyendas móviles\\s*: Bang Bang", "Mobile Legends: Bang Bang"],
    ["Leyendas móviles", "Mobile Legends"],
    ["pieles", "skins"],
    ["piel", "skin"],
    ["aspectos(?!\\s+(?:más\\s+)?destacad)", "skins"],
    ["aspecto(?!\\s+(?:más\\s+)?destacad)", "skin"],
  ],
  it: [
    ["Leggende mobili\\s*: Bang Bang", "Mobile Legends: Bang Bang"],
    ["Leggende mobili", "Mobile Legends"],
    ["pelli", "skin"],
    ["pelle", "skin"],
  ],

  // Russian players use the community's words: "контрпик", "тир-лист",
  // "лес", "скин", "патч-ноуты". Russian declines its nouns, so each form
  // the service returns is listed; docs/glossary/ru.md.
  ru: [
    ["Мобильные легенды: Bang Bang", "Mobile Legends: Bang Bang"],
    ["мобильных легенд: Bang Bang", "Mobile Legends: Bang Bang"],
    ["мобильных легенд", "Mobile Legends"],
    ["Мобильные легенды", "Mobile Legends"],
    // A skin is "скин", not "облик": only next to the adjectives the patch
    // notes use, since "в человеческом облике" (in human form) is no skin.
    ["сезонный облик", "сезонный скин"],
    ["новый облик", "новый скин"],
    ["эксклюзивный облик", "эксклюзивный скин"],
    ["бесплатный облик", "бесплатный скин"],
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
          // Either apostrophe, outside a character class: the service
          // writes "d'or" or "d’or".
          re: new RegExp(`${before}(${pattern.replace(/ /g, "\\s+").replace(/['’](?![^[]*\])/g, "['’]")})${suffix}${after}`, o?.caseSensitive ? "gu" : "giu"),
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
      // A function rewrites the matched words itself, case included.
      let out = typeof replacement === "function" ? replacement(word) : replacement;
      if (typeof replacement === "string" && /^\p{Lu}/u.test(word) && /^\p{Ll}/u.test(replacement)) {
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

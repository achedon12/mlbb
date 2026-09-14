/**
 * Synchronisation des donnees du jeu.
 *
 * Tout ce que le site affiche sur les heros, les skins, les objets et les
 * patchs est extrait du wiki communautaire, qui range ses donnees dans des
 * modules Scribunto — des tables Lua structurees, bien plus fiables a lire que
 * du HTML rendu.
 *
 *     npm run sync            donnees seules
 *     npm run sync -- --images   donnees + telechargement des visuels
 *
 * Le resultat est ecrit dans `src/data/game/`. Les visuels vont dans
 * `public/visuels/`, versionnes avec le depot : le build de l'image n'a besoin
 * d'aucun acces au wiki.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { analyzeTableLua } from "./lua.mjs";
import { splitSections, cleanRender, newHeroes, toc } from "./patch-notes.mjs";
import {
  cleanDescription,
  withoutTags,
  extractStory,
  sectionsPage,
  cleanLore,
} from "./wikitext.mjs";
import { heroAdjustments, summary } from "./patch-parser.mjs";
import { extractIllustrations, normalizeNameSkin } from "./gallery.mjs";
import {
  rounded,
  chooseGuide,
  heroCombos,
  duosOfRank,
  mergeDuos,
  mergeHistory,
  serializeDuos,
  dailyStreak,
} from "./measures.mjs";

const WIKI = "https://mobilelegends.fandom.com/api.php";
/**
 * Statistiques de partie.
 *
 * Le wiki decrit le jeu mais ne mesure rien. Cette API communautaire expose
 * les taux de victoire, de ban et de selection remontes par le jeu — la seule
 * source verifiable permettant un classement qui ne soit pas une opinion.
 */
const STATS = "https://arena.rone.dev/api";

/** Nombre de patch notes dont on recupere le contenu complet. */
const DETAILED_PATCHES = 12;
const UA = "MLBB-sync/1.0 (https://mlbbdex.com; contact via github.com/achedon12)";
const OUTPUT = "src/data/game";

const WITH_IMAGES = process.argv.includes("--images");

/** Wiki lane names mapped to the site's lane tokens. */
const LANES = {
  "Gold Lane": "Gold",
  "EXP Lane": "Exp",
  "Mid Lane": "Mid",
  Jungle: "Jungle",
  Roaming: "Roam",
};

// ─────────────────────────────────────────────────────────────
// Acces au wiki
// ─────────────────────────────────────────────────────────────

async function api(settings) {
  const url = new URL(WIKI);
  for (const [c, v] of Object.entries({ ...settings, format: "json" })) {
    url.searchParams.set(c, v);
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(45000),
      });
      if (response.ok) return response.json();
      // 429 : on laisse le service respirer avant de reessayer.
      if (response.status === 429) await pause(3000 * attempt);
      else throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 3) throw error;
      await pause(1500 * attempt);
    }
  }
  throw new Error("Wiki injoignable.");
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function moduleLua(title) {
  const data = await api({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
  });

  const page = Object.values(data.query.pages)[0];
  if (!page?.revisions) throw new Error(`Module introuvable : ${title}`);

  return analyzeTableLua(page.revisions[0].slots.main["*"]);
}

// ─────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────

/** Un identifiant d'URL stable, insensible aux accents et a la ponctuation. */
function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // L'apostrophe et le point separent des mots : « Chang'e » donne
    // « chang-e », et « X.Borg » donne « x-borg », plutot que de coller les
    // morceaux en un seul bloc illisible.
    .replace(/['’.]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Le wiki laisse des champs a `<nom>` dans ses gabarits : ce n'est pas une valeur. */
const empty = (v) => !v || String(v).startsWith("<") || String(v).trim() === "";
const clean = (v) => (empty(v) ? null : String(v).trim());
const list = (...v) => v.map(clean).filter(Boolean);

function normalizeHeroes(raw) {
  return Object.entries(raw)
    .filter(([name, h]) => name !== "Mystery Hero" && !empty(h.id) && !empty(h.name))
    .map(([, h]) => ({
      slug: slugify(h.name),
      name: String(h.name),
      id: String(h.id),
      title: clean(h.title),
      roles: list(h.role1, h.role2),
      lanes: list(h.lane1, h.lane2).map((l) => LANES[l] ?? l),
      specialties: list(h.specialty1, h.specialty2),
      release: clean(h.release_date),
      year: clean(h.release_year) ?? extractYear(h.release_date),
      resource: clean(h.resource),
      damageType: clean(h.dmg_type),
      attackType: clean(h.atk_type),
      region: clean(h.region),
      ratings: {
        offense: count(h.ratings?.offense),
        durability: count(h.ratings?.durability),
        abilityEffects: count(h.ratings?.control_effect ?? h.ratings?.ability_effects),
        difficulty: count(h.ratings?.difficulty),
      },
      stats: h.stats && typeof h.stats === "object" ? normalizeStats(h.stats) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function count(v) {
  if (empty(v)) return null;
  const n = Number(String(v).replace(",", "."));
  // `|| null` serait tentant, mais transformerait un zero legitime en absence
  // de valeur : en JavaScript, 0 est faux.
  return Number.isFinite(n) ? n : null;
}

function extractYear(date) {
  const found = String(date ?? "").match(/\b(20\d{2})\b/);
  return found ? found[1] : null;
}

function normalizeStats(stats) {
  const keep = [
    "hp1", "hp15", "hp_regen1", "mana1", "mana15",
    "physical_atk1", "physical_atk15", "physical_def1", "physical_def15",
    "magic_def1", "magic_def15", "movement_spd", "basic_atk_range",
  ];
  const output = {};
  for (const key of keep) if (!empty(stats[key])) output[key] = String(stats[key]);
  return Object.keys(output).length ? output : null;
}

function normalizeSkins(raw) {
  const byHero = {};

  for (const [heroName, entry] of Object.entries(raw)) {
    const skins = Object.values(entry?.skins ?? {})
      .filter((s) => !empty(s.id) && !empty(s.name))
      .map((s) => ({
        id: String(s.id),
        name: String(s.name),
        release: clean(s.release)?.replace(/-XX/g, "") ?? null,
        availability: clean(s.availability),
        rarity: clean(s.tier),
        label: clean(s.tag),
        price: Object.fromEntries(
          Object.entries(s.price ?? {})
            .map(([m, v]) => [m, clean(v)])
            .filter(([, v]) => v),
        ),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (skins.length) byHero[slugify(heroName)] = skins;
  }

  return byHero;
}

function normalizeItems(raw) {
  return Object.entries(raw)
    .filter(([, o]) => !empty(o?.name))
    // Le module du wiki melange aux objets des lignes de gabarit qui n'en sont
    // pas : des effets isoles (« Passive - Favor ») et des drapeaux de
    // mecanique (« Throw Forbidden »). Aucun n'a de prix, de statistiques ni
    // d'effet propre — c'est le critere qui les distingue d'un vrai objet.
    // Un objet de boutique a un prix, ou au minimum des statistiques. Ce qui
    // n'a ni l'un ni l'autre est un enchantement ou une bascule d'interaction
    // entre heros (« Allow Throw », « Passive - Favor ») : le wiki les range
    // dans le meme module, le site ne doit pas les presenter comme des objets.
    .filter(([, o]) => count(o.price) > 0 || !empty(o.bonus))
    .map(([, o]) => ({
      slug: slugify(o.name),
      name: String(o.name),
      summary: clean(o.caption),
      category: clean(o.type) ?? "Autre",
      price: count(o.price),
      bonus: clean(o.bonus),
      unique: clean(o.unique),
      passive: clean(o.passive),
      active: clean(o.active),
      recipe: clean(o.recipe)?.split(",").map((x) => x.trim()).filter(Boolean) ?? [],
      bestFor: clean(o.availability),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// ─────────────────────────────────────────────────────────────
// Visuels
// ─────────────────────────────────────────────────────────────

/**
 * Resout les URL d'images par lots.
 *
 * Le wiki nomme les visuels d'apres l'identifiant du heros ou du skin, la meme
 * convention pour les deux. On interroge par paquets de 50, la limite de l'API
 * pour une requete anonyme.
 */
async function urlsImages(credentials, variant) {
  const found = {};

  for (let i = 0; i < credentials.length; i += 50) {
    const batch = credentials.slice(i, i + 50);
    const titles = batch.map((id) => `File:Hero${id}-${variant}.png`).join("|");

    const data = await api({
      action: "query",
      titles,
      prop: "imageinfo",
      iiprop: "url",
    });

    for (const page of Object.values(data.query?.pages ?? {})) {
      const source = page.imageinfo?.[0]?.url;
      if (!source) continue;
      const id = page.title.match(/Hero(\w+)-/)?.[1];
      // Le suffixe de cache ne sert a rien et rend l'URL instable.
      if (id) found[id] = source.split("/revision/")[0];
    }

    process.stdout.write(`\r    ${variant} ${Math.min(i + 50, credentials.length)}/${credentials.length}`);
    await pause(300);
  }

  process.stdout.write("\n");
  return found;
}

/**
 * Resout des fichiers du wiki designes par leur nom exact.
 *
 * Les visuels de heros suivent une convention numerique ; les objets, les
 * emblemes, les talents et les sorts sont nommes d'apres leur libelle anglais.
 * Cette fonction sert ce second cas.
 */
async function urlsFiles(names, extension = "png") {
  const found = {};

  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const titles = batch.map((n) => `File:${n}.${extension}`).join("|");

    const data = await api({
      action: "query",
      titles,
      prop: "imageinfo",
      iiprop: "url",
    });

    // Le wiki normalise certains titres (espaces, apostrophes) : on suit ses
    // redirections pour retrouver le nom demande.
    const normalized = new Map(
      (data.query?.normalized ?? []).map((n) => [n.to, n.from]),
    );

    for (const page of Object.values(data.query?.pages ?? {})) {
      const source = page.imageinfo?.[0]?.url;
      if (!source) continue;
      const title = normalized.get(page.title) ?? page.title;
      found[title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")] =
        source.split("/revision/")[0];
    }

    await pause(300);
  }

  return found;
}

/**
 * Telecharge un visuel s'il n'est pas deja present.
 *
 * Les illustrations pleine taille du wiki vont jusqu'a 3 Mo piece, pour 745
 * fichiers : telles quelles, elles pesent plus de 200 Mo dans le depot et a
 * chaque clonage. On les ramene a une largeur utile pour le web et on les
 * convertit en WebP, ce qui divise le volume par six sans difference visible
 * a l'ecran. Les portraits et les icones, deja petits, sont copies tels quels.
 */
async function download(url, path, optimize = false, width = 1280) {
  if (existsSync(path)) return "deja";
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) return "echec";

    const data = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(path), { recursive: true });

    if (optimize) {
      const sharp = (await import("sharp")).default;
      await sharp(data)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path);
    } else {
      await writeFile(path, data);
    }

    return "ok";
  } catch {
    return "echec";
  }
}

/**
 * Range les visuels par heros.
 *
 * Le site ne doit dependre d'aucune URL externe : chaque image est copiee
 * localement, sous un chemin lisible plutot que sous l'identifiant numerique
 * du wiki.
 *
 *     public/visuels/heros/khufra/portrait.png
 *     public/visuels/heros/khufra/icone.png
 *     public/visuels/heros/khufra/skins/782-desert-owl.png
 */
function planVisuals(heroes, skins, portraits, icons) {
  const plan = [];
  const paths = {};

  for (const h of heroes) {
    const folder = `visuels/heros/${h.slug}`;
    const entry = { portrait: null, icon: null, skins: {} };

    if (portraits[h.id]) {
      entry.portrait = `/${folder}/portrait.png`;
      plan.push({ url: portraits[h.id], path: `public/${folder}/portrait.png` });
    }
    if (icons[h.id]) {
      entry.icon = `/${folder}/icone.png`;
      plan.push({ url: icons[h.id], path: `public/${folder}/icone.png` });
    }

    for (const skin of skins[h.slug] ?? []) {
      const url = portraits[skin.id];
      if (!url) continue;
      const file = `${skin.id}-${slugify(skin.name)}.png`;
      entry.skins[skin.id] = `/${folder}/skins/${file}`;
      plan.push({ url, path: `public/${folder}/skins/${file}` });
    }

    paths[h.slug] = entry;
  }

  return { plan, paths };
}

/**
 * Range les visuels qui ne dependent pas d'un heros.
 *
 *     public/visuels/objets/blade-of-despair.png
 *     public/visuels/emblemes/tank.png
 *     public/visuels/talents/impure-rage.png
 *     public/visuels/sorts/flicker.png
 */
function planFiles(urls, folder) {
  const plan = [];
  const paths = {};

  for (const [name, url] of Object.entries(urls)) {
    const file = `${slugify(name)}.png`;
    paths[slugify(name)] = `/visuels/${folder}/${file}`;
    plan.push({ url, path: `public/visuels/${folder}/${file}` });
  }

  return { plan, paths };
}

/**
 * Emblemes, talents et sorts de combat.
 *
 * Le wiki n'expose pas de module de donnees pour eux : la liste est declaree
 * ici, et chaque nom a ete verifie comme correspondant a un fichier existant.
 * Un nom qui cesserait d'exister disparait simplement des visuels.
 */
const EMBLEMS = [
  "Tank Emblem", "Fighter Emblem", "Assassin Emblem",
  "Mage Emblem", "Marksman Emblem", "Support Emblem",
];

const TALENTS = [
  "Agility", "Swift", "Vitality", "Fatal", "Firmness", "Thrill", "Inspire",
  "Tenacity", "Seasoned Hunter", "Master Assassin", "Weakness Finder",
  "Impure Rage", "Quantum Charge", "Weapon Master", "Lethal Ignition",
  "Concussive Blast", "Wilderness Blessing", "Focusing Mark", "Brave Smite",
  "Killing Spree", "Festival of Blood", "Bargain Hunter",
  "Pull Yourself Together",
];

const SPELLS = [
  "Flicker", "Execute", "Retribution", "Purify", "Inspire", "Sprint",
  "Petrify", "Arrival", "Vengeance", "Aegis", "Revitalize",
];

// ─────────────────────────────────────────────────────────────
// Competences et illustrations
// ─────────────────────────────────────────────────────────────

/**
 * Extrait les competences et les illustrations depuis la page d'un heros.
 *
 * Deux informations que les modules de donnees ne portent pas :
 *
 * - le gabarit `{{Ability}}` declare le **nom anglais** de chaque competence,
 *   qui est aussi le nom de son icone sur le wiki ;
 * - la galerie « Splash art » liste les illustrations pleine taille de chaque
 *   skin, bien plus grandes que les portraits de la boutique.
 */
/**
 * Extrait les gabarits `{{Ability ...}}` d'une page, accolades comptees.
 *
 * Une regex echouerait : la description imbrique d'autres gabarits (`{{Scale}}`,
 * `{{ai}}`), et le gabarit ferme tantot par « \n}} », tantot par « }} » colle
 * au dernier champ. On compte donc les accolades pour trouver la vraie
 * fermeture, quelle que soit la mise en page.
 */
function templatesAbility(wikitext) {
  const results = [];
  const re = /\{\{Ability\b/gi;
  let m;
  while ((m = re.exec(wikitext)) !== null) {
    const start = m.index;
    let depth = 0;
    let k = start;
    for (; k < wikitext.length; k += 1) {
      if (wikitext[k] === "{" && wikitext[k + 1] === "{") {
        depth += 1;
        k += 1;
      } else if (wikitext[k] === "}" && wikitext[k + 1] === "}") {
        depth -= 1;
        k += 1;
        if (depth === 0) {
          k += 1;
          break;
        }
      }
    }
    results.push({ position: start, body: wikitext.slice(start + 2, k - 2) });
    re.lastIndex = k;
  }
  return results;
}

function extractFromPage(wikitext) {
  // Les competences sont declarees section par section, et chaque section
  // n'en contient qu'une — parfois aucune. On borne donc la recherche entre
  // un titre et le suivant.
  //
  // Prendre simplement les gabarits `{{Ability}}` dans l'ordre du texte
  // donnerait un resultat faux a deux titres : une page mentionne les
  // competences d'autres heros, et une section sans gabarit ferait remonter
  // celui de la section d'apres.
  const events = [
    ...[...wikitext.matchAll(/^=+\s*(.+?)\s*=+\s*$/gm)].map((m) => ({
      position: m.index,
      type: "titre",
      value: m[1].trim().toLowerCase(),
    })),
    ...templatesAbility(wikitext).map(({ position, body }) => {
      // La description court jusqu'au champ suivant du gabarit. Un nom de
      // champ peut contenir un chiffre (`term-1`), d'ou la classe elargie.
      const description = body.match(
        /\|?\s*description\s*=\s*([\s\S]+?)(?=\n\s*\|\s*[a-z0-9-]+\s*=|$)/i,
      )?.[1];

      return {
        position,
        type: "competence",
        value: withoutTags(body.match(/\|?\s*name\s*=\s*(.+)/)?.[1] ?? "").trim() || undefined,
        description: description ? cleanDescription(description) : null,
        // Le nom du fichier d'icone, souvent distinct du nom affiche : la
        // competence « Contract: Transform » a pour image « Contract Transform »
        // (sans les deux-points, absents des noms de fichier). L'espace apres
        // le « = » est borne a la ligne pour ne pas capturer le champ suivant
        // quand la valeur est vide.
        image: body.match(/\|\s*image\s*=[ \t]*(.+)/i)?.[1]?.trim() || null,
      };
    }),
  ].sort((a, b) => a.position - b.position);

  const EXPECTED = ["passive", "skill 1", "skill 2", "ultimate"];
  const bySection = {};

  for (const [i, e] of events.entries()) {
    if (e.type !== "titre" || !EXPECTED.includes(e.value)) continue;

    // On avance jusqu'au titre suivant : ce qui se trouve entre les deux
    // appartient a cette section.
    for (const next of events.slice(i + 1)) {
      if (next.type === "titre") break;
      if (next.value) {
        bySection[e.value] = {
          name: next.value,
          description: next.description,
          image: next.image ?? null,
        };
        break;
      }
    }
  }

  // On conserve les emplacements vides : la position dans la liste porte le
  // sens (passif, competence 1, competence 2, ultime).
  const skills = EXPECTED.map((key) => bySection[key] ?? null);

  // La galerie « Splash art » liste les illustrations pleine taille de chaque
  // skin, bien plus grandes que les portraits de la boutique.
  const illustrations = extractIllustrations(wikitext);

  return { skills, illustrations, story: extractStory(wikitext) };
}

/** Parcourt les pages de heros, par lots, pour en extraire ces deux blocs. */
async function heroPages(heroes) {
  const output = {};

  for (let i = 0; i < heroes.length; i += 10) {
    const batch = heroes.slice(i, i + 10);

    const data = await api({
      action: "query",
      titles: batch.map((h) => h.name).join("|"),
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      redirects: "1",
    });

    const byTitle = new Map(
      Object.values(data.query?.pages ?? {})
        .filter((p) => p.revisions)
        .map((p) => [p.title, p.revisions[0].slots.main["*"]]),
    );
    const redirections = new Map(
      (data.query?.redirects ?? []).map((r) => [r.from, r.to]),
    );

    for (const h of batch) {
      const text = byTitle.get(redirections.get(h.name) ?? h.name);
      if (text) output[h.slug] = extractFromPage(text);
    }

    process.stdout.write(`\r    pages ${Math.min(i + 10, heroes.length)}/${heroes.length}`);
    await pause(350);
  }

  process.stdout.write("\n");
  return output;
}

/**
 * Rangs mesures, dans l'ordre de l'API.
 *
 * `all` agrege toutes les parties ; les autres isolent une tranche du
 * classement, de Epique a Gloire mythique. Taux et matchups changent vraiment
 * d'une tranche a l'autre — le pire adversaire d'Aamon n'est pas le meme en
 * Epique et en Gloire —, d'ou une mesure par rang plutot qu'une seule moyenne.
 */
const MEASURED_RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"];

/** Table identifiant de jeu vers slug, depuis le meme endpoint que le reste. */
async function heroTableById(heroes) {
  // Table identifiant de jeu vers slug, depuis le meme endpoint que le reste.
  const response = await fetch(`${STATS}/heroes?size=200`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Table des heros indisponible : HTTP ${response.status}`);

  const records = (await response.json())?.data?.records ?? [];
  const byId = new Map();
  const known = new Map(heroes.map((h) => [h.slug, h]));
  for (const r of records) {
    const name = r?.data?.hero?.data?.name;
    const id = r?.data?.hero_id;
    if (name && id != null) {
      const slug = slugify(name);
      if (known.has(slug)) byId.set(id, slug);
    }
  }
  return byId;
}

/**
 * JSON d'une adresse de l'API, ou null si elle ne repond pas. Une erreur
 * passagere (surcharge, delai) merite deux nouveaux essais, espaces.
 */
async function jsonFrom(url, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const rep = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (rep.ok) return await rep.json();
      if (rep.status === 404) return null;
    } catch {
      // nouvel essai
    }
    if (attempt < attempts) await pause(1000 * 2 ** attempt);
  }
  return null;
}

/**
 * Ecrit evolution.json : series quotidiennes, une ligne par heros pour garder
 * des diffs lisibles. Un heros que l'API n'a pas servi garde ses mesures
 * precedentes, et l'historique se cumule d'une synchronisation a l'autre.
 */
async function writeEvolution(complementary) {
  const existing = await readJson(`${OUTPUT}/evolution.json`);
  const evolution = {
    trends: { ...(existing.trends ?? {}), ...(complementary?.trends ?? {}) },
    duration: { ...(existing.duration ?? {}), ...(complementary?.duration ?? {}) },
    history: mergeHistory(existing.history ?? {}, complementary?.trends ?? {}),
  };
  const byRow = (byKey) => {
    const rows = Object.entries(byKey).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    return rows.length > 0 ? `{\n${rows.join(",\n")}\n  }` : "{}";
  };
  await writeFile(
    `${OUTPUT}/evolution.json`,
    `{\n${Object.entries(evolution).map(([k, v]) => `  "${k}": ${byRow(v)}`).join(",\n")}\n}\n`,
  );
}

/**
 * `--evolution` : ne rafraichit que coequipiers, tendances et durees de
 * partie, sur les heros deja synchronises. De quoi completer ces mesures
 * quand l'API a flanche pendant une synchronisation complete.
 */
async function evolutionSingle() {
  const heroes = await readJson(`${OUTPUT}/heroes.json`);
  if (!Array.isArray(heroes) || heroes.length === 0) throw new Error("Lancer d'abord une synchronisation complete.");
  // Les heros encore sans mesure d'abord : une relance comble les trous avant
  // que l'API ne sature.
  const existing = await readJson(`${OUTPUT}/evolution.json`);
  const measure = (h) => Number(Boolean(existing.trends?.[h.slug]));
  const order = [...heroes].sort((a, b) => measure(a) - measure(b));
  console.log(`Coequipiers et tendances (academie), ${heroes.filter((h) => !measure(h)).length} heros sans mesure…`);
  const complementary = await teammatesAndTrends(order, await heroTableById(heroes));
  const stats = await readJson(`${OUTPUT}/statistics.json`);
  stats.teammates = { ...(stats.teammates ?? {}), ...complementary.teammates };
  await Promise.all([
    writeFile(`${OUTPUT}/statistics.json`, JSON.stringify(stats, null, 2) + "\n"),
    writeEvolution(complementary),
  ]);
  console.log(`  ${Object.keys(complementary.trends).length} heros mesures`);
}

/**
 * Combos de competences conseilles par le jeu, par heros : l'API les decrit en
 * anglais et designe chaque competence par son identifiant, que la fiche du
 * heros (`skillsArena`, voir competencesArena) traduit en nom. L'icone locale
 * est reprise quand la competence est reconnue, sinon celle du CDN.
 */
async function combosArena(heroes, skillsArena, skillsSite, icons) {
  const output = {};
  let silent = 0;
  for (const [i, h] of heroes.entries()) {
    const response = await jsonFrom(`${STATS}/heroes/${encodeURIComponent(h.name)}/skill-combos`);
    const records = response?.data?.records;
    silent = response ? 0 : silent + 1;
    if (Array.isArray(records)) {
      const combos = heroCombos(records, skillsArena[h.slug] ?? [], skillsSite[h.slug] ?? [], icons[h.slug] ?? {});
      if (combos.length > 0) output[h.slug] = combos;
    }
    process.stdout.write(`\r    combos ${i + 1}/${heroes.length}`);
    // Meme garde-fou que les tendances : une API muette ne reviendra pas d'ici la fin.
    if (silent >= 8) {
      console.warn(`\n    API muette depuis ${silent} heros : arret des combos`);
      break;
    }
    await pause(200);
  }
  process.stdout.write("\n");
  return output;
}

/**
 * Ecrit combos.json, une ligne par heros. Un heros que l'API n'a pas servi
 * garde ses combos precedents.
 */
async function writeCombos(combos) {
  const all = { ...(await readJson(`${OUTPUT}/combos.json`)), ...combos };
  const rows = Object.keys(all)
    .sort()
    .map((slug) => `  ${JSON.stringify(slug)}: ${JSON.stringify(all[slug])}`);
  await writeFile(`${OUTPUT}/combos.json`, `{\n${rows.join(",\n")}\n}\n`);
  return Object.keys(all).length;
}

/**
 * `--combos` : ne relit que les combos, sur les heros, competences et icones
 * deja synchronises. Aucun autre fichier n'est reecrit.
 */
async function combosOnly() {
  const heroes = await readJson(`${OUTPUT}/heroes.json`);
  if (!Array.isArray(heroes) || heroes.length === 0) throw new Error("Lancer d'abord une synchronisation complete.");
  console.log("Fiches des heros (API)…");
  const { skills: skillsArena } = await fetchArenaSkills(heroes);
  const skillsSite = await readJson(`${OUTPUT}/skills.json`);
  const icons = (await readJson(`${OUTPUT}/visuals.json`)).skills ?? {};
  console.log("Combos de competences (API)…");
  const combos = await combosArena(heroes, skillsArena, skillsSite, icons);
  const total = await writeCombos(combos);
  console.log(`  ${Object.keys(combos).length} heros relus, ${total} dans combos.json`);
}

/** Fenetre des duos, en jours : la plus large que l'API accepte, pour des paires rares mais mesurees. */
const DAYS_DUOS = 30;
/** Requetes de duos en vol a la fois : au-dela de six, l'API sature et repond en erreur pour tout le monde. */
const DUOS_IN_FLIGHT = 6;

/**
 * Duos de chaque heros, pour chaque rang : les cinq partenaires qui font le
 * plus monter son taux de victoire, les cinq qui le font le plus baisser, et
 * le taux du duo par tranche de duree de partie (`/heroes/{h}/compatibility`).
 *
 * Les six rangs d'un heros partent ensemble, six requetes en vol au plus ;
 * chacune retente deux fois (jsonDe). Une API muette pour huit heros de suite
 * ne reviendra pas d'ici la fin : on garde l'acquis.
 */
async function duosArena(heroes, byId) {
  const output = {};
  let silent = 0;
  for (const [i, h] of heroes.entries()) {
    const name = encodeURIComponent(h.name);
    const results = [];
    for (let k = 0; k < MEASURED_RANKS.length; k += DUOS_IN_FLIGHT) {
      const batch = MEASURED_RANKS.slice(k, k + DUOS_IN_FLIGHT);
      results.push(
        ...(await Promise.all(
          batch.map((rank) => jsonFrom(`${STATS}/heroes/${name}/compatibility?days=${DAYS_DUOS}&rank=${rank}`)),
        )),
      );
    }
    const byRank = {};
    MEASURED_RANKS.forEach((rank, j) => {
      const duos = duosOfRank(results[j]?.data?.records?.[0]?.data, byId, h.slug);
      if (duos) byRank[rank] = duos;
    });
    if (Object.keys(byRank).length > 0) output[h.slug] = byRank;

    silent = results.some(Boolean) ? 0 : silent + 1;
    if (silent >= 8) {
      console.warn(`\n    API muette depuis ${silent} heros : arret des duos apres ${i + 1 - silent} heros`);
      break;
    }
    process.stdout.write(`\r    duos ${i + 1}/${heroes.length}`);
    await pause(250);
  }
  process.stdout.write("\n");
  return output;
}

/**
 * Ecrit duos.json, un heros par ligne. Un heros ou un rang que l'API n'a pas
 * servi garde sa mesure precedente.
 */
async function writeDuos(duos) {
  const existing = (await readJson(`${OUTPUT}/duos.json`)).heroes ?? {};
  const all = mergeDuos(existing, duos ?? {});
  await writeFile(`${OUTPUT}/duos.json`, serializeDuos(DAYS_DUOS, all));
  return Object.keys(all).length;
}

/**
 * `--duos` : ne relit que les duos, sur les heros deja synchronises. Aucun
 * autre fichier n'est reecrit. Les heros encore sans duo passent d'abord.
 */
async function duosOnly() {
  const heroes = await readJson(`${OUTPUT}/heroes.json`);
  if (!Array.isArray(heroes) || heroes.length === 0) throw new Error("Lancer d'abord une synchronisation complete.");
  const existing = (await readJson(`${OUTPUT}/duos.json`)).heroes ?? {};
  const measure = (h) => Number(Boolean(existing[h.slug]));
  const order = [...heroes].sort((a, b) => measure(a) - measure(b));
  console.log(`Duos (compatibilite, ${DAYS_DUOS} jours), ${heroes.filter((h) => !measure(h)).length} heros sans mesure…`);
  const duos = await duosArena(order, await heroTableById(heroes));
  const total = await writeDuos(duos);
  console.log(`  ${Object.keys(duos).length} heros relus, ${total} dans duos.json`);
}

/**
 * Coequipiers, tendances et taux par duree de partie, pour chaque rang.
 *
 * L'academie publie, pour chaque heros : la variation de son taux de victoire
 * selon son coequipier, ses taux quotidiens (victoire, ban, selection) sur
 * trente jours, et son taux de victoire par tranche de duree de partie — de
 * quoi dire s'il pese en debut ou en fin de partie. La duree se mesure sur sa
 * position principale.
 */
async function teammatesAndTrends(heroes, byId) {
  const teammates = {};
  const trends = {};
  const duration = {};

  async function measuresOfRank(h, rank) {
    const name = encodeURIComponent(h.name);
    const lane = API_LANES[h.lanes[0]];
    const [team, trend, timer] = await Promise.all([
      jsonFrom(`${STATS}/academy/heroes/${name}/teammates?rank=${rank}`),
      jsonFrom(`${STATS}/academy/heroes/${name}/trends?days=30&rank=${rank}`),
      lane ? jsonFrom(`${STATS}/academy/heroes/${name}/win-rate/timeline?rank=${rank}&lane=${lane}`) : null,
    ]);

    const partners = team?.data?.records?.[0]?.data?.sub_hero;
    const best = (Array.isArray(partners) ? partners : [])
      .map((a) => ({ slug: byId.get(a.heroid), gain: a.increase_win_rate }))
      .filter((a) => a.slug && a.slug !== h.slug && typeof a.gain === "number")
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 6)
      .map((a) => ({ slug: a.slug, advantage: Math.round(a.gain * 1000) / 10 }));

    const series = dailyStreak(
      (trend?.data?.records?.[0]?.data?.win_rate ?? [])
        .filter((x) => x?.date && typeof x.win_rate === "number")
        .map((x) => ({
          date: x.date,
          winRate: rounded(x.win_rate * 100, 1),
          banRate: rounded(x.ban_rate * 100, 1),
          pickRate: rounded(x.app_rate * 100, 2),
        })),
    );

    const buckets = (timer?.data?.records?.[0]?.data?.time_win_rate ?? [])
      .filter((x) => typeof x?.win_rate === "number" && typeof x.time_min === "number")
      .sort((a, b) => a.time_min - b.time_min)
      .map((x) => ({ from: x.time_min, to: x.time_max ?? null, winRate: rounded(x.win_rate * 100, 1) }));

    return { best: best.length > 0 ? best : null, series, buckets: buckets.length > 0 ? buckets : null };
  }

  let silent = 0;
  for (const [i, h] of heroes.entries()) {
    // Deux rangs a la fois, trois requetes chacun : au-dela, l'API sature et
    // repond en erreur pour tout le monde.
    const results = [];
    for (let k = 0; k < MEASURED_RANKS.length; k += 2) {
      results.push(...(await Promise.all(MEASURED_RANKS.slice(k, k + 2).map((rank) => measuresOfRank(h, rank)))));
    }
    MEASURED_RANKS.forEach((rank, j) => {
      const { best, series, buckets } = results[j];
      if (best) (teammates[h.slug] ??= {})[rank] = best;
      if (series) (trends[h.slug] ??= {})[rank] = series;
      if (buckets) (duration[h.slug] ??= {})[rank] = buckets;
    });
    // Une API muette pour huit heros de suite ne reviendra pas d'ici la fin :
    // on garde l'acquis plutot que d'attendre chaque delai d'expiration.
    silent = results.some((r) => r.best || r.series || r.buckets) ? 0 : silent + 1;
    if (silent >= 8) {
      console.warn(`\n    API muette depuis ${silent} heros : arret apres ${i + 1 - silent} heros mesures`);
      break;
    }
    process.stdout.write(`\r    coequipiers et tendances ${i + 1}/${heroes.length}`);
    await pause(300);
  }
  process.stdout.write("\n");
  return { teammates, trends, duration };
}

/**
 * Contres reels, avec taux de victoire, pour chaque rang.
 *
 * L'academie expose, pour chaque heros, le taux de victoire de tous ses
 * adversaires et surtout la variation de ce taux quand ils l'affrontent :
 * `increase_win_rate`. Negatif, l'adversaire perd du terrain — le heros le
 * contre ; positif, l'adversaire prend l'avantage. On en tire les contres
 * chiffres, dans les deux sens, la ou l'analyse ecrite ne couvre qu'une
 * poignee de heros.
 */
async function actualCounters(heroes) {
  const byId = await heroTableById(heroes);

  /** Contres d'un heros dans un rang, ou null si l'API n'a rien pour lui. */
  async function countersOfRank(h, rank) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/counters?rank=${rank}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
      );
      if (!rep.ok) return null;

      const block = (await rep.json())?.data?.records?.[0]?.data;
      const opponents = Array.isArray(block?.sub_hero) ? block.sub_hero : [];
      if (opponents.length === 0) return null;

      // On ne retient que les adversaires connus, avec leur variation.
      const notes = opponents
        .map((a) => ({
          slug: byId.get(a.heroid),
          delta: typeof a.increase_win_rate === "number" ? a.increase_win_rate : 0,
        }))
        .filter((a) => a.slug && a.slug !== h.slug);

      // `increase_win_rate` est la variation du taux de victoire du heros dans
      // ce duel : positive, il gagne davantage → il contre l'adversaire ;
      // negative, il est en difficulte. On trie du plus favorable au moins.
      const byDelta = [...notes].sort((a, b) => b.delta - a.delta);
      const point = (a) => ({ slug: a.slug, advantage: Math.round(a.delta * 1000) / 10 });

      return {
        // avantage positif : le heros est fort contre cette cible.
        strong: byDelta.slice(0, 6).map(point),
        // avantage negatif : le heros est en difficulte.
        weak: byDelta.slice(-6).reverse().map(point),
        winRate: block.main_hero_win_rate
          ? Math.round(block.main_hero_win_rate * 1000) / 10
          : null,
      };
    } catch {
      /* un rang en echec n'interrompt pas la synchronisation */
      return null;
    }
  }

  const output = {};

  for (const [i, h] of heroes.entries()) {
    // Les six rangs d'un meme heros partent ensemble : l'API met pres de trois
    // secondes a repondre, en serie la synchronisation durerait une demi-heure.
    const results = await Promise.all(MEASURED_RANKS.map((rank) => countersOfRank(h, rank)));
    const byRank = {};
    MEASURED_RANKS.forEach((rank, j) => {
      if (results[j]) byRank[rank] = results[j];
    });
    if (Object.keys(byRank).length > 0) output[h.slug] = byRank;

    process.stdout.write(`\r    contres ${i + 1}/${heroes.length}`);
    await pause(150);
  }

  process.stdout.write("\n");
  return output;
}

/** Positions du site vers le parametre `lane` de l'API. */
const API_LANES = { Gold: "gold", Exp: "exp", Mid: "mid", Jungle: "jungle", Roam: "roam" };

/**
 * Builds reellement joues, par position et par rang.
 *
 * L'academie publie, pour chaque heros, position et rang, les builds du moment
 * avec leurs taux de selection et de victoire : trois objets cles, l'embleme,
 * ses trois talents et le sort. On garde les trois plus joues. Objets, talents
 * et sorts arrivent en identifiants : trois tables de l'API les traduisent en
 * noms, ceux-la memes qui relient chaque choix a son visuel.
 *
 * Ces builds ne portent que les objets cles. L'equipement complet n'existe que
 * dans les guides publies par les joueurs sur l'academie : pour chaque
 * position et chaque rang, on retient le guide a six objets le mieux note d'un
 * auteur de ce rang, ou a defaut d'un rang superieur. C'est un avis, pas une
 * mesure — la fiche le presente comme tel.
 */
async function buildsActual(heroes) {
  const table = async (path) => {
    const rep = await fetch(`${STATS}/academy/${path}?size=200`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!rep.ok) throw new Error(`Table ${path} indisponible : HTTP ${rep.status}`);
    return ((await rep.json())?.data?.records ?? []).map((r) => r?.data).filter(Boolean);
  };
  const [talents, sorts, equipmentList] = await Promise.all([
    table("emblems"),
    table("spells"),
    table("equipment"),
  ]);

  const talentById = new Map(talents.map((t) => [t.giftid, t.emblemskill]));
  const spellById = new Map(sorts.map((s) => [s.battleskillid, s.__data]));
  const itemById = new Map(equipmentList.map((e) => [e.equipid, e.equipname]));
  // Remplis au fil des builds classes : aucune table de l'API ne les donne.
  const emblemById = new Map();
  const laneByRoute = new Map();

  // Icones officielles, pour les talents et sorts recents que le wiki n'a pas.
  const icons = { talents: {}, sorts: {} };
  for (const t of talentById.values()) {
    if (t?.skillname && t.skillicon) icons.talents[t.skillname] = t.skillicon;
  }
  for (const s of spellById.values()) {
    if (s?.skillname && s.skillicon) icons.sorts[s.skillname] = s.skillicon;
  }

  async function buildsOfRank(h, l, lane, rank) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/builds?rank=${rank}&lane=${lane}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
      );
      if (!rep.ok) return null;

      const data = (await rep.json())?.data?.records?.[0]?.data;
      if (data?.real_road != null) laneByRoute.set(String(data.real_road), l);
      const list = data?.build;
      if (!Array.isArray(list) || list.length === 0) return null;
      for (const b of list) {
        const e = b.emblem?.data;
        if (e?.emblemid && e.emblemname) emblemById.set(e.emblemid, e.emblemname);
      }

      return [...list]
        .sort((a, b) => (b.build_pick_rate ?? 0) - (a.build_pick_rate ?? 0))
        .slice(0, 3)
        .map((b) => ({
          items: (b.equipid ?? []).map((id) => itemById.get(id)).filter(Boolean),
          emblem: b.emblem?.data?.emblemname ?? null,
          talents: (b.new_rune_skill ?? [])
            .map((id) => talentById.get(id)?.skillname)
            .filter(Boolean),
          spell: spellById.get(b.skillid)?.skillname ?? b.battleskill?.data?.__data?.skillname ?? null,
          winRate: round(b.build_win_rate),
          pickRate: round(b.build_pick_rate),
        }));
    } catch {
      /* un rang en echec n'interrompt pas la synchronisation */
      return null;
    }
  }

  /** Guides de joueurs a equipement complet, bruts : les noms se resolvent a la fin. */
  async function heroGuides(h) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/recommended?size=100`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) },
      );
      if (!rep.ok) return [];
      return ((await rep.json())?.data?.records ?? []).flatMap((r) => {
        const d = r?.data?.data;
        const equipment = (d?.equips ?? [])
          .map((e) => e?.equip_ids)
          .find((ids) => Array.isArray(ids) && ids.length === 6);
        if (!equipment) return [];
        const emblem = d?.emblems?.[0];
        return [
          {
            equipment,
            emblemId: emblem?.emblem_id ?? null,
            talents: Array.isArray(emblem?.emblem_gifts) ? emblem.emblem_gifts : [],
            spellId: d?.spell?.spell_id ?? null,
            route: d?.hero?.hero_lane != null ? String(d.hero.hero_lane) : null,
            authorRank: Number(r?.user?.historyRankLevel) || 0,
            votes: Number(r?.vote_all?.total) || 0,
            views: Number(r?.dynamic?.views) || 0,
          },
        ];
      });
    } catch {
      return [];
    }
  }

  const output = {};
  const guidesRaw = {};

  for (const [i, h] of heroes.entries()) {
    const pendingGuides = heroGuides(h);
    const byLane = {};
    for (const l of h.lanes) {
      const lane = API_LANES[l];
      if (!lane) continue;
      // Comme pour les contres, les six rangs d'une position partent ensemble.
      const results = await Promise.all(MEASURED_RANKS.map((rank) => buildsOfRank(h, l, lane, rank)));
      const byRank = {};
      MEASURED_RANKS.forEach((rank, j) => {
        if (results[j]) byRank[rank] = results[j];
      });
      if (Object.keys(byRank).length > 0) byLane[l] = byRank;
    }
    if (Object.keys(byLane).length > 0) output[h.slug] = byLane;
    guidesRaw[h.slug] = await pendingGuides;

    process.stdout.write(`\r    builds ${i + 1}/${heroes.length}`);
    await pause(150);
  }

  process.stdout.write("\n");

  const guides = {};
  for (const h of heroes) {
    const list = (guidesRaw[h.slug] ?? []).map((g) => ({ ...g, lane: laneByRoute.get(g.route) ?? null }));
    const byLane = {};
    for (const l of h.lanes) {
      // Un guide sans position reconnue ne vaut que pour un heros a position unique.
      // Seuls comptent les guides dont les six objets se reconnaissent.
      const candidates = list.filter(
        (g) =>
          (g.lane === l || (g.lane === null && h.lanes.length === 1)) &&
          g.equipment.every((id) => itemById.has(id)),
      );
      const byRank = {};
      for (const rank of MEASURED_RANKS) {
        const best = chooseGuide(candidates, rank);
        if (!best) continue;
        byRank[rank] = {
          items: best.equipment.map((id) => itemById.get(id)).filter(Boolean),
          emblem: emblemById.get(best.emblemId) ?? null,
          talents: best.talents.map((id) => talentById.get(id)?.skillname).filter(Boolean),
          spell: spellById.get(best.spellId)?.skillname ?? null,
          authorRank: best.authorRank,
          votes: best.votes,
          views: best.views,
        };
      }
      if (Object.keys(byRank).length > 0) byLane[l] = byRank;
    }
    if (Object.keys(byLane).length > 0) guides[h.slug] = byLane;
  }

  return { builds: output, guides, icons };
}

// ─────────────────────────────────────────────────────────────
// Classement
// ─────────────────────────────────────────────────────────────

/**
 * Taux de victoire, de ban et de selection, pour chaque rang.
 *
 * Les identifiants de cette API ne sont pas ceux du wiki : le rapprochement se
 * fait par nom, apres passage au meme format de slug. Un heros sans
 * correspondance est simplement ignore plutot que rattache au hasard.
 */
async function ranking(heroes) {
  const known = new Set(heroes.map((h) => h.slug));

  async function rateOfRank(rank) {
    const response = await fetch(`${STATS}/heroes/rank?size=200&rank=${rank}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Statistiques indisponibles (${rank}) : HTTP ${response.status}`);

    const records = (await response.json())?.data?.records ?? [];
    const rate = {};
    const orphans = [];

    for (const entry of records) {
      const d = entry?.data;
      const name = d?.main_hero?.data?.name;
      if (!name) continue;

      const key = slugify(name);
      if (!known.has(key)) {
        orphans.push(name);
        continue;
      }

      rate[key] = {
        winRate: round(d.main_hero_win_rate),
        banRate: round(d.main_hero_ban_rate),
        pickRate: round(d.main_hero_appearance_rate),
      };
    }
    return { rate, orphans };
  }

  // Six requetes seulement : elles partent ensemble.
  const results = await Promise.allSettled(MEASURED_RANKS.map(rateOfRank));

  // Sans la mesure tous rangs, la tier list n'a plus de base : on echoue, et
  // l'appelant conserve le classement precedent. Un autre rang manquant est
  // simplement omis.
  if (results[0].status === "rejected") throw results[0].reason;
  const { orphans } = results[0].value;
  if (orphans.length) console.log(`  sans correspondance : ${orphans.join(", ")}`);

  const byRank = {};
  MEASURED_RANKS.forEach((rank, i) => {
    if (results[i].status === "fulfilled") byRank[rank] = results[i].value.rate;
  });
  return byRank;
}

/**
 * Relations entre heros : contres et synergies.
 *
 * L'API expose, pour chaque heros, ceux contre lesquels il est fort, ceux qui
 * le mettent en difficulte, et ceux avec qui il se combine. Ses identifiants
 * ne sont pas ceux du wiki : le rapprochement se fait par nom.
 */
async function relations(heroes) {
  const bySlug = new Map(heroes.map((h) => [h.slug, h]));

  const response = await fetch(`${STATS}/heroes?size=200`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Relations indisponibles : HTTP ${response.status}`);

  const records = (await response.json())?.data?.records ?? [];

  // Table identifiant de l'API vers slug du site, construite depuis les noms.
  const byId = new Map();
  for (const entry of records) {
    const name = entry?.data?.hero?.data?.name;
    const id = entry?.data?.hero_id;
    if (!name || id == null) continue;
    const slug = slugify(name);
    if (bySlug.has(slug)) byId.set(id, slug);
  }

  const output = {};
  for (const entry of records) {
    const slug = byId.get(entry?.data?.hero_id);
    if (!slug) continue;

    const read = (key) =>
      (entry.data.relation?.[key]?.target_hero_id ?? [])
        .map((id) => byId.get(id))
        .filter(Boolean);

    output[slug] = {
      strongAgainst: read("strong"),
      weakAgainst: read("weak"),
      synergies: read("assist"),
    };
  }

  return output;
}

/** Les taux arrivent en fraction ; on les stocke en pourcentage a deux decimales. */
const round = (v) => (typeof v === "number" ? Math.round(v * 10000) / 100 : null);

// ─────────────────────────────────────────────────────────────
// Patchs
// ─────────────────────────────────────────────────────────────

async function patches() {
  const members = [];
  let run;

  do {
    const data = await api({
      action: "query",
      list: "categorymembers",
      cmtitle: "Category:Patch Notes",
      cmlimit: "500",
      ...(run ? { cmcontinue: run } : {}),
    });
    members.push(...(data.query?.categorymembers ?? []));
    run = data.continue?.cmcontinue;
  } while (run);

  // Some official notes are missing from the category (2.1.90 was): pages
  // whose title starts with "Patch Notes " fill the gap. Duplicates merge by
  // version below.
  do {
    const data = await api({
      action: "query",
      list: "allpages",
      apprefix: "Patch Notes ",
      apfilterredir: "nonredirects",
      aplimit: "500",
      ...(run ? { apcontinue: run } : {}),
    });
    members.push(...(data.query?.allpages ?? []));
    run = data.continue?.apcontinue;
  } while (run);

  /**
   * Le wiki publie plusieurs pages pour une meme version : les notes
   * officielles, celles du serveur de test (« Advanced Server »), et parfois
   * un ajustement d'equilibrage separe. On ne garde que la plus autoritaire —
   * afficher trois fois « 1.8.30 » n'apprendrait rien a personne.
   */
  const rank = (title) => {
    if (/advanced server/i.test(title)) return 2;
    if (/balance adjustment/i.test(title)) return 1;
    return 0;
  };

  const byVersion = new Map();

  for (const m of members) {
    const version = m.title.match(/(\d+\.\d+\.\d+)/)?.[1];
    if (!version) continue;

    const candidate = {
      version,
      title: m.title,
      link: `https://mobilelegends.fandom.com/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`,
    };

    const existing = byVersion.get(version);
    if (!existing || rank(candidate.title) < rank(existing.title)) {
      byVersion.set(version, candidate);
    }
  }

  return [...byVersion.values()].sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Date de chaque patch detaille : la premiere revision de sa page sur le wiki,
 * creee le jour de la sortie ou a quelques jours pres. Elle place les patchs
 * sur les courbes de taux.
 */
async function daterPatchs(detail) {
  for (const patch of Object.values(detail)) {
    try {
      const data = await api({
        action: "query",
        prop: "revisions",
        titles: patch.title,
        rvprop: "timestamp",
        rvdir: "newer",
        rvlimit: "1",
      });
      const page = Object.values(data.query?.pages ?? {})[0];
      patch.date = page?.revisions?.[0]?.timestamp?.slice(0, 10) ?? null;
    } catch {
      patch.date = null;
    }
  }
}

/**
 * Contenu complet des patch notes les plus recents.
 *
 * On demande au wiki son propre rendu HTML plutot que d'analyser du wikitext,
 * puis on nettoie ce qui n'a de sens que sur le wiki. Seuls les derniers
 * patchs sont recuperes : les 249 pages representeraient plusieurs megaoctets
 * pour un contenu que plus personne ne consulte.
 */
async function contentPatchs(list) {
  const contents = {};

  for (const [i, patch] of list.slice(0, DETAILED_PATCHES).entries()) {
    try {
      const data = await api({
        action: "parse",
        page: patch.title,
        prop: "text",
        disabletoc: "1",
        formatversion: "2",
      });

      const raw = data.parse?.text;
      if (!raw) continue;

      // Deux lectures complementaires : le rendu HTML pour les sections libres
      // (mot des concepteurs, terrain), et le wikitexte pour extraire les
      // ajustements de heros en donnees structurees — heros, type, diffs.
      let adjustments = [];
      try {
        const wt = await api({
          action: "parse",
          page: patch.title,
          prop: "wikitext",
          formatversion: "2",
        });
        const wikitext = wt.parse?.wikitext;
        if (wikitext) adjustments = heroAdjustments(wikitext);
      } catch {
        // Sans le wikitexte, on garde au moins le rendu HTML.
      }

      const { html } = cleanRender(raw, patch.link);

      // Le corps est decoupe en sections : la page en rend certaines telles
      // quelles et en remplace d'autres — nouveaux heros, ajustements — par un
      // composant riche. On extrait la presentation des nouveaux heros et on
      // vide le HTML des sections reprises par un composant, inutile a garder.
      const sections = splitSections(html);
      let introduced = [];
      const sectionsRendered = sections.map((s) => {
        const t = (s.title ?? "").toLowerCase();
        if (/hero adjustments/.test(t)) return { ...s, html: "", role: "adjustments" };
        if (/new hero/.test(t)) {
          introduced = newHeroes(s.html).map((h) => ({ ...h, slug: slugify(h.name) }));
          return { ...s, html: "", role: "newHeroes" };
        }
        return { ...s, role: null };
      });

      contents[patch.version] = {
        version: patch.version,
        title: patch.title,
        link: patch.link,
        toc: toc(html),
        sections: sectionsRendered,
        newHeroes: introduced,
        // Ajustements de heros ramenes a des slugs, pour lier aux fiches.
        adjustments: adjustments.map((a) => ({ ...a, slug: slugify(a.name) })),
        balance: summary(adjustments),
      };
    } catch {
      // Une page illisible ne doit pas interrompre la synchronisation.
    }

    process.stdout.write(`\r    patchs ${i + 1}/${Math.min(DETAILED_PATCHES, list.length)}`);
    await pause(400);
  }

  process.stdout.write("\n");
  return contents;
}

/** Trie 1.9.40 apres 1.9.9, ce qu'un tri alphabetique ne fait pas. */
function compareVersions(a, b) {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** Lit un JSON deja genere, ou un objet vide s'il n'existe pas encore. */
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

/** Nettoie une description de competence renvoyee par l'API (balises, sauts). */
function cleanSkillDesc(raw) {
  return withoutTags(String(raw ?? "").replace(/<br\s*\/?>/gi, " "))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Competences depuis l'API communautaire, en repli du wiki.
 *
 * Certaines pages du wiki n'exposent pas leurs competences — nom, description
 * ou icone manquants. L'API les fournit toutes : nom, texte du jeu et icone
 * officielle. On les recupere pour completer ce que le wiki laisse de cote,
 * sans jamais ecraser ce qu'il fournit deja.
 */
async function fetchArenaSkills(heroes) {
  const output = {};
  // L'API expose aussi une accroche d'une ligne (« story ») : on la recolte
  // au passage, sans interrogation supplementaire.
  const taglines = {};

  for (const [i, h] of heroes.entries()) {
    try {
      const rep = await fetch(`${STATS}/heroes/${encodeURIComponent(h.name)}?lang=en`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (rep.ok) {
        const data = (await rep.json())?.data?.records?.[0]?.data?.hero?.data;
        const skills = (data?.heroskilllist ?? []).flatMap((g) => g.skilllist ?? []);
        if (skills.length > 0) {
          output[h.slug] = skills.map((s) => ({
            // Identifiant de jeu : c'est par lui que les combos designent la competence.
            id: s.skillid ?? null,
            name: String(s.skillname ?? "").trim(),
            description: cleanSkillDesc(s.skilldesc) || null,
            icon: s.skillicon ? String(s.skillicon) : null,
          }));
        }
        const tagline = String(data?.story ?? "").trim();
        if (tagline) taglines[h.slug] = tagline;
      }
    } catch {
      // Un heros en echec ne doit pas interrompre la synchronisation.
    }

    process.stdout.write(`\r    competences arena ${i + 1}/${heroes.length}`);
    await pause(200);
  }

  process.stdout.write("\n");
  return { skills: output, taglines };
}

/**
 * Modes de jeu, depuis le wiki.
 *
 * La page « Game Modes » liste les modes de combat officiels dans une galerie ;
 * chaque mode a sa propre page, dont on tire le paragraphe de presentation et
 * l'image. L'API communautaire ne couvre pas les modes : le wiki est la seule
 * source structuree.
 */
async function modesOfGame() {
  const gallery = await api({
    action: "parse",
    page: "Game Modes",
    prop: "wikitext",
    formatversion: "2",
  });
  const wt = gallery.parse?.wikitext ?? "";
  const entries = [...wt.matchAll(/File:([^|]+)\|link=([^|]+)\|\[\[([^\]]+)\]\]/gi)].map((m) => ({
    file: m[1].trim(),
    page: m[2].trim().replace(/_/g, " "),
    name: m[3].trim(),
  }));
  if (entries.length === 0) return [];

  // Images : une seule requete pour tous les fichiers de la galerie.
  const dataImg = await api({
    action: "query",
    titles: entries.map((e) => `File:${e.file}`).join("|"),
    prop: "imageinfo",
    iiprop: "url",
  });
  const byFile = new Map(
    Object.values(dataImg.query?.pages ?? {})
      .filter((p) => p.imageinfo)
      .map((p) => [p.title.replace(/^File:/, ""), p.imageinfo[0].url.split("/revision")[0]]),
  );

  // Le paragraphe de presentation d'un mode : on le tire de sa page. Le lien de
  // la galerie et le libelle affiche different parfois (« Arcade » vs « Arcade
  // Mode ») ; on tente les deux avant d'abandonner.
  // Sections de service, sans interet pour un lecteur : on les ecarte.
  const SECTIONS_IGNOREES = [
    "trivia", "gallery", "references", "navigation", "see also",
    "ranked mode subpages", "external links",
  ];

  // On lit la page une fois, en wikitexte brut, pour en tirer l'introduction
  // et les sections detaillees.
  const content = async (title) => {
    try {
      const rep = await api({
        action: "query",
        titles: title,
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        redirects: "1",
      });
      const page = Object.values(rep.query?.pages ?? {})[0];
      const wt = page?.revisions?.[0]?.slots?.main?.["*"];
      if (!wt) return null;

      // L'introduction : ce qui precede le premier titre de section.
      const intro = wt.split(/\n==/)[0];
      const description = cleanLore(intro).find((p) => p.length > 40) ?? null;

      const sections = sectionsPage(wt, SECTIONS_IGNOREES);
      return { description, sections };
    } catch {
      return null;
    }
  };

  const modes = [];
  for (const e of entries) {
    // Le lien de la galerie et le libelle affiche different parfois
    // (« Arcade » vs « Arcade Mode ») : on tente les deux.
    const c = (await content(e.page)) ?? (await content(e.name));

    modes.push({
      name: e.name,
      slug: slugify(e.name),
      description: c?.description ?? null,
      sections: c?.sections ?? [],
      image: byFile.get(e.file) ?? null,
    });
    await pause(300);
  }

  return modes;
}

/**
 * Emblemes officiels des rangs.
 *
 * Le decoupage des rangs (de Guerrier a Epique, puis la famille Mythique) est
 * stable et code cote site ; seuls les emblemes sont recuperes ici, depuis le
 * wiki, pour rester frais si leur fichier change. Les sous-paliers mythiques
 * (Honneur, Gloire, Immortel) n'existent pas dans la table du jeu : on prend
 * leurs images du wiki, ou elles sont documentees.
 */
async function ranks() {
  const FILES = {
    warrior: "Warrior.png",
    elite: "Elite.png",
    master: "Master.png",
    grandmaster: "Grandmaster.png",
    epic: "Epic.png",
    legend: "Legend.png",
    mythic: "Mythic.png",
    "mythic-honor": "Mythical_Honor.png",
    "mythic-glory": "Mythical_Glory.png",
    "mythic-immortal": "Mythical_Immortal.png",
  };

  const data = await api({
    action: "query",
    titles: Object.values(FILES)
      .map((f) => `File:${f}`)
      .join("|"),
    prop: "imageinfo",
    iiprop: "url",
  });

  const byName = new Map(
    Object.values(data.query?.pages ?? {})
      .filter((p) => p.imageinfo)
      .map((p) => [
        p.title.replace(/^File:/, "").replace(/ /g, "_"),
        p.imageinfo[0].url.split("/revision")[0],
      ]),
  );

  const images = {};
  for (const [key, file] of Object.entries(FILES)) {
    const url = byName.get(file);
    if (url) images[key] = url;
  }
  return { images };
}

/**
 * Portraits des monstres de l'entraineur de Chatiment : l'image principale de
 * leur page du wiki. Le Seigneur de 12 minutes reprend celui de 8 minutes.
 */
async function monsters() {
  const PAGES = { lord: "Lord", turtle: "Turtle", "purple-buff": "Thunder Fenrir", "orange-buff": "Molten Fiend" };
  const data = await api({
    action: "query",
    titles: Object.values(PAGES).join("|"),
    prop: "pageimages",
    piprop: "original",
  });
  const byTitle = new Map(
    Object.values(data.query?.pages ?? {})
      .filter((p) => p.original)
      .map((p) => [p.title, p.original.source.split("/revision")[0]]),
  );
  const images = {};
  for (const [key, title] of Object.entries(PAGES)) {
    const url = byTitle.get(title);
    if (url) images[key] = url;
  }
  return images;
}

// ─────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUTPUT, { recursive: true });

  console.log("Lecture des modules du wiki…");
  const [rawHeroes, rawSkins, rawItems] = await Promise.all([
    moduleLua("Module:Hero/data"),
    moduleLua("Module:Skin/data"),
    moduleLua("Module:Equipment/data"),
  ]);

  const heroes = normalizeHeroes(rawHeroes);
  const skins = normalizeSkins(rawSkins);
  const items = normalizeItems(rawItems);

  const nbSkins = Object.values(skins).reduce((n, s) => n + s.length, 0);
  console.log(`  ${heroes.length} heros, ${nbSkins} skins, ${items.length} objets`);

  console.log("Lecture des pages de heros…");
  const pages = await heroPages(heroes);
  const nbSkills = Object.values(pages).reduce(
    (n, p) => n + p.skills.filter(Boolean).length,
    0,
  );
  const nbDescriptions = Object.values(pages).reduce(
    (n, p) => n + p.skills.filter((c) => c?.description).length,
    0,
  );
  const nbIllustrations = Object.values(pages).reduce((n, p) => n + p.illustrations.length, 0);
  console.log(
    `  ${nbSkills} competences (${nbDescriptions} decrites), ${nbIllustrations} illustrations`,
  );

  console.log("Competences en repli (API)…");
  const { skills: skillsArena, taglines } = await fetchArenaSkills(heroes);
  console.log(`  ${Object.keys(skillsArena).length} heros couverts par l'API`);

  // Fusion wiki + API : le wiki prime, l'API comble nom, description et icone
  // manquants. Les deux listes suivent le meme ordre (passif → ultime). En
  // dernier recours, on garde ce qui avait deja ete complete : une panne de
  // l'API ne doit pas effacer un enrichissement obtenu lors d'un passage
  // precedent.
  const skillsExisting = await readJson(`${OUTPUT}/skills.json`);
  const finalSkills = {};
  for (const h of heroes) {
    const wiki = pages[h.slug]?.skills ?? [];
    const arena = skillsArena[h.slug] ?? [];
    const old = skillsExisting[h.slug] ?? [];
    const n = Math.max(wiki.length, arena.length, old.length);
    if (n === 0) continue;

    const list = [];
    for (let i = 0; i < n; i += 1) {
      const name = wiki[i]?.name ?? arena[i]?.name ?? old[i]?.name ?? null;
      const description =
        wiki[i]?.description ?? arena[i]?.description ?? old[i]?.description ?? null;
      list.push(name || description ? { name, description } : null);
    }
    finalSkills[h.slug] = list;
  }

  // ── Histoire des heros ─────────────────────────────────────────────
  // Deux apports complementaires : l'accroche d'une ligne de l'API et le
  // recit long du wiki (lore, fiche narrative, anecdotes). On n'inscrit un
  // heros que s'il apporte au moins l'un des deux.
  const stories = {};
  for (const h of heroes) {
    const story = pages[h.slug]?.story ?? null;
    const tagline = taglines[h.slug] ?? null;
    if (!story && !tagline) continue;
    stories[h.slug] = {
      tagline,
      lore: story?.lore ?? [],
      profile: story?.sheet ?? null,
      trivia: story?.trivia ?? [],
    };
  }
  console.log(`  ${Object.keys(stories).length} histoires de heros`);

  console.log("Classement des heros…");
  let stats = {};
  try {
    stats = await ranking(heroes);
    console.log(`  ${Object.keys(stats.all).length} heros mesures, ${Object.keys(stats).length} rangs`);
  } catch (error) {
    // Une source de statistiques indisponible ne doit pas faire echouer toute
    // la synchronisation : le site retombe sur le classement precedent.
    console.warn(`  statistiques indisponibles (${error.message}) — classement inchange`);
    stats = null;
  }

  console.log("Contres reels (academie)…");
  let counters = null;
  try {
    counters = await actualCounters(heroes);
    console.log(`  ${Object.keys(counters).length} heros avec contres chiffres`);
  } catch (error) {
    console.warn(`  contres indisponibles (${error.message}) — inchanges`);
  }

  console.log("Builds joues (academie)…");
  let builds = null;
  let guides = null;
  let iconsBuilds = { talents: {}, sorts: {} };
  try {
    ({ builds, guides, icons: iconsBuilds } = await buildsActual(heroes));
    console.log(`  ${Object.keys(builds).length} heros avec builds, ${Object.keys(guides).length} avec un guide complet`);
  } catch (error) {
    console.warn(`  builds indisponibles (${error.message}) — inchanges`);
  }

  console.log("Coequipiers et tendances (academie)…");
  let complementary = null;
  try {
    complementary = await teammatesAndTrends(heroes, await heroTableById(heroes));
    console.log(
      `  ${Object.keys(complementary.teammates).length} heros avec coequipiers, ${Object.keys(complementary.trends).length} avec tendance`,
    );
  } catch (error) {
    console.warn(`  coequipiers et tendances indisponibles (${error.message}) — inchanges`);
  }

  console.log("Duos (compatibilite)…");
  let duos = null;
  try {
    duos = await duosArena(heroes, await heroTableById(heroes));
    console.log(`  ${Object.keys(duos).length} heros avec duos`);
  } catch (error) {
    console.warn(`  duos indisponibles (${error.message}) — inchanges`);
  }

  console.log("Relations entre heros…");
  let links = null;
  try {
    links = await relations(heroes);
    const n = Object.values(links).reduce((t, r) => t + r.strongAgainst.length, 0);
    console.log(`  ${Object.keys(links).length} heros, ${n} relations de contre`);
  } catch (error) {
    console.warn(`  relations indisponibles (${error.message}) — inchangees`);
  }

  console.log("Liste des patchs…");
  const listPatchs = await patches();
  console.log(`  ${listPatchs.length} patchs`);

  console.log("Contenu des patchs recents…");
  const detailPatchs = await contentPatchs(listPatchs);
  await daterPatchs(detailPatchs);
  console.log(`  ${Object.keys(detailPatchs).length} patchs detailles`);

  console.log("Emblemes des rangs…");
  const emblemsRanks = await ranks();
  console.log(`  ${Object.keys(emblemsRanks.images).length} emblemes`);

  console.log("Modes de jeu…");
  const modes = await modesOfGame();
  console.log(`  ${modes.length} modes (${modes.filter((m) => m.description).length} decrits)`);

  console.log("Resolution des visuels…");
  const credentials = [
    ...heroes.map((h) => h.id),
    ...Object.values(skins).flat().map((s) => s.id),
  ];
  // Deux formats : le portrait vertical pour les fiches et les galeries,
  // l'icone carree pour les listes compactes.
  const portraits = await urlsImages(credentials, "portrait");
  const icons = await urlsImages(heroes.map((h) => h.id), "icon");
  console.log(`  ${Object.keys(portraits).length} portraits, ${Object.keys(icons).length} icones`);

  const { plan, paths } = planVisuals(heroes, skins, portraits, icons);

  // Emblemes de rang copies en local, comme le reste : aucune image servie
  // depuis un hote externe a l'execution.
  for (const [key, url] of Object.entries(emblemsRanks.images)) {
    if (!url || url.startsWith("/")) continue;
    plan.push({
      url,
      path: `public/visuels/rangs/${key}.webp`,
      optimize: true,
      width: 160,
    });
    emblemsRanks.images[key] = `/visuels/rangs/${key}.webp`;
  }

  // Portraits des monstres de l'entraineur de Chatiment, a la meme enseigne.
  for (const [key, url] of Object.entries(await monsters())) {
    plan.push({ url, path: `public/visuels/monstres/${key}.webp`, optimize: true, width: 320 });
  }

  // ── Visuels des modes ──────────────────────────────────────────────
  // Comme le reste, l'image d'un mode est copiee en local : le site ne doit
  // dependre d'aucune URL externe a l'execution. On planifie le telechargement
  // et on remplace l'URL du wiki par le chemin local dans `modes.json`.
  for (const mode of modes) {
    if (!mode.image || mode.image.startsWith("/")) continue;
    plan.push({
      url: mode.image,
      path: `public/visuels/modes/${mode.slug}.webp`,
      optimize: true,
      width: 640,
    });
    mode.image = `/visuels/modes/${mode.slug}.webp`;
  }

  // ── Icones de competences ──────────────────────────────────────────
  // Le fichier d'icone porte le nom du champ « image » du gabarit quand il
  // existe, souvent distinct du nom affiche (« Contract Transform » pour la
  // competence « Contract: Transform ») ; sinon on retombe sur le nom.
  const fileIcon = (slug, i, name) => pages[slug]?.skills?.[i]?.image ?? name;
  const namesSkills = [
    ...new Set(
      Object.entries(finalSkills).flatMap(([slug, cs]) =>
        cs.map((c, i) => (c?.name ? fileIcon(slug, i, c.name) : null)).filter(Boolean),
      ),
    ),
  ];
  const urlsSkills = await urlsFiles(namesSkills);

  // Icones deja resolues : dernier recours si ni le wiki ni l'API ne repondent.
  const visualsExisting = (await readJson(`${OUTPUT}/visuals.json`)).skills ?? {};

  let iconsArena = 0;
  const visualsSkills = {};
  for (const [slug, comps] of Object.entries(finalSkills)) {
    const arena = skillsArena[slug] ?? [];
    const icons = {};
    comps.forEach((skill, i) => {
      const name = skill?.name;
      if (!name) return;
      const urlWiki = urlsSkills[fileIcon(slug, i, name)];
      if (urlWiki) {
        const file = `${slugify(name)}.webp`;
        icons[name] = `/visuels/competences/${file}`;
        plan.push({
          url: urlWiki,
          path: `public/visuels/competences/${file}`,
          optimize: true,
          width: 128,
        });
      } else if (arena[i]?.icon) {
        // Repli : l'icone officielle du CDN de l'API, copiee en local comme le
        // reste — le site ne sert aucune image depuis un hote externe.
        const file = `${slugify(name)}.webp`;
        icons[name] = `/visuels/competences/${file}`;
        plan.push({
          url: arena[i].icon,
          path: `public/visuels/competences/${file}`,
          optimize: true,
          width: 128,
        });
        iconsArena += 1;
      } else if (visualsExisting[slug]?.[name]) {
        // Ni wiki ni API : on conserve l'icone deja resolue precedemment.
        icons[name] = visualsExisting[slug][name];
      }
    });
    if (Object.keys(icons).length) visualsSkills[slug] = icons;
  }
  console.log(
    `  ${Object.keys(urlsSkills).length}/${namesSkills.length} icones du wiki` +
      (iconsArena ? `, ${iconsArena} completees par l'API` : ""),
  );

  // ── Combos de competences ──────────────────────────────────────────
  // Apres les icones : un combo reprend l'icone locale de chaque competence
  // reconnue.
  console.log("Combos de competences (API)…");
  const combos = await combosArena(heroes, skillsArena, finalSkills, visualsSkills);
  console.log(`  ${Object.keys(combos).length} heros avec combos`);

  // ── Illustrations pleine taille ────────────────────────────────────
  const namesIllustrations = [
    ...new Set(Object.values(pages).flatMap((p) => p.illustrations.map((i) => i.file))),
  ];
  // Les illustrations sont en .jpg comme en .png : on interroge les deux.
  const [toJpg, toPng] = await Promise.all([
    urlsFiles(
      namesIllustrations.filter((f) => f.endsWith(".jpg")).map((f) => f.replace(/\.jpg$/, "")),
      "jpg",
    ),
    urlsFiles(
      namesIllustrations.filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, "")),
      "png",
    ),
  ]);
  const urlsIllustrations = { ...toJpg, ...toPng };

  const illustrations = {};
  for (const [slug, page] of Object.entries(pages)) {
    const bySkin = {};
    // L'illustration est rangee sous le nom du module de donnees, celui que la
    // fiche utilise pour la retrouver, des que la legende le reconnait.
    const namesModule = new Map(
      (skins[slug] ?? []).map((s) => [normalizeNameSkin(s.name), s.name]),
    );
    for (const { file, skin } of page.illustrations) {
      const key = file.replace(/\.(jpg|png)$/, "");
      const url = urlsIllustrations[key];
      if (!url || !skin) continue;
      const nameSkin = namesModule.get(normalizeNameSkin(skin)) ?? skin;
      // Premiere illustration retenue : les suivantes sont d'anciens visuels.
      if (bySkin[nameSkin]) continue;
      const nameFile = `${slugify(nameSkin)}.webp`;
      bySkin[nameSkin] = `/visuels/heros/${slug}/illustrations/${nameFile}`;
      plan.push({
        url,
        path: `public/visuels/heros/${slug}/illustrations/${nameFile}`,
        optimize: true,
      });
    }
    if (Object.keys(bySkin).length) illustrations[slug] = bySkin;
  }
  console.log(
    `  ${Object.keys(urlsIllustrations).length}/${namesIllustrations.length} illustrations pleine taille`,
  );

  console.log("Resolution des objets, emblemes, talents et sorts…");
  const [urlsItems, urlsEmblems, urlsTalents, spellUrls] = await Promise.all([
    urlsFiles(items.map((o) => o.name)),
    urlsFiles(EMBLEMS),
    urlsFiles(TALENTS),
    urlsFiles(SPELLS),
  ]);

  const batches = [
    planFiles(urlsItems, "objets"),
    planFiles(urlsEmblems, "emblemes"),
    planFiles(urlsTalents, "talents"),
    planFiles(spellUrls, "sorts"),
  ];
  plan.push(...batches.flatMap((l) => l.plan));

  const [visualsItems, visualsEmblems, visualsTalents, spellVisuals] =
    batches.map((l) => l.paths);

  // Talents et sorts recents absents du wiki (Rupture, War Cry, Flameshot…) :
  // l'icone officielle de l'API les complete, copiee en local comme le reste.
  // Sans --images, on ne reference que ce qui est deja sur le disque.
  for (const [type, icons, target] of [
    ["talents", iconsBuilds.talents, visualsTalents],
    ["sorts", iconsBuilds.sorts, spellVisuals],
  ]) {
    for (const [name, url] of Object.entries(icons)) {
      const key = slugify(name);
      if (target[key]) continue;
      const path = `/visuels/${type}/${key}.png`;
      plan.push({ url, path: `public${path}` });
      if (WITH_IMAGES || existsSync(`public${path}`)) target[key] = path;
    }
  }

  console.log(
    `  ${Object.keys(visualsItems).length}/${items.length} objets, ` +
      `${Object.keys(visualsEmblems).length} emblemes, ` +
      `${Object.keys(visualsTalents).length} talents, ` +
      `${Object.keys(spellVisuals).length} sorts`,
  );

  if (WITH_IMAGES) {
    console.log(`Telechargement de ${plan.length} visuels…`);
    let ok = 0;
    let already = 0;
    let failures = 0;

    // Par petits paquets : assez rapide, sans saturer le wiki.
    for (let i = 0; i < plan.length; i += 8) {
      const results = await Promise.all(
        plan.slice(i, i + 8).map((v) => download(v.url, v.path, v.optimize, v.width)),
      );
      ok += results.filter((r) => r === "ok").length;
      already += results.filter((r) => r === "deja").length;
      failures += results.filter((r) => r === "echec").length;
      process.stdout.write(`\r    ${Math.min(i + 8, plan.length)}/${plan.length}`);
    }
    console.log(`\n  ${ok} telecharges, ${already} deja presents, ${failures} echecs`);
  } else {
    console.log("  (relancer avec --images pour telecharger les visuels)");
  }

  const write = (name, data) =>
    writeFile(`${OUTPUT}/${name}.json`, JSON.stringify(data, null, 2) + "\n");

  // Les mesures (classement, contres, synergies) sont regroupees dans un seul
  // fichier. Chacune a sa propre disponibilite : quand une source ne repond
  // pas, on conserve la valeur precedente plutot que de l'effacer. Le
  // classement garde en plus sa date, car il ne se rafraichit pas au meme
  // rythme que le reste.
  const statsExisting = await readJson(`${OUTPUT}/statistics.json`);
  const statistics = {
    rankings: stats
      ? { measuredAt: new Date().toISOString(), rates: stats.all, byRank: stats }
      : (statsExisting.rankings ?? { measuredAt: null, rates: {} }),
    counters: counters ?? statsExisting.counters ?? {},
    builds: builds ?? statsExisting.builds ?? {},
    guides: guides ?? statsExisting.guides ?? {},
    // Par heros : celui que l'API n'a pas servi garde ses coequipiers.
    teammates: { ...(statsExisting.teammates ?? {}), ...(complementary?.teammates ?? {}) },
    relations: links ?? statsExisting.relations ?? {},
  };

  // Table nom-par-slug, embarquee cote client sans le reste du catalogue.
  const names = Object.fromEntries(heroes.map((h) => [h.slug, h.name]));

  await Promise.all([
    // Catalogue
    write("heroes", heroes),
    write("skins", skins),
    write("items", items),
    write("skills", finalSkills),
    write("modes", modes),
    write("stories", stories),
    write("ranks", emblemsRanks),
    write("names", names),
    writeEvolution(complementary),
    writeCombos(combos),
    writeDuos(duos),
    // Tous les chemins de visuels, regroupes
    write("visuals", {
      heroes: paths,
      illustrations,
      skills: visualsSkills,
      items: visualsItems,
      emblems: visualsEmblems,
      talents: visualsTalents,
      spells: spellVisuals,
    }),
    // Mesures et patchs, regroupes
    write("statistics", statistics),
    write("patches", { list: listPatchs, details: detailPatchs }),
    // Metadonnees de la synchronisation
    write("sync", {
      date: new Date().toISOString(),
      source: "https://mobilelegends.fandom.com",
      heroes: heroes.length,
      skins: nbSkins,
      items: items.length,
      patches: listPatchs.length,
      rankings: stats ? Object.keys(stats.all).length : null,
      counters: counters ? Object.keys(counters).length : null,
      builds: builds ? Object.keys(builds).length : null,
      // Le wiki fournit le catalogue ; l'API communautaire fournit les mesures.
      sources: [
        "https://mobilelegends.fandom.com",
        "https://arena.rone.dev",
      ],
    }),
  ]);

  console.log(`\nEcrit dans ${OUTPUT}/`);
}

await (process.argv.includes("--evolution")
  ? evolutionSingle()
  : process.argv.includes("--combos")
    ? combosOnly()
    : process.argv.includes("--duos")
      ? duosOnly()
      : main());

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
 * Le resultat est ecrit dans `src/data/jeu/`. Les visuels vont dans
 * `public/visuels/`, versionnes avec le depot : le build de l'image n'a besoin
 * d'aucun acces au wiki.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { analyserTableLua } from "./lua.mjs";
import { decouperSections, nettoyerRendu, nouveauxHeros, sommaire } from "./patch-notes.mjs";
import {
  nettoyerDescription,
  sansBalises,
  extraireHistoire,
  sectionsPage,
  nettoyerLore,
} from "./wikitexte.mjs";
import { ajustementsHeros, bilan } from "./patch-parser.mjs";
import { extraireIllustrations, normaliserNomSkin } from "./galerie.mjs";
import {
  arrondi,
  choisirGuide,
  combosDuHeros,
  duosDuRang,
  fusionnerDuos,
  fusionnerHistorique,
  serialiserDuos,
  serieQuotidienne,
} from "./mesures.mjs";

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
const PATCHS_DETAILLES = 12;
const UA = "MLBB-sync/1.0 (https://mlbbdex.com; contact via github.com/achedon12)";
const SORTIE = "src/data/jeu";

const AVEC_IMAGES = process.argv.includes("--images");

/** Le wiki nomme les positions en anglais ; le site est en francais. */
const LANES = {
  "Gold Lane": "Or",
  "EXP Lane": "Experience",
  "Mid Lane": "Milieu",
  Jungle: "Jungle",
  Roaming: "Roam",
};

// ─────────────────────────────────────────────────────────────
// Acces au wiki
// ─────────────────────────────────────────────────────────────

async function api(parametres) {
  const url = new URL(WIKI);
  for (const [c, v] of Object.entries({ ...parametres, format: "json" })) {
    url.searchParams.set(c, v);
  }

  for (let essai = 1; essai <= 3; essai += 1) {
    try {
      const reponse = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(45000),
      });
      if (reponse.ok) return reponse.json();
      // 429 : on laisse le service respirer avant de reessayer.
      if (reponse.status === 429) await pause(3000 * essai);
      else throw new Error(`HTTP ${reponse.status}`);
    } catch (erreur) {
      if (essai === 3) throw erreur;
      await pause(1500 * essai);
    }
  }
  throw new Error("Wiki injoignable.");
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function moduleLua(titre) {
  const donnees = await api({
    action: "query",
    titles: titre,
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
  });

  const page = Object.values(donnees.query.pages)[0];
  if (!page?.revisions) throw new Error(`Module introuvable : ${titre}`);

  return analyserTableLua(page.revisions[0].slots.main["*"]);
}

// ─────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────

/** Un identifiant d'URL stable, insensible aux accents et a la ponctuation. */
function slugifier(nom) {
  return String(nom)
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
const vide = (v) => !v || String(v).startsWith("<") || String(v).trim() === "";
const propre = (v) => (vide(v) ? null : String(v).trim());
const liste = (...v) => v.map(propre).filter(Boolean);

function normaliserHeros(brut) {
  return Object.entries(brut)
    .filter(([nom, h]) => nom !== "Mystery Hero" && !vide(h.id) && !vide(h.name))
    .map(([, h]) => ({
      slug: slugifier(h.name),
      name: String(h.name),
      id: String(h.id),
      title: propre(h.title),
      roles: liste(h.role1, h.role2),
      lanes: liste(h.lane1, h.lane2).map((l) => LANES[l] ?? l),
      specialties: liste(h.specialty1, h.specialty2),
      release: propre(h.release_date),
      year: propre(h.release_year) ?? extraireAnnee(h.release_date),
      resource: propre(h.resource),
      damageType: propre(h.dmg_type),
      attackType: propre(h.atk_type),
      region: propre(h.region),
      ratings: {
        offense: nombre(h.ratings?.offense),
        durability: nombre(h.ratings?.durability),
        abilityEffects: nombre(h.ratings?.control_effect ?? h.ratings?.ability_effects),
        difficulty: nombre(h.ratings?.difficulty),
      },
      stats: h.stats && typeof h.stats === "object" ? normaliserStats(h.stats) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function nombre(v) {
  if (vide(v)) return null;
  const n = Number(String(v).replace(",", "."));
  // `|| null` serait tentant, mais transformerait un zero legitime en absence
  // de valeur : en JavaScript, 0 est faux.
  return Number.isFinite(n) ? n : null;
}

function extraireAnnee(date) {
  const trouve = String(date ?? "").match(/\b(20\d{2})\b/);
  return trouve ? trouve[1] : null;
}

function normaliserStats(stats) {
  const garder = [
    "hp1", "hp15", "hp_regen1", "mana1", "mana15",
    "physical_atk1", "physical_atk15", "physical_def1", "physical_def15",
    "magic_def1", "magic_def15", "movement_spd", "basic_atk_range",
  ];
  const sortie = {};
  for (const cle of garder) if (!vide(stats[cle])) sortie[cle] = String(stats[cle]);
  return Object.keys(sortie).length ? sortie : null;
}

function normaliserSkins(brut) {
  const parHeros = {};

  for (const [nomHeros, entree] of Object.entries(brut)) {
    const skins = Object.values(entree?.skins ?? {})
      .filter((s) => !vide(s.id) && !vide(s.name))
      .map((s) => ({
        id: String(s.id),
        name: String(s.name),
        release: propre(s.release)?.replace(/-XX/g, "") ?? null,
        availability: propre(s.availability),
        rarity: propre(s.tier),
        label: propre(s.tag),
        price: Object.fromEntries(
          Object.entries(s.price ?? {})
            .map(([m, v]) => [m, propre(v)])
            .filter(([, v]) => v),
        ),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (skins.length) parHeros[slugifier(nomHeros)] = skins;
  }

  return parHeros;
}

function normaliserObjets(brut) {
  return Object.entries(brut)
    .filter(([, o]) => !vide(o?.name))
    // Le module du wiki melange aux objets des lignes de gabarit qui n'en sont
    // pas : des effets isoles (« Passive - Favor ») et des drapeaux de
    // mecanique (« Throw Forbidden »). Aucun n'a de prix, de statistiques ni
    // d'effet propre — c'est le critere qui les distingue d'un vrai objet.
    // Un objet de boutique a un prix, ou au minimum des statistiques. Ce qui
    // n'a ni l'un ni l'autre est un enchantement ou une bascule d'interaction
    // entre heros (« Allow Throw », « Passive - Favor ») : le wiki les range
    // dans le meme module, le site ne doit pas les presenter comme des objets.
    .filter(([, o]) => nombre(o.price) > 0 || !vide(o.bonus))
    .map(([, o]) => ({
      slug: slugifier(o.name),
      name: String(o.name),
      summary: propre(o.caption),
      category: propre(o.type) ?? "Autre",
      price: nombre(o.price),
      bonus: propre(o.bonus),
      unique: propre(o.unique),
      passive: propre(o.passive),
      active: propre(o.active),
      recipe: propre(o.recipe)?.split(",").map((x) => x.trim()).filter(Boolean) ?? [],
      bestFor: propre(o.availability),
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
async function urlsImages(identifiants, variante) {
  const trouvees = {};

  for (let i = 0; i < identifiants.length; i += 50) {
    const lot = identifiants.slice(i, i + 50);
    const titres = lot.map((id) => `File:Hero${id}-${variante}.png`).join("|");

    const donnees = await api({
      action: "query",
      titles: titres,
      prop: "imageinfo",
      iiprop: "url",
    });

    for (const page of Object.values(donnees.query?.pages ?? {})) {
      const source = page.imageinfo?.[0]?.url;
      if (!source) continue;
      const id = page.title.match(/Hero(\w+)-/)?.[1];
      // Le suffixe de cache ne sert a rien et rend l'URL instable.
      if (id) trouvees[id] = source.split("/revision/")[0];
    }

    process.stdout.write(`\r    ${variante} ${Math.min(i + 50, identifiants.length)}/${identifiants.length}`);
    await pause(300);
  }

  process.stdout.write("\n");
  return trouvees;
}

/**
 * Resout des fichiers du wiki designes par leur nom exact.
 *
 * Les visuels de heros suivent une convention numerique ; les objets, les
 * emblemes, les talents et les sorts sont nommes d'apres leur libelle anglais.
 * Cette fonction sert ce second cas.
 */
async function urlsFichiers(noms, extension = "png") {
  const trouvees = {};

  for (let i = 0; i < noms.length; i += 50) {
    const lot = noms.slice(i, i + 50);
    const titres = lot.map((n) => `File:${n}.${extension}`).join("|");

    const donnees = await api({
      action: "query",
      titles: titres,
      prop: "imageinfo",
      iiprop: "url",
    });

    // Le wiki normalise certains titres (espaces, apostrophes) : on suit ses
    // redirections pour retrouver le nom demande.
    const normalises = new Map(
      (donnees.query?.normalized ?? []).map((n) => [n.to, n.from]),
    );

    for (const page of Object.values(donnees.query?.pages ?? {})) {
      const source = page.imageinfo?.[0]?.url;
      if (!source) continue;
      const titre = normalises.get(page.title) ?? page.title;
      trouvees[titre.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")] =
        source.split("/revision/")[0];
    }

    await pause(300);
  }

  return trouvees;
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
async function telecharger(url, chemin, optimiser = false, largeur = 1280) {
  if (existsSync(chemin)) return "deja";
  try {
    const reponse = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(45000),
    });
    if (!reponse.ok) return "echec";

    const donnees = Buffer.from(await reponse.arrayBuffer());
    await mkdir(dirname(chemin), { recursive: true });

    if (optimiser) {
      const sharp = (await import("sharp")).default;
      await sharp(donnees)
        .resize({ width: largeur, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(chemin);
    } else {
      await writeFile(chemin, donnees);
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
function planVisuels(heros, skins, portraits, icones) {
  const plan = [];
  const chemins = {};

  for (const h of heros) {
    const dossier = `visuels/heros/${h.slug}`;
    const entree = { portrait: null, icon: null, skins: {} };

    if (portraits[h.id]) {
      entree.portrait = `/${dossier}/portrait.png`;
      plan.push({ url: portraits[h.id], chemin: `public/${dossier}/portrait.png` });
    }
    if (icones[h.id]) {
      entree.icon = `/${dossier}/icone.png`;
      plan.push({ url: icones[h.id], chemin: `public/${dossier}/icone.png` });
    }

    for (const skin of skins[h.slug] ?? []) {
      const url = portraits[skin.id];
      if (!url) continue;
      const fichier = `${skin.id}-${slugifier(skin.name)}.png`;
      entree.skins[skin.id] = `/${dossier}/skins/${fichier}`;
      plan.push({ url, chemin: `public/${dossier}/skins/${fichier}` });
    }

    chemins[h.slug] = entree;
  }

  return { plan, chemins };
}

/**
 * Range les visuels qui ne dependent pas d'un heros.
 *
 *     public/visuels/objets/blade-of-despair.png
 *     public/visuels/emblemes/tank.png
 *     public/visuels/talents/impure-rage.png
 *     public/visuels/sorts/flicker.png
 */
function planFichiers(urls, dossier) {
  const plan = [];
  const chemins = {};

  for (const [nom, url] of Object.entries(urls)) {
    const fichier = `${slugifier(nom)}.png`;
    chemins[slugifier(nom)] = `/visuels/${dossier}/${fichier}`;
    plan.push({ url, chemin: `public/visuels/${dossier}/${fichier}` });
  }

  return { plan, chemins };
}

/**
 * Emblemes, talents et sorts de combat.
 *
 * Le wiki n'expose pas de module de donnees pour eux : la liste est declaree
 * ici, et chaque nom a ete verifie comme correspondant a un fichier existant.
 * Un nom qui cesserait d'exister disparait simplement des visuels.
 */
const EMBLEMES = [
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

const SORTS = [
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
function templatesAbility(wikitexte) {
  const resultats = [];
  const re = /\{\{Ability\b/gi;
  let m;
  while ((m = re.exec(wikitexte)) !== null) {
    const debut = m.index;
    let profondeur = 0;
    let k = debut;
    for (; k < wikitexte.length; k += 1) {
      if (wikitexte[k] === "{" && wikitexte[k + 1] === "{") {
        profondeur += 1;
        k += 1;
      } else if (wikitexte[k] === "}" && wikitexte[k + 1] === "}") {
        profondeur -= 1;
        k += 1;
        if (profondeur === 0) {
          k += 1;
          break;
        }
      }
    }
    resultats.push({ position: debut, corps: wikitexte.slice(debut + 2, k - 2) });
    re.lastIndex = k;
  }
  return resultats;
}

function extraireDePage(wikitexte) {
  // Les competences sont declarees section par section, et chaque section
  // n'en contient qu'une — parfois aucune. On borne donc la recherche entre
  // un titre et le suivant.
  //
  // Prendre simplement les gabarits `{{Ability}}` dans l'ordre du texte
  // donnerait un resultat faux a deux titres : une page mentionne les
  // competences d'autres heros, et une section sans gabarit ferait remonter
  // celui de la section d'apres.
  const evenements = [
    ...[...wikitexte.matchAll(/^=+\s*(.+?)\s*=+\s*$/gm)].map((m) => ({
      position: m.index,
      type: "titre",
      valeur: m[1].trim().toLowerCase(),
    })),
    ...templatesAbility(wikitexte).map(({ position, corps }) => {
      // La description court jusqu'au champ suivant du gabarit. Un nom de
      // champ peut contenir un chiffre (`term-1`), d'ou la classe elargie.
      const description = corps.match(
        /\|?\s*description\s*=\s*([\s\S]+?)(?=\n\s*\|\s*[a-z0-9-]+\s*=|$)/i,
      )?.[1];

      return {
        position,
        type: "competence",
        valeur: sansBalises(corps.match(/\|?\s*name\s*=\s*(.+)/)?.[1] ?? "").trim() || undefined,
        description: description ? nettoyerDescription(description) : null,
        // Le nom du fichier d'icone, souvent distinct du nom affiche : la
        // competence « Contract: Transform » a pour image « Contract Transform »
        // (sans les deux-points, absents des noms de fichier). L'espace apres
        // le « = » est borne a la ligne pour ne pas capturer le champ suivant
        // quand la valeur est vide.
        image: corps.match(/\|\s*image\s*=[ \t]*(.+)/i)?.[1]?.trim() || null,
      };
    }),
  ].sort((a, b) => a.position - b.position);

  const ATTENDUES = ["passive", "skill 1", "skill 2", "ultimate"];
  const parSection = {};

  for (const [i, e] of evenements.entries()) {
    if (e.type !== "titre" || !ATTENDUES.includes(e.valeur)) continue;

    // On avance jusqu'au titre suivant : ce qui se trouve entre les deux
    // appartient a cette section.
    for (const suivant of evenements.slice(i + 1)) {
      if (suivant.type === "titre") break;
      if (suivant.valeur) {
        parSection[e.valeur] = {
          name: suivant.valeur,
          description: suivant.description,
          image: suivant.image ?? null,
        };
        break;
      }
    }
  }

  // On conserve les emplacements vides : la position dans la liste porte le
  // sens (passif, competence 1, competence 2, ultime).
  const competences = ATTENDUES.map((cle) => parSection[cle] ?? null);

  // La galerie « Splash art » liste les illustrations pleine taille de chaque
  // skin, bien plus grandes que les portraits de la boutique.
  const illustrations = extraireIllustrations(wikitexte);

  return { competences, illustrations, histoire: extraireHistoire(wikitexte) };
}

/** Parcourt les pages de heros, par lots, pour en extraire ces deux blocs. */
async function pagesHeros(heros) {
  const sortie = {};

  for (let i = 0; i < heros.length; i += 10) {
    const lot = heros.slice(i, i + 10);

    const donnees = await api({
      action: "query",
      titles: lot.map((h) => h.name).join("|"),
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      redirects: "1",
    });

    const parTitre = new Map(
      Object.values(donnees.query?.pages ?? {})
        .filter((p) => p.revisions)
        .map((p) => [p.title, p.revisions[0].slots.main["*"]]),
    );
    const redirections = new Map(
      (donnees.query?.redirects ?? []).map((r) => [r.from, r.to]),
    );

    for (const h of lot) {
      const texte = parTitre.get(redirections.get(h.name) ?? h.name);
      if (texte) sortie[h.slug] = extraireDePage(texte);
    }

    process.stdout.write(`\r    pages ${Math.min(i + 10, heros.length)}/${heros.length}`);
    await pause(350);
  }

  process.stdout.write("\n");
  return sortie;
}

/**
 * Rangs mesures, dans l'ordre de l'API.
 *
 * `all` agrege toutes les parties ; les autres isolent une tranche du
 * classement, de Epique a Gloire mythique. Taux et matchups changent vraiment
 * d'une tranche a l'autre — le pire adversaire d'Aamon n'est pas le meme en
 * Epique et en Gloire —, d'ou une mesure par rang plutot qu'une seule moyenne.
 */
const RANGS_MESURE = ["all", "epic", "legend", "mythic", "honor", "glory"];

/** Table identifiant de jeu vers slug, depuis le meme endpoint que le reste. */
async function tableHerosParId(heros) {
  // Table identifiant de jeu vers slug, depuis le meme endpoint que le reste.
  const reponse = await fetch(`${STATS}/heroes?size=200`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!reponse.ok) throw new Error(`Table des heros indisponible : HTTP ${reponse.status}`);

  const records = (await reponse.json())?.data?.records ?? [];
  const parId = new Map();
  const connus = new Map(heros.map((h) => [h.slug, h]));
  for (const r of records) {
    const nom = r?.data?.hero?.data?.name;
    const id = r?.data?.hero_id;
    if (nom && id != null) {
      const slug = slugifier(nom);
      if (connus.has(slug)) parId.set(id, slug);
    }
  }
  return parId;
}

/**
 * JSON d'une adresse de l'API, ou null si elle ne repond pas. Une erreur
 * passagere (surcharge, delai) merite deux nouveaux essais, espaces.
 */
async function jsonDe(url, essais = 3) {
  for (let essai = 1; essai <= essais; essai += 1) {
    try {
      const rep = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (rep.ok) return await rep.json();
      if (rep.status === 404) return null;
    } catch {
      // nouvel essai
    }
    if (essai < essais) await pause(1000 * 2 ** essai);
  }
  return null;
}

/**
 * Ecrit evolution.json : series quotidiennes, une ligne par heros pour garder
 * des diffs lisibles. Un heros que l'API n'a pas servi garde ses mesures
 * precedentes, et l'historique se cumule d'une synchronisation a l'autre.
 */
async function ecrireEvolution(complementaires) {
  const existante = await lireJson(`${SORTIE}/evolution.json`);
  const evolution = {
    trends: { ...(existante.trends ?? {}), ...(complementaires?.tendances ?? {}) },
    duration: { ...(existante.duration ?? {}), ...(complementaires?.duree ?? {}) },
    history: fusionnerHistorique(existante.history ?? {}, complementaires?.tendances ?? {}),
  };
  const parLigne = (parCle) => {
    const lignes = Object.entries(parCle).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    return lignes.length > 0 ? `{\n${lignes.join(",\n")}\n  }` : "{}";
  };
  await writeFile(
    `${SORTIE}/evolution.json`,
    `{\n${Object.entries(evolution).map(([k, v]) => `  "${k}": ${parLigne(v)}`).join(",\n")}\n}\n`,
  );
}

/**
 * `--evolution` : ne rafraichit que coequipiers, tendances et durees de
 * partie, sur les heros deja synchronises. De quoi completer ces mesures
 * quand l'API a flanche pendant une synchronisation complete.
 */
async function evolutionSeule() {
  const heros = await lireJson(`${SORTIE}/heros.json`);
  if (!Array.isArray(heros) || heros.length === 0) throw new Error("Lancer d'abord une synchronisation complete.");
  // Les heros encore sans mesure d'abord : une relance comble les trous avant
  // que l'API ne sature.
  const existante = await lireJson(`${SORTIE}/evolution.json`);
  const mesure = (h) => Number(Boolean(existante.trends?.[h.slug]));
  const ordre = [...heros].sort((a, b) => mesure(a) - mesure(b));
  console.log(`Coequipiers et tendances (academie), ${heros.filter((h) => !mesure(h)).length} heros sans mesure…`);
  const complementaires = await coequipiersEtTendances(ordre, await tableHerosParId(heros));
  const stats = await lireJson(`${SORTIE}/statistiques.json`);
  stats.teammates = { ...(stats.teammates ?? {}), ...complementaires.coequipiers };
  await Promise.all([
    writeFile(`${SORTIE}/statistiques.json`, JSON.stringify(stats, null, 2) + "\n"),
    ecrireEvolution(complementaires),
  ]);
  console.log(`  ${Object.keys(complementaires.tendances).length} heros mesures`);
}

/**
 * Combos de competences conseilles par le jeu, par heros : l'API les decrit en
 * anglais et designe chaque competence par son identifiant, que la fiche du
 * heros (`skillsArena`, voir competencesArena) traduit en nom. L'icone locale
 * est reprise quand la competence est reconnue, sinon celle du CDN.
 */
async function combosArena(heros, skillsArena, competencesSite, icones) {
  const sortie = {};
  let muets = 0;
  for (const [i, h] of heros.entries()) {
    const reponse = await jsonDe(`${STATS}/heroes/${encodeURIComponent(h.name)}/skill-combos`);
    const records = reponse?.data?.records;
    muets = reponse ? 0 : muets + 1;
    if (Array.isArray(records)) {
      const combos = combosDuHeros(records, skillsArena[h.slug] ?? [], competencesSite[h.slug] ?? [], icones[h.slug] ?? {});
      if (combos.length > 0) sortie[h.slug] = combos;
    }
    process.stdout.write(`\r    combos ${i + 1}/${heros.length}`);
    // Meme garde-fou que les tendances : une API muette ne reviendra pas d'ici la fin.
    if (muets >= 8) {
      console.warn(`\n    API muette depuis ${muets} heros : arret des combos`);
      break;
    }
    await pause(200);
  }
  process.stdout.write("\n");
  return sortie;
}

/**
 * Ecrit combos.json, une ligne par heros. Un heros que l'API n'a pas servi
 * garde ses combos precedents.
 */
async function ecrireCombos(combos) {
  const tous = { ...(await lireJson(`${SORTIE}/combos.json`)), ...combos };
  const lignes = Object.keys(tous)
    .sort()
    .map((slug) => `  ${JSON.stringify(slug)}: ${JSON.stringify(tous[slug])}`);
  await writeFile(`${SORTIE}/combos.json`, `{\n${lignes.join(",\n")}\n}\n`);
  return Object.keys(tous).length;
}

/**
 * `--combos` : ne relit que les combos, sur les heros, competences et icones
 * deja synchronises. Aucun autre fichier n'est reecrit.
 */
async function combosSeuls() {
  const heros = await lireJson(`${SORTIE}/heros.json`);
  if (!Array.isArray(heros) || heros.length === 0) throw new Error("Lancer d'abord une synchronisation complete.");
  console.log("Fiches des heros (API)…");
  const { competences: skillsArena } = await competencesArena(heros);
  const competencesSite = await lireJson(`${SORTIE}/competences.json`);
  const icones = (await lireJson(`${SORTIE}/visuels.json`)).skills ?? {};
  console.log("Combos de competences (API)…");
  const combos = await combosArena(heros, skillsArena, competencesSite, icones);
  const total = await ecrireCombos(combos);
  console.log(`  ${Object.keys(combos).length} heros relus, ${total} dans combos.json`);
}

/** Fenetre des duos, en jours : la plus large que l'API accepte, pour des paires rares mais mesurees. */
const JOURS_DUOS = 30;
/** Requetes de duos en vol a la fois : au-dela de six, l'API sature et repond en erreur pour tout le monde. */
const EN_VOL_DUOS = 6;

/**
 * Duos de chaque heros, pour chaque rang : les cinq partenaires qui font le
 * plus monter son taux de victoire, les cinq qui le font le plus baisser, et
 * le taux du duo par tranche de duree de partie (`/heroes/{h}/compatibility`).
 *
 * Les six rangs d'un heros partent ensemble, six requetes en vol au plus ;
 * chacune retente deux fois (jsonDe). Une API muette pour huit heros de suite
 * ne reviendra pas d'ici la fin : on garde l'acquis.
 */
async function duosArena(heros, parId) {
  const sortie = {};
  let muets = 0;
  for (const [i, h] of heros.entries()) {
    const nom = encodeURIComponent(h.name);
    const resultats = [];
    for (let k = 0; k < RANGS_MESURE.length; k += EN_VOL_DUOS) {
      const lot = RANGS_MESURE.slice(k, k + EN_VOL_DUOS);
      resultats.push(
        ...(await Promise.all(
          lot.map((rang) => jsonDe(`${STATS}/heroes/${nom}/compatibility?days=${JOURS_DUOS}&rank=${rang}`)),
        )),
      );
    }
    const parRang = {};
    RANGS_MESURE.forEach((rang, j) => {
      const duos = duosDuRang(resultats[j]?.data?.records?.[0]?.data, parId, h.slug);
      if (duos) parRang[rang] = duos;
    });
    if (Object.keys(parRang).length > 0) sortie[h.slug] = parRang;

    muets = resultats.some(Boolean) ? 0 : muets + 1;
    if (muets >= 8) {
      console.warn(`\n    API muette depuis ${muets} heros : arret des duos apres ${i + 1 - muets} heros`);
      break;
    }
    process.stdout.write(`\r    duos ${i + 1}/${heros.length}`);
    await pause(250);
  }
  process.stdout.write("\n");
  return sortie;
}

/**
 * Ecrit duos.json, un heros par ligne. Un heros ou un rang que l'API n'a pas
 * servi garde sa mesure precedente.
 */
async function ecrireDuos(duos) {
  const existants = (await lireJson(`${SORTIE}/duos.json`)).heroes ?? {};
  const tous = fusionnerDuos(existants, duos ?? {});
  await writeFile(`${SORTIE}/duos.json`, serialiserDuos(JOURS_DUOS, tous));
  return Object.keys(tous).length;
}

/**
 * `--duos` : ne relit que les duos, sur les heros deja synchronises. Aucun
 * autre fichier n'est reecrit. Les heros encore sans duo passent d'abord.
 */
async function duosSeuls() {
  const heros = await lireJson(`${SORTIE}/heros.json`);
  if (!Array.isArray(heros) || heros.length === 0) throw new Error("Lancer d'abord une synchronisation complete.");
  const existants = (await lireJson(`${SORTIE}/duos.json`)).heroes ?? {};
  const mesure = (h) => Number(Boolean(existants[h.slug]));
  const ordre = [...heros].sort((a, b) => mesure(a) - mesure(b));
  console.log(`Duos (compatibilite, ${JOURS_DUOS} jours), ${heros.filter((h) => !mesure(h)).length} heros sans mesure…`);
  const duos = await duosArena(ordre, await tableHerosParId(heros));
  const total = await ecrireDuos(duos);
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
async function coequipiersEtTendances(heros, parId) {
  const coequipiers = {};
  const tendances = {};
  const duree = {};

  async function mesuresDuRang(h, rang) {
    const nom = encodeURIComponent(h.name);
    const lane = LANES_API[h.lanes[0]];
    const [equipe, tendance, chrono] = await Promise.all([
      jsonDe(`${STATS}/academy/heroes/${nom}/teammates?rank=${rang}`),
      jsonDe(`${STATS}/academy/heroes/${nom}/trends?days=30&rank=${rang}`),
      lane ? jsonDe(`${STATS}/academy/heroes/${nom}/win-rate/timeline?rank=${rang}&lane=${lane}`) : null,
    ]);

    const partenaires = equipe?.data?.records?.[0]?.data?.sub_hero;
    const meilleurs = (Array.isArray(partenaires) ? partenaires : [])
      .map((a) => ({ slug: parId.get(a.heroid), gain: a.increase_win_rate }))
      .filter((a) => a.slug && a.slug !== h.slug && typeof a.gain === "number")
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 6)
      .map((a) => ({ slug: a.slug, advantage: Math.round(a.gain * 1000) / 10 }));

    const serie = serieQuotidienne(
      (tendance?.data?.records?.[0]?.data?.win_rate ?? [])
        .filter((x) => x?.date && typeof x.win_rate === "number")
        .map((x) => ({
          date: x.date,
          winRate: arrondi(x.win_rate * 100, 1),
          banRate: arrondi(x.ban_rate * 100, 1),
          pickRate: arrondi(x.app_rate * 100, 2),
        })),
    );

    const tranches = (chrono?.data?.records?.[0]?.data?.time_win_rate ?? [])
      .filter((x) => typeof x?.win_rate === "number" && typeof x.time_min === "number")
      .sort((a, b) => a.time_min - b.time_min)
      .map((x) => ({ from: x.time_min, to: x.time_max ?? null, winRate: arrondi(x.win_rate * 100, 1) }));

    return { meilleurs: meilleurs.length > 0 ? meilleurs : null, serie, tranches: tranches.length > 0 ? tranches : null };
  }

  let muets = 0;
  for (const [i, h] of heros.entries()) {
    // Deux rangs a la fois, trois requetes chacun : au-dela, l'API sature et
    // repond en erreur pour tout le monde.
    const resultats = [];
    for (let k = 0; k < RANGS_MESURE.length; k += 2) {
      resultats.push(...(await Promise.all(RANGS_MESURE.slice(k, k + 2).map((rang) => mesuresDuRang(h, rang)))));
    }
    RANGS_MESURE.forEach((rang, j) => {
      const { meilleurs, serie, tranches } = resultats[j];
      if (meilleurs) (coequipiers[h.slug] ??= {})[rang] = meilleurs;
      if (serie) (tendances[h.slug] ??= {})[rang] = serie;
      if (tranches) (duree[h.slug] ??= {})[rang] = tranches;
    });
    // Une API muette pour huit heros de suite ne reviendra pas d'ici la fin :
    // on garde l'acquis plutot que d'attendre chaque delai d'expiration.
    muets = resultats.some((r) => r.meilleurs || r.serie || r.tranches) ? 0 : muets + 1;
    if (muets >= 8) {
      console.warn(`\n    API muette depuis ${muets} heros : arret apres ${i + 1 - muets} heros mesures`);
      break;
    }
    process.stdout.write(`\r    coequipiers et tendances ${i + 1}/${heros.length}`);
    await pause(300);
  }
  process.stdout.write("\n");
  return { coequipiers, tendances, duree };
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
async function contresReels(heros) {
  const parId = await tableHerosParId(heros);

  /** Contres d'un heros dans un rang, ou null si l'API n'a rien pour lui. */
  async function contresDuRang(h, rang) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/counters?rank=${rang}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
      );
      if (!rep.ok) return null;

      const bloc = (await rep.json())?.data?.records?.[0]?.data;
      const adversaires = Array.isArray(bloc?.sub_hero) ? bloc.sub_hero : [];
      if (adversaires.length === 0) return null;

      // On ne retient que les adversaires connus, avec leur variation.
      const notes = adversaires
        .map((a) => ({
          slug: parId.get(a.heroid),
          delta: typeof a.increase_win_rate === "number" ? a.increase_win_rate : 0,
        }))
        .filter((a) => a.slug && a.slug !== h.slug);

      // `increase_win_rate` est la variation du taux de victoire du heros dans
      // ce duel : positive, il gagne davantage → il contre l'adversaire ;
      // negative, il est en difficulte. On trie du plus favorable au moins.
      const parDelta = [...notes].sort((a, b) => b.delta - a.delta);
      const point = (a) => ({ slug: a.slug, advantage: Math.round(a.delta * 1000) / 10 });

      return {
        // avantage positif : le heros est fort contre cette cible.
        strong: parDelta.slice(0, 6).map(point),
        // avantage negatif : le heros est en difficulte.
        weak: parDelta.slice(-6).reverse().map(point),
        winRate: bloc.main_hero_win_rate
          ? Math.round(bloc.main_hero_win_rate * 1000) / 10
          : null,
      };
    } catch {
      /* un rang en echec n'interrompt pas la synchronisation */
      return null;
    }
  }

  const sortie = {};

  for (const [i, h] of heros.entries()) {
    // Les six rangs d'un meme heros partent ensemble : l'API met pres de trois
    // secondes a repondre, en serie la synchronisation durerait une demi-heure.
    const resultats = await Promise.all(RANGS_MESURE.map((rang) => contresDuRang(h, rang)));
    const parRang = {};
    RANGS_MESURE.forEach((rang, j) => {
      if (resultats[j]) parRang[rang] = resultats[j];
    });
    if (Object.keys(parRang).length > 0) sortie[h.slug] = parRang;

    process.stdout.write(`\r    contres ${i + 1}/${heros.length}`);
    await pause(150);
  }

  process.stdout.write("\n");
  return sortie;
}

/** Positions du site vers le parametre `lane` de l'API. */
const LANES_API = { Or: "gold", Experience: "exp", Milieu: "mid", Jungle: "jungle", Roam: "roam" };

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
async function buildsReels(heros) {
  const table = async (chemin) => {
    const rep = await fetch(`${STATS}/academy/${chemin}?size=200`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!rep.ok) throw new Error(`Table ${chemin} indisponible : HTTP ${rep.status}`);
    return ((await rep.json())?.data?.records ?? []).map((r) => r?.data).filter(Boolean);
  };
  const [talents, sorts, equipements] = await Promise.all([
    table("emblems"),
    table("spells"),
    table("equipment"),
  ]);

  const talentParId = new Map(talents.map((t) => [t.giftid, t.emblemskill]));
  const sortParId = new Map(sorts.map((s) => [s.battleskillid, s.__data]));
  const objetParId = new Map(equipements.map((e) => [e.equipid, e.equipname]));
  // Remplis au fil des builds classes : aucune table de l'API ne les donne.
  const emblemeParId = new Map();
  const laneParRoute = new Map();

  // Icones officielles, pour les talents et sorts recents que le wiki n'a pas.
  const icones = { talents: {}, sorts: {} };
  for (const t of talentParId.values()) {
    if (t?.skillname && t.skillicon) icones.talents[t.skillname] = t.skillicon;
  }
  for (const s of sortParId.values()) {
    if (s?.skillname && s.skillicon) icones.sorts[s.skillname] = s.skillicon;
  }

  async function buildsDuRang(h, l, lane, rang) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/builds?rank=${rang}&lane=${lane}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
      );
      if (!rep.ok) return null;

      const donnees = (await rep.json())?.data?.records?.[0]?.data;
      if (donnees?.real_road != null) laneParRoute.set(String(donnees.real_road), l);
      const liste = donnees?.build;
      if (!Array.isArray(liste) || liste.length === 0) return null;
      for (const b of liste) {
        const e = b.emblem?.data;
        if (e?.emblemid && e.emblemname) emblemeParId.set(e.emblemid, e.emblemname);
      }

      return [...liste]
        .sort((a, b) => (b.build_pick_rate ?? 0) - (a.build_pick_rate ?? 0))
        .slice(0, 3)
        .map((b) => ({
          items: (b.equipid ?? []).map((id) => objetParId.get(id)).filter(Boolean),
          emblem: b.emblem?.data?.emblemname ?? null,
          talents: (b.new_rune_skill ?? [])
            .map((id) => talentParId.get(id)?.skillname)
            .filter(Boolean),
          spell: sortParId.get(b.skillid)?.skillname ?? b.battleskill?.data?.__data?.skillname ?? null,
          winRate: arrondir(b.build_win_rate),
          pickRate: arrondir(b.build_pick_rate),
        }));
    } catch {
      /* un rang en echec n'interrompt pas la synchronisation */
      return null;
    }
  }

  /** Guides de joueurs a equipement complet, bruts : les noms se resolvent a la fin. */
  async function guidesDuHeros(h) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/recommended?size=100`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) },
      );
      if (!rep.ok) return [];
      return ((await rep.json())?.data?.records ?? []).flatMap((r) => {
        const d = r?.data?.data;
        const equipement = (d?.equips ?? [])
          .map((e) => e?.equip_ids)
          .find((ids) => Array.isArray(ids) && ids.length === 6);
        if (!equipement) return [];
        const embleme = d?.emblems?.[0];
        return [
          {
            equipement,
            emblemeId: embleme?.emblem_id ?? null,
            talents: Array.isArray(embleme?.emblem_gifts) ? embleme.emblem_gifts : [],
            sortId: d?.spell?.spell_id ?? null,
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

  const sortie = {};
  const guidesBruts = {};

  for (const [i, h] of heros.entries()) {
    const guidesEnCours = guidesDuHeros(h);
    const parLane = {};
    for (const l of h.lanes) {
      const lane = LANES_API[l];
      if (!lane) continue;
      // Comme pour les contres, les six rangs d'une position partent ensemble.
      const resultats = await Promise.all(RANGS_MESURE.map((rang) => buildsDuRang(h, l, lane, rang)));
      const parRang = {};
      RANGS_MESURE.forEach((rang, j) => {
        if (resultats[j]) parRang[rang] = resultats[j];
      });
      if (Object.keys(parRang).length > 0) parLane[l] = parRang;
    }
    if (Object.keys(parLane).length > 0) sortie[h.slug] = parLane;
    guidesBruts[h.slug] = await guidesEnCours;

    process.stdout.write(`\r    builds ${i + 1}/${heros.length}`);
    await pause(150);
  }

  process.stdout.write("\n");

  const guides = {};
  for (const h of heros) {
    const liste = (guidesBruts[h.slug] ?? []).map((g) => ({ ...g, lane: laneParRoute.get(g.route) ?? null }));
    const parLane = {};
    for (const l of h.lanes) {
      // Un guide sans position reconnue ne vaut que pour un heros a position unique.
      // Seuls comptent les guides dont les six objets se reconnaissent.
      const candidats = liste.filter(
        (g) =>
          (g.lane === l || (g.lane === null && h.lanes.length === 1)) &&
          g.equipement.every((id) => objetParId.has(id)),
      );
      const parRang = {};
      for (const rang of RANGS_MESURE) {
        const meilleur = choisirGuide(candidats, rang);
        if (!meilleur) continue;
        parRang[rang] = {
          items: meilleur.equipement.map((id) => objetParId.get(id)).filter(Boolean),
          emblem: emblemeParId.get(meilleur.emblemeId) ?? null,
          talents: meilleur.talents.map((id) => talentParId.get(id)?.skillname).filter(Boolean),
          spell: sortParId.get(meilleur.sortId)?.skillname ?? null,
          authorRank: meilleur.authorRank,
          votes: meilleur.votes,
          views: meilleur.views,
        };
      }
      if (Object.keys(parRang).length > 0) parLane[l] = parRang;
    }
    if (Object.keys(parLane).length > 0) guides[h.slug] = parLane;
  }

  return { builds: sortie, guides, icones };
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
async function classement(heros) {
  const connus = new Set(heros.map((h) => h.slug));

  async function tauxDuRang(rang) {
    const reponse = await fetch(`${STATS}/heroes/rank?size=200&rank=${rang}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!reponse.ok) throw new Error(`Statistiques indisponibles (${rang}) : HTTP ${reponse.status}`);

    const enregistrements = (await reponse.json())?.data?.records ?? [];
    const taux = {};
    const orphelins = [];

    for (const entree of enregistrements) {
      const d = entree?.data;
      const nom = d?.main_hero?.data?.name;
      if (!nom) continue;

      const cle = slugifier(nom);
      if (!connus.has(cle)) {
        orphelins.push(nom);
        continue;
      }

      taux[cle] = {
        winRate: arrondir(d.main_hero_win_rate),
        banRate: arrondir(d.main_hero_ban_rate),
        pickRate: arrondir(d.main_hero_appearance_rate),
      };
    }
    return { taux, orphelins };
  }

  // Six requetes seulement : elles partent ensemble.
  const resultats = await Promise.allSettled(RANGS_MESURE.map(tauxDuRang));

  // Sans la mesure tous rangs, la tier list n'a plus de base : on echoue, et
  // l'appelant conserve le classement precedent. Un autre rang manquant est
  // simplement omis.
  if (resultats[0].status === "rejected") throw resultats[0].reason;
  const { orphelins } = resultats[0].value;
  if (orphelins.length) console.log(`  sans correspondance : ${orphelins.join(", ")}`);

  const parRang = {};
  RANGS_MESURE.forEach((rang, i) => {
    if (resultats[i].status === "fulfilled") parRang[rang] = resultats[i].value.taux;
  });
  return parRang;
}

/**
 * Relations entre heros : contres et synergies.
 *
 * L'API expose, pour chaque heros, ceux contre lesquels il est fort, ceux qui
 * le mettent en difficulte, et ceux avec qui il se combine. Ses identifiants
 * ne sont pas ceux du wiki : le rapprochement se fait par nom.
 */
async function relations(heros) {
  const parSlug = new Map(heros.map((h) => [h.slug, h]));

  const reponse = await fetch(`${STATS}/heroes?size=200`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!reponse.ok) throw new Error(`Relations indisponibles : HTTP ${reponse.status}`);

  const enregistrements = (await reponse.json())?.data?.records ?? [];

  // Table identifiant de l'API vers slug du site, construite depuis les noms.
  const parIdentifiant = new Map();
  for (const entree of enregistrements) {
    const nom = entree?.data?.hero?.data?.name;
    const identifiant = entree?.data?.hero_id;
    if (!nom || identifiant == null) continue;
    const slug = slugifier(nom);
    if (parSlug.has(slug)) parIdentifiant.set(identifiant, slug);
  }

  const sortie = {};
  for (const entree of enregistrements) {
    const slug = parIdentifiant.get(entree?.data?.hero_id);
    if (!slug) continue;

    const lire = (cle) =>
      (entree.data.relation?.[cle]?.target_hero_id ?? [])
        .map((id) => parIdentifiant.get(id))
        .filter(Boolean);

    sortie[slug] = {
      strongAgainst: lire("strong"),
      weakAgainst: lire("weak"),
      synergies: lire("assist"),
    };
  }

  return sortie;
}

/** Les taux arrivent en fraction ; on les stocke en pourcentage a deux decimales. */
const arrondir = (v) => (typeof v === "number" ? Math.round(v * 10000) / 100 : null);

// ─────────────────────────────────────────────────────────────
// Patchs
// ─────────────────────────────────────────────────────────────

async function patchs() {
  const membres = [];
  let suite;

  do {
    const donnees = await api({
      action: "query",
      list: "categorymembers",
      cmtitle: "Category:Patch Notes",
      cmlimit: "500",
      ...(suite ? { cmcontinue: suite } : {}),
    });
    membres.push(...(donnees.query?.categorymembers ?? []));
    suite = donnees.continue?.cmcontinue;
  } while (suite);

  // Some official notes are missing from the category (2.1.90 was): pages
  // whose title starts with "Patch Notes " fill the gap. Duplicates merge by
  // version below.
  do {
    const donnees = await api({
      action: "query",
      list: "allpages",
      apprefix: "Patch Notes ",
      apfilterredir: "nonredirects",
      aplimit: "500",
      ...(suite ? { apcontinue: suite } : {}),
    });
    membres.push(...(donnees.query?.allpages ?? []));
    suite = donnees.continue?.apcontinue;
  } while (suite);

  /**
   * Le wiki publie plusieurs pages pour une meme version : les notes
   * officielles, celles du serveur de test (« Advanced Server »), et parfois
   * un ajustement d'equilibrage separe. On ne garde que la plus autoritaire —
   * afficher trois fois « 1.8.30 » n'apprendrait rien a personne.
   */
  const rang = (titre) => {
    if (/advanced server/i.test(titre)) return 2;
    if (/balance adjustment/i.test(titre)) return 1;
    return 0;
  };

  const parVersion = new Map();

  for (const m of membres) {
    const version = m.title.match(/(\d+\.\d+\.\d+)/)?.[1];
    if (!version) continue;

    const candidat = {
      version,
      title: m.title,
      link: `https://mobilelegends.fandom.com/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`,
    };

    const existant = parVersion.get(version);
    if (!existant || rang(candidat.title) < rang(existant.title)) {
      parVersion.set(version, candidat);
    }
  }

  return [...parVersion.values()].sort((a, b) => comparerVersions(b.version, a.version));
}

/**
 * Date de chaque patch detaille : la premiere revision de sa page sur le wiki,
 * creee le jour de la sortie ou a quelques jours pres. Elle place les patchs
 * sur les courbes de taux.
 */
async function daterPatchs(detail) {
  for (const patch of Object.values(detail)) {
    try {
      const donnees = await api({
        action: "query",
        prop: "revisions",
        titles: patch.title,
        rvprop: "timestamp",
        rvdir: "newer",
        rvlimit: "1",
      });
      const page = Object.values(donnees.query?.pages ?? {})[0];
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
async function contenuPatchs(liste) {
  const contenus = {};

  for (const [i, patch] of liste.slice(0, PATCHS_DETAILLES).entries()) {
    try {
      const donnees = await api({
        action: "parse",
        page: patch.title,
        prop: "text",
        disabletoc: "1",
        formatversion: "2",
      });

      const brut = donnees.parse?.text;
      if (!brut) continue;

      // Deux lectures complementaires : le rendu HTML pour les sections libres
      // (mot des concepteurs, terrain), et le wikitexte pour extraire les
      // ajustements de heros en donnees structurees — heros, type, diffs.
      let ajustements = [];
      try {
        const wt = await api({
          action: "parse",
          page: patch.title,
          prop: "wikitext",
          formatversion: "2",
        });
        const wikitexte = wt.parse?.wikitext;
        if (wikitexte) ajustements = ajustementsHeros(wikitexte);
      } catch {
        // Sans le wikitexte, on garde au moins le rendu HTML.
      }

      const { html } = nettoyerRendu(brut, patch.link);

      // Le corps est decoupe en sections : la page en rend certaines telles
      // quelles et en remplace d'autres — nouveaux heros, ajustements — par un
      // composant riche. On extrait la presentation des nouveaux heros et on
      // vide le HTML des sections reprises par un composant, inutile a garder.
      const sections = decouperSections(html);
      let nouveaux = [];
      const sectionsRendues = sections.map((s) => {
        const t = (s.title ?? "").toLowerCase();
        if (/hero adjustments/.test(t)) return { ...s, html: "", role: "ajustements" };
        if (/new hero/.test(t)) {
          nouveaux = nouveauxHeros(s.html).map((h) => ({ ...h, slug: slugifier(h.name) }));
          return { ...s, html: "", role: "nouveaux" };
        }
        return { ...s, role: null };
      });

      contenus[patch.version] = {
        version: patch.version,
        title: patch.title,
        link: patch.link,
        toc: sommaire(html),
        sections: sectionsRendues,
        newHeroes: nouveaux,
        // Ajustements de heros ramenes a des slugs, pour lier aux fiches.
        adjustments: ajustements.map((a) => ({ ...a, slug: slugifier(a.name) })),
        balance: bilan(ajustements),
      };
    } catch {
      // Une page illisible ne doit pas interrompre la synchronisation.
    }

    process.stdout.write(`\r    patchs ${i + 1}/${Math.min(PATCHS_DETAILLES, liste.length)}`);
    await pause(400);
  }

  process.stdout.write("\n");
  return contenus;
}

/** Trie 1.9.40 apres 1.9.9, ce qu'un tri alphabetique ne fait pas. */
function comparerVersions(a, b) {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** Lit un JSON deja genere, ou un objet vide s'il n'existe pas encore. */
async function lireJson(chemin) {
  try {
    return JSON.parse(await readFile(chemin, "utf8"));
  } catch {
    return {};
  }
}

/** Nettoie une description de competence renvoyee par l'API (balises, sauts). */
function nettoyerSkillDesc(brut) {
  return sansBalises(String(brut ?? "").replace(/<br\s*\/?>/gi, " "))
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
async function competencesArena(heros) {
  const sortie = {};
  // L'API expose aussi une accroche d'une ligne (« story ») : on la recolte
  // au passage, sans interrogation supplementaire.
  const accroches = {};

  for (const [i, h] of heros.entries()) {
    try {
      const rep = await fetch(`${STATS}/heroes/${encodeURIComponent(h.name)}?lang=en`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (rep.ok) {
        const data = (await rep.json())?.data?.records?.[0]?.data?.hero?.data;
        const skills = (data?.heroskilllist ?? []).flatMap((g) => g.skilllist ?? []);
        if (skills.length > 0) {
          sortie[h.slug] = skills.map((s) => ({
            // Identifiant de jeu : c'est par lui que les combos designent la competence.
            id: s.skillid ?? null,
            name: String(s.skillname ?? "").trim(),
            description: nettoyerSkillDesc(s.skilldesc) || null,
            icon: s.skillicon ? String(s.skillicon) : null,
          }));
        }
        const accroche = String(data?.story ?? "").trim();
        if (accroche) accroches[h.slug] = accroche;
      }
    } catch {
      // Un heros en echec ne doit pas interrompre la synchronisation.
    }

    process.stdout.write(`\r    competences arena ${i + 1}/${heros.length}`);
    await pause(200);
  }

  process.stdout.write("\n");
  return { competences: sortie, accroches };
}

/**
 * Modes de jeu, depuis le wiki.
 *
 * La page « Game Modes » liste les modes de combat officiels dans une galerie ;
 * chaque mode a sa propre page, dont on tire le paragraphe de presentation et
 * l'image. L'API communautaire ne couvre pas les modes : le wiki est la seule
 * source structuree.
 */
async function modesDeJeu() {
  const galerie = await api({
    action: "parse",
    page: "Game Modes",
    prop: "wikitext",
    formatversion: "2",
  });
  const wt = galerie.parse?.wikitext ?? "";
  const entrees = [...wt.matchAll(/File:([^|]+)\|link=([^|]+)\|\[\[([^\]]+)\]\]/gi)].map((m) => ({
    fichier: m[1].trim(),
    page: m[2].trim().replace(/_/g, " "),
    nom: m[3].trim(),
  }));
  if (entrees.length === 0) return [];

  // Images : une seule requete pour tous les fichiers de la galerie.
  const donneesImg = await api({
    action: "query",
    titles: entrees.map((e) => `File:${e.fichier}`).join("|"),
    prop: "imageinfo",
    iiprop: "url",
  });
  const parFichier = new Map(
    Object.values(donneesImg.query?.pages ?? {})
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
  const contenu = async (titre) => {
    try {
      const rep = await api({
        action: "query",
        titles: titre,
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
      const description = nettoyerLore(intro).find((p) => p.length > 40) ?? null;

      const sections = sectionsPage(wt, SECTIONS_IGNOREES);
      return { description, sections };
    } catch {
      return null;
    }
  };

  const modes = [];
  for (const e of entrees) {
    // Le lien de la galerie et le libelle affiche different parfois
    // (« Arcade » vs « Arcade Mode ») : on tente les deux.
    const c = (await contenu(e.page)) ?? (await contenu(e.nom));

    modes.push({
      name: e.nom,
      slug: slugifier(e.nom),
      description: c?.description ?? null,
      sections: c?.sections ?? [],
      image: parFichier.get(e.fichier) ?? null,
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
async function rangs() {
  const FICHIERS = {
    guerrier: "Warrior.png",
    elite: "Elite.png",
    maitre: "Master.png",
    "grand-maitre": "Grandmaster.png",
    epique: "Epic.png",
    legende: "Legend.png",
    mythique: "Mythic.png",
    "mythique-honneur": "Mythical_Honor.png",
    "mythique-gloire": "Mythical_Glory.png",
    "mythique-immortel": "Mythical_Immortal.png",
  };

  const donnees = await api({
    action: "query",
    titles: Object.values(FICHIERS)
      .map((f) => `File:${f}`)
      .join("|"),
    prop: "imageinfo",
    iiprop: "url",
  });

  const parNom = new Map(
    Object.values(donnees.query?.pages ?? {})
      .filter((p) => p.imageinfo)
      .map((p) => [
        p.title.replace(/^File:/, "").replace(/ /g, "_"),
        p.imageinfo[0].url.split("/revision")[0],
      ]),
  );

  const images = {};
  for (const [cle, fichier] of Object.entries(FICHIERS)) {
    const url = parNom.get(fichier);
    if (url) images[cle] = url;
  }
  return { images };
}

/**
 * Portraits des monstres de l'entraineur de Chatiment : l'image principale de
 * leur page du wiki. Le Seigneur de 12 minutes reprend celui de 8 minutes.
 */
async function monstres() {
  const PAGES = { seigneur: "Lord", tortue: "Turtle", "buff-violet": "Thunder Fenrir", "buff-orange": "Molten Fiend" };
  const donnees = await api({
    action: "query",
    titles: Object.values(PAGES).join("|"),
    prop: "pageimages",
    piprop: "original",
  });
  const parTitre = new Map(
    Object.values(donnees.query?.pages ?? {})
      .filter((p) => p.original)
      .map((p) => [p.title, p.original.source.split("/revision")[0]]),
  );
  const images = {};
  for (const [cle, titre] of Object.entries(PAGES)) {
    const url = parTitre.get(titre);
    if (url) images[cle] = url;
  }
  return images;
}

// ─────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────

async function principal() {
  await mkdir(SORTIE, { recursive: true });

  console.log("Lecture des modules du wiki…");
  const [brutHeros, brutSkins, brutObjets] = await Promise.all([
    moduleLua("Module:Hero/data"),
    moduleLua("Module:Skin/data"),
    moduleLua("Module:Equipment/data"),
  ]);

  const heros = normaliserHeros(brutHeros);
  const skins = normaliserSkins(brutSkins);
  const objets = normaliserObjets(brutObjets);

  const nbSkins = Object.values(skins).reduce((n, s) => n + s.length, 0);
  console.log(`  ${heros.length} heros, ${nbSkins} skins, ${objets.length} objets`);

  console.log("Lecture des pages de heros…");
  const pages = await pagesHeros(heros);
  const nbCompetences = Object.values(pages).reduce(
    (n, p) => n + p.competences.filter(Boolean).length,
    0,
  );
  const nbDescriptions = Object.values(pages).reduce(
    (n, p) => n + p.competences.filter((c) => c?.description).length,
    0,
  );
  const nbIllustrations = Object.values(pages).reduce((n, p) => n + p.illustrations.length, 0);
  console.log(
    `  ${nbCompetences} competences (${nbDescriptions} decrites), ${nbIllustrations} illustrations`,
  );

  console.log("Competences en repli (API)…");
  const { competences: skillsArena, accroches } = await competencesArena(heros);
  console.log(`  ${Object.keys(skillsArena).length} heros couverts par l'API`);

  // Fusion wiki + API : le wiki prime, l'API comble nom, description et icone
  // manquants. Les deux listes suivent le meme ordre (passif → ultime). En
  // dernier recours, on garde ce qui avait deja ete complete : une panne de
  // l'API ne doit pas effacer un enrichissement obtenu lors d'un passage
  // precedent.
  const competencesExistantes = await lireJson(`${SORTIE}/competences.json`);
  const competencesFinales = {};
  for (const h of heros) {
    const wiki = pages[h.slug]?.competences ?? [];
    const arena = skillsArena[h.slug] ?? [];
    const ancien = competencesExistantes[h.slug] ?? [];
    const n = Math.max(wiki.length, arena.length, ancien.length);
    if (n === 0) continue;

    const liste = [];
    for (let i = 0; i < n; i += 1) {
      const nom = wiki[i]?.name ?? arena[i]?.name ?? ancien[i]?.name ?? null;
      const description =
        wiki[i]?.description ?? arena[i]?.description ?? ancien[i]?.description ?? null;
      liste.push(nom || description ? { name: nom, description } : null);
    }
    competencesFinales[h.slug] = liste;
  }

  // ── Histoire des heros ─────────────────────────────────────────────
  // Deux apports complementaires : l'accroche d'une ligne de l'API et le
  // recit long du wiki (lore, fiche narrative, anecdotes). On n'inscrit un
  // heros que s'il apporte au moins l'un des deux.
  const histoires = {};
  for (const h of heros) {
    const recit = pages[h.slug]?.histoire ?? null;
    const accroche = accroches[h.slug] ?? null;
    if (!recit && !accroche) continue;
    histoires[h.slug] = {
      tagline: accroche,
      lore: recit?.lore ?? [],
      profile: recit?.fiche ?? null,
      trivia: recit?.anecdotes ?? [],
    };
  }
  console.log(`  ${Object.keys(histoires).length} histoires de heros`);

  console.log("Classement des heros…");
  let stats = {};
  try {
    stats = await classement(heros);
    console.log(`  ${Object.keys(stats.all).length} heros mesures, ${Object.keys(stats).length} rangs`);
  } catch (erreur) {
    // Une source de statistiques indisponible ne doit pas faire echouer toute
    // la synchronisation : le site retombe sur le classement precedent.
    console.warn(`  statistiques indisponibles (${erreur.message}) — classement inchange`);
    stats = null;
  }

  console.log("Contres reels (academie)…");
  let contres = null;
  try {
    contres = await contresReels(heros);
    console.log(`  ${Object.keys(contres).length} heros avec contres chiffres`);
  } catch (erreur) {
    console.warn(`  contres indisponibles (${erreur.message}) — inchanges`);
  }

  console.log("Builds joues (academie)…");
  let builds = null;
  let guides = null;
  let iconesBuilds = { talents: {}, sorts: {} };
  try {
    ({ builds, guides, icones: iconesBuilds } = await buildsReels(heros));
    console.log(`  ${Object.keys(builds).length} heros avec builds, ${Object.keys(guides).length} avec un guide complet`);
  } catch (erreur) {
    console.warn(`  builds indisponibles (${erreur.message}) — inchanges`);
  }

  console.log("Coequipiers et tendances (academie)…");
  let complementaires = null;
  try {
    complementaires = await coequipiersEtTendances(heros, await tableHerosParId(heros));
    console.log(
      `  ${Object.keys(complementaires.coequipiers).length} heros avec coequipiers, ${Object.keys(complementaires.tendances).length} avec tendance`,
    );
  } catch (erreur) {
    console.warn(`  coequipiers et tendances indisponibles (${erreur.message}) — inchanges`);
  }

  console.log("Duos (compatibilite)…");
  let duos = null;
  try {
    duos = await duosArena(heros, await tableHerosParId(heros));
    console.log(`  ${Object.keys(duos).length} heros avec duos`);
  } catch (erreur) {
    console.warn(`  duos indisponibles (${erreur.message}) — inchanges`);
  }

  console.log("Relations entre heros…");
  let liens = null;
  try {
    liens = await relations(heros);
    const n = Object.values(liens).reduce((t, r) => t + r.strongAgainst.length, 0);
    console.log(`  ${Object.keys(liens).length} heros, ${n} relations de contre`);
  } catch (erreur) {
    console.warn(`  relations indisponibles (${erreur.message}) — inchangees`);
  }

  console.log("Liste des patchs…");
  const listePatchs = await patchs();
  console.log(`  ${listePatchs.length} patchs`);

  console.log("Contenu des patchs recents…");
  const detailPatchs = await contenuPatchs(listePatchs);
  await daterPatchs(detailPatchs);
  console.log(`  ${Object.keys(detailPatchs).length} patchs detailles`);

  console.log("Emblemes des rangs…");
  const emblemesRangs = await rangs();
  console.log(`  ${Object.keys(emblemesRangs.images).length} emblemes`);

  console.log("Modes de jeu…");
  const modes = await modesDeJeu();
  console.log(`  ${modes.length} modes (${modes.filter((m) => m.description).length} decrits)`);

  console.log("Resolution des visuels…");
  const identifiants = [
    ...heros.map((h) => h.id),
    ...Object.values(skins).flat().map((s) => s.id),
  ];
  // Deux formats : le portrait vertical pour les fiches et les galeries,
  // l'icone carree pour les listes compactes.
  const portraits = await urlsImages(identifiants, "portrait");
  const icones = await urlsImages(heros.map((h) => h.id), "icon");
  console.log(`  ${Object.keys(portraits).length} portraits, ${Object.keys(icones).length} icones`);

  const { plan, chemins } = planVisuels(heros, skins, portraits, icones);

  // Emblemes de rang copies en local, comme le reste : aucune image servie
  // depuis un hote externe a l'execution.
  for (const [cle, url] of Object.entries(emblemesRangs.images)) {
    if (!url || url.startsWith("/")) continue;
    plan.push({
      url,
      chemin: `public/visuels/rangs/${cle}.webp`,
      optimiser: true,
      largeur: 160,
    });
    emblemesRangs.images[cle] = `/visuels/rangs/${cle}.webp`;
  }

  // Portraits des monstres de l'entraineur de Chatiment, a la meme enseigne.
  for (const [cle, url] of Object.entries(await monstres())) {
    plan.push({ url, chemin: `public/visuels/monstres/${cle}.webp`, optimiser: true, largeur: 320 });
  }

  // ── Visuels des modes ──────────────────────────────────────────────
  // Comme le reste, l'image d'un mode est copiee en local : le site ne doit
  // dependre d'aucune URL externe a l'execution. On planifie le telechargement
  // et on remplace l'URL du wiki par le chemin local dans `modes.json`.
  for (const mode of modes) {
    if (!mode.image || mode.image.startsWith("/")) continue;
    plan.push({
      url: mode.image,
      chemin: `public/visuels/modes/${mode.slug}.webp`,
      optimiser: true,
      largeur: 640,
    });
    mode.image = `/visuels/modes/${mode.slug}.webp`;
  }

  // ── Icones de competences ──────────────────────────────────────────
  // Le fichier d'icone porte le nom du champ « image » du gabarit quand il
  // existe, souvent distinct du nom affiche (« Contract Transform » pour la
  // competence « Contract: Transform ») ; sinon on retombe sur le nom.
  const fichierIcone = (slug, i, nom) => pages[slug]?.competences?.[i]?.image ?? nom;
  const nomsCompetences = [
    ...new Set(
      Object.entries(competencesFinales).flatMap(([slug, cs]) =>
        cs.map((c, i) => (c?.name ? fichierIcone(slug, i, c.name) : null)).filter(Boolean),
      ),
    ),
  ];
  const urlsCompetences = await urlsFichiers(nomsCompetences);

  // Icones deja resolues : dernier recours si ni le wiki ni l'API ne repondent.
  const visuelsExistants = (await lireJson(`${SORTIE}/visuels.json`)).skills ?? {};

  let iconesArena = 0;
  const visuelsCompetences = {};
  for (const [slug, comps] of Object.entries(competencesFinales)) {
    const arena = skillsArena[slug] ?? [];
    const icones = {};
    comps.forEach((competence, i) => {
      const nom = competence?.name;
      if (!nom) return;
      const urlWiki = urlsCompetences[fichierIcone(slug, i, nom)];
      if (urlWiki) {
        const fichier = `${slugifier(nom)}.webp`;
        icones[nom] = `/visuels/competences/${fichier}`;
        plan.push({
          url: urlWiki,
          chemin: `public/visuels/competences/${fichier}`,
          optimiser: true,
          largeur: 128,
        });
      } else if (arena[i]?.icon) {
        // Repli : l'icone officielle du CDN de l'API, copiee en local comme le
        // reste — le site ne sert aucune image depuis un hote externe.
        const fichier = `${slugifier(nom)}.webp`;
        icones[nom] = `/visuels/competences/${fichier}`;
        plan.push({
          url: arena[i].icon,
          chemin: `public/visuels/competences/${fichier}`,
          optimiser: true,
          largeur: 128,
        });
        iconesArena += 1;
      } else if (visuelsExistants[slug]?.[nom]) {
        // Ni wiki ni API : on conserve l'icone deja resolue precedemment.
        icones[nom] = visuelsExistants[slug][nom];
      }
    });
    if (Object.keys(icones).length) visuelsCompetences[slug] = icones;
  }
  console.log(
    `  ${Object.keys(urlsCompetences).length}/${nomsCompetences.length} icones du wiki` +
      (iconesArena ? `, ${iconesArena} completees par l'API` : ""),
  );

  // ── Combos de competences ──────────────────────────────────────────
  // Apres les icones : un combo reprend l'icone locale de chaque competence
  // reconnue.
  console.log("Combos de competences (API)…");
  const combos = await combosArena(heros, skillsArena, competencesFinales, visuelsCompetences);
  console.log(`  ${Object.keys(combos).length} heros avec combos`);

  // ── Illustrations pleine taille ────────────────────────────────────
  const nomsIllustrations = [
    ...new Set(Object.values(pages).flatMap((p) => p.illustrations.map((i) => i.fichier))),
  ];
  // Les illustrations sont en .jpg comme en .png : on interroge les deux.
  const [enJpg, enPng] = await Promise.all([
    urlsFichiers(
      nomsIllustrations.filter((f) => f.endsWith(".jpg")).map((f) => f.replace(/\.jpg$/, "")),
      "jpg",
    ),
    urlsFichiers(
      nomsIllustrations.filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, "")),
      "png",
    ),
  ]);
  const urlsIllustrations = { ...enJpg, ...enPng };

  const illustrations = {};
  for (const [slug, page] of Object.entries(pages)) {
    const parSkin = {};
    // L'illustration est rangee sous le nom du module de donnees, celui que la
    // fiche utilise pour la retrouver, des que la legende le reconnait.
    const nomsModule = new Map(
      (skins[slug] ?? []).map((s) => [normaliserNomSkin(s.name), s.name]),
    );
    for (const { fichier, skin } of page.illustrations) {
      const cle = fichier.replace(/\.(jpg|png)$/, "");
      const url = urlsIllustrations[cle];
      if (!url || !skin) continue;
      const nomSkin = nomsModule.get(normaliserNomSkin(skin)) ?? skin;
      // Premiere illustration retenue : les suivantes sont d'anciens visuels.
      if (parSkin[nomSkin]) continue;
      const nomFichier = `${slugifier(nomSkin)}.webp`;
      parSkin[nomSkin] = `/visuels/heros/${slug}/illustrations/${nomFichier}`;
      plan.push({
        url,
        chemin: `public/visuels/heros/${slug}/illustrations/${nomFichier}`,
        optimiser: true,
      });
    }
    if (Object.keys(parSkin).length) illustrations[slug] = parSkin;
  }
  console.log(
    `  ${Object.keys(urlsIllustrations).length}/${nomsIllustrations.length} illustrations pleine taille`,
  );

  console.log("Resolution des objets, emblemes, talents et sorts…");
  const [urlsObjets, urlsEmblemes, urlsTalents, urlsSorts] = await Promise.all([
    urlsFichiers(objets.map((o) => o.name)),
    urlsFichiers(EMBLEMES),
    urlsFichiers(TALENTS),
    urlsFichiers(SORTS),
  ]);

  const lots = [
    planFichiers(urlsObjets, "objets"),
    planFichiers(urlsEmblemes, "emblemes"),
    planFichiers(urlsTalents, "talents"),
    planFichiers(urlsSorts, "sorts"),
  ];
  plan.push(...lots.flatMap((l) => l.plan));

  const [visuelsObjets, visuelsEmblemes, visuelsTalents, visuelsSorts] =
    lots.map((l) => l.chemins);

  // Talents et sorts recents absents du wiki (Rupture, War Cry, Flameshot…) :
  // l'icone officielle de l'API les complete, copiee en local comme le reste.
  // Sans --images, on ne reference que ce qui est deja sur le disque.
  for (const [type, icones, cible] of [
    ["talents", iconesBuilds.talents, visuelsTalents],
    ["sorts", iconesBuilds.sorts, visuelsSorts],
  ]) {
    for (const [nom, url] of Object.entries(icones)) {
      const cle = slugifier(nom);
      if (cible[cle]) continue;
      const chemin = `/visuels/${type}/${cle}.png`;
      plan.push({ url, chemin: `public${chemin}` });
      if (AVEC_IMAGES || existsSync(`public${chemin}`)) cible[cle] = chemin;
    }
  }

  console.log(
    `  ${Object.keys(visuelsObjets).length}/${objets.length} objets, ` +
      `${Object.keys(visuelsEmblemes).length} emblemes, ` +
      `${Object.keys(visuelsTalents).length} talents, ` +
      `${Object.keys(visuelsSorts).length} sorts`,
  );

  if (AVEC_IMAGES) {
    console.log(`Telechargement de ${plan.length} visuels…`);
    let ok = 0;
    let deja = 0;
    let echecs = 0;

    // Par petits paquets : assez rapide, sans saturer le wiki.
    for (let i = 0; i < plan.length; i += 8) {
      const resultats = await Promise.all(
        plan.slice(i, i + 8).map((v) => telecharger(v.url, v.chemin, v.optimiser, v.largeur)),
      );
      ok += resultats.filter((r) => r === "ok").length;
      deja += resultats.filter((r) => r === "deja").length;
      echecs += resultats.filter((r) => r === "echec").length;
      process.stdout.write(`\r    ${Math.min(i + 8, plan.length)}/${plan.length}`);
    }
    console.log(`\n  ${ok} telecharges, ${deja} deja presents, ${echecs} echecs`);
  } else {
    console.log("  (relancer avec --images pour telecharger les visuels)");
  }

  const ecrire = (nom, donnees) =>
    writeFile(`${SORTIE}/${nom}.json`, JSON.stringify(donnees, null, 2) + "\n");

  // Les mesures (classement, contres, synergies) sont regroupees dans un seul
  // fichier. Chacune a sa propre disponibilite : quand une source ne repond
  // pas, on conserve la valeur precedente plutot que de l'effacer. Le
  // classement garde en plus sa date, car il ne se rafraichit pas au meme
  // rythme que le reste.
  const statsExistantes = await lireJson(`${SORTIE}/statistiques.json`);
  const statistiques = {
    rankings: stats
      ? { measuredAt: new Date().toISOString(), rates: stats.all, byRank: stats }
      : (statsExistantes.rankings ?? { measuredAt: null, rates: {} }),
    counters: contres ?? statsExistantes.counters ?? {},
    builds: builds ?? statsExistantes.builds ?? {},
    guides: guides ?? statsExistantes.guides ?? {},
    // Par heros : celui que l'API n'a pas servi garde ses coequipiers.
    teammates: { ...(statsExistantes.teammates ?? {}), ...(complementaires?.coequipiers ?? {}) },
    relations: liens ?? statsExistantes.relations ?? {},
  };

  // Table nom-par-slug, embarquee cote client sans le reste du catalogue.
  const noms = Object.fromEntries(heros.map((h) => [h.slug, h.name]));

  await Promise.all([
    // Catalogue
    ecrire("heros", heros),
    ecrire("skins", skins),
    ecrire("objets", objets),
    ecrire("competences", competencesFinales),
    ecrire("modes", modes),
    ecrire("histoires", histoires),
    ecrire("rangs", emblemesRangs),
    ecrire("noms", noms),
    ecrireEvolution(complementaires),
    ecrireCombos(combos),
    ecrireDuos(duos),
    // Tous les chemins de visuels, regroupes
    ecrire("visuels", {
      heroes: chemins,
      illustrations,
      skills: visuelsCompetences,
      items: visuelsObjets,
      emblems: visuelsEmblemes,
      talents: visuelsTalents,
      spells: visuelsSorts,
    }),
    // Mesures et patchs, regroupes
    ecrire("statistiques", statistiques),
    ecrire("patchs", { list: listePatchs, details: detailPatchs }),
    // Metadonnees de la synchronisation
    ecrire("synchro", {
      date: new Date().toISOString(),
      source: "https://mobilelegends.fandom.com",
      heroes: heros.length,
      skins: nbSkins,
      items: objets.length,
      patches: listePatchs.length,
      rankings: stats ? Object.keys(stats.all).length : null,
      counters: contres ? Object.keys(contres).length : null,
      builds: builds ? Object.keys(builds).length : null,
      // Le wiki fournit le catalogue ; l'API communautaire fournit les mesures.
      sources: [
        "https://mobilelegends.fandom.com",
        "https://arena.rone.dev",
      ],
    }),
  ]);

  console.log(`\nEcrit dans ${SORTIE}/`);
}

await (process.argv.includes("--evolution")
  ? evolutionSeule()
  : process.argv.includes("--combos")
    ? combosSeuls()
    : process.argv.includes("--duos")
      ? duosSeuls()
      : principal());

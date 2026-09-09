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
 * Le resultat est ecrit dans `src/data/genere/`. Les visuels vont dans
 * `public/visuels/`, qui n'est pas versionne : ce sont des ressources de
 * Moonton, que ce depot ne redistribue pas. Le Dockerfile relance donc la
 * synchronisation au build.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { analyserTableLua } from "./lua.mjs";
import { nettoyerRendu, sommaire } from "./patch-notes.mjs";

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
const UA = "MLBB-sync/1.0 (https://mlbb.leoderoin.fr; contact via github.com/achedon12)";
const SORTIE = "src/data/genere";

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
      nom: String(h.name),
      id: String(h.id),
      titre: propre(h.title),
      roles: liste(h.role1, h.role2),
      lanes: liste(h.lane1, h.lane2).map((l) => LANES[l] ?? l),
      specialites: liste(h.specialty1, h.specialty2),
      sortie: propre(h.release_date),
      annee: propre(h.release_year) ?? extraireAnnee(h.release_date),
      ressource: propre(h.resource),
      typeDegats: propre(h.dmg_type),
      typeAttaque: propre(h.atk_type),
      region: propre(h.region),
      notes: {
        offensive: nombre(h.ratings?.offense),
        resistance: nombre(h.ratings?.durability),
        effets: nombre(h.ratings?.control_effect ?? h.ratings?.ability_effects),
        difficulte: nombre(h.ratings?.difficulty),
      },
      stats: h.stats && typeof h.stats === "object" ? normaliserStats(h.stats) : null,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
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
        nom: String(s.name),
        sortie: propre(s.release)?.replace(/-XX/g, "") ?? null,
        disponibilite: propre(s.availability),
        rarete: propre(s.tier),
        etiquette: propre(s.tag),
        prix: Object.fromEntries(
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
      nom: String(o.name),
      resume: propre(o.caption),
      categorie: propre(o.type) ?? "Autre",
      prix: nombre(o.price),
      bonus: propre(o.bonus),
      unique: propre(o.unique),
      passif: propre(o.passive),
      actif: propre(o.active),
      recette: propre(o.recipe)?.split(",").map((x) => x.trim()).filter(Boolean) ?? [],
      pourQui: propre(o.availability),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
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

/** Telecharge un visuel s'il n'est pas deja present. */
async function telecharger(url, chemin) {
  if (existsSync(chemin)) return "deja";
  try {
    const reponse = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!reponse.ok) return "echec";
    await mkdir(dirname(chemin), { recursive: true });
    await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
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
    const entree = { portrait: null, icone: null, skins: {} };

    if (portraits[h.id]) {
      entree.portrait = `/${dossier}/portrait.png`;
      plan.push({ url: portraits[h.id], chemin: `public/${dossier}/portrait.png` });
    }
    if (icones[h.id]) {
      entree.icone = `/${dossier}/icone.png`;
      plan.push({ url: icones[h.id], chemin: `public/${dossier}/icone.png` });
    }

    for (const skin of skins[h.slug] ?? []) {
      const url = portraits[skin.id];
      if (!url) continue;
      const fichier = `${skin.id}-${slugifier(skin.nom)}.png`;
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
// Classement
// ─────────────────────────────────────────────────────────────

/**
 * Taux de victoire, de ban et de selection.
 *
 * Les identifiants de cette API ne sont pas ceux du wiki : le rapprochement se
 * fait par nom, apres passage au meme format de slug. Un heros sans
 * correspondance est simplement ignore plutot que rattache au hasard.
 */
async function classement(heros) {
  const connus = new Set(heros.map((h) => h.slug));

  const reponse = await fetch(`${STATS}/heroes/rank?size=200`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!reponse.ok) throw new Error(`Statistiques indisponibles : HTTP ${reponse.status}`);

  const enregistrements = (await reponse.json())?.data?.records ?? [];
  const sortie = {};
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

    sortie[cle] = {
      victoire: arrondir(d.main_hero_win_rate),
      ban: arrondir(d.main_hero_ban_rate),
      selection: arrondir(d.main_hero_appearance_rate),
    };
  }

  if (orphelins.length) console.log(`  sans correspondance : ${orphelins.join(", ")}`);
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

  return membres
    .map((m) => {
      const version = m.title.match(/(\d+\.\d+\.\d+)/)?.[1];
      return version
        ? {
            version,
            titre: m.title,
            lien: `https://mobilelegends.fandom.com/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => comparerVersions(b.version, a.version));
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
        page: patch.titre,
        prop: "text",
        disabletoc: "1",
        formatversion: "2",
      });

      const brut = donnees.parse?.text;
      if (!brut) continue;

      const { html } = nettoyerRendu(brut, patch.lien);
      contenus[patch.version] = {
        version: patch.version,
        titre: patch.titre,
        lien: patch.lien,
        sommaire: sommaire(html).filter((t) => t.niveau === 2),
        html,
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

  console.log("Classement des heros…");
  let stats = {};
  try {
    stats = await classement(heros);
    console.log(`  ${Object.keys(stats).length} heros mesures`);
  } catch (erreur) {
    // Une source de statistiques indisponible ne doit pas faire echouer toute
    // la synchronisation : le site retombe sur le classement precedent.
    console.warn(`  statistiques indisponibles (${erreur.message}) — classement inchange`);
    stats = null;
  }

  console.log("Liste des patchs…");
  const listePatchs = await patchs();
  console.log(`  ${listePatchs.length} patchs`);

  console.log("Contenu des patchs recents…");
  const detailPatchs = await contenuPatchs(listePatchs);
  console.log(`  ${Object.keys(detailPatchs).length} patchs detailles`);

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

  console.log("Resolution des objets, emblemes, talents et sorts…");
  const [urlsObjets, urlsEmblemes, urlsTalents, urlsSorts] = await Promise.all([
    urlsFichiers(objets.map((o) => o.nom)),
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
        plan.slice(i, i + 8).map((v) => telecharger(v.url, v.chemin)),
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

  if (stats) await ecrire("classement", stats);

  await Promise.all([
    ecrire("heros", heros),
    ecrire("skins", skins),
    ecrire("objets", objets),
    ecrire("patchs", listePatchs),
    ecrire("visuels", chemins),
    ecrire("visuels-objets", visuelsObjets),
    ecrire("visuels-emblemes", visuelsEmblemes),
    ecrire("visuels-talents", visuelsTalents),
    ecrire("visuels-sorts", visuelsSorts),
    ecrire("patchs-detail", detailPatchs),
    ecrire("synchro", {
      date: new Date().toISOString(),
      source: "https://mobilelegends.fandom.com",
      heros: heros.length,
      skins: nbSkins,
      objets: objets.length,
      patchs: listePatchs.length,
      classement: stats ? Object.keys(stats).length : null,
    }),
  ]);

  console.log(`\nEcrit dans ${SORTIE}/`);
}

await principal();

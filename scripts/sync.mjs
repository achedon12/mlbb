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
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { analyserTableLua } from "./lua.mjs";
import { decouperSections, nettoyerRendu, nouveauxHeros, sommaire } from "./patch-notes.mjs";
import { nettoyerDescription, sansBalises } from "./wikitexte.mjs";
import { ajustementsHeros, bilan } from "./patch-parser.mjs";

const WIKI = "https://mobilelegends.fandom.com/api.php";
/**
 * Statistiques de partie.
 *
 * Le wiki decrit le jeu mais ne mesure rien. Cette API communautaire expose
 * les taux de victoire, de ban et de selection remontes par le jeu — la seule
 * source verifiable permettant un classement qui ne soit pas une opinion.
 */
const STATS = "https://arena.rone.dev/api";

/**
 * Recherche des presentations video officielles.
 *
 * Moonton publie une video « Heroes Spotlight » par heros. Les retrouver
 * suppose une cle d'API YouTube — gratuite, mais qu'on ne peut pas inventer.
 * Sans cle, l'etape est simplement sautee et le site propose un lien de
 * recherche plutot qu'une video.
 */
const CLE_YOUTUBE = process.env.YOUTUBE_API_KEY ?? null;

/** Nombre de patch notes dont on recupere le contenu complet. */
const PATCHS_DETAILLES = 12;
const UA = "MLBB-sync/1.0 (https://mlbbdex.com; contact via github.com/achedon12)";
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
          nom: suivant.valeur,
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
  const galerie = wikitexte.match(
    /Splash art\s*=+\s*\n<gallery[^>]*>([\s\S]*?)<\/gallery>/i,
  );
  const illustrations = galerie
    ? [...galerie[1].matchAll(/^File:(.+?\.(?:jpg|png))\|(.*)$/gim)].map((m) => ({
        fichier: m[1].trim(),
        skin: m[2].trim(),
      }))
    : [];

  return { competences, illustrations };
}

/** Parcourt les pages de heros, par lots, pour en extraire ces deux blocs. */
async function pagesHeros(heros) {
  const sortie = {};

  for (let i = 0; i < heros.length; i += 10) {
    const lot = heros.slice(i, i + 10);

    const donnees = await api({
      action: "query",
      titles: lot.map((h) => h.nom).join("|"),
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
      const texte = parTitre.get(redirections.get(h.nom) ?? h.nom);
      if (texte) sortie[h.slug] = extraireDePage(texte);
    }

    process.stdout.write(`\r    pages ${Math.min(i + 10, heros.length)}/${heros.length}`);
    await pause(350);
  }

  process.stdout.write("\n");
  return sortie;
}

/**
 * Identifiant de la presentation video de chaque heros.
 *
 * On retient le premier resultat dont le titre nomme le heros : une recherche
 * large ramene aussi des videos de joueurs, qui n'ont pas leur place ici.
 */
async function videos(heros) {
  if (!CLE_YOUTUBE) {
    console.log("  YOUTUBE_API_KEY absente — etape sautee");
    return null;
  }

  const trouvees = {};

  for (const [i, h] of heros.entries()) {
    const requete = new URL("https://www.googleapis.com/youtube/v3/search");
    for (const [cle, valeur] of Object.entries({
      key: CLE_YOUTUBE,
      part: "snippet",
      type: "video",
      maxResults: "3",
      videoEmbeddable: "true",
      // Titre reel des videos officielles : « Hero Spotlight | Khufra |
      // Mobile Legends: Bang Bang ». Chercher « Heroes Spotlight » ramenait
      // surtout des videos de joueurs.
      q: `Hero Spotlight ${h.nom} Mobile Legends Bang Bang`,
    })) {
      requete.searchParams.set(cle, valeur);
    }

    try {
      const reponse = await fetch(requete, { signal: AbortSignal.timeout(20000) });
      if (!reponse.ok) {
        // Quota epuise : inutile d'insister sur les heros suivants.
        if (reponse.status === 403) {
          console.warn(`\n  quota YouTube atteint apres ${i} heros`);
          break;
        }
        continue;
      }

      const resultats = (await reponse.json())?.items ?? [];
      const nom = h.nom.toLowerCase();
      const bon = resultats.find((r) =>
        String(r.snippet?.title ?? "").toLowerCase().includes(nom),
      );

      if (bon?.id?.videoId) {
        trouvees[h.slug] = { id: bon.id.videoId, titre: bon.snippet.title };
      }
    } catch {
      // Une recherche en echec ne doit pas interrompre la synchronisation.
    }

    process.stdout.write(`\r    videos ${i + 1}/${heros.length}`);
    await pause(200);
  }

  process.stdout.write("\n");
  return trouvees;
}

/**
 * Contres reels, avec taux de victoire.
 *
 * L'academie expose, pour chaque heros, le taux de victoire de tous ses
 * adversaires et surtout la variation de ce taux quand ils l'affrontent :
 * `increase_win_rate`. Negatif, l'adversaire perd du terrain — le heros le
 * contre ; positif, l'adversaire prend l'avantage. On en tire les contres
 * chiffres, dans les deux sens, la ou l'analyse ecrite ne couvre qu'une
 * poignee de heros.
 */
async function contresReels(heros) {
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

  const sortie = {};

  for (const [i, h] of heros.entries()) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.nom)}/counters`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
      );
      if (!rep.ok) continue;

      const bloc = (await rep.json())?.data?.records?.[0]?.data;
      const adversaires = Array.isArray(bloc?.sub_hero) ? bloc.sub_hero : [];
      if (adversaires.length === 0) continue;

      // On ne retient que les adversaires connus, avec leur variation.
      const notes = adversaires
        .map((a) => ({
          slug: parId.get(a.heroid),
          delta: typeof a.increase_win_rate === "number" ? a.increase_win_rate : 0,
          winRate: typeof a.hero_win_rate === "number" ? a.hero_win_rate : null,
        }))
        .filter((a) => a.slug && a.slug !== h.slug);

      // `increase_win_rate` est la variation du taux de victoire du heros dans
      // ce duel : positive, il gagne davantage → il contre l'adversaire ;
      // negative, il est en difficulte. On trie du plus favorable au moins.
      const parDelta = [...notes].sort((a, b) => b.delta - a.delta);
      const point = (a) => ({ slug: a.slug, avantage: Math.round(a.delta * 1000) / 10 });

      sortie[h.slug] = {
        // avantage positif : le heros est fort contre cette cible.
        fort: parDelta.slice(0, 6).map(point),
        // avantage negatif : le heros est en difficulte.
        faible: parDelta.slice(-6).reverse().map(point),
        mesure: bloc.main_hero_win_rate
          ? Math.round(bloc.main_hero_win_rate * 1000) / 10
          : null,
      };
    } catch {
      /* un heros en echec n'interrompt pas la synchronisation */
    }

    process.stdout.write(`\r    contres ${i + 1}/${heros.length}`);
    await pause(150);
  }

  process.stdout.write("\n");
  return sortie;
}

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
      fortContre: lire("strong"),
      faibleContre: lire("weak"),
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
      titre: m.title,
      lien: `https://mobilelegends.fandom.com/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`,
    };

    const existant = parVersion.get(version);
    if (!existant || rang(candidat.titre) < rang(existant.titre)) {
      parVersion.set(version, candidat);
    }
  }

  return [...parVersion.values()].sort((a, b) => comparerVersions(b.version, a.version));
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

      // Deux lectures complementaires : le rendu HTML pour les sections libres
      // (mot des concepteurs, terrain), et le wikitexte pour extraire les
      // ajustements de heros en donnees structurees — heros, type, diffs.
      let ajustements = [];
      try {
        const wt = await api({
          action: "parse",
          page: patch.titre,
          prop: "wikitext",
          formatversion: "2",
        });
        const wikitexte = wt.parse?.wikitext;
        if (wikitexte) ajustements = ajustementsHeros(wikitexte);
      } catch {
        // Sans le wikitexte, on garde au moins le rendu HTML.
      }

      const { html } = nettoyerRendu(brut, patch.lien);

      // Le corps est decoupe en sections : la page en rend certaines telles
      // quelles et en remplace d'autres — nouveaux heros, ajustements — par un
      // composant riche. On extrait la presentation des nouveaux heros et on
      // vide le HTML des sections reprises par un composant, inutile a garder.
      const sections = decouperSections(html);
      let nouveaux = [];
      const sectionsRendues = sections.map((s) => {
        const t = (s.titre ?? "").toLowerCase();
        if (/hero adjustments/.test(t)) return { ...s, html: "", role: "ajustements" };
        if (/new hero/.test(t)) {
          nouveaux = nouveauxHeros(s.html).map((h) => ({ ...h, slug: slugifier(h.nom) }));
          return { ...s, html: "", role: "nouveaux" };
        }
        return { ...s, role: null };
      });

      contenus[patch.version] = {
        version: patch.version,
        titre: patch.titre,
        lien: patch.lien,
        sommaire: sommaire(html),
        sections: sectionsRendues,
        nouveaux,
        // Ajustements de heros ramenes a des slugs, pour lier aux fiches.
        ajustements: ajustements.map((a) => ({ ...a, slug: slugifier(a.nom) })),
        bilan: bilan(ajustements),
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

  for (const [i, h] of heros.entries()) {
    try {
      const rep = await fetch(`${STATS}/heroes/${encodeURIComponent(h.nom)}?lang=en`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (rep.ok) {
        const data = (await rep.json())?.data?.records?.[0]?.data?.hero?.data;
        const skills = (data?.heroskilllist ?? []).flatMap((g) => g.skilllist ?? []);
        if (skills.length > 0) {
          sortie[h.slug] = skills.map((s) => ({
            nom: String(s.skillname ?? "").trim(),
            description: nettoyerSkillDesc(s.skilldesc) || null,
            icone: s.skillicon ? String(s.skillicon) : null,
          }));
        }
      }
    } catch {
      // Un heros en echec ne doit pas interrompre la synchronisation.
    }

    process.stdout.write(`\r    competences arena ${i + 1}/${heros.length}`);
    await pause(200);
  }

  process.stdout.write("\n");
  return sortie;
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
  const skillsArena = await competencesArena(heros);
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
      const nom = wiki[i]?.nom ?? arena[i]?.nom ?? ancien[i]?.nom ?? null;
      const description =
        wiki[i]?.description ?? arena[i]?.description ?? ancien[i]?.description ?? null;
      liste.push(nom || description ? { nom, description } : null);
    }
    competencesFinales[h.slug] = liste;
  }

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

  console.log("Presentations video…");
  const presentations = await videos(heros);
  if (presentations) console.log(`  ${Object.keys(presentations).length} videos trouvees`);

  console.log("Contres reels (academie)…");
  let contres = null;
  try {
    contres = await contresReels(heros);
    console.log(`  ${Object.keys(contres).length} heros avec contres chiffres`);
  } catch (erreur) {
    console.warn(`  contres indisponibles (${erreur.message}) — inchanges`);
  }

  console.log("Relations entre heros…");
  let liens = null;
  try {
    liens = await relations(heros);
    const n = Object.values(liens).reduce((t, r) => t + r.fortContre.length, 0);
    console.log(`  ${Object.keys(liens).length} heros, ${n} relations de contre`);
  } catch (erreur) {
    console.warn(`  relations indisponibles (${erreur.message}) — inchangees`);
  }

  console.log("Liste des patchs…");
  const listePatchs = await patchs();
  console.log(`  ${listePatchs.length} patchs`);

  console.log("Contenu des patchs recents…");
  const detailPatchs = await contenuPatchs(listePatchs);
  console.log(`  ${Object.keys(detailPatchs).length} patchs detailles`);

  console.log("Emblemes des rangs…");
  const emblemesRangs = await rangs();
  console.log(`  ${Object.keys(emblemesRangs.images).length} emblemes`);

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

  // ── Icones de competences ──────────────────────────────────────────
  // Le fichier d'icone porte le nom du champ « image » du gabarit quand il
  // existe, souvent distinct du nom affiche (« Contract Transform » pour la
  // competence « Contract: Transform ») ; sinon on retombe sur le nom.
  const fichierIcone = (slug, i, nom) => pages[slug]?.competences?.[i]?.image ?? nom;
  const nomsCompetences = [
    ...new Set(
      Object.entries(competencesFinales).flatMap(([slug, cs]) =>
        cs.map((c, i) => (c?.nom ? fichierIcone(slug, i, c.nom) : null)).filter(Boolean),
      ),
    ),
  ];
  const urlsCompetences = await urlsFichiers(nomsCompetences);

  // Icones deja resolues : dernier recours si ni le wiki ni l'API ne repondent.
  const visuelsExistants = await lireJson(`${SORTIE}/visuels-competences.json`);

  let iconesArena = 0;
  const visuelsCompetences = {};
  for (const [slug, comps] of Object.entries(competencesFinales)) {
    const arena = skillsArena[slug] ?? [];
    const icones = {};
    comps.forEach((competence, i) => {
      const nom = competence?.nom;
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
      } else if (arena[i]?.icone) {
        // Repli : l'icone officielle servie par le CDN de l'API.
        icones[nom] = arena[i].icone;
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
    for (const { fichier, skin } of page.illustrations) {
      const cle = fichier.replace(/\.(jpg|png)$/, "");
      const url = urlsIllustrations[cle];
      if (!url || !skin) continue;
      const nomFichier = `${slugifier(skin)}.webp`;
      parSkin[skin] = `/visuels/heros/${slug}/illustrations/${nomFichier}`;
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

  // Le classement porte sa propre date : il ne se met pas a jour au meme
  // rythme que le reste quand sa source est indisponible, et afficher la date
  // de la derniere synchronisation laisserait croire qu'il est plus frais
  // qu'il ne l'est.
  if (stats) {
    await ecrire("classement", { mesure: new Date().toISOString(), taux: stats });
  }
  if (liens) await ecrire("relations", liens);
  if (presentations) await ecrire("videos", presentations);
  if (contres) await ecrire("contres", contres);

  await Promise.all([
    ecrire("heros", heros),
    ecrire("skins", skins),
    ecrire("objets", objets),
    ecrire("patchs", listePatchs),
    ecrire("visuels", chemins),
    ecrire("visuels-objets", visuelsObjets),
    ecrire("competences", competencesFinales),
    ecrire("visuels-competences", visuelsCompetences),
    ecrire("illustrations", illustrations),
    ecrire("visuels-emblemes", visuelsEmblemes),
    ecrire("visuels-talents", visuelsTalents),
    ecrire("visuels-sorts", visuelsSorts),
    ecrire("patchs-detail", detailPatchs),
    ecrire("rangs", emblemesRangs),
    ecrire("synchro", {
      date: new Date().toISOString(),
      source: "https://mobilelegends.fandom.com",
      heros: heros.length,
      skins: nbSkins,
      objets: objets.length,
      patchs: listePatchs.length,
      classement: stats ? Object.keys(stats).length : null,
      contres: contres ? Object.keys(contres).length : null,
      // Le wiki fournit le catalogue ; l'API communautaire fournit les mesures.
      sources: [
        "https://mobilelegends.fandom.com",
        "https://arena.rone.dev",
      ],
    }),
  ]);

  console.log(`\nEcrit dans ${SORTIE}/`);
}

await principal();

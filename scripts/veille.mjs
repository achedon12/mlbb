/**
 * Instantane de la veille.
 *
 * Le site ne doit interroger aucun service externe a l'execution : ce script
 * lit les flux publics une fois (en CI, a intervalle regulier) et ecrit le
 * resultat dans `src/data/jeu/veille.json`. La page « Veille » se contente
 * ensuite de lire ce fichier.
 *
 * On n'affiche que ce qu'un agregateur peut legitimement montrer : titre, date,
 * court extrait et lien vers la source. Le contenu integral n'est jamais copie.
 */
import { writeFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const SORTIE = "src/data/jeu/veille.json";
const LIMITE = 40;

const sources = [
  {
    slug: "reddit",
    nom: "r/MobileLegendsGame",
    url: "https://www.reddit.com/r/MobileLegendsGame/top/.rss?t=week",
    site: "https://www.reddit.com/r/MobileLegendsGame/",
    filtrer: false,
  },
  {
    slug: "esports-gg",
    nom: "Esports.gg",
    url: "https://esports.gg/feed/",
    site: "https://esports.gg/",
    filtrer: true,
  },
];

const MOTS_CLES = ["mobile legends", "mlbb", "moonton", "mpl ", "m6 world", "m7 world"];

const analyseur = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function extrait(html, longueur = 180) {
  const texte = String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|[a-z]+);/gi, " ")
    .replace(/submitted by\s*\/?u\/[\w-]+/gi, "")
    .replace(/\[link\]|\[comments\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (texte.length <= longueur) return texte;
  return texte.slice(0, texte.lastIndexOf(" ", longueur)) + "…";
}

const concerneLeJeu = (titre, corps) =>
  MOTS_CLES.some((m) => `${titre} ${corps}`.toLowerCase().includes(m));

const premier = (v) => (Array.isArray(v) ? v[0] : v);

function normaliser(flux, source) {
  const rss = flux?.rss?.channel?.item;
  const atom = flux?.feed?.entry;
  const entrees = rss ?? atom ?? [];

  return (Array.isArray(entrees) ? entrees : [entrees])
    .filter(Boolean)
    .map((e) => {
      const titre = extrait(e.title, 200);
      const corps = e["content:encoded"] ?? e.description ?? e.summary ?? e.content;
      const lienBrut = e.link;
      const lien =
        typeof lienBrut === "string" ? lienBrut : String(premier(lienBrut)?.["@_href"] ?? "");
      return {
        titre,
        lien,
        date: String(e.pubDate ?? e.updated ?? e.published ?? ""),
        extrait: extrait(typeof corps === "object" ? corps?.["#text"] : corps),
        source: source.nom,
        sourceSlug: source.slug,
      };
    })
    .filter((a) => a.titre && a.lien)
    .filter((a) => !source.filtrer || concerneLeJeu(a.titre, a.extrait));
}

async function lireSource(source) {
  try {
    const reponse = await fetch(source.url, {
      headers: {
        "User-Agent": "MLBB-veille/1.0 (https://mlbbdex.com; contact via github.com/achedon12)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!reponse.ok) return [];
    return normaliser(analyseur.parse(await reponse.text()), source);
  } catch {
    return [];
  }
}

const lots = await Promise.all(sources.map(lireSource));
const vues = new Set();
const actualites = lots
  .flat()
  .filter((a) => (vues.has(a.lien) ? false : (vues.add(a.lien), true)))
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  .slice(0, LIMITE);

await writeFile(
  SORTIE,
  JSON.stringify({ mesure: new Date().toISOString(), actualites }, null, 2) + "\n",
);
console.log(`veille : ${actualites.length} entrees ecrites dans ${SORTIE}`);

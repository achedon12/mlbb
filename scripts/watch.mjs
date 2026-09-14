/**
 * Instantane de la veille.
 *
 * Le site ne doit interroger aucun service externe a l'execution : ce script
 * lit les flux publics une fois (en CI, a intervalle regulier) et ecrit le
 * resultat dans `src/data/game/watch.json`. La page « Veille » se contente
 * ensuite de lire ce fichier.
 *
 * On n'affiche que ce qu'un agregateur peut legitimement montrer : titre, date,
 * court extrait et lien vers la source. Le contenu integral n'est jamais copie.
 */
import { writeFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const OUTPUT = "src/data/game/watch.json";
const LIMIT = 40;

const sources = [
  {
    slug: "reddit",
    name: "r/MobileLegendsGame",
    url: "https://www.reddit.com/r/MobileLegendsGame/top/.rss?t=week",
    site: "https://www.reddit.com/r/MobileLegendsGame/",
    filter: false,
  },
  {
    slug: "esports-gg",
    name: "Esports.gg",
    url: "https://esports.gg/feed/",
    site: "https://esports.gg/",
    filter: true,
  },
];

const KEYWORDS = ["mobile legends", "mlbb", "moonton", "mpl ", "m6 world", "m7 world"];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function excerpt(html, length = 180) {
  const text = String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|[a-z]+);/gi, " ")
    .replace(/submitted by\s*\/?u\/[\w-]+/gi, "")
    .replace(/\[link\]|\[comments\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= length) return text;
  return text.slice(0, text.lastIndexOf(" ", length)) + "…";
}

const concernsGame = (title, body) =>
  KEYWORDS.some((m) => `${title} ${body}`.toLowerCase().includes(m));

const first = (v) => (Array.isArray(v) ? v[0] : v);

function normalize(feed, source) {
  const rss = feed?.rss?.channel?.item;
  const atom = feed?.feed?.entry;
  const entries = rss ?? atom ?? [];

  return (Array.isArray(entries) ? entries : [entries])
    .filter(Boolean)
    .map((e) => {
      const title = excerpt(e.title, 200);
      const body = e["content:encoded"] ?? e.description ?? e.summary ?? e.content;
      const linkRaw = e.link;
      const link =
        typeof linkRaw === "string" ? linkRaw : String(first(linkRaw)?.["@_href"] ?? "");
      return {
        title,
        link,
        date: String(e.pubDate ?? e.updated ?? e.published ?? ""),
        excerpt: excerpt(typeof body === "object" ? body?.["#text"] : body),
        source: source.name,
        sourceSlug: source.slug,
      };
    })
    .filter((a) => a.title && a.link)
    .filter((a) => !source.filter || concernsGame(a.title, a.excerpt));
}

async function readSource(source) {
  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "MLBB-veille/1.0 (https://mlbbdex.com; contact via github.com/achedon12)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    return normalize(parser.parse(await response.text()), source);
  } catch {
    return [];
  }
}

const batches = await Promise.all(sources.map(readSource));
const views = new Set();
const news = batches
  .flat()
  .filter((a) => (views.has(a.link) ? false : (views.add(a.link), true)))
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  .slice(0, LIMIT);

await writeFile(
  OUTPUT,
  JSON.stringify({ measuredAt: new Date().toISOString(), news }, null, 2) + "\n",
);
console.log(`veille : ${news.length} entrees ecrites dans ${OUTPUT}`);

import { XMLParser } from "fast-xml-parser";

/**
 * Veille automatique.
 *
 * Le site agrege des flux publics et n'affiche que ce qu'un agregateur peut
 * legitimement montrer : un titre, une date, un court extrait et un lien vers
 * la source. Le contenu integral n'est jamais recopie — on renvoie chez
 * l'editeur d'origine.
 *
 * Aucune tache planifiee n'est necessaire : les pages qui consomment ces
 * donnees sont revalidees par Next a intervalle regulier, et les flux sont mis
 * en cache entre deux revalidations.
 */
export const DUREE_CACHE = 1800; // 30 minutes

export interface Source {
  slug: string;
  nom: string;
  url: string;
  /** Page d'accueil de la source, affichee comme credit. */
  site: string;
  /**
   * Un flux generaliste doit etre filtre sur le jeu ; un flux deja dedie ne
   * l'est pas, sinon on perd des sujets qui ne nomment pas le jeu en titre.
   */
  filtrer: boolean;
}

export const sources: Source[] = [
  {
    slug: "reddit",
    nom: "r/MobileLegendsGame",
    // Tri hebdomadaire plutot que chronologique : le flux par defaut est
    // domine par des messages sans portee informative.
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

export interface Actualite {
  titre: string;
  lien: string;
  date: string;
  extrait: string;
  source: string;
  sourceSlug: string;
}

const MOTS_CLES = ["mobile legends", "mlbb", "moonton", "mpl ", "m6 world", "m7 world"];

const analyseur = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

/** Retire le balisage et ramene a une longueur lisible en carte. */
function extrait(html: unknown, longueur = 180): string {
  const texte = String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|[a-z]+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (texte.length <= longueur) return texte;
  // Coupe au dernier mot entier plutot qu'au milieu d'un mot.
  return texte.slice(0, texte.lastIndexOf(" ", longueur)) + "…";
}

function concerneLeJeu(titre: string, corps: string): boolean {
  const texte = `${titre} ${corps}`.toLowerCase();
  return MOTS_CLES.some((m) => texte.includes(m));
}

function premier<T>(valeur: T | T[] | undefined): T | undefined {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

function normaliser(flux: unknown, source: Source): Actualite[] {
  const racine = flux as Record<string, never>;

  // RSS 2.0 et Atom ont des formes differentes ; on ramene les deux au meme
  // objet plutot que de traiter chaque flux separement en aval.
  const rss = (racine?.rss as never)?.["channel"]?.["item"];
  const atom = (racine?.feed as never)?.["entry"];
  const entrees: Record<string, never>[] = rss ?? atom ?? [];

  return (Array.isArray(entrees) ? entrees : [entrees])
    .filter(Boolean)
    .map((e) => {
      const titre = extrait(e["title"], 200);
      const corps = e["content:encoded"] ?? e["description"] ?? e["summary"] ?? e["content"];

      // Atom porte le lien dans un attribut, RSS dans le texte de la balise.
      const lienBrut = e["link"];
      const lien =
        typeof lienBrut === "string"
          ? lienBrut
          : String(premier(lienBrut as never)?.["@_href"] ?? "");

      return {
        titre,
        lien,
        date: String(e["pubDate"] ?? e["updated"] ?? e["published"] ?? ""),
        extrait: extrait(typeof corps === "object" ? (corps as never)["#text"] : corps),
        source: source.nom,
        sourceSlug: source.slug,
      } satisfies Actualite;
    })
    .filter((a) => a.titre && a.lien)
    .filter((a) => !source.filtrer || concerneLeJeu(a.titre, a.extrait));
}

async function lireSource(source: Source): Promise<Actualite[]> {
  try {
    const reponse = await fetch(source.url, {
      headers: {
        // Plusieurs services refusent un agent anonyme : on s'identifie, avec
        // un moyen de nous joindre en cas de probleme.
        "User-Agent":
          "MLBB-veille/1.0 (https://mlbb.leoderoin.fr; contact via github.com/achedon12)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      next: { revalidate: DUREE_CACHE },
      signal: AbortSignal.timeout(12000),
    });

    if (!reponse.ok) return [];
    return normaliser(analyseur.parse(await reponse.text()), source);
  } catch {
    // Une source en panne ne doit pas vider la page : les autres suffisent.
    return [];
  }
}

/**
 * Toutes les sources, fusionnees et triees du plus recent au plus ancien.
 * Les sources sont interrogees en parallele et echouent independamment.
 */
export async function veille(limite = 40): Promise<Actualite[]> {
  const lots = await Promise.all(sources.map(lireSource));

  const vues = new Set<string>();
  return lots
    .flat()
    .filter((a) => {
      if (vues.has(a.lien)) return false;
      vues.add(a.lien);
      return true;
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, limite);
}

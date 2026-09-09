/**
 * Recupere l'URL du portrait de chaque heros depuis le wiki communautaire.
 *
 * Le resultat est ecrit dans `src/data/portraits.json` et versionne : le build
 * ne depend donc d'aucun service externe, et le site continue de fonctionner
 * si le wiki tombe. A relancer quand de nouveaux heros sortent :
 *
 *     npm run portraits
 *
 * Les images restent hebergees par le wiki et ne sont pas recopiees ici : ce
 * sont des ressources de Moonton, affichees en pointant vers leur hebergeur.
 */
import { readFileSync, writeFileSync } from "node:fs";

const UA =
  "MLBB-portraits/1.0 (https://mlbb.leoderoin.fr; contact via github.com/achedon12)";
const API = "https://mobilelegends.fandom.com/api.php";

// Le roster est lu tel quel plutot qu'importe : ce script tourne en Node nu,
// sans passer par la resolution de modules de Next.
const source = readFileSync("src/data/roster.ts", "utf8");
const heros = [...source.matchAll(/slug: "([^"]+)", nom: "([^"]+)"/g)].map(
  ([, slug, nom]) => ({ slug, nom }),
);

console.log(`${heros.length} heros a traiter.`);

/** Le wiki nomme certaines pages autrement que le jeu. */
const CORRESPONDANCES = {
  "popol-et-kupa": "Popol and Kupa",
  "chang-e": "Chang'e",
  "x-borg": "X.Borg",
  "yi-sun-shin": "Yi Sun-shin",
  "luo-yi": "Luo Yi",
  "yu-zhong": "Yu Zhong",
  "lapu-lapu": "Lapu-Lapu",
};

const portraits = {};
let trouves = 0;

// Le wiki accepte plusieurs titres par requete : on interroge par lots pour
// rester poli avec le service.
const LOT = 20;

for (let i = 0; i < heros.length; i += LOT) {
  const lot = heros.slice(i, i + LOT);
  const titres = lot.map((h) => CORRESPONDANCES[h.slug] ?? h.nom);

  const url =
    `${API}?action=query&titles=${encodeURIComponent(titres.join("|"))}` +
    `&prop=pageimages&pithumbsize=400&format=json&redirects=1`;

  try {
    const reponse = await fetch(url, { headers: { "User-Agent": UA } });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const donnees = await reponse.json();
    const pages = Object.values(donnees.query?.pages ?? {});

    // Le wiki renvoie les pages par titre : on les rattache au slug d'origine,
    // en tenant compte des redirections eventuelles.
    const parTitre = new Map(pages.map((p) => [p.title, p]));
    const redirections = new Map(
      (donnees.query?.redirects ?? []).map((r) => [r.from, r.to]),
    );

    for (const [j, h] of lot.entries()) {
      const demande = titres[j];
      const page = parTitre.get(redirections.get(demande) ?? demande);
      const source = page?.thumbnail?.source;
      if (source) {
        // On retire le suffixe de mise en cache : l'URL reste stable.
        portraits[h.slug] = source.split("/revision/")[0];
        trouves += 1;
      }
    }
  } catch (erreur) {
    console.warn(`  lot ${i / LOT + 1} en echec : ${erreur.message}`);
  }

  process.stdout.write(`\r  ${Math.min(i + LOT, heros.length)}/${heros.length}`);
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`\n${trouves} portraits trouves sur ${heros.length}.`);

const manquants = heros.filter((h) => !portraits[h.slug]).map((h) => h.slug);
if (manquants.length) console.log("Sans portrait :", manquants.join(", "));

writeFileSync(
  "src/data/portraits.json",
  JSON.stringify(Object.fromEntries(Object.entries(portraits).sort()), null, 2) + "\n",
);
console.log("Ecrit dans src/data/portraits.json");

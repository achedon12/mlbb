import { retirerBalises } from "./balises.mjs";
/**
 * Calculs purs de la synchronisation des mesures : series quotidiennes,
 * historique cumule et compacte, choix des guides de joueurs et combos de
 * competences. Isoles du script pour etre testes sans reseau.
 */

const JOUR = 86400000;
export const numeroJour = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / JOUR);
export const dateDuJour = (n) => new Date(n * JOUR).toISOString().slice(0, 10);
export const arrondi = (v, decimales) =>
  typeof v === "number" ? Math.round(v * 10 ** decimales) / 10 ** decimales : null;

/** Lundi de la semaine d'un numero de jour : le jour 0, 1er janvier 1970, etait un jeudi. */
const lundi = (n) => n - ((((n + 3) % 7) + 7) % 7);

/**
 * Series alignees sur une meme date de debut, un point tous les `pas` jours
 * (1 : quotidienne, 7 : hebdomadaire). Un point manquant reste un trou (null)
 * plutot que de decaler les suivants.
 */
export function serieQuotidienne(points, pas = 1) {
  if (points.length === 0) return null;
  const tries = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const premier = numeroJour(tries[0].date);
  const n = (numeroJour(tries.at(-1).date) - premier) / pas + 1;
  const serie = {
    start: tries[0].date,
    winRate: Array(n).fill(null),
    banRate: Array(n).fill(null),
    pickRate: Array(n).fill(null),
  };
  for (const p of tries) {
    const k = (numeroJour(p.date) - premier) / pas;
    serie.winRate[k] = p.winRate;
    serie.banRate[k] = p.banRate;
    serie.pickRate[k] = p.pickRate;
  }
  return serie;
}

/** Inverse de serieQuotidienne : un point par jour (ou par semaine) mesure. */
export function pointsDe(serie, pas = 1) {
  if (!serie?.winRate) return [];
  const debut = numeroJour(serie.start);
  return serie.winRate.flatMap((v, k) =>
    v == null
      ? []
      : [{
          date: dateDuJour(debut + k * pas),
          winRate: v,
          banRate: serie.banRate?.[k] ?? null,
          pickRate: serie.pickRate?.[k] ?? null,
        }],
  );
}

/** Jours gardes au jour pres dans l'historique ; au-dela, une moyenne par semaine. */
export const JOURS_QUOTIDIENS = 90;

/** Precision des moyennes hebdomadaires, celle des mesures du jeu. */
const DECIMALES = { winRate: 1, banRate: 1, pickRate: 2 };

function moyenne(valeurs, decimales) {
  const mesurees = valeurs.filter((v) => typeof v === "number");
  return mesurees.length ? arrondi(mesurees.reduce((a, b) => a + b, 0) / mesurees.length, decimales) : null;
}

/**
 * Serie stockee d'un heros : les `jours` derniers jours au jour pres, les
 * semaines plus anciennes en moyennes, rangees sous `semaines` (datees de leur
 * lundi, un point tous les sept jours). La coupure tombe un lundi : seules des
 * semaines entieres sont moyennees, et une semaine compactee ne bouge plus.
 * Si une semaine deja compactee recoit malgre tout des jours (fenetre
 * raccourcie, rattrapage), la moyenne existante prime : elle portait plus de
 * mesures.
 */
export function compacterHistorique(points, semainesExistantes = [], jours = JOURS_QUOTIDIENS) {
  if (points.length === 0) return null;
  const dernier = Math.max(...points.map((p) => numeroJour(p.date)));
  const coupure = lundi(dernier - jours + 1);
  const recents = points.filter((p) => numeroJour(p.date) >= coupure);

  const parSemaine = new Map();
  for (const p of points) {
    const n = numeroJour(p.date);
    if (n >= coupure) continue;
    const cle = dateDuJour(lundi(n));
    parSemaine.set(cle, [...(parSemaine.get(cle) ?? []), p]);
  }
  const semaines = new Map(
    [...parSemaine].map(([date, ps]) => [
      date,
      {
        date,
        winRate: moyenne(ps.map((p) => p.winRate), DECIMALES.winRate),
        banRate: moyenne(ps.map((p) => p.banRate), DECIMALES.banRate),
        pickRate: moyenne(ps.map((p) => p.pickRate), DECIMALES.pickRate),
      },
    ]),
  );
  for (const s of semainesExistantes) semaines.set(s.date, s);

  const serie = serieQuotidienne(recents);
  const hebdo = serieQuotidienne([...semaines.values()], 7);
  return hebdo ? { ...serie, weeks: hebdo } : serie;
}

/**
 * Historique long, tous rangs confondus. L'API ne remonte que trente jours :
 * chaque synchronisation verse les siens ici, et le fichier grandit patch
 * apres patch — d'une moyenne par semaine au-dela de JOURS_QUOTIDIENS, pour
 * rester compact. Un jour deja connu prend la mesure la plus recente. Un
 * fichier d'avant la compaction, tout au jour pres, se lit tel quel.
 */
export function fusionnerHistorique(existant, tendances, jours = JOURS_QUOTIDIENS) {
  const sortie = {};
  for (const slug of new Set([...Object.keys(existant), ...Object.keys(tendances)])) {
    const parDate = new Map();
    for (const p of [...pointsDe(existant[slug]), ...pointsDe(tendances[slug]?.all)]) parDate.set(p.date, p);
    const serie = compacterHistorique([...parDate.values()], pointsDe(existant[slug]?.weeks, 7), jours);
    if (serie) sortie[slug] = serie;
  }
  return sortie;
}

/**
 * Seuils de rank_level des auteurs de guides, sur l'echelle de
 * src/lib/rangs.ts : Epique des 76, Legende des 106, puis les
 * etoiles mythiques a partir de 136 — Honneur a 25 etoiles, Gloire a 50. Le
 * niveau publie est le meilleur rang atteint par l'auteur.
 */
export const BANDES_AUTEUR = {
  all: [0, Infinity],
  epic: [76, 106],
  legend: [106, 136],
  mythic: [136, 161],
  honor: [161, 186],
  glory: [186, Infinity],
};

/**
 * Guide retenu pour un rang : le plus vote parmi les auteurs de ce rang ; a
 * defaut, d'un rang superieur. Null quand aucun auteur n'atteint le rang.
 */
export function choisirGuide(candidats, rang) {
  const [bas, haut] = BANDES_AUTEUR[rang];
  const parVotes = (a, b) => b.votes - a.votes || b.views - a.views;
  return (
    candidats.filter((g) => g.authorRank >= bas && g.authorRank < haut).sort(parVotes)[0] ??
    candidats.filter((g) => g.authorRank >= bas).sort(parVotes)[0] ??
    null
  );
}

/**
 * Tranches de duree des duos, en minutes : celles de la courbe de duree d'un
 * heros (evolution.json), de 10 a 20 minutes et plus. L'API publie aussi
 * « moins de 6 », « 6-8 » et « 8-10 » : des parties abandonnees ou a
 * l'echantillon trop maigre (un duo a 92 % entre 6 et 8 minutes), ecartees.
 */
export const TRANCHES_DUO = [
  ["min_win_rate10_12", 10],
  ["min_win_rate12_14", 12],
  ["min_win_rate14_16", 14],
  ["min_win_rate16_18", 16],
  ["min_win_rate18_20", 18],
  ["min_win_rate20", 20],
];

/**
 * Duos d'un heros dans un rang, depuis `/heroes/{h}/compatibility` : les
 * partenaires qui font le plus monter son taux de victoire (`sub_hero`) et
 * ceux qui le font le plus baisser (`sub_hero_last`), cinq de chaque cote.
 * `increase_win_rate` devient un ecart en points ; le taux du duo par tranche
 * de duree, un pourcentage — null quand la tranche est vide (0 pile).
 * Null quand l'API n'a aucun partenaire connu pour ce rang.
 */
export function duosDuRang(bloc, parId, slug, max = 10) {
  const phases = (a) => {
    const valeurs = TRANCHES_DUO.map(([cle]) => (typeof a[cle] === "number" && a[cle] > 0 ? arrondi(a[cle] * 100, 1) : null));
    return valeurs.some((v) => v !== null) ? valeurs : null;
  };
  const partenaires = (liste) =>
    (Array.isArray(liste) ? liste : [])
      .map((a) => ({ a, slug: parId.get(a?.heroid) }))
      .filter(({ a, slug: s }) => s && s !== slug && typeof a.increase_win_rate === "number")
      .map(({ a, slug: s }) => {
        const p = phases(a);
        return { slug: s, advantage: Math.round(a.increase_win_rate * 1000) / 10, ...(p ? { phases: p } : {}) };
      });
  const meilleurs = partenaires(bloc?.sub_hero).filter((d) => d.advantage > 0).sort((a, b) => b.advantage - a.advantage);
  const pires = partenaires(bloc?.sub_hero_last).filter((d) => d.advantage < 0).sort((a, b) => a.advantage - b.advantage);
  if (meilleurs.length === 0 && pires.length === 0) return null;
  return {
    winRate: typeof bloc.main_hero_win_rate === "number" ? arrondi(bloc.main_hero_win_rate * 100, 1) : null,
    best: meilleurs.slice(0, max),
    worst: pires.slice(0, max),
  };
}

/**
 * Duos du fichier existant completes par une nouvelle lecture, rang par rang :
 * un rang que l'API n'a pas servi cette fois garde sa mesure precedente.
 */
export function fusionnerDuos(existants, nouveaux) {
  const sortie = {};
  for (const slug of new Set([...Object.keys(existants ?? {}), ...Object.keys(nouveaux ?? {})])) {
    sortie[slug] = { ...(existants?.[slug] ?? {}), ...(nouveaux?.[slug] ?? {}) };
  }
  return sortie;
}

/** duos.json : fenetre de mesure, puis un heros par ligne, dans l'ordre des slugs. */
export function serialiserDuos(jours, heros) {
  const lignes = Object.keys(heros)
    .sort()
    .map((slug) => `    ${JSON.stringify(slug)}: ${JSON.stringify(heros[slug])}`);
  return `{\n  "days": ${jours},\n  "heroes": ${lignes.length > 0 ? `{\n${lignes.join(",\n")}\n  }` : "{}"}\n}\n`;
}

const normaliserNom = (nom) => String(nom ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ORDRE_COMBOS = ["laning", "teamfight"];

/** « LANING COMBOS » → laning ; null pour un titre inconnu. */
const typeCombo = (titre) => ORDRE_COMBOS.find((t) => normaliserNom(titre).startsWith(t)) ?? null;

/**
 * Combos d'un heros, depuis les enregistrements de l'API (`skill-combos`).
 *
 * Chaque competence y arrive en identifiant de jeu. La fiche du heros cote API
 * (`skills` : id, nom) donne son nom, qui retrouve le nom affiche par le site
 * (`competencesSite`, le wiki) et son icone locale (`icones`, par nom). Une
 * forme transformee reprend le nom d'une competence sous un autre identifiant :
 * elle garde l'icone du CDN, qui la distingue. L'attaque de base, absente des
 * fiches, porte un identifiant rond (celui du heros suivi de 00).
 */
export function combosDuHeros(records, skills, competencesSite, icones) {
  const nomsSite = new Map(competencesSite.filter((c) => c?.name).map((c) => [normaliserNom(c.name), c.name]));
  const parId = new Map(skills.map((s) => [s.id, s]));
  const premierId = new Map();
  for (const s of skills) if (!premierId.has(normaliserNom(s.name))) premierId.set(normaliserNom(s.name), s.id);

  const competence = (brute) => {
    const id = brute?.data?.skillid;
    const distante = brute?.data?.skillicon ? String(brute.data.skillicon) : null;
    const skill = parId.get(id);
    if (!skill) return id % 100 === 0 ? { name: null, icon: distante, basicAttack: true } : { name: null, icon: distante };
    const cle = normaliserNom(skill.name);
    const nom = nomsSite.get(cle) ?? (skill.name || null);
    if (premierId.get(cle) === id && nom && icones[nom]) return { name: nom, icon: icones[nom] };
    return { name: nom, icon: distante ?? skill.icon ?? null };
  };

  const rang = (c) => (c.type ? ORDRE_COMBOS.indexOf(c.type) : ORDRE_COMBOS.length);
  return records
    .map((r) => r?.data)
    .filter((d) => d?.desc && Array.isArray(d.skill_id) && d.skill_id.length > 0)
    .map((d) => ({
      type: typeCombo(d.title),
      description: retirerBalises(d.desc).replace(/\s+/g, " ").trim(),
      skills: d.skill_id.map(competence),
    }))
    .sort((a, b) => rang(a) - rang(b));
}

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
    debut: tries[0].date,
    victoire: Array(n).fill(null),
    ban: Array(n).fill(null),
    selection: Array(n).fill(null),
  };
  for (const p of tries) {
    const k = (numeroJour(p.date) - premier) / pas;
    serie.victoire[k] = p.victoire;
    serie.ban[k] = p.ban;
    serie.selection[k] = p.selection;
  }
  return serie;
}

/** Inverse de serieQuotidienne : un point par jour (ou par semaine) mesure. */
export function pointsDe(serie, pas = 1) {
  if (!serie?.victoire) return [];
  const debut = numeroJour(serie.debut);
  return serie.victoire.flatMap((v, k) =>
    v == null
      ? []
      : [{
          date: dateDuJour(debut + k * pas),
          victoire: v,
          ban: serie.ban?.[k] ?? null,
          selection: serie.selection?.[k] ?? null,
        }],
  );
}

/** Jours gardes au jour pres dans l'historique ; au-dela, une moyenne par semaine. */
export const JOURS_QUOTIDIENS = 90;

/** Precision des moyennes hebdomadaires, celle des mesures du jeu. */
const DECIMALES = { victoire: 1, ban: 1, selection: 2 };

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
        victoire: moyenne(ps.map((p) => p.victoire), DECIMALES.victoire),
        ban: moyenne(ps.map((p) => p.ban), DECIMALES.ban),
        selection: moyenne(ps.map((p) => p.selection), DECIMALES.selection),
      },
    ]),
  );
  for (const s of semainesExistantes) semaines.set(s.date, s);

  const serie = serieQuotidienne(recents);
  const hebdo = serieQuotidienne([...semaines.values()], 7);
  return hebdo ? { ...serie, semaines: hebdo } : serie;
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
    const serie = compacterHistorique([...parDate.values()], pointsDe(existant[slug]?.semaines, 7), jours);
    if (serie) sortie[slug] = serie;
  }
  return sortie;
}

/**
 * Seuils de rank_level des auteurs de guides, sur l'echelle de
 * src/lib/rangs.ts : Epique des 76, l'ancienne plage Legende des 106, puis les
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
  const parVotes = (a, b) => b.votes - a.votes || b.vues - a.vues;
  return (
    candidats.filter((g) => g.rangAuteur >= bas && g.rangAuteur < haut).sort(parVotes)[0] ??
    candidats.filter((g) => g.rangAuteur >= bas).sort(parVotes)[0] ??
    null
  );
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
  const nomsSite = new Map(competencesSite.filter((c) => c?.nom).map((c) => [normaliserNom(c.nom), c.nom]));
  const parId = new Map(skills.map((s) => [s.id, s]));
  const premierId = new Map();
  for (const s of skills) if (!premierId.has(normaliserNom(s.nom))) premierId.set(normaliserNom(s.nom), s.id);

  const competence = (brute) => {
    const id = brute?.data?.skillid;
    const distante = brute?.data?.skillicon ? String(brute.data.skillicon) : null;
    const skill = parId.get(id);
    if (!skill) return id % 100 === 0 ? { nom: null, icone: distante, attaque: true } : { nom: null, icone: distante };
    const cle = normaliserNom(skill.nom);
    const nom = nomsSite.get(cle) ?? (skill.nom || null);
    if (premierId.get(cle) === id && nom && icones[nom]) return { nom, icone: icones[nom] };
    return { nom, icone: distante ?? skill.icone ?? null };
  };

  const rang = (c) => (c.type ? ORDRE_COMBOS.indexOf(c.type) : ORDRE_COMBOS.length);
  return records
    .map((r) => r?.data)
    .filter((d) => d?.desc && Array.isArray(d.skill_id) && d.skill_id.length > 0)
    .map((d) => ({
      type: typeCombo(d.title),
      description: String(d.desc).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
      competences: d.skill_id.map(competence),
    }))
    .sort((a, b) => rang(a) - rang(b));
}

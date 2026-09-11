/**
 * Calculs purs de la synchronisation des mesures : series quotidiennes,
 * historique cumule et choix des guides de joueurs. Isoles du script pour etre
 * testes sans reseau.
 */

const JOUR = 86400000;
export const numeroJour = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / JOUR);
export const dateDuJour = (n) => new Date(n * JOUR).toISOString().slice(0, 10);
export const arrondi = (v, decimales) =>
  typeof v === "number" ? Math.round(v * 10 ** decimales) / 10 ** decimales : null;

/**
 * Series quotidiennes alignees sur une meme date de debut. Un jour manquant
 * reste un trou (null) plutot que de decaler les suivants.
 */
export function serieQuotidienne(points) {
  if (points.length === 0) return null;
  const tries = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const premier = numeroJour(tries[0].date);
  const n = numeroJour(tries.at(-1).date) - premier + 1;
  const serie = {
    debut: tries[0].date,
    victoire: Array(n).fill(null),
    ban: Array(n).fill(null),
    selection: Array(n).fill(null),
  };
  for (const p of tries) {
    const k = numeroJour(p.date) - premier;
    serie.victoire[k] = p.victoire;
    serie.ban[k] = p.ban;
    serie.selection[k] = p.selection;
  }
  return serie;
}

/** Inverse de serieQuotidienne : un point par jour mesure. */
export function pointsDe(serie) {
  if (!serie?.victoire) return [];
  const debut = numeroJour(serie.debut);
  return serie.victoire.flatMap((v, k) =>
    v == null
      ? []
      : [{ date: dateDuJour(debut + k), victoire: v, ban: serie.ban?.[k] ?? null, selection: serie.selection?.[k] ?? null }],
  );
}

/**
 * Historique long, tous rangs confondus. L'API ne remonte que trente jours :
 * chaque synchronisation verse les siens ici, et le fichier ne fait que
 * grandir, patch apres patch. Un jour deja connu prend la mesure la plus
 * recente.
 */
export function fusionnerHistorique(existant, tendances) {
  const sortie = {};
  for (const slug of new Set([...Object.keys(existant), ...Object.keys(tendances)])) {
    const parDate = new Map();
    for (const p of [...pointsDe(existant[slug]), ...pointsDe(tendances[slug]?.all)]) parDate.set(p.date, p);
    const serie = serieQuotidienne([...parDate.values()]);
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

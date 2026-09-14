/**
 * Rangs pour lesquels le jeu publie ses mesures, dans l'ordre de l'API.
 *
 * `all` agrege toutes les parties ; les autres isolent une tranche du
 * classement, de Epique a Gloire mythique. Module sans dependance : les
 * composants client l'importent sans embarquer les donnees.
 */
export const MEASURED_RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"] as const;
export type MeasuredRank = (typeof MEASURED_RANKS)[number];

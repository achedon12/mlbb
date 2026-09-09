import noms from "@/data/genere/noms.json";

/**
 * Table nom-par-slug utilisable cote client.
 *
 * Les composants client ont besoin du nom d'un heros sans embarquer tout le
 * catalogue — competences, skins et builds n'ont rien a faire dans un bundle
 * de navigateur. Cette table n'est que `{ slug: nom }`.
 */
export const herosParSlug = noms as Record<string, string>;

/**
 * Createur de tier list : etat, operations et partage par lien.
 *
 * Module pur, sans donnees : la page lui passe le roster. Chaque operation
 * rend un nouvel etat ; l'interface n'a qu'a le ranger.
 *
 * Le lien partage porte toute la liste dans `?l=` : titre, rangees (nom,
 * couleur, heros par slug), en texte compresse puis en base64url. Les slugs
 * plutot que des indices : un lien reste valable quand un heros s'ajoute au
 * roster. Un lien de 133 heros tient en moins d'un kilo-octet.
 */

export interface Rangee {
  id: string;
  nom: string;
  couleur: string;
  heros: string[];
}

export interface EtatTier {
  titre: string;
  rangees: Rangee[];
}

export const RANGEES_DEFAUT: { nom: string; couleur: string }[] = [
  { nom: "S+", couleur: "#ff5a5f" },
  { nom: "S", couleur: "#ff9f43" },
  { nom: "A", couleur: "#ffd166" },
  { nom: "B", couleur: "#06d6a0" },
  { nom: "C", couleur: "#4da3ff" },
  { nom: "D", couleur: "#a78bfa" },
];

/** Couleurs proposees d'un clic ; le selecteur du navigateur donne le reste. */
export const PALETTE = [...RANGEES_DEFAUT.map((r) => r.couleur), "#f472b6", "#94a3b8"];

export const MAX_RANGEES = 12;
export const NOM_MAX = 20;
export const TITRE_MAX = 60;
const COULEUR_NEUTRE = "#94a3b8";
/** Au-dela, un lien est rejete sans etre lu : aucune liste legitime n'en approche. */
const CODE_MAX = 12_000;
const TEXTE_MAX = 40_000;

export function etatDefaut(titre = ""): EtatTier {
  return { titre, rangees: RANGEES_DEFAUT.map((r, i) => ({ id: `d${i}`, ...r, heros: [] })) };
}

export function rangeeDe(etat: EtatTier, slug: string): Rangee | undefined {
  return etat.rangees.find((r) => r.heros.includes(slug));
}

/**
 * Pose un heros dans une rangee, avant `avant` s'il y est, sinon a la fin ;
 * `cible` nul le rend a la reserve.
 */
export function placer(etat: EtatTier, slug: string, cible: string | null, avant?: string | null): EtatTier {
  const rangees = etat.rangees.map((r) => ({ ...r, heros: r.heros.filter((s) => s !== slug) }));
  const r = cible ? rangees.find((x) => x.id === cible) : undefined;
  if (r) {
    const i = avant ? r.heros.indexOf(avant) : -1;
    r.heros.splice(i >= 0 ? i : r.heros.length, 0, slug);
  }
  return { ...etat, rangees };
}

/** Avance ou recule un heros dans sa rangee. */
export function decaler(etat: EtatTier, slug: string, delta: number): EtatTier {
  return {
    ...etat,
    rangees: etat.rangees.map((r) => {
      const i = r.heros.indexOf(slug);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= r.heros.length) return r;
      const heros = [...r.heros];
      [heros[i], heros[j]] = [heros[j], heros[i]];
      return { ...r, heros };
    }),
  };
}

/** Monte ou descend un heros d'une rangee, a la fin de la nouvelle. */
export function changerDeRangee(etat: EtatTier, slug: string, delta: number): EtatTier {
  const i = etat.rangees.findIndex((r) => r.heros.includes(slug));
  const cible = etat.rangees[i + delta];
  return i < 0 || !cible ? etat : placer(etat, slug, cible.id);
}

export function ajouterRangee(etat: EtatTier, id: string, nom: string): EtatTier {
  if (etat.rangees.length >= MAX_RANGEES) return etat;
  const couleur = PALETTE[etat.rangees.length % PALETTE.length];
  return { ...etat, rangees: [...etat.rangees, { id, nom: nettoyer(nom, NOM_MAX), couleur, heros: [] }] };
}

/** Retire une rangee ; ses heros retournent a la reserve. */
export function supprimerRangee(etat: EtatTier, id: string): EtatTier {
  if (etat.rangees.length <= 1) return etat;
  return { ...etat, rangees: etat.rangees.filter((r) => r.id !== id) };
}

export function deplacerRangee(etat: EtatTier, id: string, delta: number): EtatTier {
  const i = etat.rangees.findIndex((r) => r.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= etat.rangees.length) return etat;
  const rangees = [...etat.rangees];
  [rangees[i], rangees[j]] = [rangees[j], rangees[i]];
  return { ...etat, rangees };
}

export function modifierRangee(etat: EtatTier, id: string, champs: Partial<Pick<Rangee, "nom" | "couleur">>): EtatTier {
  return {
    ...etat,
    rangees: etat.rangees.map((r) =>
      r.id !== id
        ? r
        : {
            ...r,
            ...(champs.nom !== undefined ? { nom: champs.nom.replace(/[\t\n\r]/g, " ").slice(0, NOM_MAX) } : {}),
            ...(champs.couleur && /^#[0-9a-f]{6}$/i.test(champs.couleur) ? { couleur: champs.couleur.toLowerCase() } : {}),
          },
    ),
  };
}

export function viderRangees(etat: EtatTier): EtatTier {
  return { ...etat, rangees: etat.rangees.map((r) => ({ ...r, heros: [] })) };
}

/**
 * Liste de depart tiree de notre tier list : `groupes` donne, palier par
 * palier (S+ a C), les indices des heros dans `slugs`, du plus fort au plus
 * faible. La rangee D reste vide : notre classement s'arrete a C.
 */
export function preremplir(slugs: string[], groupes: number[][], titre = ""): EtatTier {
  const etat = etatDefaut(titre);
  return {
    ...etat,
    rangees: etat.rangees.map((r, i) => ({ ...r, heros: (groupes[i] ?? []).flatMap((n) => slugs[n] ?? []) })),
  };
}

/** Texte lisible sur un fond de cette couleur : sombre sur clair, clair sur sombre. */
export function couleurTexte(fond: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(fond);
  if (!m) return "#ffffff";
  const [r, g, b] = m.slice(1).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#0a0e1a" : "#ffffff";
}

// ─────────────────────────────────────────────────────────────
// Partage par lien
// ─────────────────────────────────────────────────────────────

function nettoyer(texte: string, max: number): string {
  return texte.replace(/[\t\n\r]/g, " ").trim().slice(0, max);
}

/** Une ligne pour le titre, puis une par rangee : nom, couleur, heros. */
export function serialiser(etat: EtatTier): string {
  return [
    nettoyer(etat.titre, TITRE_MAX),
    ...etat.rangees.map((r) =>
      [nettoyer(r.nom, NOM_MAX), r.couleur.replace(/^#/, "").toLowerCase(), r.heros.join(",")].join("\t"),
    ),
  ].join("\n");
}

/**
 * Relit une liste, sans faire confiance au lien : heros inconnus et doublons
 * ecartes, couleurs invalides remplacees, nombre de rangees borne.
 */
export function deserialiser(texte: string, connus: Set<string>): EtatTier | null {
  const [titre = "", ...lignes] = texte.split("\n");
  if (!lignes.length) return null;
  const vus = new Set<string>();
  const rangees = lignes.slice(0, MAX_RANGEES).map((ligne, i) => {
    const [nom = "", couleur = "", liste = ""] = ligne.split("\t");
    const heros: string[] = [];
    for (const slug of liste.split(",")) {
      if (connus.has(slug) && !vus.has(slug)) {
        vus.add(slug);
        heros.push(slug);
      }
    }
    return {
      id: `p${i}`,
      nom: nettoyer(nom, NOM_MAX),
      couleur: /^[0-9a-f]{6}$/i.test(couleur) ? `#${couleur.toLowerCase()}` : COULEUR_NEUTRE,
      heros,
    };
  });
  return { titre: nettoyer(titre, TITRE_MAX), rangees };
}

function versBase64Url(octets: Uint8Array): string {
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function depuisBase64Url(code: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(code)) return null;
  try {
    const binaire = atob(code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4));
    return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Passe des octets dans un flux de (de)compression, en s'arretant au-dela de `max`. */
async function transformer(
  octets: Uint8Array,
  flux: CompressionStream | DecompressionStream,
  max = Infinity,
): Promise<Uint8Array | null> {
  try {
    const lecteur = new Blob([octets as BlobPart]).stream().pipeThrough(flux).getReader();
    const morceaux: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await lecteur.cancel();
        return null;
      }
      morceaux.push(value);
    }
    const sortie = new Uint8Array(total);
    let i = 0;
    for (const m of morceaux) {
      sortie.set(m, i);
      i += m.length;
    }
    return sortie;
  } catch {
    return null;
  }
}

const compressionDisponible = () => typeof CompressionStream !== "undefined";

/**
 * Code du lien : « 2 » + texte compresse, ou « 1 » + texte brut quand la
 * compression manque ou ne gagne rien (une liste presque vide).
 */
export async function encoderTier(etat: EtatTier, compresser = true): Promise<string> {
  const octets = new TextEncoder().encode(serialiser(etat));
  const brut = `1${versBase64Url(octets)}`;
  if (!compresser || !compressionDisponible()) return brut;
  const compresse = await transformer(octets, new CompressionStream("deflate-raw"));
  const code = compresse ? `2${versBase64Url(compresse)}` : brut;
  return code.length < brut.length ? code : brut;
}

export async function decoderTier(code: string, connus: Set<string>): Promise<EtatTier | null> {
  if (!code || code.length > CODE_MAX) return null;
  const octets = depuisBase64Url(code.slice(1));
  if (!octets) return null;
  let texte: Uint8Array | null = null;
  if (code[0] === "1") texte = octets;
  else if (code[0] === "2" && typeof DecompressionStream !== "undefined") {
    texte = await transformer(octets, new DecompressionStream("deflate-raw"), TEXTE_MAX);
  }
  if (!texte || texte.length > TEXTE_MAX) return null;
  try {
    return deserialiser(new TextDecoder("utf-8", { fatal: true }).decode(texte), connus);
  } catch {
    return null;
  }
}

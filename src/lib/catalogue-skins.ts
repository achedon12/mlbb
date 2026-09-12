import type { T } from "@/i18n/t";
import { RARETES, RARETE_ORIGINE, type Rarete } from "./raretes";
import { ancreSkin } from "./skins";
import type { Role } from "./types";
import { cleRecherche } from "./utils";

/** Dossier des visuels d'un heros : les chemins de l'index s'y rapportent, pour peser moins. */
const dossier = (slug: string) => `/visuels/heros/${slug}/`;
export const relatifHeros = (slug: string, chemin: string | null) =>
  chemin?.startsWith(dossier(slug)) ? chemin.slice(dossier(slug).length) : chemin;
export const absoluHeros = (slug: string, chemin: string | null) =>
  chemin && !chemin.startsWith("/") ? `${dossier(slug)}${chemin}` : chemin;

/**
 * Catalogue des skins, pour le calendrier des sorties et le calculateur de
 * collection.
 *
 * Le serveur publie un index compact (`/{langue}/skins/calendar/skins.json`),
 * en tuples, sans noms de champs repetes : un millier de skins partent au
 * navigateur, et seulement au premier besoin. Ce module le decode en objets
 * lisibles et porte les calculs communs (dates, regroupements, filtres). Il
 * n'importe aucune donnee : un composant client peut l'utiliser.
 */

export const ROLES_INDEX: readonly Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
export const DISPOS = ["Available", "Limited", "Upcoming"] as const;
export type Dispo = (typeof DISPOS)[number];

/** Monnaies chiffrees d'un prix. Le texte d'obtention (`other` du wiki) est a part. */
export const MONNAIES_CHIFFREES = ["dm", "bp", "ticket", "mc", "lg", "hf", "mythcoin"] as const;
export type Monnaie = (typeof MONNAIES_CHIFFREES)[number];
export type Prix = Partial<Record<Monnaie, number>>;

/** Libelle de chaque monnaie, sous `skinsUI`. */
export const LIBELLE_MONNAIE: Record<Monnaie, string> = {
  dm: "diamonds",
  bp: "battlePoints",
  ticket: "tickets",
  mc: "magicCores",
  lg: "gems",
  hf: "fragments",
  mythcoin: "mythicCoins",
};

export interface HerosCatalogue {
  slug: string;
  nom: string;
  roles: Role[];
  icone: string | null;
}

export interface SkinCatalogue {
  id: string;
  nom: string;
  /** Slug du heros. */
  heros: string;
  /** Rang de rarete (1 Commun a 6 Supreme), 0 pour le skin d'origine. */
  rarete: number;
  /** Serie ou evenement (« Collector », « StarLight »), tel que le wiki l'etiquette. */
  serie: string | null;
  /** Date telle que le wiki la donne : « 2025-05-01 », « 2025-05 », « 2025 », parfois « 202X ». */
  sortie: string | null;
  dispo: Dispo | null;
  prix: Prix;
  /** Moyen d'obtention en clair, quand il remplace ou complete le prix (« 2025/05 StarLight Member »). */
  obtention: string | null;
  /** Portrait de boutique, a defaut l'illustration ; chemin absolu. */
  image: string | null;
  /** Ancre du skin dans la galerie de son heros. */
  ancre: string;
}

/** Le skin d'origine vient avec le heros : son prix est celui du heros. */
export const estOrigine = (s: SkinCatalogue) => s.rarete === 0;

export interface Catalogue {
  /** Date de la synchronisation, ISO (jour). */
  maj: string;
  heros: HerosCatalogue[];
  skins: SkinCatalogue[];
}

// ── Index compact ───────────────────────────────────────────────────

export type HerosIndex = [slug: string, nom: string, roles: number[], icone: string | null];
export type SkinIndex = [
  heros: number,
  id: string,
  nom: string,
  rarete: number,
  /** Position dans `series`, -1 sans serie. */
  serie: number,
  /** Vide quand le wiki ne date pas le skin. */
  sortie: string,
  /** Position dans `DISPOS`, -1 inconnue. */
  dispo: number,
  prix: Prix,
  obtention: string | null,
  /** Relative au dossier du heros quand elle y est. */
  image: string | null,
];

export interface IndexSkins {
  maj: string;
  heros: HerosIndex[];
  series: string[];
  skins: SkinIndex[];
}

/**
 * Ancres des skins d'un heros, dans l'ordre de sa galerie : deux noms qui se
 * reduisent au meme texte prennent un suffixe. Meme regle que `ancresGalerie`.
 */
export function ancresDe(noms: readonly string[]): string[] {
  const vues = new Map<string, number>();
  return noms.map((nom) => {
    const base = ancreSkin(nom);
    const n = (vues.get(base) ?? 0) + 1;
    vues.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** Series classees de la plus fournie a la plus rare : les plus courantes ont les plus petits numeros. */
function dictionnaireSeries(skins: readonly SkinCatalogue[]): string[] {
  const comptes = new Map<string, number>();
  for (const s of skins) if (s.serie) comptes.set(s.serie, (comptes.get(s.serie) ?? 0) + 1);
  return [...comptes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en")).map(([s]) => s);
}

export function encoderIndex(c: Catalogue): IndexSkins {
  const series = dictionnaireSeries(c.skins);
  const numeroSerie = new Map(series.map((s, i) => [s, i]));
  const numeroHeros = new Map(c.heros.map((h, i) => [h.slug, i]));
  return {
    maj: c.maj,
    heros: c.heros.map((h) => [
      h.slug,
      h.nom,
      h.roles.map((r) => ROLES_INDEX.indexOf(r)).filter((i) => i >= 0),
      relatifHeros(h.slug, h.icone),
    ]),
    series,
    skins: c.skins.map((s) => [
      numeroHeros.get(s.heros) ?? -1,
      s.id,
      s.nom,
      s.rarete,
      s.serie ? (numeroSerie.get(s.serie) ?? -1) : -1,
      s.sortie ?? "",
      s.dispo ? DISPOS.indexOf(s.dispo) : -1,
      s.prix,
      s.obtention,
      relatifHeros(s.heros, s.image),
    ]),
  };
}

export function decoderIndex(index: IndexSkins): Catalogue {
  const heros: HerosCatalogue[] = index.heros.map(([slug, nom, roles, icone]) => ({
    slug,
    nom,
    roles: roles.map((i) => ROLES_INDEX[i]).filter(Boolean),
    icone: absoluHeros(slug, icone),
  }));
  const skins: SkinCatalogue[] = index.skins.map(([h, id, nom, rarete, serie, sortie, dispo, prix, obtention, image]) => {
    const slug = heros[h]?.slug ?? "";
    return {
      id,
      nom,
      heros: slug,
      rarete,
      serie: index.series[serie] ?? null,
      sortie: sortie || null,
      dispo: DISPOS[dispo] ?? null,
      prix,
      obtention,
      image: absoluHeros(slug, image),
      ancre: "",
    };
  });
  // Les ancres se recalculent dans l'ordre de chaque galerie, plutot que de voyager dans l'index.
  const parHeros = new Map<string, SkinCatalogue[]>();
  for (const s of skins) parHeros.set(s.heros, [...(parHeros.get(s.heros) ?? []), s]);
  for (const liste of parHeros.values()) {
    const ancres = ancresDe(liste.map((s) => s.nom));
    liste.forEach((s, i) => (s.ancre = ancres[i]));
  }
  return { maj: index.maj, heros, skins };
}

/** Index charge une seule fois par visite, au premier besoin. */
let promesse: Promise<Catalogue> | null = null;
export function chargerCatalogue(langue: string): Promise<Catalogue> {
  promesse ??= fetch(`/${langue}/skins/calendar/skins.json`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<IndexSkins>;
    })
    .then(decoderIndex)
    .catch((e) => {
      // Un echec (hors ligne) ne doit pas bloquer le prochain essai.
      promesse = null;
      throw e;
    });
  return promesse;
}

// ── Dates ──────────────────────────────────────────────────────────

export interface DateSortie {
  annee: number;
  mois: number | null;
  jour: number | null;
}

const FORMAT_SORTIE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Date du wiki, au jour, au mois ou a l'annee ; null quand elle est approximative (« 202X ») ou absente. */
export function lireSortie(sortie: string | null | undefined): DateSortie | null {
  const m = sortie ? FORMAT_SORTIE.exec(sortie) : null;
  if (!m) return null;
  return { annee: Number(m[1]), mois: m[2] ? Number(m[2]) : null, jour: m[3] ? Number(m[3]) : null };
}

/**
 * Skin sorti a la date de reference : date lisible, ni annonce (« a venir »),
 * ni date posterieure. Une date au mois ou a l'annee se compare a sa
 * precision : « 2026-09 » est sorti le 11 septembre 2026.
 */
export function estSorti(s: SkinCatalogue, reference: string): boolean {
  if (s.dispo === "Upcoming" || !s.sortie || !lireSortie(s.sortie)) return false;
  return s.sortie <= reference.slice(0, s.sortie.length);
}

export interface MoisSkins {
  /** 1 a 12, null quand le wiki ne donne que l'annee. */
  mois: number | null;
  skins: SkinCatalogue[];
}
export interface AnneeSkins {
  annee: number;
  total: number;
  mois: MoisSkins[];
}

/**
 * Skins ranges par annee puis par mois. `recent` : annees et mois du plus
 * recent au plus ancien ; `chronologique` : l'annee se lit de janvier a
 * decembre. Les skins dates a l'annee seule ferment toujours leur annee. Un
 * skin sans date lisible est ecarte.
 */
export function grouperParDate(
  skins: readonly SkinCatalogue[],
  ordre: "recent" | "chronologique" = "recent",
): AnneeSkins[] {
  const sens = ordre === "recent" ? -1 : 1;
  const annees = new Map<number, Map<number | null, SkinCatalogue[]>>();
  for (const s of skins) {
    const d = lireSortie(s.sortie);
    if (!d) continue;
    const parMois = annees.get(d.annee) ?? new Map<number | null, SkinCatalogue[]>();
    annees.set(d.annee, parMois);
    parMois.set(d.mois, [...(parMois.get(d.mois) ?? []), s]);
  }
  return [...annees]
    .sort((a, b) => sens * (a[0] - b[0]))
    .map(([annee, parMois]) => {
      const mois = [...parMois]
        .sort((a, b) => (a[0] === null ? 1 : b[0] === null ? -1 : sens * (a[0] - b[0])))
        .map(([m, liste]) => ({
          mois: m,
          skins: [...liste].sort(
            (a, b) => sens * (a.sortie ?? "").localeCompare(b.sortie ?? "") || a.nom.localeCompare(b.nom, "en"),
          ),
        }));
      return { annee, total: mois.reduce((n, m) => n + m.skins.length, 0), mois };
    });
}

/** Les `limite` premiers skins de groupes deja ordonnes, groupes compris : l'affichage s'allonge par pas. */
export function tronquerGroupes(groupes: readonly AnneeSkins[], limite: number): AnneeSkins[] {
  let reste = limite;
  const sortie: AnneeSkins[] = [];
  for (const a of groupes) {
    if (reste <= 0) break;
    const mois: MoisSkins[] = [];
    for (const m of a.mois) {
      if (reste <= 0) break;
      const skins = m.skins.slice(0, reste);
      reste -= skins.length;
      mois.push({ mois: m.mois, skins });
    }
    sortie.push({ annee: a.annee, total: a.total, mois });
  }
  return sortie;
}

/** Les skins dates au moins au mois, du plus recent au plus ancien. */
export function plusRecents(skins: readonly SkinCatalogue[], nombre: number): SkinCatalogue[] {
  return skins
    .filter((s) => (lireSortie(s.sortie)?.mois ?? null) !== null)
    .sort((a, b) => b.sortie!.localeCompare(a.sortie!) || a.nom.localeCompare(b.nom, "en"))
    .slice(0, nombre);
}

// ── Filtres et series ──────────────────────────────────────────────

export interface FiltresSkins {
  recherche?: string;
  heros?: string | null;
  role?: Role | null;
  serie?: string | null;
  rarete?: number | null;
  annee?: number | null;
}

/** La recherche porte sur le nom du skin et sur celui de son heros, sans casse ni accents. */
export function filtrerSkins(
  skins: readonly SkinCatalogue[],
  heros: ReadonlyMap<string, HerosCatalogue>,
  f: FiltresSkins,
): SkinCatalogue[] {
  const terme = cleRecherche((f.recherche ?? "").trim());
  return skins.filter((s) => {
    const h = heros.get(s.heros);
    if (f.heros && s.heros !== f.heros) return false;
    if (f.role && !h?.roles.includes(f.role)) return false;
    if (f.serie && s.serie !== f.serie) return false;
    if (f.rarete != null && s.rarete !== f.rarete) return false;
    if (f.annee != null && lireSortie(s.sortie)?.annee !== f.annee) return false;
    if (terme && !cleRecherche(s.nom).includes(terme) && !cleRecherche(h?.nom ?? "").includes(terme)) return false;
    return true;
  });
}

export interface StatSerie {
  serie: string;
  total: number;
  /** Premiere et derniere date connues de la serie. */
  premiere: string | null;
  derniere: string | null;
}

/** Series presentes, de la plus fournie a la plus rare. */
export function statsSeries(skins: readonly SkinCatalogue[]): StatSerie[] {
  const parSerie = new Map<string, StatSerie>();
  for (const s of skins) {
    if (!s.serie) continue;
    const st = parSerie.get(s.serie) ?? { serie: s.serie, total: 0, premiere: null, derniere: null };
    st.total += 1;
    if (lireSortie(s.sortie)) {
      if (!st.premiere || s.sortie! < st.premiere) st.premiere = s.sortie;
      if (!st.derniere || s.sortie! > st.derniere) st.derniere = s.sortie;
    }
    parSerie.set(s.serie, st);
  }
  return [...parSerie.values()].sort((a, b) => b.total - a.total || a.serie.localeCompare(b.serie, "en"));
}

// ── Libelles ───────────────────────────────────────────────────────

const PAR_RANG: Rarete[] = [RARETE_ORIGINE, ...Object.values(RARETES).sort((a, b) => a.rang - b.rang)];

export function rareteDeRang(rang: number): Rarete {
  return PAR_RANG[rang] ?? RARETE_ORIGINE;
}

/** Rangs des raretes achetables, du plus commun au plus rare. */
export const RANGS_RARETE = PAR_RANG.slice(1).map((r) => r.rang);

/** Libelle traduit d'une valeur du wiki, ou la valeur elle-meme quand le catalogue ne la connait pas. */
export function libelleOu(t: T, cle: string, valeur: string): string {
  const trad = t(`${cle}.${valeur}`);
  return trad === `${cle}.${valeur}` ? valeur : trad;
}

export const libelleRarete = (t: T, rang: number) => t(`skinRarity.${rareteDeRang(rang).cle}`);
export const libelleSerie = (t: T, serie: string) => libelleOu(t, "skinLabel", serie);

/** « 599 diamants · 32 000 points de bataille », ou null sans prix chiffre. */
export function textePrix(prix: Prix, t: T, nombre: Intl.NumberFormat): string | null {
  const parties = MONNAIES_CHIFFREES.flatMap((m) =>
    prix[m] != null ? [`${nombre.format(prix[m]!)} ${t(`skinsUI.${LIBELLE_MONNAIE[m]}`).toLowerCase()}`] : [],
  );
  return parties.length ? parties.join(" · ") : null;
}

/** Galerie du heros, ouverte sur le skin. */
export const lienSkin = (s: SkinCatalogue) => `/heroes/${s.heros}/skins#${s.ancre}`;

/**
 * Heure du serveur MLBB et remises a zero.
 *
 * Module pur, sans donnees : le composant client de l'horloge l'importe tel
 * quel. Toutes les echeances se calculent en millisecondes UTC, a partir d'une
 * seule constante de fuseau.
 */

const MINUTE = 60_000;
const JOUR = 86_400_000;

/**
 * Decalage de l'heure serveur sur UTC, en minutes : UTC-8, toute l'annee, sans
 * heure d'ete.
 *
 * Source : wiki Fandom, page « Server time » (consultee le 11 septembre 2026),
 * https://mobilelegends.fandom.com/wiki/Server_time — « Coordinated Universal
 * Time (UTC) subtracted by eight hours ». Son tableau le recoupe (00:00 serveur
 * = 16:00 a Manille, 09:00 a Paris l'hiver), comme les notes de patch, qui
 * datent fins et debuts de saison « (Server Time) ». Les sources qui annoncent
 * « minuit UTC+8 » confondent le fuseau du public asiatique avec celui du jeu.
 */
export const DECALAGE_SERVEUR_MIN = -8 * 60;

/** Le meme fuseau pour Intl. Les zones `Etc/` inversent le signe : `Etc/GMT+8` vaut UTC-8. */
export const FUSEAU_SERVEUR = "Etc/GMT+8";

/**
 * Heure serveur des remises, meme source : taches quotidiennes a 00:00, taches
 * hebdomadaires le lundi a 00:00. Le Starlight repart le 1er de chaque mois a
 * 00:00 (page « StarLight » du meme wiki).
 */
export const HEURE_REMISE = 0;
/** Jour de la remise hebdomadaire, numerote comme `getUTCDay` : 1 = lundi. */
export const JOUR_REMISE_HEBDO = 1;

export const SOURCES_HEURE = {
  serveur: "https://mobilelegends.fandom.com/wiki/Server_time",
  starlight: "https://mobilelegends.fandom.com/wiki/StarLight",
} as const;

/** Instant UTC d'une heure « murale » du serveur (annee, mois 0-11, jour, heure…). */
function instantServeur(annee: number, mois: number, jour: number, heure = 0, minute = 0, seconde = 0): number {
  return Date.UTC(annee, mois, jour, heure, minute, seconde) - DECALAGE_SERVEUR_MIN * MINUTE;
}

/** Heure murale du serveur : une date dont les champs UTC donnent l'heure serveur. */
export function muralServeur(instant: number): Date {
  return new Date(instant + DECALAGE_SERVEUR_MIN * MINUTE);
}

/** Prochaine remise quotidienne, strictement apres `maintenant`. */
export function prochaineRemiseQuotidienne(maintenant: number): number {
  const m = muralServeur(maintenant);
  const aujourdhui = instantServeur(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate(), HEURE_REMISE);
  return aujourdhui > maintenant ? aujourdhui : aujourdhui + JOUR;
}

/** Prochaine remise hebdomadaire (lundi 00:00 serveur), strictement apres `maintenant`. */
export function prochaineRemiseHebdo(maintenant: number): number {
  const m = muralServeur(maintenant);
  const ecart = (JOUR_REMISE_HEBDO - m.getUTCDay() + 7) % 7;
  const cible = instantServeur(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate() + ecart, HEURE_REMISE);
  return cible > maintenant ? cible : cible + 7 * JOUR;
}

/** Prochain depart du Starlight (1er du mois, 00:00 serveur), strictement apres `maintenant`. */
export function prochainStarlight(maintenant: number): number {
  const m = muralServeur(maintenant);
  const ceMois = instantServeur(m.getUTCFullYear(), m.getUTCMonth(), 1, HEURE_REMISE);
  return ceMois > maintenant ? ceMois : instantServeur(m.getUTCFullYear(), m.getUTCMonth() + 1, 1, HEURE_REMISE);
}

export interface Duree {
  jours: number;
  heures: number;
  minutes: number;
  secondes: number;
}

/** Decoupe une duree en jours, heures, minutes et secondes entieres ; jamais negative. */
export function decomposer(ms: number): Duree {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    jours: Math.floor(s / 86_400),
    heures: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    secondes: s % 60,
  };
}

/**
 * Decalage d'un fuseau IANA sur UTC a un instant donne, en minutes : il suit
 * l'heure d'ete, ce qu'un decalage fixe ne ferait pas.
 */
export function decalageFuseau(fuseau: string, instant: number): number {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const v = (type: Intl.DateTimeFormatPartTypes) => Number(parties.find((p) => p.type === type)?.value ?? 0);
  const mural = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second"));
  return Math.round((mural - Math.floor(instant / 1000) * 1000) / MINUTE);
}

/** « UTC+2 », « UTC−3 », « UTC+5:30 », « UTC ». */
export function libelleDecalage(minutes: number): string {
  if (minutes === 0) return "UTC";
  const absolu = Math.abs(minutes);
  const reste = absolu % 60;
  return `UTC${minutes > 0 ? "+" : "−"}${Math.floor(absolu / 60)}${reste ? `:${String(reste).padStart(2, "0")}` : ""}`;
}

/** Fin de saison classee, telle que l'annoncent les notes de patch. */
export interface FinSaison {
  saison: number;
  /** Instant UTC, en millisecondes. */
  fin: number;
  /** Version du patch qui l'annonce. */
  patch: string;
  lien: string;
}

/**
 * « S31 will end at 23:59:59 on 3/15 (Server Time). » : la seule forme sous
 * laquelle le jeu date une fin de saison. Mois et jour, sans annee.
 */
const MOTIF_FIN = /\bS(\d+) will end at (\d{1,2}):(\d{2}):(\d{2}) on (\d{1,2})\/(\d{1,2}) \(Server Time\)/gi;

/**
 * Fins de saison annoncees dans les notes de patch synchronisees, de la plus
 * ancienne a la plus recente. L'annee manque : c'est celle du patch, ou la
 * suivante quand la date tombe plus d'un mois avant sa publication (patch de
 * decembre, fin en janvier).
 */
export function finsDeSaison(
  patchs: { version: string; link: string; date?: string | null; sections: { html: string }[] }[],
): FinSaison[] {
  const fins = new Map<number, FinSaison>();
  for (const p of patchs) {
    if (!p.date) continue;
    const publie = Date.parse(`${p.date}T00:00:00Z`);
    if (Number.isNaN(publie)) continue;
    const annee = new Date(publie).getUTCFullYear();
    for (const section of p.sections) {
      for (const m of section.html.matchAll(MOTIF_FIN)) {
        const [, saison, h, mi, s, mois, jour] = m.map(Number);
        let fin = instantServeur(annee, mois - 1, jour, h, mi, s);
        if (fin < publie - 31 * JOUR) fin = instantServeur(annee + 1, mois - 1, jour, h, mi, s);
        if (!fins.has(saison) || fins.get(saison)!.fin < fin) fins.set(saison, { saison, fin, patch: p.version, lien: p.link });
      }
    }
  }
  return [...fins.values()].sort((a, b) => a.fin - b.fin);
}

/** Prochaine fin de saison encore a venir, ou null quand aucune n'est annoncee. */
export function prochaineFinSaison(fins: FinSaison[], maintenant: number): FinSaison | null {
  return fins.find((f) => f.fin > maintenant) ?? null;
}

/**
 * Pays du tableau des heures locales, par langue du site : ceux ou le jeu a le
 * plus de joueurs parlant cette langue. Le nom du pays vient d'Intl
 * (`DisplayNames`), dans la langue du lecteur ; la ville ne sert qu'a
 * distinguer les pays a plusieurs fuseaux.
 */
export interface PaysFuseau {
  /** Code ISO 3166-1. */
  pays: string;
  fuseau: string;
  ville?: string;
}

export const PAYS_PAR_LANGUE: Record<"fr" | "en" | "it" | "es", PaysFuseau[]> = {
  fr: [
    { pays: "FR", fuseau: "Europe/Paris" },
    { pays: "BE", fuseau: "Europe/Brussels" },
    { pays: "CH", fuseau: "Europe/Zurich" },
    { pays: "LU", fuseau: "Europe/Luxembourg" },
    { pays: "CA", fuseau: "America/Toronto", ville: "Montréal" },
    { pays: "MA", fuseau: "Africa/Casablanca" },
    { pays: "DZ", fuseau: "Africa/Algiers" },
    { pays: "TN", fuseau: "Africa/Tunis" },
    { pays: "SN", fuseau: "Africa/Dakar" },
    { pays: "CI", fuseau: "Africa/Abidjan" },
    { pays: "CM", fuseau: "Africa/Douala" },
    { pays: "CD", fuseau: "Africa/Kinshasa" },
    { pays: "RE", fuseau: "Indian/Reunion" },
  ],
  it: [
    { pays: "IT", fuseau: "Europe/Rome" },
    { pays: "CH", fuseau: "Europe/Zurich" },
    { pays: "SM", fuseau: "Europe/San_Marino" },
    { pays: "MT", fuseau: "Europe/Malta" },
  ],
  es: [
    { pays: "ES", fuseau: "Europe/Madrid" },
    { pays: "MX", fuseau: "America/Mexico_City" },
    { pays: "CO", fuseau: "America/Bogota" },
    { pays: "AR", fuseau: "America/Argentina/Buenos_Aires" },
    { pays: "PE", fuseau: "America/Lima" },
    { pays: "CL", fuseau: "America/Santiago" },
    { pays: "VE", fuseau: "America/Caracas" },
    { pays: "EC", fuseau: "America/Guayaquil" },
    { pays: "BO", fuseau: "America/La_Paz" },
    { pays: "GT", fuseau: "America/Guatemala" },
    { pays: "DO", fuseau: "America/Santo_Domingo" },
  ],
  en: [
    { pays: "US", fuseau: "America/New_York", ville: "New York" },
    { pays: "US", fuseau: "America/Los_Angeles", ville: "Los Angeles" },
    { pays: "GB", fuseau: "Europe/London" },
    { pays: "IE", fuseau: "Europe/Dublin" },
    { pays: "CA", fuseau: "America/Vancouver", ville: "Vancouver" },
    { pays: "AU", fuseau: "Australia/Sydney", ville: "Sydney" },
    { pays: "IN", fuseau: "Asia/Kolkata" },
    { pays: "PH", fuseau: "Asia/Manila" },
    { pays: "MY", fuseau: "Asia/Kuala_Lumpur" },
    { pays: "SG", fuseau: "Asia/Singapore" },
    { pays: "NG", fuseau: "Africa/Lagos" },
    { pays: "ZA", fuseau: "Africa/Johannesburg" },
  ],
};

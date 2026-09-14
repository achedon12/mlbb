/**
 * Heure du serveur MLBB et remises a zero.
 *
 * Module pur, sans donnees : le composant client de l'horloge l'importe tel
 * quel. Toutes les echeances se calculent en millisecondes UTC, a partir d'une
 * seule constante de fuseau.
 */

const MINUTE = 60_000;
const DAY = 86_400_000;

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
export const SERVER_OFFSET_MIN = -8 * 60;

/** Le meme fuseau pour Intl. Les zones `Etc/` inversent le signe : `Etc/GMT+8` vaut UTC-8. */
export const SERVER_TIMEZONE = "Etc/GMT+8";

/**
 * Heure serveur des remises, meme source : taches quotidiennes a 00:00, taches
 * hebdomadaires le lundi a 00:00. Le Starlight repart le 1er de chaque mois a
 * 00:00 (page « StarLight » du meme wiki).
 */
export const TIME_RESET = 0;
/** Jour de la remise hebdomadaire, numerote comme `getUTCDay` : 1 = lundi. */
export const DAY_RESET_WEEKLY = 1;

export const TIME_SOURCES = {
  server: "https://mobilelegends.fandom.com/wiki/Server_time",
  starlight: "https://mobilelegends.fandom.com/wiki/StarLight",
} as const;

/** Instant UTC d'une heure « murale » du serveur (annee, mois 0-11, jour, heure…). */
function instantServer(year: number, month: number, day: number, time = 0, minute = 0, second = 0): number {
  return Date.UTC(year, month, day, time, minute, second) - SERVER_OFFSET_MIN * MINUTE;
}

/** Heure murale du serveur : une date dont les champs UTC donnent l'heure serveur. */
export function wallServer(instant: number): Date {
  return new Date(instant + SERVER_OFFSET_MIN * MINUTE);
}

/** Prochaine remise quotidienne, strictement apres `maintenant`. */
export function nextResetDaily(now: number): number {
  const m = wallServer(now);
  const today = instantServer(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate(), TIME_RESET);
  return today > now ? today : today + DAY;
}

/** Prochaine remise hebdomadaire (lundi 00:00 serveur), strictement apres `maintenant`. */
export function nextResetWeekly(now: number): number {
  const m = wallServer(now);
  const gap = (DAY_RESET_WEEKLY - m.getUTCDay() + 7) % 7;
  const target = instantServer(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate() + gap, TIME_RESET);
  return target > now ? target : target + 7 * DAY;
}

/** Prochain depart du Starlight (1er du mois, 00:00 serveur), strictement apres `maintenant`. */
export function nextStarlight(now: number): number {
  const m = wallServer(now);
  const ceMonth = instantServer(m.getUTCFullYear(), m.getUTCMonth(), 1, TIME_RESET);
  return ceMonth > now ? ceMonth : instantServer(m.getUTCFullYear(), m.getUTCMonth() + 1, 1, TIME_RESET);
}

export interface Duration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Decoupe une duree en jours, heures, minutes et secondes entieres ; jamais negative. */
export function split(ms: number): Duration {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/**
 * Decalage d'un fuseau IANA sur UTC a un instant donne, en minutes : il suit
 * l'heure d'ete, ce qu'un decalage fixe ne ferait pas.
 */
export function offsetTimezone(timezone: string, instant: number): number {
  const matches = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const v = (type: Intl.DateTimeFormatPartTypes) => Number(matches.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second"));
  return Math.round((wall - Math.floor(instant / 1000) * 1000) / MINUTE);
}

/** « UTC+2 », « UTC−3 », « UTC+5:30 », « UTC ». */
export function labelOffset(minutes: number): string {
  if (minutes === 0) return "UTC";
  const absolute = Math.abs(minutes);
  const rest = absolute % 60;
  return `UTC${minutes > 0 ? "+" : "−"}${Math.floor(absolute / 60)}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/** Fin de saison classee, telle que l'annoncent les notes de patch. */
export interface EndSeason {
  season: number;
  /** Instant UTC, en millisecondes. */
  end: number;
  /** Version du patch qui l'annonce. */
  patch: string;
  link: string;
}

/**
 * « S31 will end at 23:59:59 on 3/15 (Server Time). » : la seule forme sous
 * laquelle le jeu date une fin de saison. Mois et jour, sans annee.
 */
const PATTERN_END = /\bS(\d+) will end at (\d{1,2}):(\d{2}):(\d{2}) on (\d{1,2})\/(\d{1,2}) \(Server Time\)/gi;

/**
 * Fins de saison annoncees dans les notes de patch synchronisees, de la plus
 * ancienne a la plus recente. L'annee manque : c'est celle du patch, ou la
 * suivante quand la date tombe plus d'un mois avant sa publication (patch de
 * decembre, fin en janvier).
 */
export function endsOfSeason(
  patches: { version: string; link: string; date?: string | null; sections: { html: string }[] }[],
): EndSeason[] {
  const ends = new Map<number, EndSeason>();
  for (const p of patches) {
    if (!p.date) continue;
    const published = Date.parse(`${p.date}T00:00:00Z`);
    if (Number.isNaN(published)) continue;
    const year = new Date(published).getUTCFullYear();
    for (const section of p.sections) {
      for (const m of section.html.matchAll(PATTERN_END)) {
        const [, season, h, mi, s, month, day] = m.map(Number);
        let end = instantServer(year, month - 1, day, h, mi, s);
        if (end < published - 31 * DAY) end = instantServer(year + 1, month - 1, day, h, mi, s);
        if (!ends.has(season) || ends.get(season)!.end < end) ends.set(season, { season, end, patch: p.version, link: p.link });
      }
    }
  }
  return [...ends.values()].sort((a, b) => a.end - b.end);
}

/** Prochaine fin de saison encore a venir, ou null quand aucune n'est annoncee. */
export function nextEndSeason(ends: EndSeason[], now: number): EndSeason | null {
  return ends.find((f) => f.end > now) ?? null;
}

/**
 * Pays du tableau des heures locales, par langue du site : ceux ou le jeu a le
 * plus de joueurs parlant cette langue. Le nom du pays vient d'Intl
 * (`DisplayNames`), dans la langue du lecteur ; la ville ne sert qu'a
 * distinguer les pays a plusieurs fuseaux.
 */
export interface CountryTimezone {
  /** Code ISO 3166-1. */
  country: string;
  timezone: string;
  city?: string;
}

export const COUNTRY_BY_LOCALE: Record<"fr" | "en" | "it" | "es", CountryTimezone[]> = {
  fr: [
    { country: "FR", timezone: "Europe/Paris" },
    { country: "BE", timezone: "Europe/Brussels" },
    { country: "CH", timezone: "Europe/Zurich" },
    { country: "LU", timezone: "Europe/Luxembourg" },
    { country: "CA", timezone: "America/Toronto", city: "Montréal" },
    { country: "MA", timezone: "Africa/Casablanca" },
    { country: "DZ", timezone: "Africa/Algiers" },
    { country: "TN", timezone: "Africa/Tunis" },
    { country: "SN", timezone: "Africa/Dakar" },
    { country: "CI", timezone: "Africa/Abidjan" },
    { country: "CM", timezone: "Africa/Douala" },
    { country: "CD", timezone: "Africa/Kinshasa" },
    { country: "RE", timezone: "Indian/Reunion" },
  ],
  it: [
    { country: "IT", timezone: "Europe/Rome" },
    { country: "CH", timezone: "Europe/Zurich" },
    { country: "SM", timezone: "Europe/San_Marino" },
    { country: "MT", timezone: "Europe/Malta" },
  ],
  es: [
    { country: "ES", timezone: "Europe/Madrid" },
    { country: "MX", timezone: "America/Mexico_City" },
    { country: "CO", timezone: "America/Bogota" },
    { country: "AR", timezone: "America/Argentina/Buenos_Aires" },
    { country: "PE", timezone: "America/Lima" },
    { country: "CL", timezone: "America/Santiago" },
    { country: "VE", timezone: "America/Caracas" },
    { country: "EC", timezone: "America/Guayaquil" },
    { country: "BO", timezone: "America/La_Paz" },
    { country: "GT", timezone: "America/Guatemala" },
    { country: "DO", timezone: "America/Santo_Domingo" },
  ],
  en: [
    { country: "US", timezone: "America/New_York", city: "New York" },
    { country: "US", timezone: "America/Los_Angeles", city: "Los Angeles" },
    { country: "GB", timezone: "Europe/London" },
    { country: "IE", timezone: "Europe/Dublin" },
    { country: "CA", timezone: "America/Vancouver", city: "Vancouver" },
    { country: "AU", timezone: "Australia/Sydney", city: "Sydney" },
    { country: "IN", timezone: "Asia/Kolkata" },
    { country: "PH", timezone: "Asia/Manila" },
    { country: "MY", timezone: "Asia/Kuala_Lumpur" },
    { country: "SG", timezone: "Asia/Singapore" },
    { country: "NG", timezone: "Africa/Lagos" },
    { country: "ZA", timezone: "Africa/Johannesburg" },
  ],
};

/**
 * Consent to the audience measurement cookies.
 *
 * Matomo always measures, but without a cookie until the visitor says yes:
 * the tracker starts with `requireCookieConsent` (`<Analytics />`), which
 * keeps it cookieless — as the site always was — until consent is given.
 * Accepting lets it set its cookies (`_pk_id`, `_pk_ses`…), so a returning
 * visitor is recognised; refusing, or withdrawing later, deletes them and
 * goes back to cookieless measurement.
 *
 * The choice itself is kept in the browser's `localStorage`, with its date,
 * and asked again after `CONSENT_LIFETIME_MS` — six months, as the CNIL
 * recommends. Matomo's own consent cookie (`mtm_cookie_consent`) is given the
 * same lifetime, so both lapse together. Nothing here sets a cookie before
 * the visitor accepts.
 *
 * The decisions are pure functions, tested without a browser; the storage
 * access is kept apart and guarded: with storage blocked, the choice holds
 * for the open page only, and the banner comes back on the next load.
 */
import { analyticsEnabled, trackEvent, type Command, pushCommands } from "@/lib/analytics";

export type ConsentChoice = "granted" | "denied";
export type ConsentRecord = { choice: ConsentChoice; at: number };

/** Six months, the longest the CNIL advises keeping a choice before asking again. */
export const CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;
/** The same, in hours, as Matomo's `rememberCookieConsentGiven` takes it. */
export const CONSENT_LIFETIME_HOURS = CONSENT_LIFETIME_MS / (60 * 60 * 1000);
/** Lifetime of Matomo's visitor cookie `_pk_id`: 393 days, within the 13 months allowed. */
export const VISITOR_COOKIE_SECONDS = 393 * 24 * 60 * 60;

export const CONSENT_KEY = "mlbb_consent";
/** Matomo's own cookie, set by `rememberCookieConsentGiven`. */
export const MATOMO_CONSENT_COOKIE = "mtm_cookie_consent";

/**
 * A stored choice, or null when there is none to honour: absent, corrupted,
 * older than six months, or dated in the future (a clock set wrong).
 */
export function parseConsent(raw: string | null, now: number): ConsentRecord | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const { choice, at } = value as Partial<ConsentRecord>;
  if (choice !== "granted" && choice !== "denied") return null;
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  if (at > now + 24 * 60 * 60 * 1000 || now - at >= CONSENT_LIFETIME_MS) return null;
  return { choice, at };
}

/** What Matomo is told when the visitor makes a choice in the banner. */
export function choiceCommands(choice: ConsentChoice): Command[] {
  return choice === "granted"
    ? [["rememberCookieConsentGiven", CONSENT_LIFETIME_HOURS]]
    : [["forgetCookieConsentGiven"]];
}

/**
 * On page load, brings Matomo's consent cookie in line with the stored
 * choice, which is the reference: a lapsed, refused or erased choice whose
 * Matomo cookie lingers is withdrawn (cookies deleted); a valid acceptance
 * whose Matomo cookie was cleared is restored for the time it has left.
 */
export function reconcileCommands(record: ConsentRecord | null, hasMatomoCookie: boolean, now: number): Command[] {
  if (record?.choice === "granted") {
    if (hasMatomoCookie) return [];
    const hours = Math.max(1, Math.ceil((record.at + CONSENT_LIFETIME_MS - now) / (60 * 60 * 1000)));
    return [["rememberCookieConsentGiven", hours]];
  }
  return hasMatomoCookie ? [["forgetCookieConsentGiven"]] : [];
}

/* ------------------------------------------------------------------------ */
/* Browser side: storage, and a small store the banner and the footer share. */

type State = {
  /** The stored choice, or null: the banner then asks. */
  record: ConsentRecord | null;
  /** Reopened from "Manage cookies", whatever the stored choice. */
  open: boolean;
};

const HIDDEN: State = { record: { choice: "denied", at: 0 }, open: false };
let state: State | null = null;
const listeners = new Set<() => void>();

function readStored(now: number): ConsentRecord | null {
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY), now);
  } catch {
    return null;
  }
}

function writeStored(record: ConsentRecord) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    /* storage blocked: the choice holds for this page only */
  }
}

function hasMatomoCookie(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${MATOMO_CONSENT_COOKIE}=`));
}

function setState(next: State) {
  state = next;
  for (const l of listeners) l();
}

/** The banner's state; read once per page load, then kept in memory. */
export function getConsentState(): State {
  state ??= { record: readStored(Date.now()), open: false };
  return state;
}

/** Once per page load, before the visitor answers: Matomo's cookie follows the stored choice. */
export function reconcileConsent() {
  if (!analyticsEnabled) return;
  pushCommands(...reconcileCommands(getConsentState().record, hasMatomoCookie(), Date.now()));
}

/** What the server renders, and the first render in the browser: nothing to show. */
export function getServerConsentState(): State {
  return HIDDEN;
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab made a choice: follow it.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CONSENT_KEY) return;
    setState({ record: parseConsent(e.newValue, Date.now()), open: state?.open ?? false });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The visitor's answer: stored, applied to Matomo, and the banner closes. */
export function chooseConsent(choice: ConsentChoice) {
  const previous = getConsentState().record?.choice;
  const record = { choice, at: Date.now() };
  writeStored(record);
  pushCommands(...choiceCommands(choice));
  // Counted cookieless either way: how many accept, how many refuse or change their mind.
  trackEvent("Consent", choice === "granted" ? "Accept" : previous === "granted" ? "Withdraw" : "Refuse");
  setState({ record, open: false });
}

/** "Manage cookies": shows the banner again, to change or withdraw the choice. */
export function reopenConsent() {
  setState({ ...getConsentState(), open: true });
}

/** Closes the reopened banner, keeping the choice already made. */
export function closeConsent() {
  setState({ ...getConsentState(), open: false });
}

/** Test hook: forgets the in-memory state, as a new page load would. */
export function resetConsentState() {
  state = null;
}

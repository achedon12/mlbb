import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_KEY,
  CONSENT_LIFETIME_HOURS,
  CONSENT_LIFETIME_MS,
  choiceCommands,
  parseConsent,
  reconcileCommands,
  VISITOR_COOKIE_SECONDS,
} from "@/lib/consent";

/**
 * Consent to the audience measurement cookies: the stored choice, its
 * six-month lifetime, and what Matomo is told on accept, refuse, withdraw
 * and on every page load. The browser side runs against a stubbed
 * `window`, `localStorage` and `document.cookie`; the module reads its
 * settings on import, hence a fresh import per case.
 */
const NOW = Date.UTC(2026, 10, 15, 12);
const DAY = 24 * 60 * 60 * 1000;
const record = (choice: string, at: number) => JSON.stringify({ choice, at });

describe("parseConsent", () => {
  it("reads a recent choice", () => {
    expect(parseConsent(record("granted", NOW - DAY), NOW)).toEqual({ choice: "granted", at: NOW - DAY });
    expect(parseConsent(record("denied", NOW), NOW)).toEqual({ choice: "denied", at: NOW });
  });

  it("asks again once six months have passed", () => {
    expect(CONSENT_LIFETIME_MS).toBe(180 * DAY);
    expect(parseConsent(record("granted", NOW - CONSENT_LIFETIME_MS + 1), NOW)).not.toBeNull();
    expect(parseConsent(record("granted", NOW - CONSENT_LIFETIME_MS), NOW)).toBeNull();
    expect(parseConsent(record("denied", NOW - 365 * DAY), NOW)).toBeNull();
  });

  it("ignores anything it cannot trust", () => {
    expect(parseConsent(null, NOW)).toBeNull();
    expect(parseConsent("", NOW)).toBeNull();
    expect(parseConsent("{not json", NOW)).toBeNull();
    expect(parseConsent("null", NOW)).toBeNull();
    expect(parseConsent(record("maybe", NOW), NOW)).toBeNull();
    expect(parseConsent(JSON.stringify({ choice: "granted" }), NOW)).toBeNull();
    expect(parseConsent(JSON.stringify({ choice: "granted", at: "yesterday" }), NOW)).toBeNull();
    // Dated in the future: a clock set wrong would make it last forever.
    expect(parseConsent(record("granted", NOW + 2 * DAY), NOW)).toBeNull();
  });
});

describe("Matomo commands", () => {
  it("remembers an acceptance for six months, no longer", () => {
    expect(CONSENT_LIFETIME_HOURS).toBe(180 * 24);
    expect(choiceCommands("granted")).toEqual([["rememberCookieConsentGiven", CONSENT_LIFETIME_HOURS]]);
  });

  it("forgets the consent, and so the cookies, on a refusal", () => {
    expect(choiceCommands("denied")).toEqual([["forgetCookieConsentGiven"]]);
  });

  it("keeps the visitor cookie within 13 months", () => {
    expect(VISITOR_COOKIE_SECONDS).toBeLessThanOrEqual(395 * 24 * 60 * 60);
  });

  it("brings Matomo's cookie in line with the stored choice on load", () => {
    const granted = { choice: "granted" as const, at: NOW - 10 * DAY };
    // In line already: nothing to say.
    expect(reconcileCommands(granted, true, NOW)).toEqual([]);
    expect(reconcileCommands(null, false, NOW)).toEqual([]);
    expect(reconcileCommands({ choice: "denied", at: NOW }, false, NOW)).toEqual([]);
    // A lapsed or erased choice whose Matomo cookie lingers: withdrawn.
    expect(reconcileCommands(null, true, NOW)).toEqual([["forgetCookieConsentGiven"]]);
    expect(reconcileCommands({ choice: "denied", at: NOW }, true, NOW)).toEqual([["forgetCookieConsentGiven"]]);
    // A valid acceptance whose cookie was cleared: restored for the time left.
    expect(reconcileCommands(granted, false, NOW)).toEqual([["rememberCookieConsentGiven", 170 * 24]]);
  });
});

describe("in the browser", () => {
  let store: Map<string, string>;
  let cookie: string;
  type Queue = unknown[][];
  const queue = () => (globalThis as unknown as { window: { _paq?: Queue } }).window._paq ?? [];

  async function load(configured = true) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", configured ? "https://stats.example.org/" : "");
    vi.stubEnv("NEXT_PUBLIC_MATOMO_SITE_ID", configured ? "13" : "");
    return import("@/lib/consent");
  }

  beforeEach(() => {
    store = new Map();
    cookie = "";
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubGlobal("document", {
      get cookie() {
        return cookie;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks on a first visit, and sets nothing before an answer", async () => {
    const c = await load();
    expect(c.getConsentState()).toEqual({ record: null, open: false });
    c.reconcileConsent();
    expect(queue()).toEqual([]);
    expect(store.size).toBe(0);
  });

  it("accepting stores the choice with its date and lets Matomo set its cookies", async () => {
    const c = await load();
    c.chooseConsent("granted");
    expect(JSON.parse(store.get(CONSENT_KEY)!)).toEqual({ choice: "granted", at: NOW });
    expect(queue()).toEqual([
      ["rememberCookieConsentGiven", CONSENT_LIFETIME_HOURS],
      ["trackEvent", "Consent", "Accept"],
    ]);
    expect(c.getConsentState()).toEqual({ record: { choice: "granted", at: NOW }, open: false });
  });

  it("refusing stores the choice and keeps Matomo cookieless", async () => {
    const c = await load();
    c.chooseConsent("denied");
    expect(JSON.parse(store.get(CONSENT_KEY)!)).toEqual({ choice: "denied", at: NOW });
    expect(queue()).toEqual([["forgetCookieConsentGiven"], ["trackEvent", "Consent", "Refuse"]]);
  });

  it("withdrawing from 'Manage cookies' deletes Matomo's cookies", async () => {
    store.set(CONSENT_KEY, record("granted", NOW - 30 * DAY));
    cookie = "mtm_cookie_consent=1700000000000; _pk_id.13.abcd=xyz";
    const c = await load();
    c.reconcileConsent();
    expect(queue()).toEqual([]);
    c.reopenConsent();
    expect(c.getConsentState().open).toBe(true);
    c.chooseConsent("denied");
    expect(queue()).toEqual([["forgetCookieConsentGiven"], ["trackEvent", "Consent", "Withdraw"]]);
    expect(c.getConsentState()).toEqual({ record: { choice: "denied", at: NOW }, open: false });
  });

  it("closing the reopened banner keeps the choice", async () => {
    store.set(CONSENT_KEY, record("denied", NOW - DAY));
    const c = await load();
    c.reopenConsent();
    c.closeConsent();
    expect(c.getConsentState()).toEqual({ record: { choice: "denied", at: NOW - DAY }, open: false });
    expect(queue()).toEqual([]);
  });

  it("asks again after six months, and withdraws the lingering Matomo cookie", async () => {
    store.set(CONSENT_KEY, record("granted", NOW - CONSENT_LIFETIME_MS - DAY));
    cookie = "mtm_cookie_consent=1";
    const c = await load();
    expect(c.getConsentState().record).toBeNull();
    c.reconcileConsent();
    expect(queue()).toEqual([["forgetCookieConsentGiven"]]);
  });

  it("survives a browser that refuses storage", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    });
    const c = await load();
    expect(c.getConsentState().record).toBeNull();
    c.chooseConsent("granted");
    // Held for this page.
    expect(c.getConsentState().record?.choice).toBe("granted");
  });

  it("tells Matomo nothing when it is not configured", async () => {
    const c = await load(false);
    c.chooseConsent("granted");
    c.reconcileConsent();
    expect(queue()).toEqual([]);
  });

  it("notifies the banner and the footer of a change", async () => {
    const c = await load();
    const listener = vi.fn();
    const unsubscribe = c.subscribeConsent(listener);
    c.reopenConsent();
    c.chooseConsent("denied");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    c.reopenConsent();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("the Matomo snippet", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires consent before any cookie, instead of turning cookies off for good", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", "https://stats.example.org");
    vi.stubEnv("NEXT_PUBLIC_MATOMO_SITE_ID", "13");
    const { Analytics } = await import("@/components/analytics");
    const tree = Analytics() as unknown as { props: { children: { props: { children: string } }[] } };
    const script = tree.props.children[0].props.children;
    expect(script).toContain('_paq.push(["requireCookieConsent"])');
    expect(script).toContain(`_paq.push(["setVisitorCookieTimeout", ${VISITOR_COOKIE_SECONDS}])`);
    expect(script).not.toContain("disableCookies");
    expect(script.indexOf("requireCookieConsent")).toBeLessThan(script.indexOf("matomo.js"));
  });
});

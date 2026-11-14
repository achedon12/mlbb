import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DISMISS_FOR_MS,
  DWELL_BEFORE_SHOWING_MS,
  type DiscordPopupContext,
  isExcludedPath,
  readDiscordPopupMemory,
  readDiscordPopupSession,
  rememberDiscordPopupDismissed,
  shouldShowDiscordPopup,
} from "@/lib/discord-popup";

/**
 * The Discord invitation's decision: it waits for a second page or a long
 * read, keeps away from the bot's pages and the 404, and remembers being
 * closed or followed. The storage helpers must survive a browser that
 * refuses storage.
 */
const NOW = Date.UTC(2026, 10, 14, 12);

const context = (over: Partial<DiscordPopupContext> = {}): DiscordPopupContext => ({
  invite: "https://discord.gg/mw5RzvkkU3",
  pathname: "/fr/heroes",
  notFound: false,
  pageViews: 2,
  dwellMs: 0,
  now: NOW,
  memory: {},
  shownThisSession: false,
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shouldShowDiscordPopup", () => {
  it("never shows on the landing page right away", () => {
    expect(shouldShowDiscordPopup(context({ pageViews: 1 }))).toBe(false);
    expect(shouldShowDiscordPopup(context({ pageViews: 1, dwellMs: DWELL_BEFORE_SHOWING_MS - 1 }))).toBe(false);
  });

  it("shows from the second page view, or after a long read of one page", () => {
    expect(shouldShowDiscordPopup(context({ pageViews: 2 }))).toBe(true);
    expect(shouldShowDiscordPopup(context({ pageViews: 5 }))).toBe(true);
    expect(shouldShowDiscordPopup(context({ pageViews: 1, dwellMs: DWELL_BEFORE_SHOWING_MS }))).toBe(true);
  });

  it("needs an invite", () => {
    expect(shouldShowDiscordPopup(context({ invite: null }))).toBe(false);
  });

  it("stays off the bot pages and the 404 page", () => {
    expect(shouldShowDiscordPopup(context({ pathname: "/en/bot" }))).toBe(false);
    expect(shouldShowDiscordPopup(context({ pathname: "/en/bot/dashboard/123" }))).toBe(false);
    expect(shouldShowDiscordPopup(context({ notFound: true }))).toBe(false);
  });

  it("stays away for 30 days once closed", () => {
    const memory = { dismissedUntil: NOW + DISMISS_FOR_MS };
    expect(shouldShowDiscordPopup(context({ memory }))).toBe(false);
    expect(shouldShowDiscordPopup(context({ memory, now: NOW + DISMISS_FOR_MS - 1 }))).toBe(false);
    expect(shouldShowDiscordPopup(context({ memory, now: NOW + DISMISS_FOR_MS }))).toBe(true);
  });

  it("never comes back once the invite was followed", () => {
    expect(shouldShowDiscordPopup(context({ memory: { joined: true }, now: NOW + 10 * DISMISS_FOR_MS }))).toBe(false);
  });

  it("shows at most once per session", () => {
    expect(shouldShowDiscordPopup(context({ shownThisSession: true }))).toBe(false);
  });
});

describe("isExcludedPath", () => {
  it("matches /bot and its sub-pages, with or without the locale", () => {
    expect(isExcludedPath("/bot")).toBe(true);
    expect(isExcludedPath("/id/bot")).toBe(true);
    expect(isExcludedPath("/fr/bot/privacy")).toBe(true);
  });

  it("leaves pages that merely start with the same letters", () => {
    expect(isExcludedPath("/fr/bottom")).toBe(false);
    expect(isExcludedPath("/fr/heroes/bot")).toBe(false);
    expect(isExcludedPath("/fr")).toBe(false);
  });
});

describe("storage", () => {
  const memoryStorage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
    };
  };

  it("reads nothing as a fresh visitor", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    expect(readDiscordPopupMemory()).toEqual({ dismissedUntil: undefined, joined: false });
    expect(readDiscordPopupSession()).toEqual({ views: 0, shown: false });
  });

  it("remembers a dismissal for 30 days", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    rememberDiscordPopupDismissed(NOW);
    expect(readDiscordPopupMemory()?.dismissedUntil).toBe(NOW + DISMISS_FOR_MS);
  });

  it("ignores a corrupted value", () => {
    vi.stubGlobal("localStorage", { getItem: () => "not json", setItem: () => {} });
    vi.stubGlobal("sessionStorage", { getItem: () => "42", setItem: () => {} });
    expect(readDiscordPopupMemory()).toEqual({ dismissedUntil: undefined, joined: false });
    expect(readDiscordPopupSession()).toEqual({ views: 0, shown: false });
  });

  it("reports blocked storage instead of throwing", () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    };
    vi.stubGlobal("localStorage", blocked);
    vi.stubGlobal("sessionStorage", blocked);
    expect(readDiscordPopupMemory()).toBeNull();
    expect(readDiscordPopupSession()).toBeNull();
    expect(() => rememberDiscordPopupDismissed(NOW)).not.toThrow();
  });
});

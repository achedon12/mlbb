import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSupportLinks, supportLinks, supportUrl } from "@/lib/support";
import {
  SUPPORT_DISMISS_MS,
  dismissSupport,
  parseSupportMemory,
  readSupportMemory,
  recordSupportWin,
  supportCardAllowed,
} from "@/lib/support-prompt";
import { GET } from "@/app/api/support/route";

/**
 * Donation links: only an https page on the platform's own domain is ever
 * linked; anything else reads as unset, and with nothing set nothing shows.
 */
describe("supportUrl", () => {
  it("accepts the platforms' https pages", () => {
    expect(supportUrl("https://ko-fi.com/achedon12", "kofi")).toBe("https://ko-fi.com/achedon12");
    expect(supportUrl("  https://paypal.me/someone  ", "paypal")).toBe("https://paypal.me/someone");
    expect(supportUrl("https://www.paypal.com/paypalme/someone", "paypal")).toBe("https://www.paypal.com/paypalme/someone");
    expect(supportUrl("https://www.paypal.me/achedon12", "paypal")).toBe("https://www.paypal.me/achedon12");
  });

  it("refuses empty, malformed or non-string values", () => {
    for (const raw of [undefined, null, "", "   ", "ko-fi.com/achedon12", "not a url", 42]) {
      expect(supportUrl(raw, "kofi")).toBeNull();
    }
  });

  it("refuses anything but https", () => {
    expect(supportUrl("http://ko-fi.com/achedon12", "kofi")).toBeNull();
    expect(supportUrl("javascript:alert(1)", "kofi")).toBeNull();
  });

  it("refuses another host, a look-alike or the other platform's domain", () => {
    expect(supportUrl("https://evil.example/achedon12", "kofi")).toBeNull();
    expect(supportUrl("https://ko-fi.com.evil.example/achedon12", "kofi")).toBeNull();
    expect(supportUrl("https://evil-ko-fi.com/achedon12", "kofi")).toBeNull();
    expect(supportUrl("https://paypal.me/someone", "kofi")).toBeNull();
    expect(supportUrl("https://ko-fi.com/achedon12", "paypal")).toBeNull();
    expect(supportUrl("https://paypal.com/paypalme/someone", "paypal")).toBeNull();
  });

  it("refuses credentials, a port or the bare home page", () => {
    expect(supportUrl("https://user:pass@ko-fi.com/achedon12", "kofi")).toBeNull();
    expect(supportUrl("https://ko-fi.com:8443/achedon12", "kofi")).toBeNull();
    expect(supportUrl("https://ko-fi.com", "kofi")).toBeNull();
    expect(supportUrl("https://ko-fi.com/", "kofi")).toBeNull();
  });
});

describe("supportLinks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists the valid ones, Ko-fi first", () => {
    expect(
      supportLinks({ SUPPORT_PAYPAL_URL: "https://paypal.me/someone", SUPPORT_KOFI_URL: "https://ko-fi.com/achedon12" }),
    ).toEqual([
      { platform: "kofi", href: "https://ko-fi.com/achedon12" },
      { platform: "paypal", href: "https://paypal.me/someone" },
    ]);
  });

  it("treats an invalid value as unset, and gives nothing when neither is set", () => {
    expect(supportLinks({ SUPPORT_KOFI_URL: "https://ko-fi.com/achedon12", SUPPORT_PAYPAL_URL: "http://paypal.me/x" })).toEqual([
      { platform: "kofi", href: "https://ko-fi.com/achedon12" },
    ]);
    expect(supportLinks({})).toEqual([]);
    expect(supportLinks({ SUPPORT_KOFI_URL: "", SUPPORT_PAYPAL_URL: "" })).toEqual([]);
  });

  it("is read from the environment at request time by the route", async () => {
    vi.stubEnv("SUPPORT_KOFI_URL", "https://ko-fi.com/achedon12");
    vi.stubEnv("SUPPORT_PAYPAL_URL", "");
    const first = GET();
    expect(await first.json()).toEqual({ links: [{ platform: "kofi", href: "https://ko-fi.com/achedon12" }] });
    expect(first.headers.get("cache-control")).toBe("private, max-age=300");

    vi.stubEnv("SUPPORT_KOFI_URL", "");
    expect(await GET().json()).toEqual({ links: [] });
  });
});

describe("parseSupportLinks", () => {
  it("checks the route's answer again", () => {
    expect(
      parseSupportLinks({
        links: [
          { platform: "paypal", href: "https://paypal.me/someone" },
          { platform: "kofi", href: "https://evil.example/x" },
        ],
      }),
    ).toEqual([{ platform: "paypal", href: "https://paypal.me/someone" }]);
    for (const data of [null, undefined, {}, { links: "x" }, { links: [null, 3] }]) expect(parseSupportLinks(data)).toEqual([]);
  });
});

describe("support cards", () => {
  const now = Date.UTC(2026, 10, 25);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a corrupted memory as nothing remembered", () => {
    expect(parseSupportMemory(null)).toEqual({ wins: 0, hiddenUntil: 0 });
    expect(parseSupportMemory("{oops")).toEqual({ wins: 0, hiddenUntil: 0 });
    expect(parseSupportMemory(JSON.stringify({ wins: "3", hiddenUntil: null }))).toEqual({ wins: 0, hiddenUntil: 0 });
    expect(parseSupportMemory(JSON.stringify({ wins: 2.7, hiddenUntil: 5 }))).toEqual({ wins: 2, hiddenUntil: 5 });
  });

  it("waits for the second daily game before the games' cards", () => {
    const fresh = { wins: 0, hiddenUntil: 0 };
    expect(supportCardAllowed(fresh, { gated: true, now })).toBe(false);
    expect(supportCardAllowed({ ...fresh, wins: 1 }, { gated: true, now })).toBe(false);
    expect(supportCardAllowed({ ...fresh, wins: 2 }, { gated: true, now })).toBe(true);
    expect(supportCardAllowed(fresh, { gated: false, now })).toBe(true);
  });

  it("hides every card for 14 days after Later", () => {
    const hidden = { wins: 5, hiddenUntil: now + SUPPORT_DISMISS_MS };
    expect(supportCardAllowed(hidden, { gated: false, now })).toBe(false);
    expect(supportCardAllowed(hidden, { gated: true, now: now + SUPPORT_DISMISS_MS - 1 })).toBe(false);
    expect(supportCardAllowed(hidden, { gated: true, now: now + SUPPORT_DISMISS_MS })).toBe(true);
  });

  it("counts the wins and remembers Later in the browser", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    recordSupportWin();
    recordSupportWin();
    dismissSupport(now);
    expect(readSupportMemory()).toEqual({ wins: 2, hiddenUntil: now + SUPPORT_DISMISS_MS });
  });

  it("survives a storage that refuses", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => recordSupportWin()).not.toThrow();
    expect(() => dismissSupport(now)).not.toThrow();
    expect(readSupportMemory()).toEqual({ wins: 0, hiddenUntil: 0 });
  });
});

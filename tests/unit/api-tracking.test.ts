import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiHit,
  apiStatus,
  apiTrackingConfig,
  endpointPattern,
  optedOut,
  trackApiCall,
  type ApiCall,
  type ApiTrackingConfig,
} from "@/lib/api-tracking";
import { proxy } from "@/proxy";
import { GET as heroes } from "@/app/api/v1/heroes/route";
import { GET as hero } from "@/app/api/v1/heroes/[slug]/route";
import { GET as items } from "@/app/api/v1/items/route";
import { GET as patches } from "@/app/api/v1/patches/route";
import { GET as rankings } from "@/app/api/v1/rankings/route";

/**
 * Server-side measurement of the public API: which calls reach Matomo, with
 * what, and above all that Matomo being slow or down never touches the
 * response.
 */
const CONFIG: ApiTrackingConfig = { endpoint: "https://stats.example.org/matomo.php", siteId: "14" };

function call(path: string, headers: Record<string, string> = {}, extra: Partial<ApiCall> = {}): ApiCall {
  return {
    url: new URL(path, "http://127.0.0.1:3001"),
    method: "GET",
    headers: new Headers({ "user-agent": "curl/8.5.0", ...headers }),
    ip: "203.0.113.7",
    ...extra,
  };
}

/** The bulk body, each tracking request as its parameters. */
function requests(hit: { body: string } | null) {
  expect(hit).not.toBeNull();
  const body = JSON.parse(hit!.body) as { requests: string[]; token_auth?: string };
  return { token: body.token_auth, actions: body.requests.map((r) => new URLSearchParams(r.slice(1))) };
}

function configure(token?: string) {
  vi.stubEnv("MATOMO_API_SITE_ID", "14");
  vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", "https://stats.example.org");
  if (token) vi.stubEnv("MATOMO_API_TOKEN", token);
}

const event = () => {
  const pending: Promise<unknown>[] = [];
  return { pending, waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as NextFetchEvent & {
    pending: Promise<unknown>[];
  };
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("endpointPattern", () => {
  it("names each endpoint and groups hero records under one placeholder", () => {
    expect(endpointPattern("/api/v1/heroes")).toBe("heroes");
    expect(endpointPattern("/api/v1/heroes/layla")).toBe("heroes/{slug}");
    expect(endpointPattern("/api/v1/heroes/tigreal")).toBe("heroes/{slug}");
    expect(endpointPattern("/api/v1/items")).toBe("items");
    expect(endpointPattern("/api/v1/patches")).toBe("patches");
    expect(endpointPattern("/api/v1/rankings")).toBe("rankings");
  });

  it("files paths without a route together instead of one row each", () => {
    expect(endpointPattern("/api/v1")).toBe("(unknown)");
    expect(endpointPattern("/api/v1/skins")).toBe("(unknown)");
    expect(endpointPattern("/api/v1/heroes/layla/skins")).toBe("(unknown)");
  });

  it("leaves everything outside the public API alone", () => {
    for (const path of [
      "/api/health",
      "/api/log",
      "/api/session",
      "/api/push",
      "/api/push/subscription",
      "/api/builds",
      "/api/builds/abc/vote",
      "/api/bot/interactions",
      "/api/v10/heroes",
      "/en/heroes",
    ]) {
      expect(endpointPattern(path)).toBeNull();
    }
  });
});

describe("apiStatus", () => {
  it("answers what the route handlers themselves answer", async () => {
    const request = (path: string) => new Request(`http://127.0.0.1:3001${path}`);
    const cases: [string, () => Promise<Response> | Response][] = [
      ["/api/v1/heroes", () => heroes(request("/api/v1/heroes?role=Mage"))],
      ["/api/v1/items", () => items(request("/api/v1/items?category=nothing"))],
      ["/api/v1/patches", () => patches()],
      ["/api/v1/rankings", () => rankings()],
      ["/api/v1/heroes/layla", () => hero(request("/api/v1/heroes/layla"), { params: Promise.resolve({ slug: "layla" }) })],
      ["/api/v1/heroes/nobody", () => hero(request("/api/v1/heroes/nobody"), { params: Promise.resolve({ slug: "nobody" }) })],
    ];
    for (const [path, handler] of cases) {
      expect(apiStatus(path, "GET"), path).toBe((await handler()).status);
    }
  });

  it("answers 404 without a route and 405 to a method the routes do not export", () => {
    expect(apiStatus("/api/v1/skins", "GET")).toBe(404);
    expect(apiStatus("/api/v1/heroes", "POST")).toBe(405);
    expect(apiStatus("/api/v1/heroes", "HEAD")).toBe(200);
  });
});

describe("optedOut", () => {
  it("honours Do-Not-Track and Global Privacy Control", () => {
    expect(optedOut(new Headers({ dnt: "1" }))).toBe(true);
    expect(optedOut(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(optedOut(new Headers({ dnt: "0" }))).toBe(false);
    expect(optedOut(new Headers())).toBe(false);
  });
});

describe("apiHit", () => {
  it("sends a page view by endpoint and an event with the status, without a token", () => {
    const { token, actions } = requests(
      apiHit(call("/api/v1/heroes/layla?lang=en", { referer: "https://example.net/tool" }), CONFIG),
    );
    expect(token).toBeUndefined();
    expect(actions).toHaveLength(2);
    const [view, status] = actions as [URLSearchParams, URLSearchParams];
    for (const action of actions) {
      expect(action.get("rec")).toBe("1");
      expect(action.get("idsite")).toBe("14");
      expect(action.get("apiv")).toBe("1");
      expect(action.get("send_image")).toBe("0");
      expect(action.get("url")).toBe("https://mlbbdex.com/api/v1/heroes/layla?lang=en");
      expect(action.get("urlref")).toBe("https://example.net/tool");
      expect(action.get("ua")).toBe("curl/8.5.0");
      expect(action.get("rand")).toMatch(/^\d+$/);
      // Both need a token: Matomo would reject the whole request.
      expect(action.has("cip")).toBe(false);
      expect(action.has("cdt")).toBe(false);
      // No identifier of any kind.
      expect(action.has("_id")).toBe(false);
      expect(action.has("uid")).toBe(false);
      expect(action.has("cid")).toBe(false);
    }
    expect(view.get("action_name")).toBe("API / heroes/{slug}");
    expect(view.has("e_c")).toBe(false);
    expect(status.get("e_c")).toBe("API");
    expect(status.get("e_a")).toBe("heroes/{slug}");
    expect(status.get("e_n")).toBe("200");
  });

  it("adds the caller's address and the time of the call with a token", () => {
    const { token, actions } = requests(
      apiHit(call("/api/v1/heroes/nobody"), { ...CONFIG, token: "secret-token" }, Date.UTC(2026, 10, 14, 12)),
    );
    expect(token).toBe("secret-token");
    for (const action of actions) {
      expect(action.get("cip")).toBe("203.0.113.7");
      expect(action.get("cdt")).toBe(String(Date.UTC(2026, 10, 14, 12) / 1000));
      // The token travels in the body only, never in a tracked parameter.
      expect([...action.values()].join(" ")).not.toContain("secret-token");
    }
    expect(actions[1]!.get("e_n")).toBe("404");
  });

  it("leaves out an address the proxy could not determine", () => {
    const { actions } = requests(apiHit(call("/api/v1/items", {}, { ip: null }), { ...CONFIG, token: "t" }));
    expect(actions[0]!.has("cip")).toBe(false);
    expect(actions[0]!.has("urlref")).toBe(false);
  });

  it("keeps the status the proxy answered itself", () => {
    const { actions } = requests(apiHit(call("/api/v1/rankings", {}, { status: 429 }), CONFIG));
    expect(actions[1]!.get("e_n")).toBe("429");
  });

  it("tracks nothing for an opted-out caller, a preflight or a private route", () => {
    expect(apiHit(call("/api/v1/heroes", { dnt: "1" }), CONFIG)).toBeNull();
    expect(apiHit(call("/api/v1/heroes", { "sec-gpc": "1" }), CONFIG)).toBeNull();
    expect(apiHit(call("/api/v1/heroes", {}, { method: "OPTIONS" }), CONFIG)).toBeNull();
    expect(apiHit(call("/api/health"), CONFIG)).toBeNull();
    expect(apiHit(call("/api/builds"), CONFIG)).toBeNull();
    expect(apiHit(call("/api/push/subscription"), CONFIG)).toBeNull();
  });
});

describe("apiTrackingConfig", () => {
  it("is off without the API site id, even with Matomo configured", () => {
    vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", "https://stats.example.org");
    vi.stubEnv("MATOMO_API_SITE_ID", "");
    expect(apiTrackingConfig()).toBeNull();
  });

  it("points at matomo.php on the browser tracker's instance", () => {
    configure("tok");
    expect(apiTrackingConfig()).toEqual({ endpoint: "https://stats.example.org/matomo.php", siteId: "14", token: "tok" });
    vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", "https://example.org/matomo/");
    expect(apiTrackingConfig()?.endpoint).toBe("https://example.org/matomo/matomo.php");
  });
});

describe("trackApiCall", () => {
  it("sends nothing when the API site is not configured", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await trackApiCall(call("/api/v1/heroes"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts one bulk request, bounded in time and never redirected", async () => {
    configure("tok");
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await trackApiCall(call("/api/v1/patches"));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://stats.example.org/matomo.php");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string).token_auth).toBe("tok");
  });

  it("swallows a failing Matomo", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(trackApiCall(call("/api/v1/items"))).resolves.toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("synchronous failure");
      }),
    );
    await expect(trackApiCall(call("/api/v1/items"))).resolves.toBeUndefined();
  });
});

describe("proxy", () => {
  it("answers at once while Matomo hangs, and hands the hit to waitUntil", () => {
    configure();
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    const e = event();
    const response = proxy(new NextRequest("http://127.0.0.1:3001/api/v1/heroes", { headers: { "x-forwarded-for": "198.51.100.1" } }), e);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(e.pending).toHaveLength(1);
  });

  it("sends Matomo the address nginx saw, never a forged left-most entry", async () => {
    configure("tok");
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const send = async (forwarded: string) => {
      const e = event();
      proxy(new NextRequest("http://127.0.0.1:3001/api/v1/items", { headers: { "x-forwarded-for": forwarded } }), e);
      await Promise.all(e.pending);
      return requests({ body: (fetch.mock.calls.at(-1)! as [string, RequestInit])[1].body as string }).actions[0]!;
    };
    expect((await send("1.2.3.4, 198.51.100.4")).get("cip")).toBe("198.51.100.4");
    expect((await send("1.2.3.4, garbage")).has("cip")).toBe(false);
  });

  it("does not track the health probe nor the other API routes", () => {
    configure();
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    for (const path of ["/api/health", "/api/log", "/api/session", "/api/builds", "/api/push"]) {
      proxy(new NextRequest(`http://127.0.0.1:3001${path}`, { headers: { "x-forwarded-for": "198.51.100.2" } }), event());
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("counts the first refusal of a rate-limit window, not the flood behind it", async () => {
    configure();
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const statuses: number[] = [];
    for (let i = 0; i < 95; i++) {
      const request = new NextRequest("http://127.0.0.1:3001/api/v1/patches", {
        headers: { "x-forwarded-for": "198.51.100.3" },
      });
      const e = event();
      statuses.push(proxy(request, e).status);
      // Settled one by one, so the cap on pending hits does not come into play.
      await Promise.all(e.pending);
    }
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
    expect(fetch).toHaveBeenCalledTimes(91);
    const last = requests({ body: (fetch.mock.calls.at(-1)! as [string, RequestInit])[1].body as string });
    expect(last.actions[1]!.get("e_n")).toBe("429");
  });
});

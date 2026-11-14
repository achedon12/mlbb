import names from "@/data/game/names.json";
import { site } from "@/lib/site";

/**
 * Public API measurement, from the server side.
 *
 * The browser tracker (`analytics.ts`) only sees people browsing the site:
 * scripts and other sites calling `/api/v1/*` never run it. Each of those
 * calls is reported to Matomo instead, through its HTTP Tracking API, on a
 * Matomo site of its own ("MLBBDex API") so API traffic does not blend into
 * the site's audience.
 *
 * Called from the proxy, which is the only code that sees every call: the
 * `force-static` routes (patches, rankings, a hero's record) are rendered at
 * build time and then served from the cache without their handler ever
 * running again, so a wrapper around the handlers would miss most of the
 * traffic. The proxy runs before the response exists, though: the status is
 * derived from the same facts the handlers decide it on (see `apiStatus`).
 *
 * Nothing is sent without `MATOMO_API_SITE_ID`. The hit never delays nor
 * changes the response: it is not awaited, it gives up after two seconds,
 * and its failures are swallowed.
 */

const PREFIX = "/api/v1";
const ENDPOINTS = new Set(["heroes", "items", "patches", "rankings"]);
const HEROES = new Set(Object.keys(names));
// A hanging Matomo with steady traffic would otherwise pile up open
// connections in the server; past this many pending hits, new ones are dropped.
const MAX_IN_FLIGHT = 64;
const TIMEOUT_MS = 2000;

export type ApiTrackingConfig = {
  /** `matomo.php`, on the instance named by `NEXT_PUBLIC_MATOMO_URL`. */
  endpoint: string;
  siteId: string;
  token?: string;
};

export type ApiCall = {
  url: URL;
  method: string;
  headers: Headers;
  /** The caller's address from `clientAddress`; `null` when it cannot be trusted. */
  ip: string | null;
  /** Only when the proxy answered itself (429); otherwise derived from the route. */
  status?: number;
};

/** Read on every call, at runtime: setting the site id must not need a rebuild of the image. */
export function apiTrackingConfig(): ApiTrackingConfig | null {
  const siteId = process.env.MATOMO_API_SITE_ID?.trim();
  // The same instance as the browser tracker. Inlined at build time like
  // every NEXT_PUBLIC_ variable, which is the value the browser uses too.
  const matomo = process.env.NEXT_PUBLIC_MATOMO_URL?.trim();
  if (!siteId || !matomo) return null;
  let endpoint: string;
  try {
    endpoint = new URL("matomo.php", matomo.endsWith("/") ? matomo : `${matomo}/`).href;
  } catch {
    return null;
  }
  const token = process.env.MATOMO_API_TOKEN?.trim();
  return { endpoint, siteId, ...(token ? { token } : {}) };
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The endpoint a path belongs to, slugs replaced by a placeholder so Matomo
 * groups `heroes/layla` and `heroes/tigreal` under one row; the real slug
 * stays in the tracked URL. `null` outside the public API, which is never
 * tracked (health probe, logs, session, notifications, community builds).
 */
export function endpointPattern(pathname: string): string | null {
  if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return null;
  const parts = pathname.slice(PREFIX.length).split("/").filter(Boolean);
  if (parts.length === 1 && ENDPOINTS.has(parts[0]!)) return parts[0]!;
  if (parts.length === 2 && parts[0] === "heroes") return "heroes/{slug}";
  return "(unknown)";
}

/**
 * The status the API answers for a path, mirroring the route handlers: every
 * list answers 200 (an empty filter is still a list), a hero's record 404s
 * for a slug the data does not know, Next answers 404 to a path without a
 * route and 405 to a method the route does not export. A unit test runs the
 * handlers themselves against this table, so the two cannot drift apart.
 */
export function apiStatus(pathname: string, method: string): number {
  const pattern = endpointPattern(pathname);
  if (pattern === null || pattern === "(unknown)") return 404;
  if (method !== "GET" && method !== "HEAD") return 405;
  if (pattern === "heroes/{slug}") {
    const slug = decoded(pathname.split("/").filter(Boolean).at(-1)!);
    return HEROES.has(slug) ? 200 : 404;
  }
  return 200;
}

/** `DNT: 1` or `Sec-GPC: 1`: the caller asked not to be measured, so that call is not. */
export function optedOut(headers: Headers): boolean {
  return headers.get("dnt")?.trim() === "1" || headers.get("sec-gpc")?.trim() === "1";
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  return `?${search}`;
}

const random = () => String(Math.floor(Math.random() * 1e10));

/**
 * The Matomo bulk request reporting one call, or `null` when the call is not
 * tracked. Two actions in one POST: a page view, so the "Page titles" report
 * groups calls by endpoint, and an event carrying the status code, which a
 * page view has no field for.
 */
export function apiHit(
  call: ApiCall,
  config: ApiTrackingConfig,
  now = Date.now(),
): { endpoint: string; body: string } | null {
  const pattern = endpointPattern(call.url.pathname);
  // A CORS preflight is the browser asking permission, not a call: counting
  // it would count the call that follows it twice.
  if (pattern === null || call.method === "OPTIONS" || optedOut(call.headers)) return null;
  const status = call.status ?? apiStatus(call.url.pathname, call.method);

  const common = {
    rec: "1",
    idsite: config.siteId,
    apiv: "1",
    send_image: "0",
    // Behind the reverse proxy, the request's own host can be the
    // container's address: the public origin keeps the URLs Matomo shows
    // clickable and matching the site's declared address.
    url: `${site.url}${call.url.pathname}${call.url.search}`,
    urlref: call.headers.get("referer") ?? undefined,
    ua: call.headers.get("user-agent") ?? undefined,
    // API consumers are scripts, which Matomo would otherwise drop as bots.
    bots: "1",
    // Without a token, Matomo refuses both and would see the server's own
    // address and clock: every caller then looks like one visitor.
    ...(config.token
      ? {
          cip: call.ip ?? undefined,
          cdt: String(Math.floor(now / 1000)),
        }
      : {}),
  };

  const requests = [
    query({ ...common, action_name: `API / ${pattern}`, rand: random() }),
    query({ ...common, e_c: "API", e_a: pattern, e_n: String(status), rand: random() }),
  ];
  return {
    endpoint: config.endpoint,
    body: JSON.stringify({ requests, ...(config.token ? { token_auth: config.token } : {}) }),
  };
}

let inFlight = 0;

/**
 * Reports one API call. The returned promise always resolves and is only
 * there for `waitUntil`: the response never waits for it.
 */
export function trackApiCall(call: ApiCall): Promise<void> {
  const config = apiTrackingConfig();
  if (!config || inFlight >= MAX_IN_FLIGHT) return Promise.resolve();
  const hit = apiHit(call, config);
  if (!hit) return Promise.resolve();

  inFlight += 1;
  return (async () => {
    try {
      const response = await fetch(hit.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: hit.body,
        cache: "no-store",
        // The body carries the token: a redirect must not forward it to
        // whatever address Matomo would point to.
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Frees the connection; Matomo answers 204 with nothing to read anyway.
      await response.body?.cancel();
    } catch {
      // Matomo slow, down or misconfigured: losing one count is better than
      // a log line per API call, and the request may hold the token.
    } finally {
      inFlight -= 1;
    }
  })();
}

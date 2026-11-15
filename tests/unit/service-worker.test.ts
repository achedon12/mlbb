import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * The service worker's offline cache never keeps a signed-in page: not by
 * address (account, login, bot dashboard and admin), not by header
 * (`private`, `no-store`), and signing out drops whatever an older worker
 * left behind. `public/sw.js` is a plain script: it runs here in a sandbox,
 * with a fake Cache Storage and network.
 */
const ORIGIN = "https://mlbbdex.com";
const SOURCE = readFileSync("public/sw.js", "utf8");

type Handler = (event: unknown) => void;
type Sandbox = {
  cacheable: (url: URL, response: Response) => boolean;
  forgetPrivate: (signingOut: boolean) => Promise<void>;
};

let handlers: Record<string, Handler>;
let stores: Map<string, Map<string, Response>>;
let network: (url: string) => Response;
let sandbox: Sandbox;

function fakeCache(name: string) {
  const entries = stores.get(name) ?? new Map<string, Response>();
  stores.set(name, entries);
  const key = (r: string | Request) => new URL(typeof r === "string" ? r : r.url, ORIGIN).href;
  return {
    match: async (r: string | Request) => entries.get(key(r))?.clone(),
    put: async (r: string | Request, response: Response) => void entries.set(key(r), response),
    add: async (r: string) => void entries.set(key(r), network(key(r))),
    delete: async (r: string | Request) => entries.delete(key(r)),
    keys: async () => [...entries.keys()].map((u) => new Request(u)),
  };
}

function page(cacheControl = "s-maxage=3600") {
  return new Response("<html></html>", { status: 200, headers: { "Cache-Control": cacheControl } });
}

/** Dispatches an event; resolves once every `respondWith` and `waitUntil` promise has. */
async function dispatch(type: string, data: Record<string, unknown>) {
  const pending: Promise<unknown>[] = [];
  let answer: Promise<Response> | undefined;
  handlers[type]({
    ...data,
    respondWith: (p: Promise<Response>) => {
      answer = p;
      pending.push(p);
    },
    waitUntil: (p: Promise<unknown>) => pending.push(p),
  });
  await Promise.all(pending);
  // `waitUntil` calls made while answering.
  await new Promise((r) => setTimeout(r, 0));
  await Promise.all(pending);
  return answer;
}

const navigate = (path: string, method = "GET") =>
  dispatch("fetch", {
    // A navigation request: `mode` cannot be set on a constructed Request.
    request: { url: `${ORIGIN}${path}`, method, mode: "navigate", headers: new Headers(), referrer: "" },
  });

const pages = () => [...(stores.get("pages-v2")?.keys() ?? [])].map((u) => new URL(u).pathname);

beforeEach(() => {
  handlers = {};
  stores = new Map();
  network = () => page();
  const context = {
    self: {
      location: { href: `${ORIGIN}/sw.js`, origin: ORIGIN },
      addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
      navigator: { language: "fr" },
      registration: {},
    },
    caches: {
      open: async (name: string) => fakeCache(name),
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
    fetch: async (r: Request | string) => network(typeof r === "string" ? r : r.url),
    URL,
    Request,
    Response,
    Promise,
    console,
  };
  runInNewContext(`${SOURCE}\nthis.cacheable = cacheable; this.forgetPrivate = forgetPrivate;`, context);
  sandbox = context as unknown as Sandbox;
});

describe("cacheable", () => {
  const url = (p: string) => new URL(p, ORIGIN);

  it("keeps an ordinary page", () => {
    expect(sandbox.cacheable(url("/fr/heroes/layla"), page())).toBe(true);
  });

  it("never keeps a signed-in page, with or without the locale", () => {
    for (const p of ["/fr/account", "/en/account/profile", "/login", "/fr/login", "/fr/bot/dashboard", "/ru/bot/dashboard/123", "/fr/bot/admin"]) {
      expect(sandbox.cacheable(url(p), page()), p).toBe(false);
    }
    expect(sandbox.cacheable(url("/fr/bot"), page())).toBe(true);
    expect(sandbox.cacheable(url("/fr/accounts-guide"), page())).toBe(true);
  });

  it("never keeps a response marked private or no-store", () => {
    expect(sandbox.cacheable(url("/fr/community"), page("private, no-cache, no-store, max-age=0, must-revalidate"))).toBe(false);
    expect(sandbox.cacheable(url("/fr/builds"), page("no-store"))).toBe(false);
    expect(sandbox.cacheable(url("/fr/heroes"), page("Private"))).toBe(false);
  });

  it("never keeps a failure", () => {
    expect(sandbox.cacheable(url("/fr/heroes"), new Response("", { status: 500 }))).toBe(false);
  });
});

describe("fetch", () => {
  it("stores an ordinary page", async () => {
    await navigate("/fr/heroes");
    expect(pages()).toContain("/fr/heroes");
  });

  it("serves a signed-in page from the network only", async () => {
    const answer = await navigate("/fr/account");
    expect(answer).toBeDefined();
    expect(pages()).not.toContain("/fr/account");
  });

  it("does not store a page rendered for a session", async () => {
    network = () => page("private, no-cache, no-store, max-age=0, must-revalidate");
    await navigate("/fr/community");
    expect(pages()).not.toContain("/fr/community");
  });

  it("shows the offline page, not a stale copy, for a signed-in page offline", async () => {
    await dispatch("install", {});
    stores.get("pages-v2")!.set(`${ORIGIN}/fr/account`, new Response("old account"));
    network = () => {
      throw new TypeError("offline");
    };
    const answer = await navigate("/fr/account");
    expect(await answer!.text()).toBe("<html></html>"); // the cached /fr/offline
  });
});

describe("signing out", () => {
  beforeEach(() => {
    const entries = new Map<string, Response>();
    for (const p of ["/fr/heroes", "/fr/account", "/fr/community", "/fr/community/general/42", "/fr/builds"]) {
      entries.set(`${ORIGIN}${p}`, page());
    }
    stores.set("pages-v2", entries);
  });

  it("drops the signed-in areas when the page says so", async () => {
    await dispatch("message", { data: { type: "forget-private" } });
    expect(pages()).toEqual(["/fr/heroes"]);
  });

  it("drops them when the Discord sign-out goes by, and lets it through", async () => {
    const answer = await navigate("/api/discord/logout", "POST");
    expect(answer).toBeUndefined();
    expect(pages()).toEqual(["/fr/heroes"]);
  });

  it("an updated worker removes what an older one stored against the rules", async () => {
    stores.get("pages-v2")!.set(`${ORIGIN}/fr/builds`, page("private, no-store"));
    await dispatch("activate", {});
    expect(pages()).toEqual(["/fr/heroes", "/fr/community", "/fr/community/general/42"]);
  });
});

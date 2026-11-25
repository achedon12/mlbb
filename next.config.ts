import { resolve } from "node:path";
import type { NextConfig } from "next";
import { version } from "./package.json";
import { LOCALES } from "./src/i18n/config";
import advance from "./src/data/game/advance-server.json";

/** Date of the latest documented Advance Server version (see src/lib/advance-fresh.ts). */
const advanceLatest = advance.versions.map((v: { date?: string | null }) => v.date ?? "").filter(Boolean).sort().at(-1) ?? "";

/**
 * Content Security Policy, sent as a header on every response.
 *
 * Pages are prerendered and cached (s-maxage), so a per-request nonce is not
 * possible: it would force dynamic rendering. Next's inline scripts (the
 * `self.__next_f` payload, bootstrap) differ on every page and every build, so
 * hashes cannot be listed in a static header either. Scripts therefore keep
 * `'unsafe-inline'`; the rest is locked down — no foreign script host but the
 * Matomo instance, no plugin, no `<base>` hijack, no framing, forms posting
 * only to the site. The site renders no user-provided HTML unsanitised (wiki
 * content goes through `cleanHtml`), which is what inline script injection
 * would need in the first place.
 *
 * The Matomo origin is read at build time (a Docker build argument), like the
 * tracker itself.
 */
function contentSecurityPolicy({ wasm = false } = {}): string {
  const development = process.env.NODE_ENV === "development";
  let matomo = "";
  try {
    if (process.env.NEXT_PUBLIC_MATOMO_URL) matomo = new URL(process.env.NEXT_PUBLIC_MATOMO_URL).origin;
  } catch {
    // Malformed URL: the tracker would not load either.
  }
  // Discord server icons and user avatars on the bot's dashboard, only
  // when the bot is deployed (its application id is known at build time).
  const discord = /^\d{17,20}$/.test(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID?.trim() ?? "") ? "https://cdn.discordapp.com" : "";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React's development build evaluates code for its call stacks.
    // The screenshot reader's worker (`/ocr/`, see the headers) compiles WebAssembly.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(development ? ["'unsafe-eval'"] : []),
      ...(wasm ? ["'wasm-unsafe-eval'"] : []),
      matomo,
    ],
    // Server-rendered `style` attributes (bars, rarity colours) and the styles
    // Next injects.
    "style-src": ["'self'", "'unsafe-inline'"],
    // data: placeholders and inline SVG, blob: exported cards (tier list,
    // retribution), remote hosts matching `images.remotePatterns`, Discord's
    // CDN for the bot dashboard, and the Matomo image fallback.
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://static.wikia.nocookie.net",
      "https://akmpicture.youngjoygame.com",
      "https://akmweb.youngjoygame.com",
      discord,
      matomo,
    ],
    "font-src": ["'self'", "data:"],
    // Hot reload uses a WebSocket in development.
    "connect-src": ["'self'", matomo, ...(development ? ["ws:", "wss:"] : [])],
    // Video export preview of the retribution tool.
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, sources]) =>
    [name, ...sources.filter(Boolean)].join(" "),
  );
  if (!development) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/**
 * The site has a server side — in-game login sessions, calls to the community
 * API — so no static export. `standalone` produces a self-contained folder
 * holding only the files actually used, which gives a production image much
 * lighter than the full tree.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  // Otherwise Next generates agent instruction files at the repository root.
  // This project is published under its author's name: nothing of the kind
  // belongs there.
  agentRules: false,
  reactStrictMode: true,
  // Hand-written stories and the author's signed texts are read from disk
  // when a page renders (`lib/lore-overrides.ts`, `lib/editorial.ts`): pages
  // rendered on demand need them in the standalone folder too. The
  // templates (`_modeles/`) are never read.
  outputFileTracingIncludes: {
    "/**": ["./content/*/lore/*.json", "./content/fr/editorial/*.md", "./content/fr/editorial/patchs/*.md", "./content/fr/editorial/tier-list/*.md"],
  },
  poweredByHeader: false,
  // The root does not render <html> ([locale]/layout does): an unknown address
  // outside any locale, such as /llms.txt before it existed, ended in a 500
  // error in production. This global 404 renders its own document.
  experimental: { globalNotFound: true },
  // The container runs read-only: pages rendered on demand (other languages,
  // pro players, compare, counters…) cannot be written back to
  // `.next/server/app`. This handler keeps them in `.next/cache/pages`, the
  // container's writable volume, and reads the build's pages where they are.
  // Read from the project root, where the build runs.
  cacheHandler: resolve("cache-handler.mjs"),
  compress: true,
  // Site version, read from package.json at build time: the footer shows it
  // without having to copy it by hand.
  env: { VERSION_SITE: version, ADVANCE_LATEST: advanceLatest },

  images: {
    // Game visuals are copied locally (public/visuels) by the sync. The wiki
    // stays allowed only for images embedded in the patch notes, which are
    // reused as they are.
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      // Profile avatars, served by Moonton's CDN.
      { protocol: "https", hostname: "akmpicture.youngjoygame.com" },
      // Fallback skill icons, when the wiki does not provide them.
      { protocol: "https", hostname: "akmweb.youngjoygame.com" },
    ],
    formats: ["image/avif", "image/webp"],
    // 50: darkened backgrounds (detail page banner); 75: everything else.
    qualities: [50, 75],
  },

  // Routes moved to English. The old French addresses, already indexed and
  // shared, redirect permanently to the new ones.
  async redirects() {
    return [
      { source: "/heros/:path*", destination: "/heroes/:path*", permanent: true },
      { source: "/objets/:path*", destination: "/items/:path*", permanent: true },
      { source: "/emblemes", destination: "/emblems", permanent: true },
      { source: "/actualites/:path*", destination: "/news/:path*", permanent: true },
      { source: "/veille", destination: "/watch", permanent: true },
      { source: "/comparateur", destination: "/compare", permanent: true },
      { source: "/modes-de-jeu/:path*", destination: "/game-modes/:path*", permanent: true },
      { source: "/a-propos", destination: "/about", permanent: true },
      { source: "/mentions-legales", destination: "/legal", permanent: true },
      { source: "/confidentialite", destination: "/privacy", permanent: true },
      { source: "/compte", destination: "/account", permanent: true },
      { source: "/connexion", destination: "/login", permanent: true },
      // Game visuals used to be stored under a `.png` name even though the
      // wiki serves WebP bytes: the extension lied and the files were sent
      // with the wrong `Content-Type`. They are now named `.webp`. The old
      // addresses are public — the image sitemap handed them to Google Images,
      // and service workers keep them — so they redirect for good.
      { source: "/visuels/:path(.*)\\.png", destination: "/visuels/:path.webp", permanent: true },
      // The former progress page is now a section of the account page. A
      // config redirect keeps it a real 308: the page route would stream
      // behind the account loading state and lose the status.
      {
        source: `/:locale(${LOCALES.join("|")})/account/progress`,
        destination: "/:locale/account#progress",
        permanent: true,
      },
      // Three September articles withdrawn after review (errors, no sources):
      // their addresses lead to the news list.
      {
        source: "/:locale/news/:slug(khufra-domine-la-file-classee|comprendre-la-reduction-de-soins|lane-experience-gagner-sans-tuer)",
        destination: "/:locale/news",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      // The service worker must be fetched again on every visit: a version in
      // the HTTP cache would delay the offline cache update.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      // Game visuals served as they are (image sitemap, offline cache, the
      // canvas of the retribution trainer) used to come with `max-age=0`, the
      // default for `public/`: every visit revalidated every file. A given
      // path is written once and never rewritten — the sync only downloads a
      // visual that is missing, and a renamed skin produces a new file name —
      // so a month of browser cache costs nothing and saves a round trip per
      // image. Everything the pages display goes through `/_next/image`, which
      // keeps its own `minimumCacheTTL`.
      {
        source: "/visuels/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/:chemin*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          // Two years, every subdomain. The domain has no subdomain today (no
          // www, no mail): any future one must be served over HTTPS. `preload`
          // is left out on purpose: leaving the browser preload list takes
          // months.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      // The OCR worker of the account value estimator (`public/ocr/`, copied
      // by `scripts/copy-ocr-assets.mjs`). A dedicated worker runs under the
      // policy of its own script's response, so only these files may compile
      // WebAssembly: the pages keep the policy above. Listed last, this rule
      // replaces that header for these paths. The files only change with the
      // library version: a week of cache.
      {
        source: "/ocr/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy({ wasm: true }) },
          { key: "Cache-Control", value: "public, max-age=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;

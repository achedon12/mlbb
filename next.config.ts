import type { NextConfig } from "next";
import { version } from "./package.json";

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
function contentSecurityPolicy(): string {
  const development = process.env.NODE_ENV === "development";
  let matomo = "";
  try {
    if (process.env.NEXT_PUBLIC_MATOMO_URL) matomo = new URL(process.env.NEXT_PUBLIC_MATOMO_URL).origin;
  } catch {
    // Malformed URL: the tracker would not load either.
  }
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React's development build evaluates code for its call stacks.
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : []), matomo],
    // Server-rendered `style` attributes (bars, rarity colours) and the styles
    // Next injects.
    "style-src": ["'self'", "'unsafe-inline'"],
    // data: placeholders and inline SVG, blob: exported cards (tier list,
    // retribution), remote hosts matching `images.remotePatterns`, and the
    // Matomo image fallback.
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://static.wikia.nocookie.net",
      "https://akmpicture.youngjoygame.com",
      "https://akmweb.youngjoygame.com",
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
  poweredByHeader: false,
  // The root does not render <html> ([locale]/layout does): an unknown address
  // outside any locale, such as /llms.txt before it existed, ended in a 500
  // error in production. This global 404 renders its own document.
  experimental: { globalNotFound: true },
  compress: true,
  // Site version, read from package.json at build time: the footer shows it
  // without having to copy it by hand.
  env: { VERSION_SITE: version },

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
    ];
  },
};

export default nextConfig;

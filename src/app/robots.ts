import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Private or per-visitor routes: never worth a crawl. */
const PRIVATE = ["/api/", "/*/account", "/*/login"];

/**
 * Search and answer-engine crawlers, named so that they are explicitly
 * welcome: OpenAI (search index, live browsing, training), Perplexity,
 * Anthropic, Google's and Apple's AI use flags. A crawler that matches a
 * named group ignores the `*` one, so each group repeats the private routes.
 * The public JSON API (`/api/v1/`, documented on /api-doc) stays open to
 * them: assistants answer from it on a user's request.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: ["/", "/api/v1/"], disallow: PRIVATE },
    ],
    sitemap: [`${site.url}/sitemap.xml`, `${site.url}/sitemap-images.xml`],
  };
}

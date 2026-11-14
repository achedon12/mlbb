import sanitizeHtml from "sanitize-html";
import type { Locale } from "@/i18n/config";
import { prefix } from "@/i18n/links";

/**
 * Sanitisation of rendered HTML.
 *
 * Patch note content comes from the wiki, editable by anyone: it cannot be
 * injected into the page as is. Only an allowlist of formatting tags and
 * attributes is permitted, links are forced to external without referrer, and
 * only safe URL schemes are accepted — no `javascript:`, event handler or
 * `<script>` survives.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "h5", "p", "ul", "ol", "li", "a", "strong", "em", "b", "i",
    "u", "s", "br", "hr", "blockquote", "code", "pre", "span", "div", "sup", "sub",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  ],
  allowedAttributes: {
    a: ["href", "rel", "target"],
    // Heading anchors serve the patch notes table of contents.
    "*": ["id"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer nofollow", target: "_blank" }),
  },
};

export function cleanHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/**
 * Sanitisation of a guide written for the site. Same allowlist, but a link to
 * another page of the site stays a site link: it gets the reader's language
 * and opens in the same tab, without `nofollow`, since these links are what
 * ties a guide to the heroes, items and tools it talks about. Only outside
 * links are forced to a new tab without referrer.
 */
export function cleanGuideHtml(html: string, locale: Locale): string {
  return sanitizeHtml(html, {
    ...OPTIONS,
    transformTags: {
      a: (tagName, attribs): sanitizeHtml.Tag => {
        const href = attribs.href ?? "";
        if (href.startsWith("/") && !href.startsWith("//")) return { tagName, attribs: { href: prefix(href, locale) } };
        if (href.startsWith("#")) return { tagName, attribs: { href } };
        return { tagName, attribs: { href, rel: "noreferrer nofollow", target: "_blank" } };
      },
    },
  });
}

// Server pages keep importing it from here; client components import
// `./json-ld` directly, which does not pull sanitize-html.
export { serializeJsonLd } from "./json-ld";

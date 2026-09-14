import sanitizeHtml from "sanitize-html";

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
 * Serialises data for a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone does not protect: a value containing `</script>`
 * would close the tag and allow injection. The `<` character is therefore
 * escaped, which prevents any escape from the tag without affecting the
 * validity of the JSON.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

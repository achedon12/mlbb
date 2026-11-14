import { Marked, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Markdown of the forum posts, rendered on the server.
 *
 * Two locks, so that neither alone has to be perfect:
 *
 * 1. The Markdown renderer never passes HTML through: a raw `<tag>` in the
 *    text comes out escaped, as text. Images are not shown (a link to them
 *    is), headings are toned down to `h3`/`h4` (the page owns the outline).
 * 2. The output then goes through sanitize-html with a short allowlist of
 *    tags and no attribute but a link's `href`. Links keep http(s) only and
 *    are marked `nofollow ugc` (user content: no ranking passed on), open in
 *    a new tab without referrer.
 */

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
const SAFE_URL = /^https?:\/\/[^\s]+$/i;

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    heading({ tokens, depth }: Tokens.Heading) {
      const level = depth <= 2 ? 3 : 4;
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
    // A link whose address is not http(s) keeps its text and loses the link.
    link({ href, tokens }: Tokens.Link) {
      const text = this.parser.parseInline(tokens);
      return SAFE_URL.test(href) ? `<a href="${escapeHtml(href)}">${text}</a>` : text;
    },
    image({ href, text }: Tokens.Image) {
      const label = escapeHtml(text || href);
      return SAFE_URL.test(href) ? `<a href="${escapeHtml(href)}">${label}</a>` : label;
    },
  },
});

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "del", "s", "code", "pre", "blockquote", "ul", "ol", "li", "a", "h3", "h4", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...(attribs.href ? { href: attribs.href } : {}), rel: "nofollow ugc noopener noreferrer", target: "_blank" },
    }),
  },
};

/** Safe HTML of a post's Markdown. */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false });
  return sanitizeHtml(html, OPTIONS);
}

/** Plain text of a post, for descriptions and structured data: one line, at most `max` characters. */
export function plainText(source: string, max = 300): string {
  const text = sanitizeHtml(renderMarkdown(source), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}

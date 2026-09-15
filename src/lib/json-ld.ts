/**
 * Serialises data for a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone does not protect: a value containing `</script>`
 * would close the tag and allow injection. The `<` character is therefore
 * escaped, which prevents any escape from the tag without affecting the
 * validity of the JSON.
 *
 * Kept apart from `html.ts`: client components (the breadcrumb) use it, and
 * importing it from there shipped sanitize-html and its HTML parser — about
 * 65 KB of compressed JavaScript — to every page.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

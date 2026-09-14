import { notFound } from "next/navigation";

/**
 * Unknown address under a language: the site's 404 page, in its language and
 * with its navigation, rather than Next's raw page — which knows nothing of
 * the language or the layout.
 */
export default function UnknownAddress() {
  notFound();
}

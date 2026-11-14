import { absoluteImage, localeParam, responseApi } from "@/lib/api";
import { emblemsSheets, textChoice } from "@/lib/usage-sheets";
import { createT } from "@/i18n/translations";

/**
 * The six role emblems, as their pages name them: the slug is the page's
 * (`/emblems/{slug}`), the description is the bonus the emblem gives.
 * `?locale=` picks the language (English by default).
 */
// Reads `?locale=`: a static response would ignore it.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const t = createT(localeParam(new URL(request.url).searchParams));
  const results = emblemsSheets.map(({ slug, emblem, image }) => ({
    slug,
    name: textChoice(t, emblem.key, "name", emblem.name),
    role: emblem.role,
    description: textChoice(t, emblem.key, "bonus", emblem.bonus),
    bestFor: textChoice(t, emblem.key, "bestFor", emblem.bestFor),
    image: absoluteImage(image),
  }));
  return responseApi(results, { total: results.length });
}

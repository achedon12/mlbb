import { itemsFor } from "@/lib/data";
import { localeParam, responseApi } from "@/lib/api";

/**
 * Shop items, filterable by category. `?locale=` picks the language of the
 * names and effects (English by default, and for an unknown value).
 */
// This route reads query parameters: freezing it at build time
// would return the same response whatever the requested filter.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const settings = new URL(request.url).searchParams;
  const all = itemsFor(localeParam(settings));
  const category = settings.get("category");
  const results = category
    ? all.filter((o) => o.category.toLowerCase() === category.toLowerCase())
    : all;

  return responseApi(results, { total: results.length });
}

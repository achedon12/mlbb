import { itemsFor } from "@/lib/data";
const all = itemsFor("en");
import { responseApi } from "@/lib/api";

/** Shop items, filterable by category. */
// This route reads query parameters: freezing it at build time
// would return the same response whatever the requested filter.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  const results = category
    ? all.filter((o) => o.category.toLowerCase() === category.toLowerCase())
    : all;

  return responseApi(results, { total: results.length });
}

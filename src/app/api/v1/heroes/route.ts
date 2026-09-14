import { skills, allHeroes } from "@/lib/data";
import { responseApi } from "@/lib/api";
import { laneFromParam } from "@/lib/draft";
import type { Lane, Role } from "@/lib/types";

/**
 * Hero list.
 *
 * Filterable by role and by lane. The list carries neither skills nor
 * skins: a response of several megabytes would be unusable for a caller
 * that only wants to list.
 */
// This route reads query parameters: freezing it at build time
// would return the same response whatever the requested filter.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const settings = new URL(request.url).searchParams;
  const role = settings.get("role") as Role | null;
  // Former lane tokens (`Or`, `Milieu`, `Experience`) keep working for existing callers.
  const laneParam = settings.get("lane");
  const lane = laneParam === null ? null : (laneFromParam(laneParam) ?? (laneParam as Lane));

  const results = allHeroes
    .filter((h) => (role ? h.roles.includes(role) : true))
    .filter((h) => (lane ? h.lanes.includes(lane) : true))
    .map((h) => ({
      slug: h.slug,
      name: h.name,
      title: h.title,
      roles: h.roles,
      lanes: h.lanes,
      specialties: h.specialties,
      release: h.release,
      ratings: h.ratings,
      skins: h.skins.length,
      skills: (skills("en")[h.slug] ?? []).map((c) => c?.name ?? null),
    }));

  return responseApi(results, { total: results.length });
}

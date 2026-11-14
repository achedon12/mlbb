import { detailedPatches, patchDetails } from "@/lib/data";
import { notFound, responseApi } from "@/lib/api";
import { isLocale } from "@/i18n/config";

/**
 * One detailed patch: notes, sections, new heroes, and the structured hero
 * adjustments with the buff / nerf / adjust count. `?locale=` picks the
 * language (English by default; a patch not translated yet stays English).
 */
// Reads `?locale=`: a static response would ignore it.
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  if (!patchDetails[version]) return notFound("Patch");
  const requested = new URL(request.url).searchParams.get("locale") ?? "en";
  const locale = isLocale(requested) ? requested : "en";
  return responseApi(detailedPatches(locale)[version]);
}

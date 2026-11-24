import { NextResponse, type NextRequest } from "next/server";
import { kitImage } from "@/lib/og/social-kit";
import { isKitCanonical, kitFileName, kitPath, parseKitRequest } from "@/lib/social-kit";
import { kitCatalog } from "@/lib/social-kit-catalog";
import { site } from "@/lib/site";

/**
 * The social kit's visuals (brand page, "Kit réseaux sociaux"): a new patch,
 * the patch's top 5, a hero, a skin or a community announcement, square
 * 1080 × 1080, portrait 1080 × 1350 or story 1080 × 1920.
 *
 * Same rules as the share images (`/api/share/<kind>`): the query is checked
 * against the catalog (`parseKitRequest`), an announcement's title is one of
 * the catalogue's messages, no URL, picture or free text is read from it.
 * Any other spelling of a valid query is sent to its one canonical address,
 * so each visual is drawn and cached once. The data only changes with a
 * deploy: a day in the browser, a week on the shared caches. The `/api`
 * rate limit (`src/proxy.ts`) applies.
 */
export const dynamic = "force-dynamic";

const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";
const UNKNOWN = { status: 404, headers: { "Cache-Control": "public, max-age=3600" } };

export async function GET(request: NextRequest, { params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  const search = request.nextUrl.search;
  const parsed = parseKitRequest(template, search, kitCatalog);
  if (!parsed) return new NextResponse("Unknown kit visual.", UNKNOWN);
  if (!isKitCanonical(search, parsed)) {
    return NextResponse.redirect(new URL(kitPath(parsed), process.env.NODE_ENV === "production" ? site.url : request.url), {
      status: 308,
      headers: { "Cache-Control": CACHE },
    });
  }
  const image = await kitImage(parsed);
  if (!image) return new NextResponse("Unknown kit visual.", UNKNOWN);
  const body = await image.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${kitFileName(parsed)}"`,
    },
  });
}

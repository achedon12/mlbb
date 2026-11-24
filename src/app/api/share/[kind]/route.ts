import { NextResponse, type NextRequest } from "next/server";
import { shareImage } from "@/lib/og/share-cards";
import { isCanonical, parseShareRequest, sharePath } from "@/lib/share-card";
import { shareCatalog } from "@/lib/share-catalog";
import { site } from "@/lib/site";

/**
 * "Partager en image": the branded PNG of a build, a draft, the tier list, a
 * MLBBdle result or a patch recap, 1080 × 1350 or 1200 × 630.
 *
 * Only the site's own data is drawn: the query is checked slug by slug
 * against the catalog (`parseShareRequest`), no URL, picture or free text is
 * read from it. Any other spelling of a valid query is sent to its one
 * canonical address, so each image is drawn and cached once. The data only
 * changes with a deploy: a day in the browser, a week on the shared caches.
 * The `/api` rate limit (`src/proxy.ts`) applies.
 */
export const dynamic = "force-dynamic";

const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const search = request.nextUrl.search;
  const parsed = parseShareRequest(kind, search, shareCatalog);
  if (!parsed) {
    return new NextResponse("Unknown share image.", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  }
  if (!isCanonical(search, parsed)) {
    return NextResponse.redirect(new URL(sharePath(parsed), process.env.NODE_ENV === "production" ? site.url : request.url), {
      status: 308,
      headers: { "Cache-Control": CACHE },
    });
  }
  const image = await shareImage(parsed);
  if (!image) return new NextResponse("Unknown share image.", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  const body = await image.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="mlbbdex-${parsed.card.kind}.png"`,
    },
  });
}

import { renderUrlset, SITEMAPS, sitemapGroups, type SitemapName } from "@/lib/sitemap";

/**
 * Child sitemaps listed by the index (`/sitemap.xml`): `/sitemaps/compare.xml`,
 * `/sitemaps/heroes.xml`… One per page type, all prerendered at build time;
 * any other name is a 404.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

const FILE = /^(.+)\.xml$/;

export function generateStaticParams(): { name: string }[] {
  return SITEMAPS.map((s) => ({ name: `${s.name}.xml` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const { name } = await params;
  const entries = sitemapGroups().get(name.match(FILE)?.[1] as SitemapName);
  if (!entries) return new Response("Not Found", { status: 404 });
  return new Response(renderUrlset(entries), {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}

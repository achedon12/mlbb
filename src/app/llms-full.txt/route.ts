import { llmsFull } from "@/lib/llms";

/**
 * /llms-full.txt: the figures behind the site for language models — every
 * hero's tier, rates, counters and build, the lane and role leaders, the live
 * patch's changes. Built in `src/lib/llms.ts`.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFull(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

import { llmsIndex } from "@/lib/llms";

/**
 * /llms.txt: site overview for language models (https://llmstxt.org). The
 * text is built in `src/lib/llms.ts`, next to `/llms-full.txt`'s.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsIndex(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

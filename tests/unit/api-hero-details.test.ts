import { describe, expect, it } from "vitest";
import { GET as countersGET } from "@/app/api/v1/heroes/[slug]/counters/route";
import { GET as buildsGET } from "@/app/api/v1/heroes/[slug]/builds/route";
import { GET as patchGET } from "@/app/api/v1/patches/[version]/route";
import { counters, patches } from "@/lib/data";

const slugParams = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("hero detail API routes read by the Discord bot", () => {
  it("serves a hero's measured counters per rank", async () => {
    const slug = Object.keys(counters).find((s) => counters[s]?.all?.strong.length);
    expect(slug).toBeDefined();
    const response = await countersGET(new Request("http://x"), slugParams(slug!));
    const body = (await response.json()) as { data: Record<string, { strong: { slug: string; advantage: number }[] }> };
    expect(response.status).toBe(200);
    expect(body.data.all.strong.length).toBeGreaterThan(0);
    expect(typeof body.data.all.strong[0].advantage).toBe("number");
  });

  it("answers 404 for an unknown hero", async () => {
    expect((await countersGET(new Request("http://x"), slugParams("nobody"))).status).toBe(404);
    expect((await buildsGET(new Request("http://x"), slugParams("nobody"))).status).toBe(404);
  });

  it("serves a hero's played builds as an object", async () => {
    const slug = Object.keys(counters)[0];
    const body = (await (await buildsGET(new Request("http://x"), slugParams(slug))).json()) as { data: unknown };
    expect(typeof body.data).toBe("object");
  });

  it("serves a detailed patch in the asked language, English otherwise", async () => {
    const version = patches[0].version;
    const params = { params: Promise.resolve({ version }) };
    const fr = await patchGET(new Request(`http://x/api/v1/patches/${version}?locale=fr`), params);
    expect(fr.status).toBe(200);
    const body = (await fr.json()) as { data: { version: string; adjustments: unknown[] } };
    expect(body.data.version).toBe(version);
    expect(Array.isArray(body.data.adjustments)).toBe(true);
    const odd = await patchGET(new Request(`http://x/api/v1/patches/${version}?locale=zz`), params);
    expect(odd.status).toBe(200);
    expect((await patchGET(new Request("http://x"), { params: Promise.resolve({ version: "0.0.0" }) })).status).toBe(404);
  });
});

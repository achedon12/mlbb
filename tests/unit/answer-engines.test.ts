import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { llmsFull, llmsIndex } from "@/lib/llms";
import { allHeroes } from "@/lib/data";
import { rankingFull } from "@/lib/tier-list";
import { patchCurrent } from "@/lib/freshness";
import { site } from "@/lib/site";

describe("robots.txt", () => {
  const { rules } = robots();
  const groups = Array.isArray(rules) ? rules : [rules];
  const groupOf = (agent: string) => groups.find((g) => [g.userAgent].flat().includes(agent));

  it.each(["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended", "Applebot-Extended"])(
    "welcomes %s on public pages and keeps private routes closed",
    (agent) => {
      const g = groupOf(agent);
      expect(g, agent).toBeDefined();
      expect([g!.allow].flat()).toContain("/");
      expect([g!.disallow].flat()).toEqual(expect.arrayContaining(["/api/", "/*/account", "/*/login"]));
    },
  );

  it("keeps the same private routes for every other crawler", () => {
    expect([groupOf("*")!.disallow].flat()).toEqual(["/api/", "/*/account", "/*/login", "/*/u/"]);
  });
});

describe("llms.txt", () => {
  const text = llmsIndex();

  it("follows the llms.txt shape: a title, a quoted summary, link sections", () => {
    expect(text.startsWith(`# ${site.name}\n\n> `)).toBe(true);
    for (const section of ["## Data freshness", "## How to cite", "## Tier lists", "## API", "## Languages"]) {
      expect(text).toContain(section);
    }
  });

  it("gives the current patch, every lane and role tier list and the full file", () => {
    if (patchCurrent) expect(text).toContain(`/en/patch-notes/${patchCurrent.version}`);
    for (const path of ["/en/tier-list/lane/jungle", "/en/tier-list/role/marksman", "/en/events", "/en/quiz", "/en/api-doc"]) {
      expect(text).toContain(`${site.url}${path}`);
    }
    expect(text).toContain(`${site.url}/llms-full.txt`);
    expect(text).toContain(`${site.url}/fr/tier-list`);
  });
});

describe("llms-full.txt", () => {
  const text = llmsFull();

  it("has one line per hero, the strongest first", () => {
    for (const h of allHeroes) expect(text).toContain(`[${h.name}](${site.url}/en/heroes/${h.slug})`);
    const first = rankingFull[0];
    if (first) {
      const heroes = text.slice(text.indexOf("## Heroes"));
      expect(heroes.indexOf(`[${first.hero.name}]`)).toBeLessThan(heroes.indexOf(`[${rankingFull.at(-1)!.hero.name}]`));
      expect(text).toContain(`${first.tier} tier`);
    }
  });
});

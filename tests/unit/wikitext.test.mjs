import { describe, expect, it } from "vitest";
import {
  cleanDescription,
  cleanLore,
  decodeEntities,
  expandTemplates,
  extractStory,
  loreBlocks,
  plainLinks,
  plainValue,
  sectionsPage,
} from "../../scripts/wikitext.mjs";
import { resourceOf } from "../../scripts/heroes.mjs";
import { findMarkup, markupIn, reportMarkup } from "../../scripts/markup-guard.mjs";

describe("templates", () => {
  it("keeps the first unnamed argument, never the others", () => {
    expect(cleanDescription("will be {{b|Locked On|mark}}.")).toBe("will be Locked On.");
    expect(cleanDescription("{{B|Passive:|e}} Alucard gains Lifesteal.")).toBe("Passive: Alucard gains Lifesteal.");
    expect(cleanDescription("ordered {{hi|Alpha|Alpha}} and Beta")).toBe("ordered Alpha and Beta");
  });

  it("never lets a named parameter through", () => {
    expect(cleanDescription("The other two are {{Hi|name=Thamuz|image=Thamuz}}, with his {{ai|Grand Lord Lava}}")).toBe(
      "The other two are Thamuz, with his Grand Lord Lava",
    );
    expect(cleanDescription("led by {{Hero Icon|name = Dyrroth}} in the Abyss")).toBe("led by Dyrroth in the Abyss");
    // An unnamed label wins over `name=`, which only picks the icon.
    expect(cleanDescription("After every 4 {{ai|name = Basic Attack|Basic Attacks}}, Badang")).toBe("After every 4 Basic Attacks, Badang");
    expect(cleanDescription("*{{ai|name=Hero1081-icon (2021-2026)|Aulus}} (mentor)")).toBe("*Aulus (mentor)");
  });

  it("puts an icon template's label last", () => {
    expect(cleanDescription("(+3 × {{icon|a|Contract Soul Steal|Soul Steal}} stack count)")).toBe("(+3 × Soul Steal stack count)");
  });

  it("resolves nested templates from the inside", () => {
    expect(expandTemplates("{{b|{{hi|Lunox}}|e}}")).toBe("Lunox");
  });

  it("drops layout templates, parser functions, magic words and data blocks", () => {
    expect(cleanDescription("A {{clr}}B {{#if:x|y}} {{PAGENAME}} C __NOTOC__")).toBe("A B C");
    expect(cleanDescription("{{Infobox character\n| name = Detona\n| image = Detona.png\n}}Text")).toBe("Text");
  });
});

describe("links, entities and headings", () => {
  it("turns links into their label and drops categories and files", () => {
    expect(plainLinks("[[Patch Notes/1.6.66|22 March 2022]]")).toBe("22 March 2022");
    expect(plainLinks("the [[Moniyan Empire]] and [[Resource#Rage|rage]]")).toBe("the Moniyan Empire and rage");
    expect(plainLinks("[[Resource#Rage]]")).toBe("Resource");
    expect(cleanDescription("[[Category:Custom]] [[Category:Game Mode]]")).toBe("");
    expect(cleanDescription("[[File:Custom.png|thumb|A [[map]]]]Custom games")).toBe("Custom games");
    // A bracket pair left unmatched by a broken wiki edit.
    expect(cleanDescription("infiltrated The City of the Dragon]] and spread")).toBe("infiltrated The City of the Dragon and spread");
    expect(cleanDescription("very similar to [https://example.org/Vs_AI Vs. AI].")).toBe("very similar to Vs. AI.");
  });

  it("decodes numeric and named entities, &amp; last", () => {
    expect(decodeEntities("tyrannical&#8230; &hellip; &#x2014; &quot;a&quot;")).toBe('tyrannical… … — "a"');
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
    expect(cleanDescription("Lancelot&#8230;")).toBe("Lancelot…");
  });

  it("removes tables, including one the page never closes", () => {
    expect(cleanDescription('Lastest Version: v350.1 {|class="article-table"\n!Hero!!Stat changes\n|-\n|{{hi|Miya}}||-16% dmg')).toBe(
      "Lastest Version: v350.1",
    );
    expect(cleanDescription("Before {|\n|a\n|} after")).toBe("Before after");
  });
});

describe("hero stories", () => {
  const page = [
    "== Story ==",
    "{{Infobox hero story",
    "|full_name=Aamon Paxley",
    "|gender=Male",
    "|birthday={{birthday|12|29}}",
    "|affiliation=House Paxley",
    "*Moniyan Empire",
    "}}",
    "{{quote|The aloof Duke of Castle Aberleen.}}",
    "",
    "=== Duke of Shards ===",
    "",
    "[[File:Aamon & Gusion Lore.png|center|400px]]",
    "An infant's cry shattered the silent dawn of [[Castle Aberleen]].",
    "House Paxley rejoiced.",
    "",
    "===Fate Deniers===",
    "In the Determination event, Thamuz wants {{Hi|name=Lunox|image=Lunox}} to join him&#8230;",
    "===Empty chapter===",
    "",
    "== Trivia ==",
    "*Aamon is named after a demon.",
    "*Its quote is from ''The Prince''.",
  ].join("\n");

  it("turns chapter headings into headings, never into text", () => {
    const story = extractStory(page);
    expect(story.lore).toEqual([
      "The aloof Duke of Castle Aberleen.",
      "Duke of Shards",
      "An infant's cry shattered the silent dawn of Castle Aberleen. House Paxley rejoiced.",
      "Fate Deniers",
      "In the Determination event, Thamuz wants Lunox to join him…",
    ]);
    expect(story.headings).toEqual([1, 3]);
    expect(story.trivia).toEqual(["Aamon is named after a demon.", "Its quote is from The Prince."]);
  });

  it("writes the story sheet in English, the source language", () => {
    const { sheet } = extractStory(page);
    expect(sheet.gender).toBe("Male");
    expect(sheet.birthday).toBe("December 29");
    expect(sheet.affiliations).toEqual(["House Paxley", "Moniyan Empire"]);
  });

  it("drops a heading that introduces nothing", () => {
    expect(loreBlocks("=== A ===\n=== B ===\nText.\n=== C ===").map((b) => `${b.type}:${b.text}`)).toEqual(["h:B", "p:Text."]);
    expect(cleanLore("=== A ===\nText.")).toEqual(["Text."]);
  });

  it("removes a data block in the middle of the lore", () => {
    const lore = cleanLore("{{Infobox character\n| name            = Detona\n| species = Dragon lizard\n}}\nThe Politans live there.");
    expect(lore).toEqual(["The Politans live there."]);
  });
});

describe("game mode sections", () => {
  it("leaves no table, category or template parameter in the blocks", () => {
    const page = [
      "Intro.",
      "== Hero Specifications ==",
      "Some heroes get buffs:",
      "<i> Lastest Version: v350.1 </i>",
      '{|class="article-table"',
      "!Hero!!Stat changes",
      "|-",
      "|{{hi|Miya}}||-16% dmg||",
      "== History ==",
      "The demons headed by {{Hero Icon|name = Dyrroth}} gather.",
      "[[Category:Game Mode]]",
    ].join("\n");
    const sections = sectionsPage(page);
    expect(sections).toEqual([
      { title: "Hero Specifications", elements: [{ type: "p", text: "Some heroes get buffs: Lastest Version: v350.1" }] },
      { title: "History", elements: [{ type: "p", text: "The demons headed by Dyrroth gather." }] },
    ]);
    expect(findMarkup(sections)).toEqual([]);
  });
});

describe("module fields", () => {
  it("keeps the label of a linked value", () => {
    expect(plainValue("[[Patch Notes/1.6.66|22 March 2022]]")).toBe("22 March 2022");
    expect(plainValue("Obtained via the [[MLBB × Jujutsu Kaisen|MLBB X Jujutsu Kaisen]] event")).toBe(
      "Obtained via the MLBB X Jujutsu Kaisen event",
    );
    expect(plainValue("")).toBeNull();
  });

  it("names the Rage resource instead of its 'None' label", () => {
    expect(resourceOf("Resource#Rage/Indicator|None")).toBe("Rage");
    expect(resourceOf("Mana")).toBe("Mana");
    expect(resourceOf("[[Energy]]")).toBe("Energy");
    expect(resourceOf("<resource>")).toBeNull();
  });
});

describe("markup guard", () => {
  it("names each kind of leftover", () => {
    expect(markupIn("wants name=Lunox|image=Lunox to join")).toEqual(["template parameter", "pipe"]);
    expect(markupIn("=== Duke of Shards ===")).toEqual(["heading"]);
    expect(markupIn("Resource#Rage/Indicator|None")).toEqual(["section anchor", "pipe"]);
    expect(markupIn("for 2 seconds.@ Redemption")).toEqual(["@ separator"]);
    expect(markupIn("tyrannical&#8230;")).toEqual(["HTML entity"]);
    expect(markupIn("Category:Custom Category:Game Mode")).toEqual(["namespace"]);
    expect(markupIn("[[MLBB × Transformers]]")).toEqual(["link"]);
    expect(markupIn('{|class="article-table"')).toEqual(["table", "pipe"]);
    expect(markupIn("Deals 120 (+80% Total Magic Power) Magic Damage. Rank #1, 50% HP.")).toEqual([]);
  });

  it("walks a data tree, skipping identifiers and addresses", () => {
    const tree = {
      aamon: { lore: ["Fine.", "=== Duke of Shards ==="], image: "/visuels/a|b.webp" },
      items: [{ slug: "a|b", passive: "x.@ y" }],
    };
    expect(findMarkup(tree).map((f) => [f.path, f.kinds])).toEqual([
      [".aamon.lore[1]", ["heading"]],
      [".items[0].passive", ["@ separator"]],
    ]);
  });

  it("reports a count per dataset, as a GitHub annotation in CI", () => {
    const lines = [];
    const total = reportMarkup({ stories: { a: ["name=Lunox|image=Lunox"] }, items: [] }, { warn: (l) => lines.push(l), annotate: true });
    expect(total).toBe(1);
    expect(lines[0]).toMatch(/^::warning title=Wiki markup in stories::1 texts/);
    expect(lines.some((l) => l.includes(".a[0]"))).toBe(true);
  });

  it("finds nothing in what the cleanup produces from the known bad cases", () => {
    const outputs = [
      cleanDescription("The other two are {{Hi|name=Thamuz|image=Thamuz}} and {{Hi|name=Faramis|image=Faramis}}"),
      cleanDescription("stacks of {{b|Soul Steal|e}} (up to 650 stacks)"),
      cleanDescription("Category text [[Category:Custom]]"),
      ...extractStory("== Story ==\n=== A ===\nText&#8230; with [[MLBB × Transformers]].").lore,
    ];
    expect(findMarkup(outputs)).toEqual([]);
  });
});

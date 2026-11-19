import { describe, expect, it } from "vitest";
import { baseItemName, currentItemName, itemFinder, itemSlug, renamedItemSlug } from "@/lib/item-names";
import * as syncItems from "../../scripts/items.mjs";

const catalogue = [
  { name: "Valkyrie's Shield", slug: "valkyrie-s-shield" },
  { name: "Magic Shoes", slug: "magic-shoes" },
  { name: "Demon Shoes", slug: "demon-shoes" },
  { name: "Tough Boots", slug: "tough-boots" },
  { name: "Rapid Boots", slug: "rapid-boots" },
  { name: "Fury Hammer", slug: "fury-hammer" },
  { name: "Twilight Armor", slug: "twilight-armor", removed: true },
];

describe("item name aliases", () => {
  it("brings the stats API's names to the catalogue's, blessing and enchantment kept", () => {
    expect(currentItemName("Athena's Shield")).toBe("Valkyrie's Shield");
    expect(currentItemName("Magic Boots")).toBe("Magic Shoes");
    expect(currentItemName("Demon Boots - Favor")).toBe("Demon Shoes - Favor");
    expect(currentItemName("Rapid Boots- Conceal")).toBe("Rapid Boots - Conceal");
    expect(currentItemName("Ice Hunter's Magic Boots")).toBe("Ice Hunter's Magic Shoes");
    expect(currentItemName("Twilight Armor (Discarded)")).toBe("Twilight Armor");
    expect(currentItemName("Blade of Despair")).toBe("Blade of Despair");
  });

  it("finds the catalogue item behind any spelling", () => {
    const find = itemFinder(catalogue);
    expect(find("Athena's Shield")?.slug).toBe("valkyrie-s-shield");
    expect(find("Ice Hunter's Tough Boots")?.slug).toBe("tough-boots");
    expect(find("Demon Boots - Encourage")?.slug).toBe("demon-shoes");
    expect(find("Fury hammer")?.slug).toBe("fury-hammer");
    expect(find("Twilight Armor (Discarded)")?.slug).toBe("twilight-armor");
    expect(find("Roaming Boots - Favor")).toBeUndefined();
    expect(baseItemName("Flame Hunter's Rapid Boots")).toBe("Rapid Boots");
  });

  it("sends an old item address to the renamed item's page", () => {
    expect(itemSlug("Athena's Shield")).toBe("athena-s-shield");
    expect(renamedItemSlug("athena-s-shield")).toBe("valkyrie-s-shield");
    expect(renamedItemSlug("blade-of-despair")).toBeNull();
  });

  it("is mirrored by the sync", () => {
    for (const name of ["Athena's Shield", "Ice Hunter's Magic Boots", "Rapid Boots- Conceal", "Twilight Armor (Discarded)"]) {
      expect(syncItems.baseItemName(name)).toBe(baseItemName(name));
    }
    expect(syncItems.liquipediaItemTitle("Valkyrie's Shield")).toBe("Athena's Shield");
  });
});

describe("removed items", () => {
  const official = syncItems.officialItemNames(
    ["Athena's Shield", "Bud of Hope", "Twilight Armor (Discarded)", "Magic Boots"].map((equipname) => ({ data: { equipname } })),
  );

  it("reads the official catalogue under the site's names, discarded entries left out", () => {
    expect([...official].sort()).toEqual(["Bud of Hope", "Magic Shoes", "Valkyrie's Shield"]);
  });

  it("trusts Liquipedia's status, then the official catalogue over the wiki's 'Removed'", () => {
    const removed = (name: string, availability: string | null, liquipedia: { status: string } | null, catalogue: Set<string> | null = official) =>
      syncItems.itemRemoved({ name, availability, liquipedia, official: catalogue });
    expect(removed("Calamity Reaper", "Removed", { status: "removed" })).toBe(true);
    expect(removed("Twilight Armor", "All heroes", { status: "removed" })).toBe(true);
    // Floryn's item: "Removed" on the wiki, still in the game's catalogue.
    expect(removed("Bud of Hope", "Removed", null)).toBe(false);
    expect(removed("Scarlet Phantom", "Removed", null)).toBe(true);
    expect(removed("Bud of Hope", "Removed", null, null)).toBe(true);
    expect(removed("Blade of Despair", "All heroes", null)).toBe(false);
  });

  it("lists the prices the wiki and Liquipedia disagree on", () => {
    const lp = new Map([
      ["Guardian Helmet", { price: 2200, status: "available" }],
      ["Blade of Despair", { price: 3010, status: "available" }],
    ]);
    expect(syncItems.priceGaps([{ name: "Guardian Helmet", price: 2500 }, { name: "Blade of Despair", price: 3010 }], lp)).toEqual([
      { name: "Guardian Helmet", wiki: 2500, liquipedia: 2200 },
    ]);
  });
});

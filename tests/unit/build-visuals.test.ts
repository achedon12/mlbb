import { describe, expect, it } from "vitest";
import { itemsFor } from "@/lib/data";
import { visualEmblem, visualItem, visualTalent } from "@/lib/build-visuals";

describe("visualItem", () => {
  const item = itemsFor("en")[0];

  it("finds an item by its English name", () => {
    expect(visualItem(item.name).slug).toBe(item.slug);
  });

  it("ignores the enchantment attached to boots", () => {
    expect(visualItem(`${item.name} - Encourage`).slug).toBe(item.slug);
  });

  it("does not resolve an unknown name", () => {
    expect(visualItem("Objet imaginaire")).toEqual({ name: "Objet imaginaire", slug: null, image: null });
  });
});

describe("talent and emblem visuals", () => {
  it("matches both spellings of Weapons Master", () => {
    expect(visualTalent("Weapons Master").image).not.toBeNull();
    expect(visualTalent("Weapon Master").image).not.toBeNull();
  });

  it("finds the emblem from the role given by the API", () => {
    expect(visualEmblem("Marksman").image).not.toBeNull();
  });
});

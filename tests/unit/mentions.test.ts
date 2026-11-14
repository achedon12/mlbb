import { describe, expect, it } from "vitest";
import { heroesMentioned } from "@/lib/mentions";

const heroes = [{ name: "Ruby" }, { name: "Yi Sun-shin" }, { name: "X.Borg" }, { name: "Lunox" }, { name: "Miya" }];

describe("heroesMentioned", () => {
  it("returns the heroes in the order the text names them", () => {
    const text = "Lunox wins lane, then X.Borg and Yi Sun-shin rotate; Lunox again.";
    expect(heroesMentioned(text, heroes).map((h) => h.name)).toEqual(["Lunox", "X.Borg", "Yi Sun-shin"]);
  });

  it("needs the whole word with its capital", () => {
    expect(heroesMentioned("a ruby ring, Miyagi and Rubyx", heroes)).toEqual([]);
  });

  it("stops at the limit", () => {
    expect(heroesMentioned("Ruby Miya Lunox", heroes, 2).map((h) => h.name)).toEqual(["Ruby", "Miya"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  DATA_NAMES,
  effectNames,
  effectNamesPattern,
  restoreDashName,
  restoreEffectNames,
} from "../../scripts/translation-official-names.mjs";
import { shieldWith } from "../../scripts/translation-shield.mjs";

describe("Item effect names, as the game writes them", () => {
  const necklace =
    "Gift: Regens 20% HP and Mana within 2 seconds of leveling up. Lifebane: Upon dealing damage to the target, reduces Shield and HP Regen of the target by 50% for 3 seconds.";

  it("reads the effect names of an English item text", () => {
    expect(effectNames(necklace)).toEqual(["Gift", "Lifebane"]);
    expect(effectNames("Mana Spring: Regenerates 15% of Max Mana. Magic Mastery: Max Cooldown Reduction is increased by 5%.")).toEqual([
      "Mana Spring",
      "Magic Mastery",
    ]);
    expect(effectNames("Bud of Hope: Granted by Floryn and Dew.")).toEqual(["Bud of Hope"]);
    // A cooldown is a label, not a name; a stat line has none.
    expect(effectNames("Recovery: restores 15% of Mana. Cooldown: 60 seconds.")).toEqual(["Recovery"]);
    expect(effectNames("+20% Spell Vamp")).toEqual([]);
  });

  it("puts the names back in every language, the colon's spacing kept", () => {
    expect(restoreEffectNames("Cadeau : régénère 20 % de PV. Lifebane : réduit le bouclier de 50 %.", necklace)).toBe(
      "Gift : régénère 20 % de PV. Lifebane : réduit le bouclier de 50 %.",
    );
    expect(restoreEffectNames("Dissuasion : lorsqu'il est touché, réduit les dégâts de 6 %.", "Deter: When hit, reduces damage by 6%.")).toBe(
      "Deter : lorsqu'il est touché, réduit les dégâts de 6 %.",
    );
    expect(restoreEffectNames("Подарок: восстанавливает 20% здоровья. Lifebane: при нанесении урона.", necklace)).toBe(
      "Gift: восстанавливает 20% здоровья. Lifebane: при нанесении урона.",
    );
    // Thai writes no full stop: the next name follows a space.
    expect(restoreEffectNames("Armor Buster: เพิ่มการเจาะเกราะ 30% พลังงานมาเลฟิก: เพิ่มระยะ 12%", "Armor Buster: Increase penetration by 30%. Malefic Energy: Increases range by 12%.")).toBe(
      "Armor Buster: เพิ่มการเจาะเกราะ 30% Malefic Energy: เพิ่มระยะ 12%",
    );
  });

  it("keeps a translated cooldown label and leaves a text it cannot pair alone", () => {
    expect(restoreEffectNames("Récupération : restaure 15 % de mana. Temps de recharge : 60 secondes.", "Recovery: restores 15% of Mana. Cooldown: 60 seconds.")).toBe(
      "Recovery : restaure 15 % de mana. Temps de recharge : 60 secondes.",
    );
    // One label fewer than the source: only the opening name is restored.
    expect(restoreEffectNames("Cadeau : régénère 20 % de PV, et réduit le bouclier.", necklace)).toBe("Gift : régénère 20 % de PV, et réduit le bouclier.");
    expect(restoreEffectNames("+20 % Spell Vamp", "+20% Spell Vamp")).toBe("+20 % Spell Vamp");
  });
});

describe("Effect names in the patch notes", () => {
  const pattern = effectNamesPattern(["Deter", "Shield", "Fortress Shield"]);

  it("only shields a name where the notes name an effect", () => {
    expect("[Unique Passive - Deter] gains a Shield".match(pattern)).toEqual(["Deter"]);
    expect("Unique Passive - Fortress Shield".match(pattern)).toEqual(["Fortress Shield"]);
    const s = shieldWith(pattern)("[Unique Passive - Deter]");
    expect(s.restore(s.text.replace("Unique Passive", "Passif unique"))).toBe("[Passif unique - Deter]");
  });

  it("puts a heading's name back after the dash", () => {
    expect(restoreDashName("Passif unique – Dissuasion", "Unique Passive - Deter")).toBe("Passif unique – Deter");
    expect(restoreDashName("Passif unique - Cadeau", "Unique Passive - Gift")).toBe("Passif unique - Gift");
    expect(restoreDashName("Attributs", "Attributes")).toBe("Attributs");
  });
});

describe("Sub-mode names", () => {
  it("shields the Arcade sub-modes only, not the names the French client translates", () => {
    expect(DATA_NAMES).toContain("Boommander");
    expect(DATA_NAMES).toContain("Chess TD");
    for (const name of ["Mythical Glory", "Diamonds", "Mage Emblem", "Spell Vamp"]) expect(DATA_NAMES).not.toContain(name);
  });
});

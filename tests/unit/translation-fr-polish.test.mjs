import { describe, expect, it } from "vitest";
import {
  FR_LABELS,
  FR_SOURCE,
  forgetUntranslated,
  frenchStatLine,
  polishFrench,
  untranslatedSentences,
} from "../../scripts/translation-fr-polish.mjs";

const p = (text) => polishFrench(text, "");

describe("French proofreading of the game data", () => {
  it("translates item summaries by hand, from their English source", () => {
    expect(polishFrench("Sort de vampire", "Spell Vamp")).toBe("Vampirisme des sorts");
    expect(polishFrench("PV contre-élevé", "Counter High HP")).toBe("Contre les PV élevés");
    expect(polishFrench("Un coup lent", "One-Hit Slow")).toBe("Ralentissement à l'impact");
    expect(polishFrench("Dommages causés par les éclaboussures", "Splash Damage")).toBe("Dégâts de zone");
    expect(FR_SOURCE.size).toBeGreaterThan(20);
  });

  it("writes every item stat line the same way", () => {
    expect(frenchStatLine("+30 Physical Attack, +20% Attack Speed, +10% Lifesteal")).toBe(
      "+30 attaque physique, +20 % vitesse d'attaque, +10 % vol de vie",
    );
    expect(frenchStatLine("+1800 HP, +20 HP Regen")).toBe("+1800 PV, +20 régénération de PV");
    expect(frenchStatLine("+20% Hybrid Lifesteal")).toBe("+20 % vol de vie hybride");
    expect(frenchStatLine("+30 Adaptive Attack,")).toBe("+30 attaque adaptative");
    expect(polishFrench("+4 PV Régénération", "+4 HP Regen")).toBe("+4 régénération de PV");
    // Not a stat line: left to the rules.
    expect(frenchStatLine("Increase Power: grants 30 Physical Attack")).toBeNull();
    expect(frenchStatLine("+30 Unknown Stat")).toBeNull();
  });

  it("rewrites the Advance Server labels the service misread", () => {
    expect(p("Refroidir")).toBe("Temps de recharge");
    expect(p("Gamme de fonte")).toBe("Portée de lancement");
    expect(p("Chemin de construction")).toBe("Recette");
    expect(p("Effet lent")).toBe("Effet de ralentissement");
    expect(p("Durée lente")).toBe("Durée du ralentissement");
    expect(p("Croissance des attaques physiques")).toBe("Croissance de l'attaque physique");
    expect(FR_LABELS.get("Coût énergétique")).toBe("Coût en énergie");
  });

  it("puts translated hero names back", () => {
    expect(p("Le Minotaure saute vers la cible.")).toBe("Minotaur saute vers la cible.");
    expect(p("la 1ère compétence du Minotaure")).toBe("la 1re compétence de Minotaur");
    expect(p("Guenièvre saute.")).toBe("Guinevere saute.");
    expect(p("La bêta mitraille les ennemis.")).toBe("Beta mitraille les ennemis.");
  });

  it("names the ranks as the French client does", () => {
    expect(p("Warrior, Elite, Master, Grandmaster, Epic, Legend et Mythic (Mythical Honor, Mythical Glory et Mythical Immortal)")).toBe(
      "Guerrier, Élite, Maître, Grand Maître, Épique, Légende et Mythique (Honneur mythique, Gloire mythique et Immortel mythique)",
    );
    expect(p("Lorsqu'un joueur atteint Epic V")).toBe("Lorsqu'un joueur atteint Épique V");
    expect(p("un joueur Legend, au rang Epic, d'Epic à Legend")).toBe("un joueur Légende, au rang Épique, d'Épique à Légende");
    expect(p("chez Warrior / Elite / Master")).toBe("chez Guerrier / Élite / Maître");
    // A skin tier or a jungle creep is not a rank.
    expect(p("une apparence Epic")).toBe("une apparence Epic");
    expect(p("les Legend Creeps")).toBe("les Legend Creeps");
  });

  it("names modes and game words like the site", () => {
    expect(p("les règles de Classic comme base")).toBe("les règles du mode Classique comme base");
    expect(p("Choix de repêchage")).toBe("Draft Pick");
    expect(p("Grabuge")).toBe("Mayhem");
    expect(p("sur le Pays de l'Aube, au Pays de l'Aube")).toBe("sur la Terre de l'Aube, à la Terre de l'Aube");
    expect(p("Défense des Anciens : Allstars")).toBe("Defense of the Ancients: Allstars");
    // Brawl and Magic Chess keep the game's names (the shared glossary).
    expect(p("Shadow Brawl et Brawl")).toBe("Shadow Brawl et Brawl");
  });

  it("translates the English stats left in a French sentence", () => {
    expect(p("elle gagne 10 % de Spell Vamp.")).toBe("elle gagne 10 % de vampirisme des sorts.");
    expect(p("Cecilion gagne 10 Max Mana et récupère 10 Mana")).toBe("Cecilion gagne 10 mana max et récupère 10 mana");
    expect(p("(+15*Hero Level)")).toBe("(+15*niveau du héros)");
    expect(p("(+8*niveau de héros)")).toBe("(+8*niveau du héros)");
    expect(p("son ratio Spell Vamp")).toBe("son ratio de vampirisme des sorts");
    expect(p("Mana Spring : régénère du mana")).toBe("Mana Spring : régénère du mana");
  });

  it("keeps Ultimate in a skill name only", () => {
    expect(p("puis lancez son Ultimate.")).toBe("puis lancez son ultime.");
    expect(p("Ultimate pour supprimer")).toBe("Ultime pour supprimer");
    expect(p("pendant Ultimate Snipe")).toBe("pendant Ultimate Snipe");
    expect(p("activez son Brilliance Ultimate")).toBe("activez son Brilliance Ultimate");
    expect(p("lancer son Ultime")).toBe("lancer son ultime");
  });

  it("says dégâts, and dégâts réels for true damage", () => {
    expect(p("Dommages de base")).toBe("Dégâts de base");
    expect(p("Dommage")).toBe("Dégâts");
    expect(p("annulé les modifications apportées aux dommages")).toBe("annulé les modifications apportées aux dégâts");
    expect(p("infligeant 60 (+30 %) de vrais dégâts.")).toBe("infligeant 60 (+30 %) de dégâts réels.");
    expect(p("lui infligeant de vrais dégâts égaux")).toBe("lui infligeant des dégâts réels égaux");
    expect(p("Vrais dégâts")).toBe("Dégâts réels");
  });

  it("counts stacks in cumuls, with the agreements", () => {
    expect(p("Freya gagne 1 pile(s) d'Orbe sacré (jusqu'à 6 piles).")).toBe("Freya gagne 1 cumul d'Orbe sacré (jusqu'à 6 cumuls).");
    expect(p("appliquant une pile de Marque. Chaque pile augmente")).toBe("appliquant un cumul de Marque. Chaque cumul augmente");
    expect(p("au maximum de stacks")).toBe("au maximum de cumuls");
    expect(p("Gagne 10 stack(s) de létalité")).toBe("Gagne 10 cumuls de létalité");
    expect(p("lorsque les piles sont complètes")).toBe("lorsque les cumuls sont complets");
    expect(p("Alice gagne 1 charge(s) de Crimson")).toBe("Alice gagne 1 charge de Crimson");
    expect(p("1 boulon(s) supplémentaire(s)")).toBe("1 boulon supplémentaire");
    expect(p("4 arme(s)")).toBe("4 armes");
  });

  it("writes a quantity of a stat in points", () => {
    expect(p("confère 4 à 10 défenses hybrides supplémentaires")).toBe("confère 4 à 10 points de défense hybride supplémentaires");
    expect(p("convertie en 2 attaques physiques.")).toBe("convertie en 2 points d'attaque physique.");
    expect(p("Toutes les 100 attaques physiques que Bane possède")).toBe("Tous les 100 points d'attaque physique que Bane possède");
    expect(p("50 défenses physiques et magiques supplémentaires")).toBe("50 points de défense physique et magique supplémentaires");
    // Counted attacks are not a stat.
    expect(p("toutes les 2 attaques de base")).toBe("toutes les 2 attaques de base");
  });

  it("writes ordinals the French way, without a capital on the noun", () => {
    expect(p("utilisez sa 1ère Compétence puis sa 2ème Compétence")).toBe("utilisez sa 1re compétence puis sa 2e compétence");
    expect(p("Au 3ème lancer")).toBe("Au 3e lancer");
    expect(p("kitez avec ses Attaques de base")).toBe("kitez avec ses attaques de base");
    // An Advance Server label keeps its capital.
    expect(p("Compétence 2")).toBe("Compétence 2");
  });

  it("leaves an empty or non-string value alone", () => {
    expect(polishFrench("", "x")).toBe("");
    expect(polishFrench(null, "x")).toBeNull();
  });
});

describe("translations that left English behind", () => {
  const source =
    "There are two healing runes on opposite sides of the lane. The rune continuously heals the one who picks up during the 5-second delay, then regenerates some health.";
  const partial =
    "Il y a deux runes de guérison sur les côtés opposés de la lane. The rune continuously heals the one who picks up during the 5-second delay, then regenerates some health.";

  it("finds the source sentences copied word for word", () => {
    expect(untranslatedSentences(source, partial)).toHaveLength(1);
    expect(untranslatedSentences(source, "Il y a deux runes. La rune soigne celui qui la ramasse.")).toEqual([]);
    // A skill name kept in English is not an untranslated sentence.
    expect(untranslatedSentences("Lesley can cast this skill during Ultimate Snipe.", "Lesley peut lancer cette compétence pendant Ultimate Snipe.")).toEqual([]);
  });

  it("drops them from the cache so that they are translated again", () => {
    const cache = { [`en|fr|${source}`]: partial, "en|fr|Hello there my friend, how are you?": "Bonjour mon ami." };
    expect(forgetUntranslated(cache, [source, "Hello there my friend, how are you?"], "en", "fr")).toEqual([`en|fr|${source}`]);
    expect(Object.keys(cache)).toEqual(["en|fr|Hello there my friend, how are you?"]);
  });
});

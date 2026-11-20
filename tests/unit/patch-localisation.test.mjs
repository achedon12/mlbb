import { describe, expect, it } from "vitest";
import { applyGlossary } from "../../scripts/translation-glossary.mjs";
import { translateHtml } from "../../scripts/translation-html.mjs";
import {
  combineShields,
  forgetLost,
  forgetLostLabels,
  listLabel,
  namesPattern,
  restoreListLabel,
  shieldLabels,
  shieldWith,
} from "../../scripts/translation-shield.mjs";

// The correction pass applied to a cached translation of game data, as in
// `translate-data.mjs` (`trGame`): list label first, then the glossary.
const correct = (cached, source, tl = "fr") => applyGlossary(restoreListLabel(cached, source), tl, "data");

const M = (n) => `${String.fromCharCode(0xe000)}${n}${String.fromCharCode(0xe000)}`;

describe("French patch notes, as the official community read them", () => {
  // The sentences that got the site turned down, as the translation cache holds them.
  it("never translate the game's name", () => {
    expect(correct("-Légendes mobiles : Bang Bang", "―Mobile Legends: Bang Bang")).toBe("-Mobile Legends: Bang Bang");
    expect(correct("Une mise à jour de Légendes mobiles", "An update for Mobile Legends")).toBe(
      "Une mise à jour de Mobile Legends",
    );
  });

  it("call a skin an apparence, feminine", () => {
    expect(correct("E. Nouvelle peau", "E. New Skin")).toBe("E. Nouvelle apparence");
    expect(correct("un. Peaux rares", "a. Rare Skins")).toBe("a. Apparences rares");
    expect(correct("a. Boutique de fragments de peau premium", "a. Premium Skin Fragment Shop")).toBe(
      "a. Boutique de fragments d'apparence premium",
    );
    expect(correct("b. Boutique de fragments de peau rares", "b. Rare Skin Fragment Shop")).toBe(
      "b. Boutique de fragments d'apparence rares",
    );
    expect(correct("Le nouveau skin de Lukas", "Lukas's new skin")).toBe("La nouvelle apparence de Lukas");
  });

  it("keep the list labels of the source", () => {
    expect(correct("un. Les billets ne sont plus affichés.", "a. Tickets are no longer displayed.")).toBe(
      "a. Les billets ne sont plus affichés.",
    );
    // Inside an HTML block, past the tags' markers.
    expect(correct(`${M(0)}un. Ajustement${M(1)}`, `${M(0)}a. Adjusted${M(1)}`)).toBe(`${M(0)}a. Ajustement${M(1)}`);
  });

  it("keep the game's English names for its modes", () => {
    expect(correct("A. Bagarre", "A. Brawl")).toBe("A. Brawl");
    expect(correct("Bagarre de cartes", "Card Brawl")).toBe("Card Brawl");
    expect(correct("A. Bagarre des ombres", "A. Shadow Brawl")).toBe("A. Shadow Brawl");
    expect(correct("[Bagarre de l'Ombre]", "[Shadow Brawl]")).toBe("[Shadow Brawl]");
    expect(correct("B. Échecs magiques", "B. Magic Chess")).toBe("B. Magic Chess");
    expect(correct("A. Lumière des étoiles", "A. StarLight")).toBe("A. StarLight");
    expect(correct("Le mode Chaos revient", "Mayhem returns")).toBe("Le mode Mayhem revient");
    // Classic and Ranked have French names on the site: they stay.
    expect(correct("les modes Classique et Classé", "Classic and Ranked modes")).toBe("les modes Classique et Classé");
    // A brawl in lowercase, an ordinary word.
    expect(correct("une bagarre générale", "a brawl")).toBe("une bagarre générale");
  });

  it("use the players' words for roles and lanes", () => {
    expect(correct("des héros de tanks errants vers la Voie Exp", "roaming tanks")).toBe("des héros de tanks roamers vers l'EXP lane");
    expect(correct("maîtriser sa configuration itinérante", "his roaming build")).toBe("maîtriser sa configuration roam");
    expect(correct("[Bénédictions itinérantes]", "[Roaming Blessings]")).toBe("[Roaming Blessings]");
    expect(correct("Nous avons remarqué que l'itinérance de Sun", "Sun's roaming")).toBe("Nous avons remarqué que le roam de Sun");
    expect(correct("L'itinérance et l'équipement d'itinérance", "Roaming")).toBe("Le roam et l'équipement de roam");
  });
});

describe("list labels", () => {
  it("are one letter or a Roman numeral and a full stop, at the start", () => {
    expect(listLabel("a. Rare Skins")).toBe("a.");
    expect(listLabel("VII. Bug Fixes")).toBe("VII.");
    expect(listLabel(`${M(0)}E. New Skin${M(1)}`)).toBe("E.");
    expect(listLabel("1. Fixed an issue")).toBe(null);
    expect(listLabel("A new skin")).toBe(null);
    expect(listLabel("e.g. this")).toBe(null);
    expect(listLabel("Vision H. Bush")).toBe(null);
  });

  it("come back from the words the service made of them, in every language", () => {
    expect(restoreListLabel("um. A distância de pouso", "a. Powerball's landing distance")).toBe("a. A distância de pouso");
    expect(restoreListLabel("UN. La distanza di atterraggio", "a. Powerball's landing distance")).toBe("a. La distanza di atterraggio");
    expect(restoreListLabel("gramo. Se solucionó", "g. Fixed")).toBe("g. Se solucionó");
    expect(restoreListLabel("Дж. Другое", "J. Others")).toBe("J. Другое");
    expect(restoreListLabel(`${M(0)}Ako. Libreng Bayani`, `${M(0)}I. Free Hero`)).toBe(`${M(0)}I. Libreng Bayani`);
  });

  it("leave a translation alone when it kept the label, or when the source has none", () => {
    expect(restoreListLabel("a. Apparences rares", "a. Rare Skins")).toBe("a. Apparences rares");
    expect(restoreListLabel("Un. Deux.", "One. Two.")).toBe("Un. Deux.");
    expect(restoreListLabel("Optimisations de la vision H. Bush", "H. Bush Vision Optimizations")).toBe(
      "Optimisations de la vision H. Bush",
    );
  });

  it("travel behind a marker, after the tags and the protected names", () => {
    const shield = combineShields(shieldWith(namesPattern(["Lukas"])), shieldLabels);
    const s = shield(`${M(0)}a. Lukas: Mobile Legends: Bang Bang${M(1)}`);
    expect(s.text).toBe(`${M(0)}${M(4)} ${M(2)}: ${M(3)}${M(1)}`);
    expect(s.restore(`${M(0)}${M(4)} ${M(2)} : ${M(3)}${M(1)}`)).toBe(`${M(0)}a. Lukas : Mobile Legends: Bang Bang${M(1)}`);
    // A marker the service dropped: the text goes again, unshielded.
    expect(s.restore(`${M(0)}un. ${M(2)} : ${M(3)}${M(1)}`)).toBe(null);
    expect(s.restore(`${M(0)}${M(4)} Lucas : ${M(3)}${M(1)}`)).toBe(null);
  });

  it("send back to the service a cached translation that lost its label beyond repair", () => {
    const cache = {
      "en|fr|a. Rare Skins": "un. Peaux rares",
      "en|fr|H. Bush Vision Optimizations": "Optimisations de la vision H. Bush",
      "en|fr|J. Others": "J.Autres",
      "en|pt|A. Brawl": "Uma briga",
      "en|fr|b. Rare Skin Fragment Shop": "b. Boutique de fragments de peau rares",
      "en|fr|New Skin": "Nouvelle peau",
    };
    const texts = Object.keys(cache).map((k) => k.slice(6));
    const dropped = [...forgetLostLabels(cache, texts, "en", "fr"), ...forgetLostLabels(cache, texts, "en", "pt")];
    expect(dropped).toEqual(["en|fr|H. Bush Vision Optimizations", "en|fr|J. Others", "en|pt|A. Brawl"]);
    // "un." for "a." is put back on output: no new request.
    expect(Object.keys(cache)).toEqual(["en|fr|a. Rare Skins", "en|fr|b. Rare Skin Fragment Shop", "en|fr|New Skin"]);
  });
});

describe("the game's name", () => {
  const shield = shieldWith(namesPattern([]));

  it("is hidden from the service in every spelling, behind any dash", () => {
    expect(shield("―Mobile Legends: Bang Bang").text).toBe(`―${M(0)}`);
    expect(shield("Mobile Legends Bang Bang and MLBB").text).toBe(`${M(0)} and ${M(1)}`);
  });

  it("sends a cached translation that rendered it back to the service, in every language", () => {
    const cache = {
      "en|fr|―Mobile Legends: Bang Bang": "-Légendes mobiles : Bang Bang",
      "en|es|―Mobile Legends: Bang Bang": "―Leyendas móviles: Bang Bang",
      "en|id|―Mobile Legends: Bang Bang": "―Legenda Seluler: Bang Bang",
      "en|th|―Mobile Legends: Bang Bang": "―ตำนานมือถือ: ปังปัง",
      "en|it|―Mobile Legends: Bang Bang": "―Mobile Legends: Bang Bang",
    };
    const texts = ["―Mobile Legends: Bang Bang"];
    const dropped = ["fr", "es", "id", "th", "it"].flatMap((tl) => forgetLost(cache, texts, "en", tl, namesPattern([])));
    expect(dropped).toEqual([
      "en|fr|―Mobile Legends: Bang Bang",
      "en|es|―Mobile Legends: Bang Bang",
      "en|id|―Mobile Legends: Bang Bang",
      "en|th|―Mobile Legends: Bang Bang",
    ]);
  });

  it("is put back on output where a translation still carries it translated", () => {
    expect(correct("―Leyendas móviles: Bang Bang", "―Mobile Legends: Bang Bang", "es")).toBe("―Mobile Legends: Bang Bang");
    expect(correct("―Legenda Seluler: Bang Bang", "―Mobile Legends: Bang Bang", "id")).toBe("―Mobile Legends: Bang Bang");
    expect(correct("―ตำนานมือถือ: ปังปัง", "―Mobile Legends: Bang Bang", "th")).toBe("―Mobile Legends: Bang Bang");
  });
});

describe("an HTML patch section", () => {
  it("comes out corrected from cached translations", () => {
    const cached = {
      [`${M(0)}a. Premium Skin Fragment Shop${M(1)}`]: `${M(0)}a. Boutique de fragments de peau premium${M(1)}`,
      "a. Rare Skins": "un. Peaux rares",
      "―Mobile Legends: Bang Bang": "-Légendes mobiles : Bang Bang",
    };
    const t = (x) => (x ? correct(cached[x] ?? x, x) : x);
    const html = "<p><b>a. Premium Skin Fragment Shop</b></p><p>a. Rare Skins</p>\n―Mobile Legends: Bang Bang";
    expect(translateHtml(html, t)).toBe(
      "<p><b>a. Boutique de fragments d'apparence premium</b></p><p>a. Apparences rares</p>\n-Mobile Legends: Bang Bang",
    );
  });
});

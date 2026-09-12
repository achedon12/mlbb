import { describe, expect, it } from "vitest";
import { heros } from "@/lib/donnees";
import {
  cleSortieHeros,
  construireLiens,
  decouperRelation,
  factionsLore,
  herosCites,
  liensLore,
  motifsHeros,
  pairesLore,
  pairesVedettes,
  regionParCle,
  regionsLore,
  resumeRegion,
} from "@/lib/lore";

describe("decouperRelation", () => {
  it("separe les noms de la nature du lien", () => {
    expect(decouperRelation("Gusion, Eren (younger brothers)")).toEqual({ noms: "Gusion, Eren", nature: "younger brothers" });
    expect(decouperRelation("Terizla, Thamuz, (companions)")).toEqual({ noms: "Terizla, Thamuz,", nature: "companions" });
  });

  it("garde les parentheses interieures et accepte une ligne sans nature", () => {
    expect(decouperRelation("Ken (Outfit 2) (rival (former))")).toEqual({ noms: "Ken (Outfit 2)", nature: "rival (former)" });
    expect(decouperRelation("Unknown sisters")).toEqual({ noms: "Unknown sisters", nature: null });
  });
});

describe("herosCites", () => {
  const motifs = motifsHeros([
    { slug: "sun", name: "Sun" },
    { slug: "yi-sun-shin", name: "Yi Sun-shin" },
    { slug: "yin", name: "Yin" },
    { slug: "chang-e", name: "Chang'e" },
    { slug: "aamon", name: "Aamon" },
  ]);

  it("trouve les noms en mots entiers, sans casse, dans l'ordre de lecture", () => {
    expect(herosCites("chang'e, Aamon", motifs)).toEqual(["chang-e", "aamon"]);
    expect(herosCites("Yinyang", motifs)).toEqual([]);
  });

  it("ne voit pas un nom inclus dans un nom plus long, et s'ignore lui-meme", () => {
    expect(herosCites("Yi Sun-shin", motifs)).toEqual(["yi-sun-shin"]);
    expect(herosCites("Sun, Yi Sun-shin", motifs)).toEqual(["sun", "yi-sun-shin"]);
    expect(herosCites("Aamon, Yin", motifs, "aamon")).toEqual(["yin"]);
  });
});

describe("liens et paires", () => {
  const liste = [
    { slug: "aamon", name: "Aamon" },
    { slug: "gusion", name: "Gusion" },
    { slug: "alice", name: "Alice" },
    { slug: "miya", name: "Miya" },
  ];
  const fiche = (relations: string[]) => ({ profile: { relations, affiliations: [], species: null } });
  const en = {
    aamon: fiche(["Gusion (younger brother)"]),
    gusion: fiche(["Aamon (older brother)"]),
    alice: fiche(["Miya, Aamon, Gusion (enemies)"]),
    miya: fiche([]),
  };
  const fr = {
    aamon: fiche(["Gusion (frère cadet)"]),
    gusion: fiche(["Aamon (frère aîné)"]),
    alice: fiche(["Miya, Aamon, Gusion (ennemis)"]),
    miya: fiche([]),
  };
  const liens = construireLiens(liste, en, fr);

  it("lit la nature dans la langue de la page et compte la taille du groupe", () => {
    expect(liens.find((l) => l.de === "aamon")).toEqual({
      de: "aamon",
      vers: "gusion",
      nature: "frère cadet",
      natureEn: "younger brother",
      groupe: 1,
    });
    expect(liens.filter((l) => l.de === "alice").map((l) => [l.vers, l.groupe])).toEqual([
      ["miya", 3],
      ["aamon", 3],
      ["gusion", 3],
    ]);
  });

  it("classe un lien personnel et reciproque avant une liste d'ennemis", () => {
    const noms = new Map(liste.map((h) => [h.slug, h.name]));
    const paires = pairesLore(liens, noms);
    expect([paires[0].a, paires[0].b]).toEqual(["aamon", "gusion"]);
    expect(paires[0].deA?.nature).toBe("frère cadet");
    expect(paires[0].deB?.nature).toBe("frère aîné");
    // Chaque heros n'apparait qu'une fois dans la vitrine.
    const vedettes = pairesVedettes(paires, 5);
    const slugs = vedettes.flatMap((p) => [p.a, p.b]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("cleSortieHeros", () => {
  it("rend une date du wiki comparable", () => {
    expect(cleSortieHeros("26 October 2021")).toBe("2021-10-26");
    expect(cleSortieHeros("January 2017")).toBe("2017-01");
    expect(cleSortieHeros("2016")).toBe("2016");
    expect(cleSortieHeros("TBA")).toBeNull();
    expect(cleSortieHeros(null)).toBeNull();
  });
});

describe("donnees reelles", () => {
  it("range chaque heros qui a une region dans une seule region", () => {
    const ranges = regionsLore.flatMap((r) => r.heros.map((h) => h.slug));
    expect(ranges.length).toBe(heros.filter((h) => h.region).length);
    expect(new Set(ranges).size).toBe(ranges.length);
    expect(new Set(regionsLore.map((r) => r.cle)).size).toBe(regionsLore.length);
  });

  it("relie Aamon a Gusion, avec la nature de la fiche francaise", () => {
    const lien = liensLore("fr").find((l) => l.de === "aamon" && l.vers === "gusion");
    expect(lien?.natureEn).toBe("younger brothers");
    expect(lien?.nature).toBe("frères cadets");
  });

  it("reunit la maison Paxley et ecarte les affiliations hostiles", () => {
    const factions = factionsLore("en");
    expect(factions.find((f) => f.nom === "Paxley House")?.heros).toEqual(["aamon", "gusion", "marcel"]);
    expect(factions.some((f) => /hostile|enem|former/i.test(f.nom))).toBe(false);
  });

  it("resume une region avec ses seuls liens internes", () => {
    const r = regionParCle.get("moniyan-empire")!;
    const membres = new Set(r.heros.map((h) => h.slug));
    const resume = resumeRegion(r, "en");
    expect(resume.internes.every((p) => membres.has(p.a) && membres.has(p.b))).toBe(true);
    expect(resume.externes.every((p) => membres.has(p.a) !== membres.has(p.b))).toBe(true);
    expect(resume.roles.reduce((n, x) => n + x.n, 0)).toBeGreaterThanOrEqual(r.heros.length);
  });
});

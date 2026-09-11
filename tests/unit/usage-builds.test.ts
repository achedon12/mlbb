import { describe, expect, it } from "vitest";
import type { BuildJoue, BuildsHeros } from "@/lib/donnees";
import { partsParChoix, resumeParRang, usageParChoix } from "@/lib/usage-builds";
import { emblemesFiches, sortsFiches, usage } from "@/lib/fiches-usage";
import { objets } from "@/lib/donnees";

const build = (objets: string[], selection: number | null, victoire: number | null, extra: Partial<BuildJoue> = {}): BuildJoue => ({
  objets,
  embleme: "Assassin",
  talents: ["Thrill", "Seasoned Hunter", "Killing Spree"],
  sort: "Retribution",
  victoire,
  selection,
  ...extra,
});

const parObjet = (b: BuildJoue) => b.objets;

const builds: Record<string, BuildsHeros> = {
  aamon: {
    Jungle: {
      all: [build(["Lame", "Bottes"], 6, 54), build(["Lame", "Baton"], 2, 58), build(["Baton"], 4, 50)],
      mythic: [build(["Lame"], 5, 60)],
    },
    Milieu: { all: [build(["Lame"], 3, 40)] },
  },
  gusion: {
    Jungle: { all: [build(["Lame", "Lame"], 10, 52)] },
  },
  miya: {
    Or: { all: [build(["Bottes"], null, 51), build(["Bottes", "Arc"], null, 49)] },
  },
};

describe("usageParChoix", () => {
  const usages = usageParChoix(builds, parObjet);

  it("cumule la part des builds qui contiennent l'objet et pondere leur taux", () => {
    const aamon = usages.get("Lame")!.find((u) => u.slug === "aamon")!;
    expect(aamon.lane).toBe("Jungle");
    expect(aamon.selection).toBe(8);
    // (54 * 6 + 58 * 2) / 8
    expect(aamon.victoire).toBeCloseTo(55);
  });

  it("garde la position ou l'objet pese le plus, une seule ligne par heros", () => {
    const lignes = usages.get("Lame")!.filter((u) => u.slug === "aamon");
    expect(lignes).toHaveLength(1);
    expect(lignes[0].lane).not.toBe("Milieu");
  });

  it("classe les heros du plus engage au moins engage", () => {
    expect(usages.get("Lame")!.map((u) => u.slug)).toEqual(["gusion", "aamon"]);
  });

  it("ne compte qu'une fois un objet pris deux fois dans le meme build", () => {
    expect(usages.get("Lame")!.find((u) => u.slug === "gusion")!.selection).toBe(10);
  });

  it("retombe sur la moyenne simple quand aucune part n'est connue", () => {
    const miya = usages.get("Bottes")!.find((u) => u.slug === "miya")!;
    expect(miya.selection).toBe(0);
    expect(miya.victoire).toBeCloseTo(50);
  });

  it("lit le rang demande", () => {
    const mythique = usageParChoix(builds, parObjet, "mythic");
    expect(mythique.get("Lame")).toEqual([{ slug: "aamon", lane: "Jungle", selection: 5, victoire: 60 }]);
    expect(mythique.get("Baton")).toBeUndefined();
  });
});

describe("resumeParRang", () => {
  it("donne une ligne par rang, avec le heros en tete et un taux pondere", () => {
    const resume = resumeParRang({
      all: [
        { slug: "gusion", lane: "Jungle", selection: 10, victoire: 52 },
        { slug: "aamon", lane: "Jungle", selection: 5, victoire: 58 },
      ],
    });
    expect(resume).toHaveLength(6);
    expect(resume[0]).toMatchObject({ rang: "all", heros: 2, premier: { slug: "gusion" } });
    expect(resume[0].victoire).toBeCloseTo(54);
    expect(resume[1]).toEqual({ rang: "epic", heros: 0, premier: null, victoire: null });
  });
});

describe("partsParChoix", () => {
  it("repartit un choix parmi les builds retenus, ponderes par leur part", () => {
    const parts = partsParChoix(
      { a: { Jungle: { all: [build([], 3, 50, { sort: "Flicker" }), build([], 1, 50), build([], 4, 50, { embleme: "Mage" })] } } },
      (b) => b.embleme === "Assassin",
      (b) => (b.sort ? [b.sort] : []),
    );
    expect(parts).toEqual([
      { cle: "Flicker", part: 75 },
      { cle: "Retribution", part: 25 },
    ]);
  });

  it("ne renvoie rien sans build retenu", () => {
    expect(partsParChoix(builds, () => false, parObjet)).toEqual([]);
  });
});

describe("pages d'objet, d'embleme et de sort", () => {
  it("resout les objets des builds joues vers des objets connus", () => {
    const slugs = new Set(objets("en").map((o) => o.slug));
    const cites = objets("en").filter((o) => usage("objet", o.slug).length > 0);
    expect(cites.length).toBeGreaterThan(10);
    expect(cites.every((o) => slugs.has(o.slug))).toBe(true);
  });

  it("donne une adresse courte a chaque embleme et retrouve ses heros", () => {
    expect(emblemesFiches.map((e) => e.slug)).toEqual(["tank", "fighter", "assassin", "mage", "marksman", "support"]);
    expect(usage("embleme", "assassin").length).toBeGreaterThan(0);
  });

  it("couvre les sorts decrits et ceux que les builds citent seulement", () => {
    const slugs = sortsFiches.map((s) => s.slug);
    expect(slugs).toContain("flicker");
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(usage("sort", "retribution").length).toBeGreaterThan(0);
  });
});

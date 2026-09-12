import { describe, expect, it } from "vitest";
import { creerTDepuis } from "@/i18n/t";
import { herosParSlug } from "@/lib/donnees";
import {
  ancreSkin,
  ancresUniques,
  coderImage,
  filtrerGroupes,
  formaterSortie,
  imageDeVignette,
  imageVignette,
  raccourcirImage,
  type GroupeSkins,
} from "@/lib/skins";
import {
  ancresGalerie,
  derniersSkins,
  elide,
  galerieHeros,
  groupesSkins,
  herosAvecSkins,
  nombreSkinsGaleries,
  titreGalerie,
} from "@/lib/skins-heros";

describe("ancres des skins", () => {
  it("donne une ancre lisible, parentheses comprises", () => {
    expect(ancreSkin("Night's Edge")).toBe("skin-night-s-edge");
    expect(ancreSkin("Ken (Outfit 2)")).toBe("skin-ken-outfit-2");
    expect(ancreSkin("Épée & Roses")).toBe("skin-epee-roses");
    expect(ancreSkin("★")).toBe("skin-sans-nom");
  });

  it("rend uniques deux noms qui se reduisent au meme texte", () => {
    expect(ancresUniques(["A b", "A-b", "C", "a B"])).toEqual(["skin-a-b", "skin-a-b-2", "skin-c", "skin-a-b-3"]);
  });
});

describe("dates de sortie", () => {
  it("formate une date complete ou un mois dans la langue", () => {
    expect(formaterSortie("2016-12-11", "fr")).toBe("11 décembre 2016");
    expect(formaterSortie("2016-12-11", "en")).toBe("December 11, 2016");
    expect(formaterSortie("2018-08", "fr")).toBe("août 2018");
  });

  it("laisse telle quelle une annee seule ou approximative", () => {
    expect(formaterSortie("2016", "fr")).toBe("2016");
    expect(formaterSortie("201X", "en")).toBe("201X");
  });
});

describe("images des vignettes", () => {
  it("code un portrait par l'id du skin, et le retrouve", () => {
    const chemin = "/visuels/heros/angela/skins/552-dove-love.png";
    expect(coderImage("angela", "Dove & Love", "552", chemin)).toBe("552");
    expect(imageDeVignette("angela", ["Dove & Love", "552", 0])).toBe(chemin);
  });

  it("code une illustration par une etoile, et la retrouve", () => {
    const chemin = "/visuels/heros/aamon/illustrations/soul-reaver.webp";
    expect(coderImage("aamon", "Soul Reaver", null, chemin)).toBe("*");
    expect(imageDeVignette("aamon", ["Soul Reaver", "*", 0])).toBe(chemin);
  });

  it("garde en entier un chemin hors de la regle de nommage", () => {
    expect(coderImage("aamon", "Duke of Shards", "1091", "/ailleurs/duke.png")).toBe("/ailleurs/duke.png");
    expect(imageDeVignette("aamon", ["Duke of Shards", "/ailleurs/duke.png", 0])).toBe("/ailleurs/duke.png");
    expect(coderImage("aamon", "Duke of Shards", "1091", null)).toBeNull();
    expect(imageDeVignette("aamon", ["Duke of Shards", null, 0])).toBeNull();
  });

  it("raccourcit un chemin sous le dossier du heros, et le retablit", () => {
    const chemin = "/visuels/heros/aamon/skins/1091-duke-of-shards.png";
    expect(raccourcirImage("aamon", chemin)).toBe("skins/1091-duke-of-shards.png");
    expect(imageVignette("aamon", raccourcirImage("aamon", chemin))).toBe(chemin);
    expect(raccourcirImage("aamon", "/visuels/autre.png")).toBe("/visuels/autre.png");
    expect(imageVignette("aamon", null)).toBeNull();
  });
});

describe("filtres de la galerie", () => {
  const GROUPES: GroupeSkins[] = [
    { slug: "aamon", nom: "Aamon", roles: ["Assassin"], skins: [["Duke of Shards", null, 0], ["Soul Vessels", null, 4]] },
    { slug: "miya", nom: "Miya", roles: ["Marksman"], skins: [["Moonlight Archer", null, 0], ["Suzuhime", null, 3]] },
    { slug: "chou", nom: "Chou", roles: ["Fighter"], skins: [["Soul Vessels", null, 4]] },
  ];
  const vide = { role: null, recherche: "" };

  it("sans filtre, garde tout", () => {
    expect(filtrerGroupes(GROUPES, vide)).toEqual(GROUPES);
  });

  it("filtre par role", () => {
    expect(filtrerGroupes(GROUPES, { ...vide, role: "Marksman" }).map((g) => g.slug)).toEqual(["miya"]);
  });

  it("garde un heros entier quand la recherche trouve son nom", () => {
    expect(filtrerGroupes(GROUPES, { ...vide, recherche: "MIY" })).toEqual([GROUPES[1]]);
  });

  it("garde les seuls skins dont le nom correspond, sinon", () => {
    const r = filtrerGroupes(GROUPES, { ...vide, recherche: "vessel" });
    expect(r.map((g) => [g.slug, g.skins.map(([nom]) => nom)])).toEqual([
      ["aamon", ["Soul Vessels"]],
      ["chou", ["Soul Vessels"]],
    ]);
  });

  it("cumule role et recherche", () => {
    expect(filtrerGroupes(GROUPES, { role: "Fighter", recherche: "vessel" }).map((g) => g.slug)).toEqual(["chou"]);
    expect(filtrerGroupes(GROUPES, { role: "Tank", recherche: "" })).toEqual([]);
  });
});

describe("titres de galerie", () => {
  const t = creerTDepuis({ pages: { heroSkins: { titre: "Skins de {nom}", titreElision: "Skins d'{nom}" } } });

  it("elide en francais devant une voyelle, et seulement la", () => {
    expect(titreGalerie(t, "fr", "Aamon")).toBe("Skins d'Aamon");
    expect(titreGalerie(t, "fr", "Esmeralda")).toBe("Skins d'Esmeralda");
    expect(titreGalerie(t, "fr", "Balmond")).toBe("Skins de Balmond");
    expect(titreGalerie(t, "fr", "Yu Zhong")).toBe("Skins de Yu Zhong");
    expect(elide("en", "Aamon")).toBe(false);
  });
});

describe("galeries des heros (donnees synchronisees)", () => {
  it("joint portraits et illustrations du catalogue, et garde a part les illustrations seules", () => {
    for (const h of herosAvecSkins) {
      const g = galerieHeros(h);
      expect(g.skins).toHaveLength(h.skins.length);
      const prises = new Set(g.skins.map((s) => s.illustration));
      expect(g.autres.every((a) => !prises.has(a.illustration))).toBe(true);
      expect(g.total).toBe(g.skins.length + g.autres.length);
      expect(g.total).toBeGreaterThan(0);
    }
  });

  it("donne a chaque skin d'une galerie une ancre unique", () => {
    for (const h of herosAvecSkins) {
      const ancres = ancresGalerie(galerieHeros(h));
      expect(new Set(ancres).size).toBe(ancres.length);
    }
  });

  it("n'ouvre pas de galerie pour un heros sans aucun visuel", () => {
    const sans = [...herosParSlug.values()].filter((h) => !herosAvecSkins.includes(h));
    for (const h of sans) expect(galerieHeros(h).total).toBe(0);
  });

  it("met tous les skins recenses dans les groupes du catalogue, par ordre alphabetique", () => {
    const groupes = groupesSkins();
    expect(groupes.reduce((n, g) => n + g.skins.length, 0)).toBe(nombreSkinsGaleries);
    const noms = groupes.map((g) => g.nom);
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("retrouve l'image exacte de chaque vignette, codee au plus court", () => {
    let entieres = 0;
    let total = 0;
    for (const g of groupesSkins()) {
      const galerie = galerieHeros(herosParSlug.get(g.slug)!);
      const attendues = [...galerie.skins.map((s) => s.portrait ?? s.illustration), ...galerie.autres.map((a) => a.illustration)];
      expect(g.skins.map((v) => imageDeVignette(g.slug, v))).toEqual(attendues);
      for (const [, image] of g.skins) {
        total += 1;
        if (image?.startsWith("/")) entieres += 1;
      }
    }
    expect(entieres / total).toBeLessThan(0.02);
  });

  it("classe les derniers skins du plus recent au plus ancien", () => {
    const dates = derniersSkins(12).map((e) => e.skin.release!);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

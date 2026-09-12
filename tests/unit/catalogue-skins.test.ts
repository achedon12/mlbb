import { describe, expect, it } from "vitest";
import { creerTDepuis } from "@/i18n/t";
import {
  ancresDe,
  decoderIndex,
  encoderIndex,
  estSorti,
  filtrerSkins,
  grouperParDate,
  lireSortie,
  plusRecents,
  statsSeries,
  textePrix,
  tronquerGroupes,
  type Catalogue,
  type HerosCatalogue,
  type SkinCatalogue,
} from "@/lib/catalogue-skins";
import { catalogueSkins, dateReference, lirePrix, nettoyerObtention, skinsSortis } from "@/lib/catalogue-skins-serveur";
import { heros } from "@/lib/donnees";
import { ancresGalerie, galerieHeros } from "@/lib/skins-heros";

const skin = (p: Partial<SkinCatalogue> & { id: string }): SkinCatalogue => ({
  nom: `Skin ${p.id}`,
  heros: "aamon",
  rarete: 3,
  serie: null,
  sortie: null,
  dispo: "Available",
  prix: {},
  obtention: null,
  image: null,
  ancre: "",
  ...p,
});

const HEROS: HerosCatalogue[] = [
  { slug: "aamon", nom: "Aamon", roles: ["Assassin"], icone: "/visuels/heros/aamon/icone.png" },
  { slug: "chang-e", nom: "Chang'e", roles: ["Mage"], icone: null },
];
const parSlug = new Map(HEROS.map((h) => [h.slug, h]));

describe("lireSortie", () => {
  it("lit une date au jour, au mois ou a l'annee", () => {
    expect(lireSortie("2025-05-01")).toEqual({ annee: 2025, mois: 5, jour: 1 });
    expect(lireSortie("2025-05")).toEqual({ annee: 2025, mois: 5, jour: null });
    expect(lireSortie("2016")).toEqual({ annee: 2016, mois: null, jour: null });
  });

  it("refuse une date approximative ou absente", () => {
    expect(lireSortie("202X")).toBeNull();
    expect(lireSortie("202XX")).toBeNull();
    expect(lireSortie(null)).toBeNull();
  });
});

describe("estSorti", () => {
  const ref = "2026-09-11";
  it("compare une date a sa propre precision", () => {
    expect(estSorti(skin({ id: "1", sortie: "2026-09" }), ref)).toBe(true);
    expect(estSorti(skin({ id: "2", sortie: "2026" }), ref)).toBe(true);
    expect(estSorti(skin({ id: "3", sortie: "2026-09-11" }), ref)).toBe(true);
    expect(estSorti(skin({ id: "4", sortie: "2026-09-12" }), ref)).toBe(false);
    expect(estSorti(skin({ id: "5", sortie: "2026-12-18" }), ref)).toBe(false);
  });

  it("ecarte les skins annonces et les dates illisibles", () => {
    expect(estSorti(skin({ id: "1", sortie: "2025-01", dispo: "Upcoming" }), ref)).toBe(false);
    expect(estSorti(skin({ id: "2", sortie: "202X" }), ref)).toBe(false);
    expect(estSorti(skin({ id: "3" }), ref)).toBe(false);
  });
});

describe("grouperParDate", () => {
  const liste = [
    skin({ id: "a", sortie: "2025-03-02" }),
    skin({ id: "b", sortie: "2025-11" }),
    skin({ id: "c", sortie: "2025" }),
    skin({ id: "d", sortie: "2024-03-10" }),
    skin({ id: "e", sortie: "2025-03-20" }),
    skin({ id: "f", sortie: "202X" }),
  ];

  it("range du plus recent au plus ancien, le mois inconnu en fin d'annee", () => {
    const g = grouperParDate(liste, "recent");
    expect(g.map((a) => [a.annee, a.total])).toEqual([
      [2025, 4],
      [2024, 1],
    ]);
    expect(g[0].mois.map((m) => m.mois)).toEqual([11, 3, null]);
    expect(g[0].mois[1].skins.map((s) => s.id)).toEqual(["e", "a"]);
  });

  it("lit une annee de janvier a decembre en ordre chronologique", () => {
    const g = grouperParDate(liste, "chronologique");
    expect(g.map((a) => a.annee)).toEqual([2024, 2025]);
    expect(g[1].mois.map((m) => m.mois)).toEqual([3, 11, null]);
    expect(g[1].mois[0].skins.map((s) => s.id)).toEqual(["a", "e"]);
  });

  it("tronque par pas sans perdre le total de l'annee", () => {
    const t = tronquerGroupes(grouperParDate(liste, "recent"), 2);
    expect(t).toHaveLength(1);
    expect(t[0].total).toBe(4);
    expect(t[0].mois.flatMap((m) => m.skins.map((s) => s.id))).toEqual(["b", "e"]);
  });

  it("donne les plus recents dates au moins au mois", () => {
    expect(plusRecents(liste, 3).map((s) => s.id)).toEqual(["b", "e", "a"]);
  });
});

describe("filtrerSkins", () => {
  const liste = [
    skin({ id: "1", nom: "Night's Edge", serie: "Epic", rarete: 4, sortie: "2023-01" }),
    skin({ id: "2", nom: "Moon Rabbit", heros: "chang-e", serie: "Collector", rarete: 2, sortie: "2024" }),
    skin({ id: "3", nom: "Vessel of Deceit", serie: "Epic", rarete: 4, sortie: "2024-06-01" }),
  ];
  const ids = (f: Parameters<typeof filtrerSkins>[2]) => filtrerSkins(liste, parSlug, f).map((s) => s.id);

  it("combine heros, role, serie, rarete et annee", () => {
    expect(ids({ heros: "aamon" })).toEqual(["1", "3"]);
    expect(ids({ role: "Mage" })).toEqual(["2"]);
    expect(ids({ serie: "Epic", annee: 2024 })).toEqual(["3"]);
    expect(ids({ rarete: 2 })).toEqual(["2"]);
  });

  it("cherche dans le nom du skin et celui du heros, sans casse ni accents", () => {
    expect(ids({ recherche: "VESSEL" })).toEqual(["3"]);
    expect(ids({ recherche: "chang'e" })).toEqual(["2"]);
  });

  it("compte les series et leurs bornes", () => {
    expect(statsSeries(liste)).toEqual([
      { serie: "Epic", total: 2, premiere: "2023-01", derniere: "2024-06-01" },
      { serie: "Collector", total: 1, premiere: "2024", derniere: "2024" },
    ]);
  });
});

describe("index compact", () => {
  const catalogue: Catalogue = {
    maj: "2026-09-11",
    heros: HEROS,
    skins: [
      skin({ id: "10", nom: "Duke of Shards", rarete: 0, prix: { dm: 599, bp: 32000 }, ancre: "skin-duke-of-shards" }),
      skin({
        id: "11",
        nom: "Night's Edge",
        serie: "Epic",
        sortie: "2023-01",
        dispo: "Limited",
        image: "/visuels/heros/aamon/skins/11-night-s-edge.png",
        ancre: "skin-night-s-edge",
      }),
      skin({ id: "12", nom: "Night S Edge", obtention: "Event", ancre: "skin-night-s-edge-2" }),
      skin({ id: "20", nom: "Moon Rabbit", heros: "chang-e", serie: "Epic", ancre: "skin-moon-rabbit" }),
    ],
  };

  it("se decode a l'identique, ancres recalculees", () => {
    expect(decoderIndex(JSON.parse(JSON.stringify(encoderIndex(catalogue))))).toEqual(catalogue);
  });

  it("raccourcit les chemins sous le dossier du heros et partage les series", () => {
    const index = encoderIndex(catalogue);
    expect(index.series).toEqual(["Epic"]);
    expect(index.skins[1][9]).toBe("skins/11-night-s-edge.png");
    expect(index.heros[0][3]).toBe("icone.png");
  });

  it("suffixe deux ancres qui se confondent", () => {
    expect(ancresDe(["A&B", "A B", "C"])).toEqual(["skin-a-b", "skin-a-b-2", "skin-c"]);
  });
});

describe("textePrix", () => {
  const t = creerTDepuis({ skinsUI: { diamonds: "Diamonds", battlePoints: "Battle Points" } });
  const nombre = new Intl.NumberFormat("en");
  it("ecrit chaque monnaie chiffree, dans l'ordre des monnaies", () => {
    expect(textePrix({ bp: 32000, dm: 599 }, t, nombre)).toBe("599 diamonds · 32,000 battle points");
    expect(textePrix({}, t, nombre)).toBeNull();
  });
});

describe("catalogue reel", () => {
  const c = catalogueSkins();

  it("n'a que des skins rattaches a un heros du catalogue, aux identifiants uniques", () => {
    const slugs = new Set(c.heros.map((h) => h.slug));
    expect(c.skins.every((s) => slugs.has(s.heros))).toBe(true);
    expect(new Set(c.skins.map((s) => s.id)).size).toBe(c.skins.length);
  });

  it("donne a chaque skin l'ancre de la galerie de son heros", () => {
    for (const h of heros.filter((x) => x.skins.length > 0)) {
      const g = galerieHeros(h);
      const attendues = ancresGalerie(g).slice(0, g.skins.length);
      expect(c.skins.filter((s) => s.heros === h.slug).map((s) => s.ancre)).toEqual(attendues);
    }
  });

  it("ne met au calendrier ni skin d'origine, ni skin annonce, ni date posterieure aux donnees", () => {
    for (const s of skinsSortis()) {
      expect(s.rarete).toBeGreaterThan(0);
      expect(s.dispo).not.toBe("Upcoming");
      expect(s.sortie! <= dateReference.slice(0, s.sortie!.length)).toBe(true);
    }
  });

  it("survit a l'aller-retour par l'index compact", () => {
    expect(decoderIndex(JSON.parse(JSON.stringify(encoderIndex(c))))).toEqual(c);
  });

  it("nettoie les liens du wiki et ignore les prix illisibles", () => {
    expect(nettoyerObtention("Obtained via the [[MLBB × Naruto|MLBB X Naruto]] event")).toBe(
      "Obtained via the MLBB X Naruto event",
    );
    expect(nettoyerObtention("[[M5 Pass]]")).toBe("M5 Pass");
    expect(lirePrix({ dm: "599", bp: "abc", other: "Twilight Pass" })).toEqual({ dm: 599 });
  });
});

import { describe, expect, it } from "vitest";
import {
  cheminFiltre,
  cheminRole,
  correspond,
  filtrerClassement,
  FILTRES_LANE,
  FILTRES_ROLE,
  laneDuSlug,
  roleDuSlug,
  SLUGS_LANE,
  SLUGS_ROLE,
} from "@/lib/filtres-tier-list";
import type { Lane, Role } from "@/lib/types";

const heros = (slug: string, lanes: Lane[], roles: Role[]) => ({ heros: { slug, lanes, roles } });

describe("adresses des lanes et des roles", () => {
  it("fait l'aller-retour entre valeur interne et adresse anglaise", () => {
    for (const [lane, slug] of Object.entries(SLUGS_LANE)) expect(laneDuSlug(slug)).toBe(lane);
    for (const [role, slug] of Object.entries(SLUGS_ROLE)) expect(roleDuSlug(slug)).toBe(role);
  });

  it("refuse une adresse inconnue ou la valeur interne francaise", () => {
    expect(laneDuSlug("Or")).toBeNull();
    expect(laneDuSlug("milieu")).toBeNull();
    expect(roleDuSlug("tireur")).toBeNull();
  });

  it("donne des adresses distinctes, en minuscules", () => {
    const chemins = [...FILTRES_LANE, ...FILTRES_ROLE].map(cheminFiltre);
    expect(new Set(chemins).size).toBe(11);
    expect(cheminFiltre({ type: "lane", valeur: "Or" })).toBe("/tier-list/lane/gold");
    expect(cheminFiltre({ type: "role", valeur: "Marksman" })).toBe("/tier-list/role/marksman");
    expect(cheminRole("Support")).toBe("/heroes/role/support");
    expect(chemins.every((c) => c === c.toLowerCase())).toBe(true);
  });
});

describe("filtre du classement", () => {
  const classement = [
    heros("a", ["Jungle"], ["Assassin"]),
    heros("b", ["Roam", "Experience"], ["Tank", "Fighter"]),
    heros("c", ["Jungle", "Experience"], ["Fighter"]),
  ];

  it("garde les heros d'une lane, dans l'ordre du classement", () => {
    expect(filtrerClassement(classement, { type: "lane", valeur: "Experience" }).map((e) => e.heros.slug)).toEqual([
      "b",
      "c",
    ]);
  });

  it("compte un role secondaire", () => {
    expect(filtrerClassement(classement, { type: "role", valeur: "Fighter" }).map((e) => e.heros.slug)).toEqual([
      "b",
      "c",
    ]);
  });

  it("laisse tout passer sans filtre", () => {
    expect(filtrerClassement(classement, null)).toHaveLength(3);
    expect(correspond(classement[0].heros, null)).toBe(true);
  });
});

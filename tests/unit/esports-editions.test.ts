import { describe, expect, it } from "vitest";
import { isPastEdition, pastEditionRedirect, tournaments } from "@/lib/esports";

const covered = [
  { slug: "m8-world-championship", number: 8 },
  { slug: "m7-world-championship", number: 7 },
  { slug: "msc-2026", number: 2026 },
  { slug: "mpl-id-season-18", number: 18 },
];

describe("isPastEdition", () => {
  it("recognizes an edition older than the oldest covered one of its series", () => {
    for (const slug of ["m4-world-championship", "m5-world-championship", "m6-world-championship", "msc-2024", "mpl-id-season-13"]) {
      expect(isPastEdition(slug, covered)).toBe(true);
    }
  });

  it("leaves a later edition alone: it may be covered at the next sync", () => {
    expect(isPastEdition("m9-world-championship", covered)).toBe(false);
    expect(isPastEdition("msc-2027", covered)).toBe(false);
    expect(isPastEdition("mpl-id-season-19", covered)).toBe(false);
  });

  it("does not take an uncovered series or a nonsense address for an edition", () => {
    for (const slug of ["mpl-ph-season-12", "m-world-championship", "mx-world-championship", "m5-world-cup", "msc-2024-extra", "hello", ""]) {
      expect(isPastEdition(slug, covered)).toBe(false);
    }
  });

  it("never redirects a covered tournament", () => {
    for (const t of tournaments) expect(isPastEdition(t.slug)).toBe(false);
  });
});

describe("pastEditionRedirect", () => {
  it("leads a past edition to the esports index of its language", () => {
    expect(pastEditionRedirect("en", "m5-world-championship", covered)).toBe("/en/esports");
    expect(pastEditionRedirect("fr", "m4-world-championship", covered)).toBe("/fr/esports");
  });

  it("keeps the 404 for a later edition or a nonsense address", () => {
    expect(pastEditionRedirect("en", "m9-world-championship", covered)).toBeNull();
    expect(pastEditionRedirect("en", "hello", covered)).toBeNull();
  });

  it("never builds a target from an unknown locale segment", () => {
    for (const locale of ["/evil.example", "%2F%2Fevil.example", "//evil.example", "\\evil.example", "https:", "EN", ""]) {
      expect(pastEditionRedirect(locale, "m5-world-championship", covered)).toBeNull();
    }
  });
});

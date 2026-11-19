/**
 * Collaboration skins: characters, brands and people that Moonton licenses
 * from their owners (NARUTO, Star Wars, Transformers, Neymar Jr…).
 *
 * Their artwork belongs to Moonton and to the licensor at once. The site
 * shows them as the small shop portrait only, with a credit to both, never
 * as a full-size illustration (see `shownIllustrations`).
 *
 * Keys are the skin labels the wiki module gives them; values, the
 * franchise as credited.
 */
export const COLLABORATIONS: Record<string, string> = {
  KOF: "The King of Fighters",
  "Saint Seiya": "Saint Seiya",
  Transformers: "Transformers",
  Naruto: "NARUTO",
  // Liquipedia's label for the skins the module lacks.
  "Naruto Shippuden": "NARUTO",
  "Street Fighter": "Street Fighter",
  "Star Wars": "Star Wars",
  Sanrio: "Sanrio",
  "HUNTER×HUNTER": "HUNTER×HUNTER",
  "Jujutsu Kaisen": "Jujutsu Kaisen",
  "Kung Fu Panda": "Kung Fu Panda",
  "Attack on Titan": "Attack on Titan",
  Ducati: "Ducati",
  "Neymar Jr": "Neymar Jr",
  SpongeBob: "SpongeBob SquarePants",
  "Pacquiao Licensed": "Manny Pacquiao",
};

const byKey = new Map(Object.entries(COLLABORATIONS).map(([label, franchise]) => [key(label), franchise]));

function key(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9×]/g, "");
}

/** The licensed franchise of a skin, or null for one of Moonton's own. */
export function collaborationOf(skin: { label: string | null }): string | null {
  return skin.label ? (byKey.get(key(skin.label)) ?? null) : null;
}

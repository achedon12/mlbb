/** An entry of the global search. */
export interface EntrySearch {
  type: "hero" | "item" | "emblem" | "spell" | "skill" | "skin" | "patch" | "page";
  title: string;
  /** Detail shown under the title: epithet, category, hero, subtitle. */
  detail?: string;
  /** Address without locale; the link adds the page's one. */
  href: string;
  image?: string | null;
}

/**
 * Order of result groups. Heroes first: a hero's name also
 * appears in the detail of their skins and skills, which it must not
 * come after.
 */
export const ORDER_TYPES: EntrySearch["type"][] = ["hero", "item", "emblem", "spell", "skill", "skin", "patch", "page"];

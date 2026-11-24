/**
 * The name shared by a hero's portrait on its tile (`HeroCard`) and on its
 * page (`ShowcasePortrait`): React pairs the two in a view transition on
 * navigation, so the portrait moves from the list to the page and back. A
 * browser without the View Transitions API simply navigates. Unique per page:
 * a hero has one tile per list and one portrait on its page.
 */
export const heroMorph = (slug: string) => `hero-portrait-${slug}`;

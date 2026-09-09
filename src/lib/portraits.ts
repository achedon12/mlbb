import portraits from "@/data/portraits.json";

/**
 * Portraits des heros.
 *
 * La table est generee par `npm run portraits` et versionnee : le build ne
 * depend d'aucun service externe, et un heros sans portrait s'affiche avec un
 * substitut plutot que de casser la page.
 */
const TABLE = portraits as Record<string, string>;

export function portrait(slug: string): string | null {
  return TABLE[slug] ?? null;
}

/** Initiales affichees quand aucun portrait n'est disponible. */
export function initiales(nom: string): string {
  return nom
    .split(/[\s'-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}

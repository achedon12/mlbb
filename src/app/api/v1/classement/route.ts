import { classementComplet, mesureLe } from "@/lib/tier-list";
import { reponseApi } from "@/lib/api";

/**
 * Classement calcule.
 *
 * La date du releve accompagne les taux : sa source peut etre indisponible
 * quand le reste du site se met a jour, et un chiffre sans date laisserait
 * croire qu'il est frais.
 */
export const dynamic = "force-static";

export function GET() {
  return reponseApi(
    {
      mesureLe,
      heros: classementComplet.map((e) => ({
        slug: e.heros.slug,
        nom: e.heros.nom,
        palier: e.palier,
        victoire: e.victoire,
        ban: e.ban,
        selection: e.selection,
        score: e.score,
        faibleEchantillon: e.faibleEchantillon,
      })),
    },
    { total: classementComplet.length },
  );
}

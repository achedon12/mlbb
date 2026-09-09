"use client";

import { useActionState } from "react";
import { Info } from "lucide-react";
import { lierCompteJeu, type Etat } from "@/lib/actions";

/**
 * Liaison d'un identifiant de jeu.
 *
 * La verification passe par l'etape de validation d'identifiant des
 * plateformes de recharge, seul point d'entree public existant. Elle ne
 * declenche aucun paiement et ne remonte que le pseudo : c'est dit
 * explicitement dans le formulaire plutot que laisse a deviner.
 */
export function LiaisonCompte() {
  const [etat, envoyer, enCours] = useActionState<Etat, FormData>(lierCompteJeu, {});

  return (
    <form action={envoyer} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="identifiant" className="block text-sm font-medium text-craie-100">
            Identifiant de joueur
          </label>
          <input
            id="identifiant"
            name="identifiant"
            inputMode="numeric"
            pattern="[\d\s()]{5,25}"
            required
            placeholder="123456789 ou 123456789 (6021)"
            aria-describedby="ou-trouver"
            className="biseau-sm mt-2 w-full border border-nuit-700 bg-nuit-900 px-4 py-2.5 text-craie-100 outline-none transition-colors focus:border-or-500"
          />
        </div>
        <div>
          <label htmlFor="serveur" className="block text-sm font-medium text-craie-100">
            Serveur
          </label>
          <input
            id="serveur"
            name="serveur"
            inputMode="numeric"
            pattern="[\d\s]{3,10}"
            required
            placeholder="2222"
            aria-describedby="ou-trouver"
            className="biseau-sm mt-2 w-full border border-nuit-700 bg-nuit-900 px-4 py-2.5 text-craie-100 outline-none transition-colors focus:border-or-500"
          />
        </div>
      </div>

      <p id="ou-trouver" className="flex gap-2 text-xs leading-relaxed text-craie-500">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
        Dans le jeu, ouvrez votre profil : l&apos;identifiant s&apos;affiche sous
        la forme <span className="text-craie-300">123456789 (6021)</span>. Vous
        pouvez le coller tel quel dans le premier champ — le serveur sera
        reconnu tout seul.
      </p>

      {etat.erreur && (
        <p role="alert" className="biseau-sm border border-sang-500/40 bg-sang-500/10 px-4 py-3 text-sm text-sang-500">
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="biseau-sm border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {etat.succes}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="biseau-sm bg-or-500 px-6 py-2.5 font-semibold text-nuit-950 transition-colors hover:bg-or-400 disabled:opacity-60"
      >
        {enCours ? "Verification…" : "Verifier et lier"}
      </button>
    </form>
  );
}

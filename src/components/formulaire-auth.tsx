"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Etat } from "@/lib/actions";

/**
 * Formulaire de connexion et d'inscription.
 *
 * Le meme composant sert aux deux ecrans : seuls l'action, les champs et les
 * libelles changent. `useActionState` affiche l'erreur renvoyee par l'action
 * sans que la page ait besoin de son propre etat.
 */
export function FormulaireAuth({
  action,
  mode,
}: {
  action: (precedent: Etat, donnees: FormData) => Promise<Etat>;
  mode: "connexion" | "inscription";
}) {
  const [etat, envoyer, enCours] = useActionState(action, {});
  const inscription = mode === "inscription";

  return (
    <form action={envoyer} className="space-y-5">
      {inscription && (
        <Champ
          nom="pseudo"
          libelle="Pseudo"
          type="text"
          autoComplete="nickname"
          indication="Affiche sur le site. Il n'a pas besoin de correspondre a votre pseudo en jeu."
          requis
        />
      )}

      <Champ nom="email" libelle="Adresse e-mail" type="email" autoComplete="email" requis />

      <Champ
        nom="motDePasse"
        libelle="Mot de passe"
        type="password"
        autoComplete={inscription ? "new-password" : "current-password"}
        indication={inscription ? "10 caracteres minimum." : undefined}
        requis
      />

      {etat.erreur && (
        <p role="alert" className="biseau-sm border border-sang-500/40 bg-sang-500/10 px-4 py-3 text-sm text-sang-500">
          {etat.erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="biseau-sm w-full bg-or-500 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400 disabled:opacity-60"
      >
        {enCours ? "Un instant…" : inscription ? "Creer mon compte" : "Se connecter"}
      </button>

      <p className="text-center text-sm text-craie-500">
        {inscription ? (
          <>
            Deja un compte ?{" "}
            <Link href="/connexion" className="text-or-400 underline underline-offset-4">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            Pas encore de compte ?{" "}
            <Link href="/inscription" className="text-or-400 underline underline-offset-4">
              En creer un
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Champ({
  nom,
  libelle,
  type,
  autoComplete,
  indication,
  requis,
}: {
  nom: string;
  libelle: string;
  type: string;
  autoComplete?: string;
  indication?: string;
  requis?: boolean;
}) {
  const idIndication = indication ? `${nom}-indication` : undefined;

  return (
    <div>
      <label htmlFor={nom} className="block text-sm font-medium text-craie-100">
        {libelle}
      </label>
      <input
        id={nom}
        name={nom}
        type={type}
        autoComplete={autoComplete}
        required={requis}
        aria-describedby={idIndication}
        className="biseau-sm mt-2 w-full border border-nuit-700 bg-nuit-900 px-4 py-2.5 text-craie-100 outline-none transition-colors focus:border-or-500"
      />
      {indication && (
        <p id={idIndication} className="mt-1.5 text-xs text-craie-500">
          {indication}
        </p>
      )}
    </div>
  );
}

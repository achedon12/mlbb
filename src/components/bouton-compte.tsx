"use client";

import { useEffect, useState } from "react";
import { LogIn, UserRound } from "lucide-react";
import Link from "@/components/lien";
import { useT } from "@/i18n/fournisseur";

type Session = { connecte: boolean; pseudo?: string };

/**
 * Acces au compte dans l'en-tete.
 *
 * L'espace est reserve des le premier rendu pour qu'aucun decalage de mise en
 * page ne se produise une fois la session connue.
 */
export function BoutonCompte() {
  const t = useT();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let annule = false;
    fetch("/api/session")
      .then((r) => r.json())
      .then((d: Session) => !annule && setSession(d))
      .catch(() => !annule && setSession({ connecte: false }));
    return () => {
      annule = true;
    };
  }, []);

  // Sur mobile, une simple icone : le libelle ne tient pas a cote du menu
  // sous 375 px de large. Il reste lu par les lecteurs d'ecran.
  if (!session) return <span aria-hidden className="h-9 w-9 sm:w-24" />;

  return session.connecte ? (
    <Link
      href="/account"
      className="bevel-sm grid h-9 min-w-9 max-w-36 place-items-center truncate bg-night-800 px-2 text-sm font-semibold text-chalk-100 transition-colors hover:bg-night-700 sm:block sm:px-4 sm:py-2"
    >
      <UserRound size={18} aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">{session.pseudo}</span>
    </Link>
  ) : (
    <Link
      href="/login"
      className="bevel-sm grid h-9 min-w-9 place-items-center bg-gold-500 px-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400 sm:block sm:px-4 sm:py-2"
    >
      <LogIn size={18} aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">{t("compte.connexion")}</span>
    </Link>
  );
}

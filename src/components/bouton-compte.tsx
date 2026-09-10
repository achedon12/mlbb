"use client";

import { useEffect, useState } from "react";
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

  if (!session) return <span aria-hidden className="h-9 w-24" />;

  return session.connecte ? (
    <Link
      href="/account"
      className="biseau-sm max-w-36 truncate bg-nuit-800 px-4 py-2 text-sm font-semibold text-craie-100 transition-colors hover:bg-nuit-700"
    >
      {session.pseudo}
    </Link>
  ) : (
    <Link
      href="/login"
      className="biseau-sm bg-or-500 px-4 py-2 text-sm font-semibold text-nuit-950 transition-colors hover:bg-or-400"
    >
      {t("compte.connexion")}
    </Link>
  );
}

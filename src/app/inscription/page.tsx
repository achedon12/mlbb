import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormulaireAuth } from "@/components/formulaire-auth";
import { inscrire } from "@/lib/actions";
import { utilisateurCourant } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Creer un compte",
  description: "Creer un compte pour garder ses heros favoris et lier un identifiant de jeu.",
  robots: { index: false, follow: false },
};

export default async function PageInscription() {
  if (await utilisateurCourant()) redirect("/compte");

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-titre text-3xl font-bold text-craie-100">Creer un compte</h1>
      <div aria-hidden className="filet-or mt-3 h-0.5 w-16" />
      <p className="mt-4 text-sm leading-relaxed text-craie-500">
        Sert a conserver vos heros favoris et a lier un identifiant de jeu
        verifie. Rien d&apos;autre n&apos;est collecte.
      </p>

      <div className="mt-10">
        <FormulaireAuth action={inscrire} mode="inscription" />
      </div>
    </div>
  );
}

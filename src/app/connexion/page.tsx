import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormulaireAuth } from "@/components/formulaire-auth";
import { connecter } from "@/lib/actions";
import { utilisateurCourant } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Se connecter a son compte.",
  robots: { index: false, follow: false },
};

export default async function PageConnexion() {
  if (await utilisateurCourant()) redirect("/compte");

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-titre text-3xl font-bold text-craie-100">Connexion</h1>
      <div aria-hidden className="filet-or mt-3 h-0.5 w-16" />
      <p className="mt-4 text-sm leading-relaxed text-craie-500">
        Le compte est facultatif : tout le contenu du site reste accessible sans
        se connecter.
      </p>

      <div className="mt-10">
        <FormulaireAuth action={connecter} mode="connexion" />
      </div>
    </div>
  );
}

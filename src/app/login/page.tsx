import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { FormulaireConnexion } from "@/components/formulaire-connexion";
import { jetonCourant } from "@/lib/session";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez votre compte Mobile Legends par code de verification, sans mot de passe.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PageConnexion() {
  if (await jetonCourant()) redirect("/account");

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-titre text-3xl font-bold text-craie-100">Connexion</h1>
      <div aria-hidden className="filet-or mt-3 h-0.5 w-16" />
      <p className="mt-4 text-sm leading-relaxed text-craie-500">
        Connectez votre compte de jeu par le code de verification officiel de
        Moonton. Aucun mot de passe ne vous est demande.
      </p>

      <div className="mt-8">
        <FormulaireConnexion />
      </div>

      <p className="mt-8 flex gap-2 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden />
        Le site ne voit jamais votre mot de passe. Il recoit uniquement un jeton
        temporaire, range dans un cookie securise, que vous effacez en vous
        deconnectant.
      </p>
    </div>
  );
}

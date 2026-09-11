"use client";

import Link from "@/components/lien";
import { useActionState } from "react";
import { ArrowLeft, KeyRound, Send } from "lucide-react";
import { demanderCode, verifierCode, type Etat } from "@/lib/actions";
import { useT } from "@/i18n/fournisseur";

/**
 * Connexion en deux temps.
 *
 * D'abord l'identifiant et le serveur, qui declenchent l'envoi d'un code dans
 * la messagerie du jeu ; puis le code, qui ouvre la session. L'etat renvoye
 * par la premiere action porte le passage a la seconde, si bien que le meme
 * composant enchaine les deux sans navigation.
 */
export function FormulaireConnexion() {
  const t = useT();
  const [etat, envoyer, enCours] = useActionState<Etat, FormData>(demanderCode, {});
  const [aideAvant, aideApres = ""] = t("loginForm.aideServeur").split("{exemple}");

  if (etat.codeEnvoye) {
    return <FormulaireCode roleId={etat.roleId!} zoneId={etat.zoneId!} />;
  }

  return (
    <form action={envoyer} className="space-y-5">
      <div>
        <label htmlFor="roleId" className="block text-sm font-medium text-craie-100">
          {t("loginForm.identifiant")}
        </label>
        <input
          id="roleId"
          name="roleId"
          inputMode="numeric"
          defaultValue={etat.roleId}
          required
          autoFocus
          placeholder={t("loginForm.exempleIdentifiant")}
          className="biseau-sm mt-2 w-full border border-nuit-700 bg-nuit-900 px-4 py-2.5 text-craie-100 outline-none transition-colors focus:border-or-500"
        />
      </div>

      <div>
        <label htmlFor="zoneId" className="block text-sm font-medium text-craie-100">
          {t("loginForm.serveur")}
        </label>
        <input
          id="zoneId"
          name="zoneId"
          inputMode="numeric"
          defaultValue={etat.zoneId}
          placeholder="6021"
          className="biseau-sm mt-2 w-full border border-nuit-700 bg-nuit-900 px-4 py-2.5 text-craie-100 outline-none transition-colors focus:border-or-500"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-craie-500">
          {aideAvant}
          <span className="text-craie-300">123456789 (6021)</span>
          {aideApres}
        </p>
      </div>

      {etat.erreur && <Erreur>{t(etat.erreur)}</Erreur>}

      <button
        type="submit"
        disabled={enCours}
        className="biseau-sm flex w-full items-center justify-center gap-2 bg-or-500 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400 disabled:opacity-60"
      >
        <Send size={16} aria-hidden />
        {enCours ? t("loginForm.envoiCode") : t("loginForm.recevoir")}
      </button>
    </form>
  );
}

function FormulaireCode({ roleId, zoneId }: { roleId: string; zoneId: string }) {
  const t = useT();
  const [etat, envoyer, enCours] = useActionState<Etat, FormData>(verifierCode, {
    codeEnvoye: true,
    roleId,
    zoneId,
  });

  return (
    <form action={envoyer} className="space-y-5">
      <input type="hidden" name="roleId" value={roleId} />
      <input type="hidden" name="zoneId" value={zoneId} />

      <div className="biseau-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
        {t("loginForm.codeEnvoye")}
      </div>

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-craie-100">
          {t("loginForm.code")}
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          required
          autoFocus
          placeholder="0000"
          className="biseau-sm mt-2 w-full border border-nuit-700 bg-nuit-900 px-4 py-2.5 text-center font-titre text-2xl tracking-[0.5em] text-craie-100 outline-none transition-colors focus:border-or-500"
        />
      </div>

      {etat.erreur && <Erreur>{t(etat.erreur)}</Erreur>}

      <button
        type="submit"
        disabled={enCours}
        className="biseau-sm flex w-full items-center justify-center gap-2 bg-or-500 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400 disabled:opacity-60"
      >
        <KeyRound size={16} aria-hidden />
        {enCours ? t("loginForm.verification") : t("loginForm.seConnecter")}
      </button>

      {/* Recommencer si le code n'arrive pas : recharger la page vide le formulaire. */}
      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-craie-500 transition-colors hover:text-or-400"
      >
        <ArrowLeft size={14} aria-hidden />
        {t("loginForm.recommencer")}
      </Link>
    </form>
  );
}

function Erreur({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="biseau-sm border border-sang-500/40 bg-sang-500/10 px-4 py-3 text-sm text-sang-500">
      {children}
    </p>
  );
}

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
  const [aideAvant, aideApres = ""] = t("loginForm.serverHelp").split("{exemple}");

  if (etat.codeEnvoye) {
    return <FormulaireCode roleId={etat.roleId!} zoneId={etat.zoneId!} />;
  }

  return (
    <form action={envoyer} className="space-y-5">
      <div>
        <label htmlFor="roleId" className="block text-sm font-medium text-chalk-100">
          {t("loginForm.playerId")}
        </label>
        <input
          id="roleId"
          name="roleId"
          inputMode="numeric"
          defaultValue={etat.roleId}
          required
          autoFocus
          placeholder={t("loginForm.playerIdExample")}
          className="bevel-sm mt-2 w-full border border-night-700 bg-night-900 px-4 py-2.5 text-chalk-100 outline-none transition-colors focus:border-gold-500"
        />
      </div>

      <div>
        <label htmlFor="zoneId" className="block text-sm font-medium text-chalk-100">
          {t("loginForm.server")}
        </label>
        <input
          id="zoneId"
          name="zoneId"
          inputMode="numeric"
          defaultValue={etat.zoneId}
          placeholder="6021"
          className="bevel-sm mt-2 w-full border border-night-700 bg-night-900 px-4 py-2.5 text-chalk-100 outline-none transition-colors focus:border-gold-500"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-chalk-500">
          {aideAvant}
          <span className="text-chalk-300">123456789 (6021)</span>
          {aideApres}
        </p>
      </div>

      {etat.erreur && <Erreur>{t(etat.erreur)}</Erreur>}

      <button
        type="submit"
        disabled={enCours}
        className="bevel-sm flex w-full items-center justify-center gap-2 bg-gold-500 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
      >
        <Send size={16} aria-hidden />
        {enCours ? t("loginForm.sendingCode") : t("loginForm.receiveCode")}
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

      <div className="bevel-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
        {t("loginForm.codeSent")}
      </div>

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-chalk-100">
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
          className="bevel-sm mt-2 w-full border border-night-700 bg-night-900 px-4 py-2.5 text-center font-heading text-2xl tracking-[0.5em] text-chalk-100 outline-none transition-colors focus:border-gold-500"
        />
      </div>

      {etat.erreur && <Erreur>{t(etat.erreur)}</Erreur>}

      <button
        type="submit"
        disabled={enCours}
        className="bevel-sm flex w-full items-center justify-center gap-2 bg-gold-500 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
      >
        <KeyRound size={16} aria-hidden />
        {enCours ? t("loginForm.verification") : t("loginForm.signIn")}
      </button>

      {/* Recommencer si le code n'arrive pas : recharger la page vide le formulaire. */}
      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-chalk-500 transition-colors hover:text-gold-400"
      >
        <ArrowLeft size={14} aria-hidden />
        {t("loginForm.startOver")}
      </Link>
    </form>
  );
}

function Erreur({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="bevel-sm border border-blood-500/40 bg-blood-500/10 px-4 py-3 text-sm text-blood-500">
      {children}
    </p>
  );
}

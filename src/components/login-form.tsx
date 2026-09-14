"use client";

import Link from "@/components/link";
import { useActionState } from "react";
import { ArrowLeft, KeyRound, Send } from "lucide-react";
import { requestCode, checkCode, type State } from "@/lib/actions";
import { useT } from "@/i18n/provider";

/**
 * Two-step sign-in.
 *
 * First the player ID and server, which trigger sending a code to the in-game
 * mailbox; then the code, which opens the session. The state returned by the
 * first action carries the move to the second, so the same component chains
 * both without navigation.
 */
export function LoginForm() {
  const t = useT();
  const [state, send, inProgress] = useActionState<State, FormData>(requestCode, {});
  const [helpBefore, helpAfter = ""] = t("loginForm.serverHelp").split("{exemple}");

  if (state.codeSent) {
    return <CodeForm roleId={state.roleId!} zoneId={state.zoneId!} />;
  }

  return (
    <form action={send} className="space-y-5">
      <div>
        <label htmlFor="roleId" className="block text-sm font-medium text-chalk-100">
          {t("loginForm.playerId")}
        </label>
        <input
          id="roleId"
          name="roleId"
          inputMode="numeric"
          defaultValue={state.roleId}
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
          defaultValue={state.zoneId}
          placeholder="6021"
          className="bevel-sm mt-2 w-full border border-night-700 bg-night-900 px-4 py-2.5 text-chalk-100 outline-none transition-colors focus:border-gold-500"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-chalk-500">
          {helpBefore}
          <span className="text-chalk-300">123456789 (6021)</span>
          {helpAfter}
        </p>
      </div>

      {state.error && <Error>{t(state.error)}</Error>}

      <button
        type="submit"
        disabled={inProgress}
        className="bevel-sm flex w-full items-center justify-center gap-2 bg-gold-500 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
      >
        <Send size={16} aria-hidden />
        {inProgress ? t("loginForm.sendingCode") : t("loginForm.receiveCode")}
      </button>
    </form>
  );
}

function CodeForm({ roleId, zoneId }: { roleId: string; zoneId: string }) {
  const t = useT();
  const [state, send, inProgress] = useActionState<State, FormData>(checkCode, {
    codeSent: true,
    roleId,
    zoneId,
  });

  return (
    <form action={send} className="space-y-5">
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

      {state.error && <Error>{t(state.error)}</Error>}

      <button
        type="submit"
        disabled={inProgress}
        className="bevel-sm flex w-full items-center justify-center gap-2 bg-gold-500 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
      >
        <KeyRound size={16} aria-hidden />
        {inProgress ? t("loginForm.verification") : t("loginForm.signIn")}
      </button>

      {/* Start over if the code does not arrive: reloading the page clears the form. */}
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

function Error({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="bevel-sm border border-blood-500/40 bg-blood-500/10 px-4 py-3 text-sm text-blood-500">
      {children}
    </p>
  );
}

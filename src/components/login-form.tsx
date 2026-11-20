"use client";

import { Flash } from "@/components/dex-states";
import Link from "@/components/link";
import { useActionState } from "react";
import { ArrowLeft, KeyRound, Send } from "lucide-react";
import { requestCode, checkCode, type State } from "@/lib/actions";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

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
  const [helpBefore, helpAfter = ""] = t("loginForm.serverHelp").split("{example}");

  if (state.codeSent) {
    return (
      <>
        <Steps current={2} />
        <CodeForm roleId={state.roleId!} zoneId={state.zoneId!} />
      </>
    );
  }

  return (
    <>
    <Steps current={1} />
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
          className="field mt-2 bg-night-950 px-4 py-2.5"
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
          className="field mt-2 bg-night-950 px-4 py-2.5"
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
        className="btn btn-primary w-full disabled:opacity-60"
      >
        <Send size={16} aria-hidden />
        {inProgress ? t("loginForm.sendingCode") : t("loginForm.receiveCode")}
      </button>
    </form>
    </>
  );
}

/**
 * The two steps, staged: the current one in gold, the one done in blue.
 * The step reads as text too ("Step 1 of 2"), the crests are decoration.
 */
function Steps({ current }: { current: 1 | 2 }) {
  const t = useT();
  return (
    <div className="mb-6">
      <p className="sr-only" aria-live="polite">
        {t("loginForm.stepOf", { n: current })}
      </p>
      <ol aria-label={t("loginForm.steps")} className="flex items-center gap-3">
        {([1, 2] as const).map((n) => {
          const state = n === current ? "active" : n < current ? "done" : "next";
          return (
            <li key={n} className="flex min-w-0 flex-1 items-center gap-2.5" aria-current={n === current ? "step" : undefined}>
              <span aria-hidden className="step-crest" data-state={state}>
                {n}
              </span>
              <span
                className={cn(
                  "min-w-0 font-heading text-sm font-bold uppercase leading-tight sm:text-base",
                  state === "active" ? "text-chalk-100" : "text-chalk-500",
                )}
              >
                {t(`loginForm.step${n}`)}
              </span>
              {n === 1 && <span aria-hidden className={cn("ml-auto h-[3px] w-8 shrink-0 sm:w-12", current === 2 ? "bg-azure-400" : "eclat")} />}
            </li>
          );
        })}
      </ol>
    </div>
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

      <div className="bevel-sm border border-azure-500/30 bg-azure-500/10 px-4 py-3 text-sm text-azure-400">
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
          className="field mt-2 bg-night-950 px-4 py-3 text-center font-display text-4xl font-black italic tracking-[0.5em]"
        />
      </div>

      {state.error && <Error>{t(state.error)}</Error>}

      <button
        type="submit"
        disabled={inProgress}
        className="btn btn-primary w-full disabled:opacity-60"
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
    <p role="alert">
      <Flash tone="error">{children}</Flash>
    </p>
  );
}

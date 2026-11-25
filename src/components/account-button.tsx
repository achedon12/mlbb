"use client";

import { useEffect, useState } from "react";
import { LogIn, UserRound } from "lucide-react";
import Link from "@/components/link";
import { LoginLink } from "@/components/login-link";
import { useT } from "@/i18n/provider";
import { readSession, type Session } from "@/lib/session-client";

/**
 * Account access in the header.
 *
 * The space is reserved from the first render so that no layout shift
 * happens once the session is known. Signed in either way — game account,
 * even while its profile is unavailable, or Discord — the button leads to
 * the account page, named after the nickname, else the Discord name, else
 * "My account".
 */
export function AccountButton() {
  const t = useT();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readSession().then((d) => !cancelled && setSession(d));
    return () => {
      cancelled = true;
    };
  }, []);

  // On mobile, a plain icon: the label does not fit next to the menu
  // below 375 px wide. Screen readers still read it. From `sm` on, one fixed
  // width for the placeholder and both states, the name truncated inside:
  // the header never moves once the session is known.
  if (!session) return <span aria-hidden className="block size-11 shrink-0 sm:h-9 sm:w-32" />;

  return session.connected || session.discord ? (
    <Link
      href="/account"
      className="btn btn-secondary btn-sm size-11 shrink-0 px-2 normal-case sm:h-9 sm:w-32 sm:px-3"
    >
      <UserRound size={18} aria-hidden className="sm:hidden" />
      <span className="min-w-0 truncate max-sm:sr-only">
        {session.pseudo || session.discord || t("account.myAccount")}
      </span>
    </Link>
  ) : (
    <LoginLink
      className="btn btn-primary btn-sm size-11 shrink-0 px-2 sm:h-9 sm:w-32 sm:px-3"
    >
      <LogIn size={18} aria-hidden className="sm:hidden" />
      <span className="min-w-0 truncate max-sm:sr-only">{t("account.signIn")}</span>
    </LoginLink>
  );
}

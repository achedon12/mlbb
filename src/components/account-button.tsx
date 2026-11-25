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
  // below 375 px wide. Screen readers still read it.
  if (!session) return <span aria-hidden className="h-9 w-9 sm:w-24" />;

  return session.connected || session.discord ? (
    <Link
      href="/account"
      className="btn btn-secondary btn-sm h-9 min-w-9 max-w-36 truncate px-2 normal-case sm:px-4"
    >
      <UserRound size={18} aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">
        {session.pseudo || session.discord || t("account.myAccount")}
      </span>
    </Link>
  ) : (
    <LoginLink
      className="btn btn-primary btn-sm h-9 min-w-9 px-2 sm:px-4"
    >
      <LogIn size={18} aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">{t("account.signIn")}</span>
    </LoginLink>
  );
}

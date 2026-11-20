"use client";

import { useEffect, useState } from "react";
import { LogIn, UserRound } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";

type Session = { connected: boolean; pseudo?: string };

/**
 * Account access in the header.
 *
 * The space is reserved from the first render so that no layout shift
 * happens once the session is known.
 */
export function AccountButton() {
  const t = useT();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session")
      .then((r) => r.json())
      .then((d: Session) => !cancelled && setSession(d))
      .catch(() => !cancelled && setSession({ connected: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  // On mobile, a plain icon: the label does not fit next to the menu
  // below 375 px wide. Screen readers still read it.
  if (!session) return <span aria-hidden className="h-9 w-9 sm:w-24" />;

  return session.connected ? (
    <Link
      href="/account"
      className="btn btn-secondary btn-sm h-9 min-w-9 max-w-36 truncate px-2 normal-case sm:px-4"
    >
      <UserRound size={18} aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">{session.pseudo}</span>
    </Link>
  ) : (
    <Link
      href="/login"
      className="btn btn-primary btn-sm h-9 min-w-9 px-2 sm:px-4"
    >
      <LogIn size={18} aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">{t("account.signIn")}</span>
    </Link>
  );
}

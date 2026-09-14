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
      className="bevel-sm grid h-9 min-w-9 max-w-36 place-items-center truncate bg-night-800 px-2 text-sm font-semibold text-chalk-100 transition-colors hover:bg-night-700 sm:block sm:px-4 sm:py-2"
    >
      <UserRound size={18} aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">{session.pseudo}</span>
    </Link>
  ) : (
    <Link
      href="/login"
      className="bevel-sm grid h-9 min-w-9 place-items-center bg-gold-500 px-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400 sm:block sm:px-4 sm:py-2"
    >
      <LogIn size={18} aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">{t("account.signIn")}</span>
    </Link>
  );
}

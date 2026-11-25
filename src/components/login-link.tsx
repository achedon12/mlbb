"use client";

import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/link";
import { loginHref } from "@/lib/login-next";

/** The login form's address, returning to the current page once signed in. */
export function useLoginHref(query?: Record<string, string>): string {
  return loginHref(usePathname(), query);
}

/** A link to the login form that brings the visitor back to this page afterwards. */
export function LoginLink({ query, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { query?: Record<string, string> }) {
  return <Link href={useLoginHref(query)} {...rest} />;
}

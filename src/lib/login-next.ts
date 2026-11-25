import { LOCALES } from "@/i18n/config";

/**
 * Where a sign-in returns to: the page the visitor left for the login form,
 * passed as `?next=`. Only a path of this site passes — it starts with one
 * "/", never "//" (another host), carries no backslash (which browsers read
 * as "/") nor control characters, and is not the login page itself or an API
 * route. Anything else gives null, and the sign-in lands on the account page.
 */
const MAX_LENGTH = 512;
const EXCLUDED = new RegExp(`^/(?:(?:${LOCALES.join("|")})/)?(?:login|api)(?:[/?#]|$)`);

export function safeNext(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (EXCLUDED.test(raw)) return null;
  return raw;
}

/** The login form's address, returning to `path` once signed in when it is a valid target. */
export function loginHref(path: string | null | undefined, query: Record<string, string> = {}): string {
  const params = new URLSearchParams(query);
  const next = safeNext(path);
  if (next) params.set("next", next);
  const search = params.toString();
  return search ? `/login?${search}` : "/login";
}

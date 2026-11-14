import { isLocale } from "@/i18n/config";
import { NextResponse } from "next/server";
import { botConfig } from "@/lib/bot/config";
import { originAllowed, refused, siteOrigin } from "@/lib/bot/dashboard-guard";
import { cookieOptions, SESSION_COOKIE } from "@/lib/bot/session";
import { site } from "@/lib/site";

/**
 * Logout: a POST from the dashboard's form (same origin only), the session
 * cookie cleared, back to the bot page in the form's language.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!botConfig()) return refused(404, "not found");
  if (!originAllowed(request.headers.get("origin"), site.url, request.url, process.env.NODE_ENV === "production")) {
    return refused(403, "origin refused");
  }
  const form = await request.formData().catch(() => null);
  const locale = String(form?.get("locale") ?? "en");
  const response = NextResponse.redirect(new URL(`/${isLocale(locale) ? locale : "en"}/bot`, siteOrigin(request)), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}

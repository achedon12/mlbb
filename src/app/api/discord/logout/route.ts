import { isLocale } from "@/i18n/config";
import { NextResponse } from "next/server";
import { botConfig } from "@/lib/bot/config";
import { isSameOrigin, refused, siteOrigin } from "@/lib/bot/dashboard-guard";
import { isCommunityReturn } from "@/lib/bot/oauth";
import { cookieOptions, SESSION_COOKIE } from "@/lib/bot/session";
import { readCapped } from "@/lib/read-body";

/**
 * Logout: a POST from the dashboard's form (same origin only), the session
 * cookie cleared, back to the bot page in the form's language (or, with a
 * `back` field, to that community page). The service worker sees this
 * request go by and drops its cached copies of signed-in pages
 * (`forgetPrivate`, public/sw.js); the HTTP cache holds none, those pages
 * being `private, no-store`.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!botConfig()) return refused(404, "not found");
  if (!isSameOrigin(request)) return refused(403, "origin refused");
  // A form with one field: a few bytes, read with a ceiling.
  const raw = await readCapped(request, 1024);
  const form = new URLSearchParams(raw ?? "");
  const locale = form.get("locale") ?? "en";
  // From the forum: back to the community page it was sent from (a fixed shape, see `COMMUNITY_RETURN`).
  const back = form.get("back");
  const page = isCommunityReturn(back) ? back : "/bot";
  const response = NextResponse.redirect(new URL(`/${isLocale(locale) ? locale : "en"}${page}`, siteOrigin(request)), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}

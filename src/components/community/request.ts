import type { T } from "@/i18n/t";
import { MAX_LINKS, REPLY_BODY_MAX, REPLY_BODY_MIN, THREAD_BODY_MAX, THREAD_BODY_MIN, TITLE_MAX, TITLE_MIN } from "@/lib/community/constants";

/**
 * Browser side of the community routes: one call, and the sentence each
 * refusal turns into. Nothing is retried behind the visitor's back.
 */

export type Answer = { status: number; data: Record<string, unknown> };

export async function send(method: "POST" | "PUT" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<Answer> {
  try {
    const r = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = r.status === 204 ? {} : ((await r.json().catch(() => ({}))) as Record<string, unknown>);
    return { status: r.status, data };
  } catch {
    return { status: 0, data: {} };
  }
}

/** The sentence for a refused call. `reply`: the body limits are a reply's. */
export function refusal(t: T, answer: Answer, reply = false): string {
  const error = typeof answer.data.error === "string" ? answer.data.error : "";
  switch (answer.status === 400 ? `400:${error}` : error || String(answer.status)) {
    case "400:title":
      return t("pages.communityUI.errors.title", { min: TITLE_MIN, max: TITLE_MAX });
    case "400:body":
      return reply
        ? t("pages.communityUI.errors.body", { min: REPLY_BODY_MIN, max: REPLY_BODY_MAX })
        : t("pages.communityUI.errors.body", { min: THREAD_BODY_MIN, max: THREAD_BODY_MAX });
    case "sign in required":
    case "401":
      return t("pages.communityUI.errors.signIn");
    case "too many requests":
    case "429":
      return t("pages.communityUI.errors.tooFast");
    case "day":
      return t("pages.communityUI.errors.day");
    case "duplicate":
      return t("pages.communityUI.errors.duplicate");
    case "blocked":
      return t("pages.communityUI.errors.blocked");
    case "spam":
      return t("pages.communityUI.errors.spam");
    case "links":
      return t("pages.communityUI.errors.links", { n: MAX_LINKS });
    case "newAccountLinks":
      return t("pages.communityUI.errors.newAccountLinks");
    case "banned":
      return t("pages.communityUI.errors.banned");
    case "window":
      return t("pages.communityUI.errors.window");
    case "locked":
      return t("pages.communityUI.errors.locked");
    case "hidden":
      return t("pages.communityUI.errors.hidden");
    case "unknown":
      return t("pages.communityUI.errors.unknown");
    default:
      return answer.status >= 400 && answer.status < 500 && answer.status !== 404
        ? t("pages.communityUI.errors.invalid")
        : t("pages.communityUI.errors.unavailable");
  }
}

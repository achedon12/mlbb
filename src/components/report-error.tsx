import { ExtendMessages } from "@/i18n/provider";
import type { messagesPage } from "@/i18n/translations";
import { ReportErrorForm } from "./report-error-form";

/**
 * "Report an error" at the foot of a data page. `path`: the page without
 * the locale (`/heroes/layla`); `messages`: its texts, given by the page
 * (`messagesPage(locale, ["pages.reportError"])`).
 */
export function ReportError({ path, messages, className }: { path: string; messages: ReturnType<typeof messagesPage>; className?: string }) {
  return (
    <ExtendMessages messages={messages}>
      <ReportErrorForm path={path} className={className} />
    </ExtendMessages>
  );
}

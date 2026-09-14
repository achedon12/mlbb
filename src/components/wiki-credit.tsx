import type { T } from "@/i18n/translations";

/**
 * Credit "taken and translated from the wiki", in the current locale. `messageKey`: another
 * credit sentence, with the same `{link}` in place of the wiki name.
 */
export function WikiCredit({
  t,
  href,
  className,
  messageKey = "common.wikiLicence",
}: {
  t: T;
  href: string;
  className?: string;
  messageKey?: string;
}) {
  const [before, after = ""] = t(messageKey).split("{link}");
  return (
    <p className={className ?? "mt-8 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500"}>
      {before}
      <a href={href} rel="noreferrer nofollow" target="_blank" className="text-gold-400 hover:underline">
        {t("common.sourceWiki")}
      </a>
      {after}
    </p>
  );
}

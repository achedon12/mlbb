import type { T } from "@/i18n/translations";

/**
 * Crédit « repris et traduit du wiki », dans la langue courante. `cle` : une
 * autre phrase de crédit, avec le même `{lien}` à la place du nom du wiki.
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
  const [before, after = ""] = t(messageKey).split("{lien}");
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

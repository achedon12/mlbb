import type { T } from "@/i18n/traductions";

/** Crédit « repris et traduit du wiki », dans la langue courante. */
export function CreditWiki({ t, href, className }: { t: T; href: string; className?: string }) {
  const [avant, apres = ""] = t("commun.licenceWiki").split("{lien}");
  return (
    <p className={className ?? "mt-8 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500"}>
      {avant}
      <a href={href} rel="noreferrer nofollow" target="_blank" className="text-or-400 hover:underline">
        {t("commun.sourceWiki")}
      </a>
      {apres}
    </p>
  );
}

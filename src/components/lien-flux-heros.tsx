import { Rss } from "lucide-react";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";

/**
 * Lien vers le flux RSS des ajustements d'un heros. Un `<a>` simple : le
 * routeur de Next n'a rien a faire d'un fichier XML, et ne doit pas le
 * precharger.
 */
export function LienFluxHeros({ langue, slug }: { langue: Langue; slug: string }) {
  const t = creerT(langue);
  return (
    <a
      href={`/${langue}/heroes/${slug}/feed.xml`}
      type="application/rss+xml"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
    >
      <Rss size={15} aria-hidden />
      {t("pages.heroDetail.statistiques.flux")}
    </a>
  );
}

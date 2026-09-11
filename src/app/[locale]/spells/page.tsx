import type { Metadata } from "next";
import Link from "@/components/lien";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { sortsFiches } from "@/lib/fiches-usage";

/**
 * Index des sorts de combat : chacun mene a sa page (heros qui le prennent,
 * emblemes associes). La page manquait au menu et a la recherche « mlbb
 * battle spells ».
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.spellsListe.metaTitre", { n: sortsFiches.length }),
    description: t("pages.spellsListe.metaDescription"),
    chemin: "/spells",
  });
}

export default async function PageSorts({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage
        titre={t("pages.spellsListe.titre")}
        chapeau={t("pages.spellsListe.chapeau", { n: sortsFiches.length })}
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortsFiches.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/spells/${s.slug}`}
                className="bevel group flex h-full items-center gap-3 border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60"
              >
                <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-night-700 bg-night-800">
                  {s.image ? (
                    // Icone deja optimisee par la synchro : un seul fichier, sans srcset.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image} alt="" width={48} height={48} loading="lazy" className="size-full object-contain" />
                  ) : (
                    <span className="text-sm font-semibold text-chalk-500">{s.nom.charAt(0)}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                    {s.nom}
                  </span>
                  {s.recharge !== null && (
                    <span className="block text-xs text-chalk-500">{t("pages.spellsListe.recharge", { s: s.recharge })}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

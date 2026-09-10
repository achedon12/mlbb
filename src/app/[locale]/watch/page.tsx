import type { Metadata } from "next";
import Link from "@/components/lien";
import { ExternalLink } from "lucide-react";
import { EnTetePage } from "@/components/ui";
import { mesureVeille, sources, veille } from "@/lib/veille";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { formaterDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.watch.metaTitre"),
    description: t("pages.watch.metaDescription"),
    partage: t("pages.watch.ogDescription"),
    chemin: "/watch",
  });
}

export default async function PageVeille({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const actualites = veille();

  return (
    <>
      <EnTetePage
        titre={t("pages.watch.titre")}
        chapeau={t("pages.watch.chapeau")}
      >
        <p className="mt-6 text-sm text-craie-500">
          {t("pages.watch.derniereCollecte", { date: formaterDate(mesureVeille) })}{" "}
          {sources.map((s, i) => (
            <span key={s.slug}>
              {i > 0 && ", "}
              <a href={s.site} rel="noreferrer nofollow" className="text-or-400 hover:underline">
                {s.nom}
              </a>
            </span>
          ))}
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-4xl px-4 py-14">
        {actualites.length === 0 ? (
          <p className="text-craie-500">
            {t("pages.watch.aucune")}
          </p>
        ) : (
          <ul className="space-y-3">
            {actualites.map((a) => (
              <li key={a.lien}>
                <a
                  href={a.lien}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className="biseau group flex gap-4 border border-nuit-700/70 bg-nuit-900/60 p-5 transition-colors hover:border-or-500/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-or-400">
                        {a.source}
                      </span>
                      {a.date && (
                        <time dateTime={a.date} className="text-xs text-craie-500">
                          {formaterDate(a.date)}
                        </time>
                      )}
                    </div>
                    <h2 className="mt-1.5 font-titre text-lg font-bold leading-snug text-craie-100 transition-colors group-hover:text-or-400">
                      {a.titre}
                    </h2>
                    {a.extrait && (
                      <p className="mt-2 text-sm leading-relaxed text-craie-500">{a.extrait}</p>
                    )}
                  </div>
                  <ExternalLink
                    size={16}
                    aria-hidden
                    className="mt-1 shrink-0 text-craie-500 transition-colors group-hover:text-or-400"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500">
          Les titres et extraits appartiennent a leurs auteurs respectifs et
          sont affichés ici pour renvoyer vers la publication d&apos;origine.
          Moonton ne publie pas de flux officiel : les mises a jour du jeu sont
          reprises et commentees dans la section{" "}
          <Link href="/patch-notes" className="text-or-400 hover:underline">
            patch notes
          </Link>
          .
        </p>
      </div>
    </>
  );
}

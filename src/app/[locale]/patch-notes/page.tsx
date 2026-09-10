import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { ListeArticles } from "@/components/article";
import { EnTetePage } from "@/components/ui";
import { patchs, patchsDetail, synchro } from "@/lib/donnees";
import { articles } from "@/lib/contenu";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { site } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.patchNotes.metaTitre"),
    description: t("pages.patchNotes.metaDescription", { n: patchs.length }),
    alternates: metaLangues(locale, "/patch-notes"),
    openGraph: { title: `${t("pages.patchNotes.metaTitre")} — ${site.nom}`, description: t("pages.patchNotes.ogDescription", { n: patchs.length }), url: `/${locale}/patch-notes` },
  };
}

const detailles = patchsDetail as Record<string, { version: string }>;

export default async function PagePatchNotes({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const analyses = articles("patch-notes");
  const avecDetail = patchs.filter((p) => detailles[p.version]);
  const autres = patchs.filter((p) => !detailles[p.version]).slice(0, 60);

  return (
    <>
      <EnTetePage
        titre={t("pages.patchNotes.titre")}
        chapeau={t("pages.patchNotes.chapeau")}
      >
        <p className="mt-6 text-sm text-craie-500">
          {t("pages.patchNotes.recenses", { n: patchs.length, m: avecDetail.length })}{" "}
          <time dateTime={synchro.date}>{formaterDate(synchro.date)}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">
            {t("pages.patchNotes.recentes")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {avecDetail.map((p) => (
              <li key={p.titre}>
                <Link
                  href={`/patch-notes/${p.version}`}
                  className="biseau group flex items-center gap-3 border border-nuit-700/70 bg-nuit-900/60 p-4 transition-colors hover:border-or-500/60"
                >
                  <FileText size={18} aria-hidden className="shrink-0 text-or-400" />
                  <span className="font-titre text-lg font-bold text-craie-100 transition-colors group-hover:text-or-400">
                    {p.version}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {analyses.length > 0 && (
          <section>
            <h2 className="font-titre text-2xl font-bold text-craie-100">{t("pages.patchNotes.analyses")}</h2>
            <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
            <p className="mt-3 text-sm text-craie-500">
              {t("pages.patchNotes.analysesIntro")}
            </p>
            <div className="mt-6">
              <ListeArticles articles={analyses} base="/patch-notes" />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">Archives</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-3 text-sm text-craie-500">
            {t("pages.patchNotes.anciens")}
          </p>

          <ul className="mt-6 grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {autres.map((p) => (
              // Le titre est unique ; la version ne l'est pas toujours.
              <li key={p.titre}>
                <a
                  href={p.lien}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className="biseau-sm group flex items-center justify-between gap-2 border border-nuit-700/70 px-3 py-2 text-sm transition-colors hover:border-or-500/60"
                >
                  <span className="tabular-nums text-craie-300 transition-colors group-hover:text-or-400">
                    {p.version}
                  </span>
                  <ExternalLink size={12} aria-hidden className="shrink-0 text-craie-500" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

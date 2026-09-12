import type { Metadata } from "next";
import Link from "@/components/lien";
import { ExternalLink, FileText } from "lucide-react";
import { ListeArticles } from "@/components/article";
import { EnTetePage } from "@/components/ui";
import { patchs, patchsDetail, synchro } from "@/lib/donnees";
import { articles } from "@/lib/contenu";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { formaterDate } from "@/lib/utils";
import { compterAjustements, dateLongue, patchActuel } from "@/lib/fraicheur";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  // Le dernier patch, sa date et ses ajustements ouvrent la description.
  const version = patchActuel.date
    ? `${patchActuel.version} (${dateLongue(locale, patchActuel.date)})`
    : patchActuel.version;
  return metaPage(locale, {
    titre: t("pages.seo.patchNotes.title", { v: patchActuel.version }),
    description: patchActuel.adjustments.length
      ? t("pages.seo.patchNotes.description", {
          version,
          ...compterAjustements(patchActuel.adjustments),
          m: Object.keys(patchsDetail).length,
          n: patchs.length,
        })
      : t("pages.patchNotes.metaDescription", { n: patchs.length }),
    partage: t("pages.patchNotes.ogDescription", { n: patchs.length }),
    chemin: "/patch-notes",
  });
}

const detailles = patchsDetail as Record<string, { version: string }>;

export default async function PagePatchNotes({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const analyses = articles("patch-notes", locale);
  const avecDetail = patchs.filter((p) => detailles[p.version]);
  const autres = patchs.filter((p) => !detailles[p.version]).slice(0, 60);

  return (
    <>
      <EnTetePage
        titre={t("pages.patchNotes.title")}
        chapeau={t("pages.patchNotes.lead")}
      >
        <p className="mt-6 text-sm text-chalk-500">
          {t("pages.patchNotes.listed", { n: patchs.length, m: avecDetail.length })}{" "}
          <time dateTime={synchro.date}>{formaterDate(synchro.date, LOCALE_HTML[locale])}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.patchNotes.recent")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {avecDetail.map((p) => (
              <li key={p.title}>
                <Link
                  href={`/patch-notes/${p.version}`}
                  className="bevel group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
                >
                  <FileText size={18} aria-hidden className="shrink-0 text-gold-400" />
                  <span className="font-heading text-lg font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                    {p.version}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {analyses.length > 0 && (
          <section>
            <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.patchNotes.analyses")}</h2>
            <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
            <p className="mt-3 text-sm text-chalk-500">
              {t("pages.patchNotes.analysesIntro")}
            </p>
            <div className="mt-6">
              <ListeArticles articles={analyses} base="/patch-notes" langue={locale} />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.patchNotes.archives")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-3 text-sm text-chalk-500">
            {t("pages.patchNotes.older")}
          </p>

          <ul className="mt-6 grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {autres.map((p) => (
              // Le titre est unique ; la version ne l'est pas toujours.
              <li key={p.title}>
                <a
                  href={p.link}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className="bevel-sm group flex items-center justify-between gap-2 border border-night-700/70 px-3 py-2 text-sm transition-colors hover:border-gold-500/60"
                >
                  <span className="tabular-nums text-chalk-300 transition-colors group-hover:text-gold-400">
                    {p.version}
                  </span>
                  <ExternalLink size={12} aria-hidden className="shrink-0 text-chalk-500" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { ListeArticles } from "@/components/article";
import { EnTetePage } from "@/components/ui";
import detailPatchs from "@/data/genere/patchs-detail.json";
import { patchs, synchro } from "@/lib/donnees";
import { articles } from "@/lib/contenu";
import { site } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Patch notes",
  description: `Les ${patchs.length} patchs de Mobile Legends: Bang Bang. Le detail des mises a jour recentes est consultable directement ici, sans quitter le site.`,
  alternates: { canonical: "/patch-notes" },
  openGraph: {
    title: `Patch notes — ${site.nom}`,
    description: `Les ${patchs.length} patchs du jeu, avec le detail des plus recents.`,
    url: "/patch-notes",
  },
};

const detailles = detailPatchs as Record<string, { version: string }>;

export default function PagePatchNotes() {
  const analyses = articles("patch-notes");
  const avecDetail = patchs.filter((p) => detailles[p.version]);
  const autres = patchs.filter((p) => !detailles[p.version]).slice(0, 60);

  return (
    <>
      <EnTetePage
        titre="Patch notes"
        chapeau="Le contenu des mises a jour recentes est repris ici, section par section. Les patchs plus anciens restent recenses, avec un lien vers leur page d'origine."
      >
        <p className="mt-6 text-sm text-craie-500">
          {patchs.length} patchs recenses · {avecDetail.length} consultables sur
          le site · synchronise le{" "}
          <time dateTime={synchro.date}>{formaterDate(synchro.date)}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">
            Mises a jour recentes
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {avecDetail.map((p) => (
              <li key={p.version}>
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
            <h2 className="font-titre text-2xl font-bold text-craie-100">Analyses</h2>
            <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
            <p className="mt-3 text-sm text-craie-500">
              Ce que les notes officielles ne disent pas : l&apos;effet reel des
              changements en partie.
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
            Les patchs plus anciens ne sont pas repris integralement — leur
            contenu representerait plusieurs megaoctets pour des versions que
            plus personne ne joue.
          </p>

          <ul className="mt-6 grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {autres.map((p) => (
              <li key={p.version}>
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

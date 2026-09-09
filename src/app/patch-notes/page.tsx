import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ListeArticles } from "@/components/article";
import { EnTetePage } from "@/components/ui";
import { patchs, synchro } from "@/lib/donnees";
import { articles } from "@/lib/contenu";
import { site } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Patch notes",
  description: `Les ${patchs.length} patchs de Mobile Legends: Bang Bang recenses automatiquement, et les analyses redigees des mises a jour marquantes.`,
  alternates: { canonical: "/patch-notes" },
  openGraph: {
    title: `Patch notes — ${site.nom}`,
    description: `Les ${patchs.length} patchs du jeu, recenses automatiquement.`,
    url: "/patch-notes",
  },
};

export default function PagePatchNotes() {
  const analyses = articles("patch-notes");
  // Les patchs sont deja tries du plus recent au plus ancien.
  const recents = patchs.slice(0, 60);

  return (
    <>
      <EnTetePage
        titre="Patch notes"
        chapeau="La liste des patchs est recensee automatiquement depuis le wiki. Moonton ne publiant aucun flux exploitable, le detail de chaque mise a jour renvoie vers la page du wiki ; les patchs marquants font en plus l'objet d'une analyse redigee."
      >
        <p className="mt-6 text-sm text-craie-500">
          {patchs.length} patchs recenses · derniere synchronisation le{" "}
          <time dateTime={synchro.date}>{formaterDate(synchro.date)}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-4xl px-4 py-14">
        {analyses.length > 0 && (
          <section className="mb-16">
            <h2 className="font-titre text-2xl font-bold text-craie-100">Analyses</h2>
            <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
            <div className="mt-6">
              <ListeArticles articles={analyses} base="/patch-notes" />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">Tous les patchs</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-3 text-sm text-craie-500">
            Les {recents.length} plus recents. Chaque entree ouvre le detail sur
            le wiki.
          </p>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recents.map((p) => (
              <li key={p.version}>
                <a
                  href={p.lien}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className="biseau-sm group flex items-center justify-between gap-2 border border-nuit-700/70 bg-nuit-900/60 px-4 py-3 transition-colors hover:border-or-500/60"
                >
                  <span className="font-titre font-bold text-craie-100 transition-colors group-hover:text-or-400">
                    {p.version}
                  </span>
                  <ExternalLink
                    size={14}
                    aria-hidden
                    className="shrink-0 text-craie-500 transition-colors group-hover:text-or-400"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-500">
          Pour ce que publie le reste du web au jour le jour, voir la{" "}
          <Link href="/veille" className="text-or-400 hover:underline">
            veille
          </Link>
          .
        </p>
      </div>
    </>
  );
}

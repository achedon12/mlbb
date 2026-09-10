import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { EnTetePage } from "@/components/ui";
import { mesureVeille, sources, veille } from "@/lib/veille";
import { site } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Veille — l'actualite MLBB du web",
  description:
    "Les dernieres publications de la communaute et de la presse esport sur Mobile Legends: Bang Bang, rassemblees automatiquement et mises a jour en continu.",
  alternates: { canonical: "/veille" },
  openGraph: {
    title: `Veille — ${site.nom}`,
    description: "L'actualite Mobile Legends du web, rassemblee automatiquement.",
    url: "/veille",
  },
};

export default function PageVeille() {
  const actualites = veille();

  return (
    <>
      <EnTetePage
        titre="Veille"
        chapeau="Ce que publie le reste du web sur le jeu : communaute et presse esport, rassembles automatiquement. Chaque entree renvoie chez son editeur — rien n'est recopie ici."
      >
        <p className="mt-6 text-sm text-craie-500">
          Derniere collecte le {formaterDate(mesureVeille)} · sources :{" "}
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
            Aucune source ne repond pour le moment. La page se recharge
            automatiquement a la prochaine collecte.
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

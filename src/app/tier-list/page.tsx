import type { Metadata } from "next";
import Link from "next/link";
import { BadgePalier, EnTetePage } from "@/components/ui";
import { rosterParSlug } from "@/data/roster";
import { tierList } from "@/data/tier-list";
import type { Palier } from "@/lib/types";
import { site } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: `Tier list ${tierList.patch}`,
  description: `Tier list argumentee de Mobile Legends: Bang Bang pour le patch ${tierList.patch}. Chaque placement est justifie en une phrase, pour la file classee solo.`,
  alternates: { canonical: "/tier-list" },
  openGraph: {
    title: `Tier list ${tierList.patch} — ${site.nom}`,
    description: `Tier list argumentee pour le patch ${tierList.patch}.`,
    url: "/tier-list",
  },
};

const ORDRE: Palier[] = ["S+", "S", "A", "B", "C"];

const LEGENDE: Record<Palier, string> = {
  "S+": "Change la partie a lui seul. A prendre ou a bannir.",
  S: "Tres fort dans la majorite des compositions.",
  A: "Solide, sans imposer le rythme de la partie.",
  B: "Correct, mais depend fortement du contexte ou du joueur.",
  C: "Jouable, avec un cout reel par rapport aux alternatives.",
};

export default function PageTierList() {
  return (
    <>
      <EnTetePage
        titre={`Tier list — patch ${tierList.patch}`}
        chapeau="Un classement court et argumente plutot qu'une liste exhaustive : chaque entree explique ce qui justifie sa place. Valable pour la file classee solo, ou les priorites different de celles du jeu en equipe organisee."
      >
        <p className="mt-6 text-sm text-craie-500">
          Mise a jour le{" "}
          <time dateTime={tierList.miseAJour}>{formaterDate(tierList.miseAJour)}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="space-y-12">
          {ORDRE.map((palier) => {
            const entrees = tierList.entrees.filter((e) => e.palier === palier);
            if (entrees.length === 0) return null;

            return (
              <section key={palier}>
                <div className="flex items-center gap-4">
                  <BadgePalier palier={palier} />
                  <div>
                    <h2 className="font-titre text-xl font-bold text-craie-100">
                      Palier {palier}
                    </h2>
                    <p className="text-sm text-craie-500">{LEGENDE[palier]}</p>
                  </div>
                </div>

                <ul className="mt-5 space-y-2">
                  {entrees.map((e) => {
                    const h = rosterParSlug.get(e.heros);
                    return (
                      <li key={e.heros}>
                        <Link
                          href={`/heros/${e.heros}`}
                          className="biseau flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-nuit-700/70 bg-nuit-900/60 p-4 transition-colors hover:border-or-500/60"
                        >
                          <span className="font-titre text-lg font-bold text-craie-100">
                            {h?.nom ?? e.heros}
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-or-400">
                            {e.lane}
                          </span>
                          <span className="w-full text-sm leading-relaxed text-craie-500 sm:w-auto sm:flex-1">
                            {e.note}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-16 border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-500">
          Une tier list est une lecture du patch, pas une verite. Un heros de
          palier C joue par quelqu&apos;un qui le maitrise bat un heros de palier
          S+ decouvert la veille : le classement mesure la marge d&apos;erreur
          offerte, pas le plafond atteignable.
        </p>
      </div>
    </>
  );
}

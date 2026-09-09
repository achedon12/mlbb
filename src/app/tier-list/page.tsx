import type { Metadata } from "next";
import Link from "next/link";
import { PortraitHeros } from "@/components/portrait-heros";
import { BadgePalier, EnTetePage } from "@/components/ui";
import {
  classementComplet,
  LEGENDE_PALIERS,
  mesureLe,
  ORDRE_PALIERS,
  parPalier,
} from "@/lib/tier-list";
import { site } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tier list",
  description:
    "Tier list de Mobile Legends: Bang Bang calculee a partir des taux de victoire et de ban remontes par le jeu. Recalculee a chaque synchronisation, sans opinion.",
  alternates: { canonical: "/tier-list" },
  openGraph: {
    title: `Tier list — ${site.nom}`,
    description: "Classement calcule a partir des taux de victoire et de ban du jeu.",
    url: "/tier-list",
  },
};

export default function PageTierList() {
  return (
    <>
      <EnTetePage
        titre="Tier list"
        chapeau="Ce classement n'est pas une opinion : il est calcule a partir des taux de victoire et de ban remontes par le jeu, et se refait tout seul a chaque synchronisation."
      >
        <p className="mt-6 text-sm text-craie-500">
          {classementComplet.length} heros mesures · taux releves le{" "}
          <time dateTime={mesureLe}>{formaterDate(mesureLe)}</time>
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-5xl px-4 py-12">
        {/* Le lecteur doit pouvoir contester le classement : on montre la regle. */}
        <details className="biseau mb-10 border border-nuit-700/70 bg-nuit-900/60 p-5">
          <summary className="cursor-pointer font-titre font-bold text-or-400">
            Comment ce classement est calcule
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-craie-300">
            <p>
              Le score vaut <strong className="text-craie-100">taux de victoire + un quart du taux de ban</strong>.
            </p>
            <p>
              Le taux de victoire mesure ce qu&apos;un heros produit une fois
              joue. Le taux de ban mesure ce que les joueurs redoutent : il
              rattrape les heros trop forts pour etre laisses libres, dont le
              taux de victoire est trompeusement bas parce qu&apos;ils sont
              rarement disponibles.
            </p>
            <p>
              Le taux de selection n&apos;entre pas dans le calcul — il mesure
              la popularite, pas la puissance. Il sert seulement a signaler
              d&apos;un{" "}
              <span className="text-or-400">asterisque</span> les heros trop peu
              joues pour que leurs chiffres soient stables.
            </p>
          </div>
        </details>

        <div className="space-y-10">
          {ORDRE_PALIERS.map((palier) => {
            const entrees = parPalier(palier);
            if (entrees.length === 0) return null;

            return (
              <section key={palier}>
                <div className="flex items-center gap-4">
                  <BadgePalier palier={palier} />
                  <div>
                    <h2 className="font-titre text-xl font-bold text-craie-100">
                      Palier {palier}
                      <span className="ml-2 text-sm font-medium text-craie-500">
                        {entrees.length}
                      </span>
                    </h2>
                    <p className="text-sm text-craie-500">{LEGENDE_PALIERS[palier]}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {entrees.map((e) => (
                    <li key={e.heros.slug}>
                      <Link
                        href={`/heros/${e.heros.slug}`}
                        className="biseau-sm group flex flex-wrap items-center gap-x-3 gap-y-2 border border-nuit-700/70 bg-nuit-900/60 p-2.5 transition-colors hover:border-or-500/60 sm:flex-nowrap"
                      >
                        <PortraitHeros
                          source={e.heros.visuels.icone ?? e.heros.visuels.portrait}
                          nom={e.heros.nom}
                          taille="icone"
                        />

                        <div className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                          <span className="font-titre font-bold text-craie-100 transition-colors group-hover:text-or-400">
                            {e.heros.nom}
                          </span>
                          {e.faibleEchantillon && (
                            <span
                              className="ml-1 text-or-400"
                              title="Trop peu joue pour que les taux soient fiables"
                            >
                              *
                            </span>
                          )}
                          <span className="block text-[0.7rem] uppercase tracking-wide text-craie-500">
                            {e.heros.lanes.join(" · ") || "—"}
                          </span>
                        </div>

                        <dl className="flex shrink-0 gap-3 text-xs tabular-nums sm:gap-4">
                          <Taux libelle="Victoire" valeur={e.victoire} accent />
                          <Taux libelle="Ban" valeur={e.ban} />
                          <Taux libelle="Pick" valeur={e.selection} />
                        </dl>

                        {e.note && (
                          <p className="hidden flex-1 text-xs leading-relaxed text-craie-500 lg:block">
                            {e.note}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-14 border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-500">
          Un classement mesure la marge d&apos;erreur qu&apos;un heros pardonne,
          pas le plafond qu&apos;il permet d&apos;atteindre. Un heros de palier C
          maitrise bat un heros de palier S+ decouvert la veille.
        </p>
      </div>
    </>
  );
}

function Taux({
  libelle,
  valeur,
  accent = false,
}: {
  libelle: string;
  valeur: number;
  accent?: boolean;
}) {
  return (
    <div className="w-12 text-right sm:w-14">
      <dt className="text-[0.65rem] uppercase tracking-wide text-craie-500">{libelle}</dt>
      <dd className={accent ? "font-semibold text-or-400" : "text-craie-300"}>
        {valeur.toFixed(1)}%
      </dd>
    </div>
  );
}

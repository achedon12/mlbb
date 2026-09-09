import type { Metadata } from "next";
import { Carte, EnTetePage } from "@/components/ui";
import { emblemes, sortsDeCombat, talents } from "@/data/emblemes";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Emblemes et sorts de combat",
  description:
    "Les emblemes, les talents des trois etages et les sorts de combat de Mobile Legends: Bang Bang, avec pour chacun le type de heros auquel il est reellement destine.",
  alternates: { canonical: "/emblemes" },
  openGraph: {
    title: `Emblemes et sorts de combat — ${site.nom}`,
    description: "Emblemes, talents et sorts de combat, et a qui chacun est destine.",
    url: "/emblemes",
  },
};

export default function PageEmblemes() {
  return (
    <>
      <EnTetePage
        titre="Emblemes et sorts"
        chapeau="Le choix d'un embleme, d'un talent ou d'un sort de combat se joue sur le role tenu, pas sur la valeur brute du bonus. Chaque entree precise a qui elle s'adresse."
      />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14">
        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">Emblemes</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {emblemes.map((e) => (
              <Carte key={e.slug}>
                <h3 className="font-titre text-lg font-bold text-craie-100">{e.nom}</h3>
                <p className="mt-1 text-sm text-or-400">{e.bonus}</p>
                <p className="mt-3 text-sm leading-relaxed text-craie-500">{e.pourQui}</p>
              </Carte>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">Talents</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-3 max-w-2xl text-sm text-craie-500">
            Un talent par etage. Le troisieme etage est celui qui change
            reellement une partie ; les deux premiers ajustent.
          </p>

          <div className="mt-6 space-y-8">
            {([1, 2, 3] as const).map((etage) => (
              <div key={etage}>
                <h3 className="font-titre text-sm font-semibold uppercase tracking-wider text-or-400">
                  Etage {etage}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {talents
                    .filter((t) => t.etage === etage)
                    .map((t) => (
                      <Carte key={t.nom} className="p-4">
                        <h4 className="font-titre font-bold text-craie-100">{t.nom}</h4>
                        <p className="mt-1.5 text-sm leading-relaxed text-craie-300">
                          {t.description}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-craie-500">{t.pourQui}</p>
                      </Carte>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">Sorts de combat</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-nuit-700">
                  <th scope="col" className="py-3 pr-4 font-titre font-semibold text-craie-100">Sort</th>
                  <th scope="col" className="py-3 pr-4 font-titre font-semibold text-craie-100">Recharge</th>
                  <th scope="col" className="py-3 pr-4 font-titre font-semibold text-craie-100">Effet</th>
                  <th scope="col" className="py-3 font-titre font-semibold text-craie-100">Pour qui</th>
                </tr>
              </thead>
              <tbody>
                {sortsDeCombat.map((s) => (
                  <tr key={s.slug} className="border-b border-nuit-800/70">
                    <th scope="row" className="py-3 pr-4 font-semibold text-or-400">{s.nom}</th>
                    <td className="py-3 pr-4 text-craie-500">{s.recharge} s</td>
                    <td className="py-3 pr-4 text-craie-300">{s.description}</td>
                    <td className="py-3 text-craie-500">{s.pourQui}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

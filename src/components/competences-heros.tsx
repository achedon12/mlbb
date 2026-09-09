import Image from "next/image";
import { Carte } from "@/components/ui";
import type { Competence } from "@/lib/types";

/**
 * Competences d'un heros.
 *
 * Deux sources se rejoignent ici : le wiki fournit le **nom officiel** de
 * chaque competence — qui est aussi la cle de son icone — et l'analyse
 * redigee fournit la description. Les deux listes suivent le meme ordre
 * (passif, competence 1, competence 2, ultime), c'est ce qui permet de les
 * apparier.
 *
 * Le nom affiche est celui du wiki, jamais une traduction : le jeu est en
 * anglais, et une traduction maison empecherait le lecteur de retrouver la
 * competence en partie.
 *
 * Un heros sans analyse affiche donc quand meme ses competences, avec leur
 * icone et leur nom d'origine.
 */
const TYPES = ["Passif", "Competence 1", "Competence 2", "Ultime"] as const;

export function CompetencesHeros({
  nomsWiki,
  icones,
  redigees,
}: {
  nomsWiki: (string | null)[];
  icones: Record<string, string>;
  redigees: Competence[] | null;
}) {
  const noms = nomsWiki.slice(0, 4);
  const nombre = Math.max(noms.length, redigees?.length ?? 0);

  if (nombre === 0) {
    return (
      <p className="text-craie-500">
        Les competences de ce heros n&apos;ont pas encore ete recuperees.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: nombre }, (_, i) => {
        const nomWiki = noms[i];
        const redigee = redigees?.[i];
        const icone = nomWiki ? icones[nomWiki] : undefined;
        const type = redigee?.type ?? TYPES[i] ?? "Competence";

        return (
          <Carte key={i} className="flex gap-4">
            <span className="relative size-14 shrink-0 overflow-hidden">
              {icone ? (
                <Image
                  src={icone}
                  alt=""
                  fill
                  sizes="56px"
                  // Les onglets masques ne declenchent pas le chargement differe.
                  loading="eager"
                  className="object-contain"
                />
              ) : (
                <span className="grid size-full place-items-center bg-nuit-800 text-xs text-craie-500">
                  —
                </span>
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="biseau-sm bg-nuit-700 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-or-400">
                  {type}
                </span>
                <h3 className="font-titre text-lg font-bold text-craie-100">
                  {nomWiki ?? redigee?.nom ?? "Competence"}
                </h3>
              </div>

              {redigee ? (
                <p className="mt-3 leading-relaxed text-craie-300">{redigee.description}</p>
              ) : (
                <p className="mt-3 text-sm text-craie-500">
                  Description non redigee.
                </p>
              )}

              {(redigee?.recharge || redigee?.cout) && (
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-nuit-800 pt-3 text-sm">
                  {redigee.recharge && (
                    <div className="flex gap-2">
                      <dt className="text-craie-500">Recharge</dt>
                      <dd className="text-craie-100">{redigee.recharge.join(" / ")} s</dd>
                    </div>
                  )}
                  {redigee.cout && (
                    <div className="flex gap-2">
                      <dt className="text-craie-500">Cout</dt>
                      <dd className="text-craie-100">{redigee.cout.join(" / ")}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </Carte>
        );
      })}
    </div>
  );
}

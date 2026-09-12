"use client";

import { useMemo, useState } from "react";
import { ChampRecherche } from "@/components/champ-recherche";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { useT } from "@/i18n/fournisseur";
import { cleRecherche } from "@/lib/utils";

/** Un heros de la liste, en tuple : slug, nom, accroche, icone, termes de recherche deja normalises. */
export type EntreeHistoire = [slug: string, nom: string, accroche: string | null, icone: string | null, termes: string];

export interface GroupeHistoires {
  cle: string;
  /** Nom de la region, dans la langue de la page. */
  nom: string;
  heros: EntreeHistoire[];
}

/**
 * Toutes les histoires, par region, avec une recherche sur le nom, le nom
 * complet, le titre et les affiliations. Le serveur rend la liste entiere ;
 * le navigateur ne recoit que ces tuples, pas une seconde fois l'arbre de
 * cent trente cartes.
 */
export function ListeHistoires({ groupes, total }: { groupes: GroupeHistoires[]; total: number }) {
  const t = useT();
  const [recherche, setRecherche] = useState("");
  const terme = cleRecherche(recherche.trim());
  const visibles = useMemo(
    () =>
      terme
        ? groupes
            .map((g) => ({ ...g, heros: g.heros.filter((h) => h[4].includes(terme)) }))
            .filter((g) => g.heros.length > 0)
        : groupes,
    [groupes, terme],
  );
  const trouves = visibles.reduce((n, g) => n + g.heros.length, 0);

  return (
    <div>
      <ChampRecherche valeur={recherche} onChange={setRecherche} libelle={t("pages.loreUI.search")} className="max-w-md" />
      <p aria-live="polite" className="mt-3 text-sm text-chalk-500">
        {!terme
          ? t("pages.loreUI.total", { n: total })
          : trouves === 0
            ? t("pages.loreUI.none")
            : t(trouves === 1 ? "pages.loreUI.found1" : "pages.loreUI.found", { n: trouves })}
      </p>
      {visibles.map((g) => (
        <section key={g.cle} className="mt-8">
          <h3 className="flex items-baseline justify-between gap-3 border-b border-night-800 pb-2">
            <Link href={`/lore/${g.cle}`} className="font-heading text-xl font-bold text-chalk-100 hover:text-gold-400">
              {g.nom}
            </Link>
            <span className="shrink-0 text-xs text-chalk-500">
              {t(g.heros.length === 1 ? "pages.loreUI.nHeroes1" : "pages.loreUI.nHeroes", { n: g.heros.length })}
            </span>
          </h3>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.heros.map(([slug, nom, accroche, icone]) => (
              <li key={slug}>
                <Link
                  href={`/heroes/${slug}#histoire`}
                  className="bevel-sm flex h-full items-start gap-3 border border-night-700/50 bg-night-900/40 p-3 transition-colors hover:border-gold-500/60"
                >
                  <PortraitHeros source={icone} nom={nom} taille="icone" decoratif />
                  <span className="min-w-0">
                    <span className="block font-semibold text-chalk-100">{nom}</span>
                    {accroche && <span className="line-clamp-2 text-sm leading-snug text-chalk-400">{accroche}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

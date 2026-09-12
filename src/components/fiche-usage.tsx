import { Fragment } from "react";
import { IconeObjet } from "@/components/fiche-objet";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import type { Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { herosParSlug } from "@/lib/donnees";
import { pourcentage } from "@/lib/fraicheur";
import type { ResumeRang, UsageHeros } from "@/lib/usage-builds";

/**
 * Blocs communs aux pages d'objet, d'embleme et de sort, rendus au serveur :
 * tableaux lisibles sans JavaScript, et par les moteurs.
 */

const nomDe = (slug: string) => herosParSlug.get(slug)?.name ?? slug;
const portraitDe = (slug: string) => {
  const h = herosParSlug.get(slug);
  return h?.images.icon ?? h?.images.portrait ?? null;
};
/** Le lien ouvre directement l'onglet des builds de la fiche heros. */
const lienBuilds = (slug: string) => `/heroes/${slug}#builds`;
const taux = (langue: Langue, v: number | null) => (v === null ? "—" : pourcentage(langue, v));

/** Espacement des cellules, pose une fois sur la table plutot que sur chaque cellule. */
const TABLE =
  "w-full text-sm [&_td]:py-2 [&_td]:pr-3 [&_td:last-child]:pr-0 [&_th]:py-2 [&_th]:pr-3 [&_th:last-child]:pr-0 [&_th]:font-medium";
const ENTETE = "border-b border-night-700 text-left text-xs uppercase tracking-wide text-chalk-500";

/**
 * Heros qui prennent le choix : position, part des parties et taux de
 * victoire. Au-dela de `limite`, les suivants passent en simple liste de liens.
 */
export function TableauUsage({
  lignes,
  legende,
  t,
  langue,
  limite = 15,
}: {
  lignes: UsageHeros[];
  legende: string;
  t: T;
  langue: Langue;
  limite?: number;
}) {
  const reste = lignes.slice(limite);
  return (
    <>
      <div className="relative overflow-x-auto">
        {/* Classes des cellules posees une fois sur la table : chaque ligne reste legere. */}
        <table className={TABLE}>
          <caption className="sr-only">{legende}</caption>
          <thead>
            <tr className={ENTETE}>
              <th scope="col">{t("pages.fiches.heros")}</th>
              <th scope="col" className="hidden sm:table-cell">{t("builds.position")}</th>
              <th scope="col" className="text-right">{t("pages.fiches.part")}</th>
              <th scope="col" className="text-right">{t("pages.heroDetail.stat.tauxVictoire")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-night-800 tabular-nums text-chalk-100">
            {lignes.slice(0, limite).map((l) => (
              <tr key={l.slug}>
                <td>
                  <Link href={lienBuilds(l.slug)} className="group flex items-center gap-2.5">
                    <PortraitHeros source={portraitDe(l.slug)} nom={nomDe(l.slug)} taille="petite" decoratif />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-chalk-100 group-hover:text-gold-400">
                        {nomDe(l.slug)}
                      </span>
                      {/* Sur mobile, la position passe sous le nom plutot que dans sa colonne. */}
                      <span className="block text-xs text-chalk-500 sm:hidden">{t(`lanes.${l.lane}`)}</span>
                    </span>
                  </Link>
                </td>
                <td className="hidden text-chalk-300 sm:table-cell">{t(`lanes.${l.lane}`)}</td>
                <td className="text-right">{taux(langue, l.selection)}</td>
                <td className="text-right">{taux(langue, l.victoire)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reste.length > 0 && (
        <p className="mt-4 text-sm leading-relaxed text-chalk-500">
          {t("pages.fiches.aussi")}{" "}
          {reste.map((l, i) => (
            <Fragment key={l.slug}>
              {i > 0 && ", "}
              <Link href={lienBuilds(l.slug)} className="text-chalk-300 underline-offset-4 hover:text-gold-400 hover:underline">
                {nomDe(l.slug)}
              </Link>
            </Fragment>
          ))}
        </p>
      )}
    </>
  );
}

/** Une ligne par rang : combien de heros prennent le choix, lequel en tete, et le taux moyen. */
export function TableauRangs({
  resume,
  legende,
  t,
  langue,
}: {
  resume: ResumeRang[];
  legende: string;
  t: T;
  langue: Langue;
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className={TABLE}>
        <caption className="sr-only">{legende}</caption>
        <thead>
          <tr className={ENTETE}>
            <th scope="col">{t("rangsMesure.label")}</th>
            <th scope="col" className="text-right">{t("pages.fiches.nbHeros")}</th>
            <th scope="col">{t("pages.fiches.enTete")}</th>
            <th scope="col" className="text-right">{t("pages.fiches.victoireMoy")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-night-800 tabular-nums text-chalk-100">
          {resume.map((r) => (
            <tr key={r.rang}>
              <th scope="row" className="text-left text-chalk-300">
                {t(`rangsMesure.${r.rang}`)}
              </th>
              <td className="text-right">{r.heros}</td>
              <td>
                {r.premier ? (
                  <Link href={lienBuilds(r.premier.slug)} className="text-chalk-100 hover:text-gold-400">
                    {nomDe(r.premier.slug)}
                  </Link>
                ) : (
                  <span className="text-chalk-500">—</span>
                )}
              </td>
              <td className="text-right">{taux(langue, r.victoire)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface EntreePart {
  cle: string;
  nom: string;
  image: string | null;
  /** Part en %. */
  part: number;
  href?: string;
}

/** Choix associes (talents, sorts, emblemes), chacun avec sa part en barre. */
export function PartsChoix({ entrees, langue }: { entrees: EntreePart[]; langue: Langue }) {
  return (
    <ul className="space-y-3">
      {entrees.map((e) => (
        <li key={e.cle} className="flex items-center gap-2.5">
          <IconeObjet image={e.image} taille={28} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              {e.href ? (
                <Link href={e.href} className="truncate text-chalk-100 underline-offset-4 hover:text-gold-400 hover:underline">
                  {e.nom}
                </Link>
              ) : (
                <span className="truncate text-chalk-100">{e.nom}</span>
              )}
              <span className="shrink-0 tabular-nums text-chalk-300">{pourcentage(langue, e.part)}</span>
            </div>
            <span aria-hidden className="mt-1 block h-1 bg-night-700">
              <span className="block h-full bg-gold-400" style={{ width: `${Math.min(100, e.part)}%` }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Grille de liens vers des pages voisines (objets de la meme categorie, autres emblemes, autres sorts). */
export function ListeLiens({ liens }: { liens: { href: string; nom: string; image: string | null; detail?: string }[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
      {liens.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="bevel-sm group flex h-full items-center gap-2 border border-night-700/70 bg-night-900/60 p-2 transition-colors hover:border-gold-500/60"
          >
            <IconeObjet image={l.image} taille={32} />
            <span className="min-w-0">
              <span className="block truncate text-sm text-chalk-100 group-hover:text-gold-400">{l.nom}</span>
              {l.detail && <span className="block text-xs tabular-nums text-gold-400">{l.detail}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

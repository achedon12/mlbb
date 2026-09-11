"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ChampRecherche } from "@/components/champ-recherche";
import {
  catalogueRecettes,
  EffetsObjet,
  RecetteObjet,
  type ApercuObjet,
  type CatalogueRecettes,
  type VersObjet,
} from "@/components/fiche-objet";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { Puce } from "@/components/puce";
import { Tiroir } from "@/components/tiroir";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import { cleRecherche, cn } from "@/lib/utils";

/**
 * Catalogue des objets.
 *
 * Une grille dense d'icones plutot que des fiches empilees : on compare des
 * objets, et comparer suppose de les voir ensemble. Le detail complet s'ouvre
 * dans un panneau lateral, ce qui evite de repeter dix lignes de statistiques
 * sur chaque vignette. Chaque objet a aussi sa page, rendue au serveur.
 */
export type { ApercuObjet };

/** Heros cite par un objet : de quoi afficher sa vignette. */
export interface VignetteHeros {
  nom: string;
  portrait: string | null;
}

/**
 * Le catalogue vu depuis les recettes et les builds : chaque objet par son nom,
 * ce qu'il sert a fabriquer, et les heros qui le prennent.
 */
interface Catalogue extends CatalogueRecettes {
  utilisePar: Record<string, string[]>;
  heros: Record<string, VignetteHeros>;
}

/**
 * Change l'objet ouvert.
 *
 * `replaceState` ne declenche pas `hashchange` : on previent donc nous-memes,
 * sinon l'affichage ne suivrait pas le changement d'adresse.
 */
function selectionner(slug: string | null) {
  history.replaceState(null, "", slug ? `#${slug}` : window.location.pathname);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function fermerObjet() {
  selectionner(null);
}

/** Dans le catalogue, un autre objet s'ouvre sur place, par l'ancre. */
const versAncre: VersObjet = (o, contenu, className) => (
  <button type="button" onClick={() => selectionner(o.slug)} className={className}>
    {contenu}
  </button>
);

export function ListeObjets({
  objets,
  categories,
  utilisePar,
  herosVignettes,
}: {
  objets: ApercuObjet[];
  categories: string[];
  /** Heros qui prennent chaque objet (par slug d'objet), les plus joues d'abord. */
  utilisePar: Record<string, string[]>;
  herosVignettes: Record<string, VignetteHeros>;
}) {
  const [recherche, setRecherche] = useState("");
  const t = useT();
  const langue = useLangue();
  const [categorie, setCategorie] = useState<string | null>(null);

  const slugsConnus = useMemo(() => new Set(objets.map((o) => o.slug)), [objets]);

  /**
   * L'objet ouvert est designe par l'adresse, pas par un etat local.
   *
   * Les builds des fiches heros renvoient ici avec une ancre — par exemple
   * `/objets#bloodlust-axe`. Faire de l'adresse la source unique evite d'avoir
   * a synchroniser deux verites : le lien entrant, la selection et le lien
   * partageable decrivent tous la meme chose.
   */
  const ancre = useSyncExternalStore(
    (rafraichir) => {
      window.addEventListener("hashchange", rafraichir);
      return () => window.removeEventListener("hashchange", rafraichir);
    },
    () => window.location.hash,
    // Rendu serveur : aucune ancre connue.
    () => "",
  );

  const actif = useMemo(() => {
    const cible = decodeURIComponent(ancre.replace(/^#/, ""));
    return cible && slugsConnus.has(cible) ? cible : null;
  }, [ancre, slugsConnus]);

  // Un objet designe par l'adresse doit etre visible : on amene la grille
  // dessus plutot que de laisser l'utilisateur le chercher.
  useEffect(() => {
    if (!actif) return;
    const image = requestAnimationFrame(() => {
      document.getElementById(actif)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(image);
  }, [actif]);

  const resultats = useMemo(() => {
    const terme = cleRecherche(recherche.trim());
    return objets.filter((o) => {
      // L'objet ouvert reste toujours affiche, meme hors du filtre courant.
      if (o.slug === actif) return true;
      if (categorie && o.categorie !== categorie) return false;
      if (!terme) return true;
      return (
        cleRecherche(o.nom).includes(terme) ||
        cleRecherche(o.bonus ?? "").includes(terme) ||
        cleRecherche(o.passif ?? "").includes(terme)
      );
    });
  }, [objets, recherche, categorie, actif]);

  const objet = objets.find((o) => o.slug === actif) ?? null;

  // Les recettes nomment leurs composants : on les retrouve par nom, et on lit
  // les recettes a l'envers pour savoir ce que chaque objet sert a fabriquer.
  const catalogue = useMemo<Catalogue>(
    () => ({ ...catalogueRecettes(objets), utilisePar, heros: herosVignettes }),
    [objets, utilisePar, herosVignettes],
  );

  return (
    <div>
      <div className="flex flex-col gap-4">
        <ChampRecherche
          valeur={recherche}
          onChange={setRecherche}
          libelle={t("pages.itemsListe.rechercher")}
          className="max-w-md"
        />

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Puce key={c} actif={categorie === c} onClick={() => setCategorie(categorie === c ? null : c)}>
              {t(`categories.${c}`)}
            </Puce>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {t("pages.itemsListe.compte", { n: resultats.length })}
        {resultats.length !== objets.length && ` ${t("pages.itemsListe.compteSur", { total: objets.length })}`}
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_21rem]">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
          {resultats.map((o) => {
            const selectionne = o.slug === objet?.slug;
            return (
              <li key={o.slug} className="offscreen">
                <button
                  type="button"
                  id={o.slug}
                  onClick={() => selectionner(selectionne ? null : o.slug)}
                  aria-pressed={selectionne}
                  className={cn(
                    "bevel-sm flex h-full w-full flex-col items-center gap-1.5 border p-2 text-center transition-colors",
                    selectionne
                      ? "border-gold-500 bg-gold-500/10"
                      : "border-night-700/70 bg-night-900/60 hover:border-gold-500/50",
                  )}
                >
                  <span className="relative size-11 shrink-0">
                    {o.image ? (
                      <Image src={o.image} alt="" width={44} height={44} className="size-full object-contain" />
                    ) : (
                      <span className="grid size-full place-items-center bg-night-800 text-[0.6rem] text-chalk-500">
                        —
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium leading-tight text-chalk-100">
                    {o.nom}
                  </span>
                  {o.prix !== null && (
                    // L'unite est ecrite en toutes lettres : un nombre nu sous
                    // une icone d'objet se lit comme un niveau ou une quantite,
                    // pas comme un prix.
                    <span className="text-xs tabular-nums text-gold-400">
                      {o.prix.toLocaleString(LOCALE_HTML[langue])} {t("pages.itemsListe.or")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
          {objet ? (
            <FicheObjet objet={objet} catalogue={catalogue} />
          ) : (
            <p className="bevel border border-dashed border-night-700 p-5 text-sm leading-relaxed text-chalk-500">
              {t("pages.itemsListe.choisir")}
            </p>
          )}
        </aside>
      </div>

      {/*
        Sur mobile, la fiche monte en tiroir depuis le bas : pas besoin de
        redescendre sous une grille de cent objets pour la lire.
      */}
      {objet && (
        <Tiroir titre={objet.nom} onFermer={fermerObjet} libelleFermer={t("pages.itemsListe.fermer")}>
          <FicheObjet objet={objet} catalogue={catalogue} sansCadre />
        </Tiroir>
      )}
    </div>
  );
}

/** Fiche detaillee d'un objet, commune a la colonne laterale et au tiroir. */
function FicheObjet({
  objet,
  catalogue,
  sansCadre = false,
}: {
  objet: ApercuObjet;
  catalogue: Catalogue;
  sansCadre?: boolean;
}) {
  const t = useT();
  const langue = useLangue();
  const utilisateurs = catalogue.utilisePar[objet.slug] ?? [];
  return (
            <div className={cn("p-5", !sansCadre && "bevel border border-night-700/70 bg-night-900/60")}>
              <div className="flex items-start gap-3">
                {objet.image && (
                  <span className="relative size-14 shrink-0">
                    <Image src={objet.image} alt="" fill sizes="56px" className="object-contain" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-bold leading-tight text-chalk-100">
                    {objet.nom}
                  </h2>
                  {objet.resume && (
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-chalk-500">
                      {objet.resume}
                    </p>
                  )}
                  {objet.prix !== null && (
                    <p className="mt-1 text-sm text-chalk-500">
                      {t("pages.itemsListe.prix")}{" "}
                      <span className="font-heading text-gold-400">
                        {objet.prix.toLocaleString(LOCALE_HTML[langue])} {t("pages.itemsListe.or")}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <EffetsObjet objet={objet} t={t} />
                <RecetteObjet objet={objet} catalogue={catalogue} t={t} langue={langue} vers={versAncre} />
                {utilisateurs.length > 0 && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsListe.utilisePar")}</dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {utilisateurs.map((slug) => (
                        <Link
                          key={slug}
                          href={`/heroes/${slug}`}
                          className="bevel-sm group flex items-center gap-1.5 border border-night-700/70 bg-night-900/60 py-1 pl-1 pr-2 transition-colors hover:border-gold-500/60"
                        >
                          <PortraitHeros
                            source={catalogue.heros[slug]?.portrait ?? null}
                            nom={catalogue.heros[slug]?.nom ?? slug}
                            taille="micro"
                            decoratif
                          />
                          <span className="text-xs text-chalk-300 group-hover:text-gold-400">{catalogue.heros[slug]?.nom ?? slug}</span>
                        </Link>
                      ))}
                    </dd>
                    <p className="mt-1.5 text-xs text-chalk-500">{t("pages.itemsListe.utiliseParAide")}</p>
                  </div>
                )}
              </dl>

              {/* La page de l'objet ajoute ce que la fiche ne peut pas tenir : taux par heros et par rang. */}
              <Link
                href={`/items/${objet.slug}`}
                className="mt-5 inline-block text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500"
              >
                {t("pages.itemsListe.pageComplete")} →
              </Link>
            </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import type { ObjetGenere } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Catalogue des objets.
 *
 * Une grille dense d'icones plutot que des fiches empilees : on compare des
 * objets, et comparer suppose de les voir ensemble. Le detail complet s'ouvre
 * dans un panneau lateral, ce qui evite de repeter dix lignes de statistiques
 * sur chaque vignette.
 */
export interface ApercuObjet extends ObjetGenere {
  image: string | null;
}

export function ListeObjets({
  objets,
  categories,
  nomCategorie,
}: {
  objets: ApercuObjet[];
  categories: string[];
  nomCategorie: Record<string, string>;
}) {
  const [recherche, setRecherche] = useState("");
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
    const terme = recherche.trim().toLowerCase();
    return objets.filter((o) => {
      // L'objet ouvert reste toujours affiche, meme hors du filtre courant.
      if (o.slug === actif) return true;
      if (categorie && o.categorie !== categorie) return false;
      if (!terme) return true;
      return (
        o.nom.toLowerCase().includes(terme) ||
        (o.bonus ?? "").toLowerCase().includes(terme) ||
        (o.passif ?? "").toLowerCase().includes(terme)
      );
    });
  }, [objets, recherche, categorie, actif]);

  const objet = objets.find((o) => o.slug === actif) ?? null;

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-craie-500"
          />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un objet, une statistique, un passif"
            aria-label="Rechercher un objet"
            className="biseau-sm w-full border border-nuit-700 bg-nuit-900 py-2.5 pl-10 pr-4 text-craie-100 outline-none transition-colors placeholder:text-craie-500 focus:border-or-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const selectionne = categorie === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={selectionne}
                onClick={() => setCategorie(selectionne ? null : c)}
                className={cn(
                  "biseau-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  selectionne
                    ? "bg-or-500 text-nuit-950"
                    : "border border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
                )}
              >
                {nomCategorie[c] ?? c}
              </button>
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-craie-500">
        {resultats.length} objets
        {resultats.length !== objets.length && ` sur ${objets.length}`}
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_21rem]">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
          {resultats.map((o) => {
            const selectionne = o.slug === objet?.slug;
            return (
              <li key={o.slug}>
                <button
                  type="button"
                  id={o.slug}
                  onClick={() => selectionner(selectionne ? null : o.slug)}
                  aria-pressed={selectionne}
                  className={cn(
                    "biseau-sm flex h-full w-full flex-col items-center gap-1.5 border p-2 text-center transition-colors",
                    selectionne
                      ? "border-or-500 bg-or-500/10"
                      : "border-nuit-700/70 bg-nuit-900/60 hover:border-or-500/50",
                  )}
                >
                  <span className="relative size-11 shrink-0">
                    {o.image ? (
                      <Image
                        src={o.image}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-contain"
                      />
                    ) : (
                      <span className="grid size-full place-items-center bg-nuit-800 text-[0.6rem] text-craie-500">
                        —
                      </span>
                    )}
                  </span>
                  <span className="text-[0.7rem] font-medium leading-tight text-craie-100">
                    {o.nom}
                  </span>
                  {o.prix !== null && (
                    // L'unite est ecrite en toutes lettres : un nombre nu sous
                    // une icone d'objet se lit comme un niveau ou une quantite,
                    // pas comme un prix.
                    <span className="text-[0.65rem] tabular-nums text-or-400">
                      {o.prix.toLocaleString("fr-FR")} or
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit lg:sticky lg:top-24">
          {objet ? (
            <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-5">
              <div className="flex items-start gap-3">
                {objet.image && (
                  <span className="relative size-14 shrink-0">
                    <Image src={objet.image} alt="" fill sizes="56px" className="object-contain" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="font-titre text-lg font-bold leading-tight text-craie-100">
                    {objet.nom}
                  </h2>
                  {objet.resume && (
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-craie-500">
                      {objet.resume}
                    </p>
                  )}
                  {objet.prix !== null && (
                    <p className="mt-1 text-sm text-craie-500">
                      Prix :{" "}
                      <span className="font-titre text-or-400">
                        {objet.prix.toLocaleString("fr-FR")} or
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                {objet.bonus && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">Statistiques</dt>
                    <dd className="mt-1 leading-snug text-craie-100">{objet.bonus}</dd>
                  </div>
                )}
                {objet.unique && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">Unique</dt>
                    <dd className="mt-1 leading-snug text-azur-400">{objet.unique}</dd>
                  </div>
                )}
                {objet.passif && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">Passif</dt>
                    <dd className="mt-1 leading-relaxed text-craie-300">{objet.passif}</dd>
                  </div>
                )}
                {objet.actif && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">Actif</dt>
                    <dd className="mt-1 leading-relaxed text-craie-300">{objet.actif}</dd>
                  </div>
                )}
                {objet.recette.length > 0 && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">Recette</dt>
                    <dd className="mt-1 text-craie-300">{objet.recette.join(" + ")}</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <p className="biseau border border-dashed border-nuit-700 p-5 text-sm leading-relaxed text-craie-500">
              Choisissez un objet pour voir ses statistiques, son passif et sa
              recette.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

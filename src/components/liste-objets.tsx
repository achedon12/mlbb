"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import type { ObjetGenere } from "@/lib/types";
import { useT } from "@/i18n/fournisseur";
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

export function ListeObjets({
  objets,
  categories,
}: {
  objets: ApercuObjet[];
  categories: string[];
}) {
  const [recherche, setRecherche] = useState("");
  const t = useT();
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
            placeholder={t("pages.itemsListe.rechercher")}
            aria-label={t("pages.itemsListe.rechercher")}
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
                {t(`categories.${c}`)}
              </button>
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-craie-500">
        {t("pages.itemsListe.compte", { n: resultats.length })}
        {resultats.length !== objets.length && ` ${t("pages.itemsListe.compteSur", { total: objets.length })}`}
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

        <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
          {objet ? (
            <FicheObjet objet={objet} />
          ) : (
            <p className="biseau border border-dashed border-nuit-700 p-5 text-sm leading-relaxed text-craie-500">
              {t("pages.itemsListe.choisir")}
            </p>
          )}
        </aside>
      </div>

      {/*
        Sur mobile, la fiche monte en tiroir depuis le bas : pas besoin de
        redescendre sous une grille de cent objets pour la lire.
      */}
      {objet && <Tiroir objet={objet} onFermer={fermerObjet} />}
    </div>
  );
}

/** Fiche detaillee d'un objet, commune a la colonne laterale et au tiroir. */
function FicheObjet({ objet, sansCadre = false }: { objet: ApercuObjet; sansCadre?: boolean }) {
  const t = useT();
  return (
            <div className={cn("p-5", !sansCadre && "biseau border border-nuit-700/70 bg-nuit-900/60")}>
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
                      {t("pages.itemsListe.prix")}{" "}
                      <span className="font-titre text-or-400">
                        {objet.prix.toLocaleString()} {t("pages.itemsListe.or")}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                {objet.bonus && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">{t("pages.itemsListe.statistiques")}</dt>
                    <dd className="mt-1 leading-snug text-craie-100">{objet.bonus}</dd>
                  </div>
                )}
                {objet.unique && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">{t("pages.itemsListe.unique")}</dt>
                    <dd className="mt-1 leading-snug text-azur-400">{objet.unique}</dd>
                  </div>
                )}
                {objet.passif && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">{t("pages.itemsListe.passif")}</dt>
                    <dd className="mt-1 leading-relaxed text-craie-300">{objet.passif}</dd>
                  </div>
                )}
                {objet.actif && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">{t("pages.itemsListe.actif")}</dt>
                    <dd className="mt-1 leading-relaxed text-craie-300">{objet.actif}</dd>
                  </div>
                )}
                {objet.recette.length > 0 && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-craie-500">{t("pages.itemsListe.recette")}</dt>
                    <dd className="mt-1 text-craie-300">{objet.recette.join(" + ")}</dd>
                  </div>
                )}
              </dl>
            </div>
  );
}

/**
 * Tiroir mobile.
 *
 * Il masque la page derriere un voile, bloque son defilement et se ferme par
 * la croix, un toucher sur le voile ou Echap. Au-dela de `lg`, la fiche vit
 * dans la colonne laterale et le tiroir ne s'affiche pas.
 */
function Tiroir({ objet, onFermer }: { objet: ApercuObjet; onFermer: () => void }) {
  const t = useT();

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", echap);
    return () => {
      document.body.style.overflow = avant;
      window.removeEventListener("keydown", echap);
    };
  }, [onFermer]);

  return (
    <div className="lg:hidden">
      <div
        aria-hidden
        onClick={onFermer}
        className="fixed inset-0 z-50 bg-nuit-950/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={objet.nom}
        className="tiroir fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-nuit-700 bg-nuit-900 pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-black/60"
      >
        <div className="sticky top-0 z-10 flex justify-center bg-nuit-900 pb-1 pt-2.5">
          <span aria-hidden className="h-1 w-10 rounded-full bg-nuit-600" />
        </div>
        <button
          type="button"
          autoFocus
          onClick={onFermer}
          aria-label={t("pages.itemsListe.fermer")}
          className="absolute right-3 top-2 z-10 grid size-9 place-items-center text-craie-500 transition-colors hover:text-craie-100"
        >
          <X size={18} aria-hidden />
        </button>
        <FicheObjet objet={objet} sansCadre />
      </div>
    </div>
  );
}

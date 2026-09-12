"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/lien";
import { ChevronRight, ChevronsUpDown, House } from "lucide-react";
import { useLangue, useT } from "@/i18n/fournisseur";
import { donneesLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cleRecherche, cn } from "@/lib/utils";

export interface Miette {
  nom: string;
  /** Lien de la miette ; absent pour la page courante. */
  href?: string;
  /**
   * Pages de meme niveau, proposees depuis la miette courante : on passe d'un
   * heros, d'un patch ou d'un rang a l'autre sans remonter a la liste.
   */
  freres?: { nom: string; href: string }[];
}

/** Au-dela, la liste des pages soeurs s'ouvre sur un champ de filtre. */
const SEUIL_FILTRE = 10;
const LARGEUR_PANNEAU = 288;

/**
 * Fil d'Ariane.
 *
 * Rend la position dans le site et emet en meme temps le balisage
 * `BreadcrumbList` : les moteurs affichent alors le chemin sous le resultat
 * plutot que l'URL brute, et le lecteur remonte d'un niveau sans la barre du
 * navigateur.
 *
 * L'accueil ouvre toujours le fil : aucune page n'a a le declarer. Le fil pose
 * son propre fond, lisible sur un en-tete illustre comme sur un fond uni.
 * Quand la page a des soeurs, la derniere miette les propose dans un menu.
 */
export function FilAriane({ miettes, className }: { miettes: Miette[]; className?: string }) {
  const t = useT();
  const langue = useLangue();
  const fil: Miette[] = [{ nom: t("common.home"), href: "/" }, ...miettes];
  // Les moteurs veulent des adresses completes, langue comprise : un lien sans
  // prefixe n'est resolu que par la redirection du proxy.
  const adresse = (href: string) => `${site.url}/${langue}${href === "/" ? "" : href}`;
  const donnees = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: fil.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nom,
      ...(m.href ? { item: adresse(m.href) } : {}),
    })),
  };

  const courante = fil.at(-1)!;
  const freres = courante.freres && courante.freres.length > 1 ? courante.freres : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }}
      />
      <nav aria-label={t("common.breadcrumb")} className={className}>
        <ol className="bevel-sm inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 border border-night-700/60 bg-night-950/70 px-3 py-1.5 text-sm backdrop-blur-sm">
          {fil.map((m, i) => {
            const dernier = i === fil.length - 1;
            const accueil = i === 0;
            return (
              <li key={`${m.nom}-${i}`} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} aria-hidden className="shrink-0 text-chalk-600" />}
                {m.href && !dernier ? (
                  <Link
                    href={m.href}
                    className="flex items-center gap-1.5 text-chalk-400 transition-colors hover:text-gold-400"
                  >
                    {accueil && <House size={14} aria-hidden className="shrink-0" />}
                    {/* Sur mobile, la maison suffit a dire « accueil ». */}
                    <span className={cn(accueil && "sr-only sm:not-sr-only")}>{m.nom}</span>
                  </Link>
                ) : dernier && freres ? (
                  <PagesSoeurs nom={m.nom} freres={freres} />
                ) : (
                  <span aria-current="page" className="truncate font-medium text-chalk-100">
                    {m.nom}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * Derniere miette ouvrant la liste des pages soeurs. Le panneau est rendu a la
 * racine du document — la forme biseautee du fil le rognerait — et se place
 * sous la miette sans deborder de l'ecran. Il se ferme au clic exterieur, a
 * Echap, au defilement de la page et au choix d'une page.
 */
function PagesSoeurs({ nom, freres }: { nom: string; freres: { nom: string; href: string }[] }) {
  const t = useT();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [position, setPosition] = useState({ haut: 0, gauche: 0 });
  const racine = useRef<HTMLSpanElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = () => setOuvert(false);
    const fermerDehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (!racine.current?.contains(cible) && !panneau.current?.contains(cible)) fermer();
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    // La page courante au milieu de la liste, sans faire defiler la page.
    const courante = liste.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (liste.current && courante) {
      liste.current.scrollTop = courante.offsetTop - liste.current.clientHeight / 2;
    }
    document.addEventListener("pointerdown", fermerDehors);
    document.addEventListener("keydown", echap);
    window.addEventListener("scroll", fermer, { passive: true });
    window.addEventListener("resize", fermer);
    return () => {
      document.removeEventListener("pointerdown", fermerDehors);
      document.removeEventListener("keydown", echap);
      window.removeEventListener("scroll", fermer);
      window.removeEventListener("resize", fermer);
    };
  }, [ouvert]);

  const basculer = () => {
    // Le panneau part de la miette, recule s'il sortirait de l'ecran.
    const bouton = racine.current?.getBoundingClientRect();
    if (bouton) {
      setPosition({
        haut: bouton.bottom + 10,
        gauche: Math.max(16, Math.min(bouton.left, window.innerWidth - 16 - LARGEUR_PANNEAU)),
      });
    }
    setFiltre("");
    setOuvert((o) => !o);
  };

  const terme = cleRecherche(filtre.trim());
  const visibles = terme ? freres.filter((f) => cleRecherche(f.nom).includes(terme)) : freres;

  return (
    <span ref={racine} className="flex min-w-0">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        aria-controls={`${id}-panneau`}
        title={t("common.siblings", { nom })}
        className="flex min-w-0 items-center gap-1 font-medium text-chalk-100 transition-colors hover:text-gold-400"
      >
        <span aria-current="page" className="truncate">
          {nom}
        </span>
        <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-chalk-500" />
        <span className="sr-only">{t("common.siblings", { nom })}</span>
      </button>

      {ouvert &&
        createPortal(
          <div
            ref={panneau}
            id={`${id}-panneau`}
            style={{ top: position.haut, left: position.gauche, width: LARGEUR_PANNEAU }}
            className="fixed z-50 max-w-[calc(100vw-2rem)] border border-night-700 bg-night-900 shadow-xl shadow-black/40"
          >
            {freres.length > SEUIL_FILTRE && (
              <input
                autoFocus
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
                placeholder={t("common.filter")}
                aria-label={t("common.filter")}
                className="w-full border-b border-night-800 bg-transparent px-3 py-2 text-sm text-chalk-100 outline-none placeholder:text-chalk-500"
              />
            )}
            <ul ref={liste} className="relative max-h-72 overflow-y-auto p-1">
              {visibles.map((f) => (
                <li key={f.href}>
                  <Link
                    href={f.href}
                    onClick={() => setOuvert(false)}
                    aria-current={f.nom === nom ? "page" : undefined}
                    className={cn(
                      "block truncate rounded-sm px-3 py-1.5 text-sm transition-colors",
                      f.nom === nom ? "bg-night-800 text-gold-400" : "text-chalk-300 hover:bg-night-850 hover:text-gold-400",
                    )}
                  >
                    {f.nom}
                  </Link>
                </li>
              ))}
              {visibles.length === 0 && <li className="px-3 py-2 text-sm text-chalk-500">{t("search.none")}</li>}
            </ul>
          </div>,
          document.body,
        )}
    </span>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/lien";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ACTUALITE, BASE, GROUPES, type Entree, type Groupe, type Noeud } from "@/lib/rubriques";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/**
 * Navigation de bureau.
 *
 * Cinq familles en menus deroulants — heros, tier lists, jeu, outils,
 * actualite. Chaque entree porte une icone, un libelle et une courte
 * description ; celles qui regroupent des sous-pages (tier list par rang, par
 * lane, emblemes…) ouvrent un sous-menu lateral, au survol, au clic ou avec la
 * fleche droite.
 */

export function estActif(chemin: string, href: string) {
  // Le chemin porte un prefixe de langue (/fr/heroes) : on compare la fin.
  return chemin.endsWith(href) || chemin.includes(`${href}/`);
}

/** Libelle d'un noeud : sa cle de navigation, ou sa cle de traduction directe. */
export function libelleNoeud(t: (cle: string) => string, n: Noeud): string {
  return n.cle ? t(`nav.${n.cle}.label`) : t(n.libelle ?? "");
}

const actifDans = (chemin: string, n: Noeud): boolean =>
  (n.href ? estActif(chemin, n.href) : false) || (n.enfants ?? []).some((e) => actifDans(chemin, e));

function Deroulant({
  groupe,
  ouvert,
  onOuvrir,
  onFermer,
}: {
  groupe: Groupe;
  ouvert: boolean;
  onOuvrir: () => void;
  onFermer: () => void;
}) {
  const t = useT();
  const chemin = usePathname();
  const panneauId = useId();
  const groupeActif = groupe.noeuds.some((n) => actifDans(chemin, n));
  const { icone: Icone } = groupe;

  return (
    <div className="relative" onMouseEnter={onOuvrir} onMouseLeave={onFermer}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={panneauId}
        onClick={() => (ouvert ? onFermer() : onOuvrir())}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors xl:px-3",
          groupeActif || ouvert ? "text-chalk-100" : "text-chalk-300 hover:text-chalk-100",
        )}
      >
        <Icone size={16} aria-hidden className={groupeActif ? "text-gold-400" : ""} />
        {t(`nav.groups.${groupe.cle}`)}
        <ChevronDown size={14} aria-hidden className={cn("transition-transform duration-200", ouvert && "rotate-180")} />
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-3 -bottom-px h-0.5 bg-gold-500 transition-opacity",
            groupeActif ? "opacity-100" : "opacity-0",
          )}
        />
      </button>

      <div id={panneauId} hidden={!ouvert} className="absolute left-0 top-full z-50 pt-2">
        {/*
          Le biseau (clip-path) est porte par un calque de fond : pose sur le
          panneau lui-meme, il rognerait les sous-menus qui en debordent.
        */}
        <div className={cn("relative p-2", groupe.large ? "w-[36rem]" : "w-80")}>
          <div
            aria-hidden
            className="bevel absolute inset-0 border border-night-700/80 bg-night-900/98 shadow-2xl shadow-night-950/60 backdrop-blur"
          />
          <ul className={cn("relative grid gap-0.5", groupe.large && "grid-cols-2")}>
            {groupe.noeuds.map((n) => (
              <li key={n.href ?? n.cle}>
                {n.enfants ? (
                  <NoeudAvecSousMenu noeud={n} chemin={chemin} onNaviguer={onFermer} />
                ) : (
                  <LienMenu
                    entree={n as Entree}
                    actif={estActif(chemin, n.href!)}
                    onClick={onFermer}
                    className="items-start"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Entree qui regroupe des sous-pages. La ligne mene a sa page quand elle en a
 * une ; la fleche, ou le survol, ouvre la liste des sous-pages a droite.
 */
function NoeudAvecSousMenu({ noeud, chemin, onNaviguer }: { noeud: Noeud; chemin: string; onNaviguer: () => void }) {
  const t = useT();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const fleche = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const nom = libelleNoeud(t, noeud);
  const actif = actifDans(chemin, noeud);

  const ouvrirEtEntrer = () => {
    setOuvert(true);
    // Le sous-menu vient d'etre rendu : on y place le focus au tour suivant.
    requestAnimationFrame(() => liste.current?.querySelector<HTMLElement>("a")?.focus());
  };

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" && !ouvert) {
      e.preventDefault();
      ouvrirEtEntrer();
    } else if (e.key === "ArrowLeft" && ouvert) {
      e.preventDefault();
      setOuvert(false);
      fleche.current?.focus();
    }
  };

  const contenu = (
    <>
      {noeud.icone && (
        <span
          className={cn(
            "bevel-sm grid size-9 shrink-0 place-items-center transition-colors",
            actif ? "bg-gold-500 text-night-950" : "bg-night-800 text-chalk-300 group-hover:text-gold-400",
          )}
        >
          <noeud.icone size={17} aria-hidden />
        </span>
      )}
      <span className="min-w-0 text-left">
        <span className={cn("block text-sm font-semibold", actif ? "text-gold-400" : "text-chalk-100")}>{nom}</span>
        {noeud.cle && <span className="block text-xs text-chalk-400">{t(`nav.${noeud.cle}.desc`)}</span>}
      </span>
    </>
  );
  const classeLigne = cn(
    "group flex min-w-0 flex-1 items-start gap-3 rounded-md p-2.5 transition-colors",
    ouvert || actif ? "bg-night-800/70" : "hover:bg-night-800/60",
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => setOuvert(true)}
      onMouseLeave={() => setOuvert(false)}
      onKeyDown={auClavier}
    >
      <div className="flex items-stretch">
        {noeud.href ? (
          <Link href={noeud.href} onClick={onNaviguer} className={classeLigne}>
            {contenu}
          </Link>
        ) : (
          <button type="button" onClick={() => (ouvert ? setOuvert(false) : ouvrirEtEntrer())} className={classeLigne}>
            {contenu}
          </button>
        )}
        <button
          ref={fleche}
          type="button"
          aria-expanded={ouvert}
          aria-controls={id}
          aria-label={t("nav.submenu", { nom })}
          onClick={() => (ouvert ? setOuvert(false) : ouvrirEtEntrer())}
          className="grid w-8 shrink-0 place-items-center rounded-md text-chalk-500 transition-colors hover:text-gold-400"
        >
          <ChevronRight size={16} aria-hidden className={cn("transition-transform", ouvert && "translate-x-0.5")} />
        </button>
      </div>

      {ouvert && (
        <div id={id} className="absolute left-full top-0 z-50 pl-2">
          <ul
            ref={liste}
            className="bevel min-w-52 border border-night-700/80 bg-night-900/98 p-1.5 shadow-2xl shadow-night-950/60 backdrop-blur"
          >
            {noeud.enfants!.map((e) => {
              const enfantActif = e.href ? chemin.endsWith(e.href) : false;
              return (
                <li key={e.href}>
                  <Link
                    href={e.href!}
                    onClick={onNaviguer}
                    aria-current={enfantActif ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm transition-colors",
                      enfantActif ? "bg-night-800 text-gold-400" : "text-chalk-200 hover:bg-night-800/70 hover:text-gold-400",
                    )}
                  >
                    {libelleNoeud(t, e)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Une rubrique du menu : icone, libelle et courte description. La meme au
 * bureau et sur mobile.
 */
export function LienMenu({
  entree,
  actif,
  onClick,
  className,
}: {
  entree: Entree;
  actif: boolean;
  onClick: () => void;
  className?: string;
}) {
  const t = useT();
  const { href, cle, icone: Ic } = entree;
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={actif ? "page" : undefined}
      className={cn(
        "group flex gap-3 rounded-md p-2.5 transition-colors",
        actif ? "bg-night-800/80" : "hover:bg-night-800/60",
        className,
      )}
    >
      <span
        className={cn(
          "bevel-sm grid size-9 shrink-0 place-items-center transition-colors",
          actif ? "bg-gold-500 text-night-950" : "bg-night-800 text-chalk-300 group-hover:text-gold-400",
        )}
      >
        <Ic size={17} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-semibold", actif ? "text-gold-400" : "text-chalk-100")}>
          {t(`nav.${cle}.label`)}
        </span>
        <span className="block text-xs text-chalk-400">{t(`nav.${cle}.desc`)}</span>
      </span>
    </Link>
  );
}

export function MenuBureau() {
  const t = useT();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const conteneur = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(null);
    const surClic = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(null);
    };
    document.addEventListener("keydown", surTouche);
    document.addEventListener("mousedown", surClic);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("mousedown", surClic);
    };
  }, [ouvert]);

  return (
    <nav ref={conteneur} aria-label={t("nav.main")} className="hidden items-center gap-0.5 lg:flex">
      {GROUPES.map((g) => (
        <Deroulant
          key={g.cle}
          groupe={g}
          ouvert={ouvert === g.cle}
          onOuvrir={() => setOuvert(g.cle)}
          onFermer={() => setOuvert((o) => (o === g.cle ? null : o))}
        />
      ))}
    </nav>
  );
}

// Reexportees pour le menu mobile.
export { ACTUALITE, BASE, GROUPES };
export type { Entree, Groupe, Noeud };

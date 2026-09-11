"use client";

import { useId, useState } from "react";
import Link from "@/components/lien";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";
import { estActif, GROUPES, LienMenu, libelleNoeud, type Entree, type Groupe, type Noeud } from "./menu-bureau";

/**
 * Menu de navigation en petite largeur : les memes cinq familles que le
 * bureau, en sections repliables ; les entrees a sous-pages se deplient en
 * accordeon plutot qu'en panneau lateral, que l'ecran n'a pas la place
 * d'afficher.
 */

function Section({
  groupe,
  chemin,
  ouverte,
  onBasculer,
  onNaviguer,
}: {
  groupe: Groupe;
  chemin: string;
  ouverte: boolean;
  onBasculer: () => void;
  onNaviguer: () => void;
}) {
  const t = useT();
  const id = useId();
  const { icone: Icone } = groupe;
  return (
    <div className="border-b border-night-800 last:border-b-0">
      <button
        type="button"
        aria-expanded={ouverte}
        aria-controls={id}
        onClick={onBasculer}
        className="flex w-full items-center gap-2 px-2 py-3 text-left text-sm font-semibold text-chalk-100"
      >
        <Icone size={17} aria-hidden className="text-gold-400" />
        <span className="flex-1">{t(`nav.groupes.${groupe.cle}`)}</span>
        <ChevronDown size={16} aria-hidden className={cn("text-chalk-500 transition-transform", ouverte && "rotate-180")} />
      </button>
      <ul id={id} hidden={!ouverte} className="pb-2">
        {groupe.noeuds.map((n) => (
          <li key={n.href ?? n.cle}>
            {n.enfants ? (
              <NoeudMobile noeud={n} chemin={chemin} onNaviguer={onNaviguer} />
            ) : (
              <LienMenu entree={n as Entree} actif={estActif(chemin, n.href!)} onClick={onNaviguer} className="items-center" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Entree a sous-pages : sa page quand elle en a une, et la liste depliable des sous-pages. */
function NoeudMobile({ noeud, chemin, onNaviguer }: { noeud: Noeud; chemin: string; onNaviguer: () => void }) {
  const t = useT();
  const id = useId();
  const [ouvert, setOuvert] = useState(() => (noeud.enfants ?? []).some((e) => e.href && chemin.endsWith(e.href)));
  const nom = libelleNoeud(t, noeud);
  const Icone = noeud.icone;

  const tete = (
    <>
      {Icone && (
        <span className="bevel-sm grid size-9 shrink-0 place-items-center bg-night-800 text-chalk-300">
          <Icone size={17} aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-chalk-100">{nom}</span>
        {noeud.cle && <span className="block text-xs text-chalk-400">{t(`nav.${noeud.cle}.desc`)}</span>}
      </span>
    </>
  );

  return (
    <div>
      <div className="flex items-stretch">
        {noeud.href ? (
          <Link href={noeud.href} onClick={onNaviguer} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2.5">
            {tete}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2.5 text-left"
          >
            {tete}
          </button>
        )}
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={id}
          aria-label={t("nav.sousMenu", { nom })}
          onClick={() => setOuvert((o) => !o)}
          className="grid w-11 shrink-0 place-items-center text-chalk-500"
        >
          <ChevronDown size={16} aria-hidden className={cn("transition-transform", ouvert && "rotate-180")} />
        </button>
      </div>
      <ul id={id} hidden={!ouvert} className="mb-1 ml-8 border-l border-night-700 pl-3">
        {noeud.enfants!.map((e) => {
          const actif = e.href ? chemin.endsWith(e.href) : false;
          return (
            <li key={e.href}>
              <Link
                href={e.href!}
                onClick={onNaviguer}
                aria-current={actif ? "page" : undefined}
                className={cn("block rounded-md px-3 py-2 text-sm", actif ? "text-gold-400" : "text-chalk-300")}
              >
                {libelleNoeud(t, e)}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MenuMobile() {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();
  // La famille de la page courante s'ouvre d'elle-meme.
  const [section, setSection] = useState<string | null>(null);
  const courante = GROUPES.find((g) =>
    g.noeuds.some((n) => (n.href && estActif(chemin, n.href)) || (n.enfants ?? []).some((e) => e.href && estActif(chemin, e.href))),
  )?.cle;
  const ouverte = section ?? courante ?? GROUPES[0].cle;

  const fermer = () => setOuvert(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        aria-label={ouvert ? t("nav.fermer") : t("nav.ouvrir")}
        className="grid size-9 place-items-center text-chalk-300 transition-colors hover:text-gold-400"
      >
        {ouvert ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>

      <div
        hidden={!ouvert}
        onClick={fermer}
        className="fixed inset-0 top-16 z-30 bg-night-950/60 backdrop-blur-sm"
        aria-hidden
      />

      <nav
        id="menu-mobile"
        aria-label={t("nav.principal")}
        hidden={!ouvert}
        className="absolute inset-x-0 top-16 z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-night-700 bg-night-950 px-3 pb-4 shadow-2xl shadow-night-950/60"
      >
        {GROUPES.map((g) => (
          <Section
            key={g.cle}
            groupe={g}
            chemin={chemin}
            ouverte={ouverte === g.cle}
            onBasculer={() => setSection(ouverte === g.cle ? "" : g.cle)}
            onNaviguer={fermer}
          />
        ))}
      </nav>
    </div>
  );
}

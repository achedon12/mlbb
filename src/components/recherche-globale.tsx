"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Link from "@/components/lien";
import type { Langue } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import { prefixer } from "@/i18n/liens";
import { ORDRE_TYPES, type EntreeRecherche } from "@/lib/recherche";
import { cleRecherche, cn } from "@/lib/utils";

/**
 * Recherche globale : heros, objets, competences, skins, notes de patch et
 * rubriques, depuis n'importe quelle page. Ctrl+K (Cmd+K sur Mac) l'ouvre et la ferme. L'index
 * est un fichier statique par langue, demande a la premiere ouverture
 * seulement : il ne pese rien tant qu'on ne cherche pas.
 */
const INDEX = new Map<Langue, Promise<EntreeRecherche[]>>();

function charger(langue: Langue): Promise<EntreeRecherche[]> {
  let promesse = INDEX.get(langue);
  if (!promesse) {
    promesse = fetch(`/${langue}/recherche.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    INDEX.set(langue, promesse);
  }
  return promesse;
}

/** Resultats affiches par groupe. */
const PAR_GROUPE = 6;

export function RechercheGlobale() {
  const t = useT();
  const langue = useLangue();
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [actif, setActif] = useState(0);
  const [entrees, setEntrees] = useState<EntreeRecherche[] | null>(null);
  const liste = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuvert((o) => !o);
      } else if (e.key === "Escape") {
        setOuvert(false);
      }
    };
    window.addEventListener("keydown", raccourci);
    return () => window.removeEventListener("keydown", raccourci);
  }, []);

  useEffect(() => {
    if (!ouvert || entrees) return;
    let annule = false;
    charger(langue).then((e) => {
      if (!annule) setEntrees(e);
    });
    return () => {
      annule = true;
    };
  }, [ouvert, entrees, langue]);

  // Sans recherche, les rubriques ; sinon les correspondances, celles qui
  // commencent par le terme d'abord.
  const groupes = useMemo(() => {
    if (!entrees) return [];
    const terme = cleRecherche(recherche.trim());
    const trouves = entrees.flatMap((e) => {
      if (!terme) return e.type === "page" ? [{ e, score: 0 }] : [];
      const titre = cleRecherche(e.titre);
      const score = titre.startsWith(terme)
        ? 0
        : titre.includes(terme)
          ? 1
          : e.detail && cleRecherche(e.detail).includes(terme)
            ? 2
            : -1;
      return score < 0 ? [] : [{ e, score }];
    });
    return ORDRE_TYPES.map((type) => ({
      type,
      entrees: trouves
        .filter((x) => x.e.type === type)
        .sort((a, b) => a.score - b.score || a.e.titre.localeCompare(b.e.titre))
        .slice(0, PAR_GROUPE)
        .map((x) => x.e),
    })).filter((g) => g.entrees.length > 0);
  }, [entrees, recherche]);
  const plats = useMemo(() => groupes.flatMap((g) => g.entrees), [groupes]);
  // Skins et competences arrivent sans image : elles prennent l'icone de leur
  // heros, dont l'entree porte l'adresse de la fiche sans ancre.
  const icones = useMemo(
    () => new Map((entrees ?? []).flatMap((e) => (e.type === "heros" && e.image ? [[e.href, e.image]] : []))),
    [entrees],
  );
  const imageDe = (e: EntreeRecherche) => e.image ?? icones.get(e.href.split("#")[0]) ?? null;

  useEffect(() => {
    liste.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  const fermer = () => {
    setOuvert(false);
    setRecherche("");
    setActif(0);
  };

  /**
   * Un resultat qui vise un onglet de la page ouverte (« #skins ») ne change
   * que l'ancre : le routeur ne declencherait pas `hashchange`, que la fiche
   * ecoute pour ouvrir l'onglet. Le navigateur s'en charge alors — en videant
   * d'abord l'ancre si c'est deja la bonne, pour que l'evenement parte.
   * Renvoie vrai si la navigation est faite.
   */
  const ancreLocale = (href: string) => {
    const [chemin, ancre] = prefixer(href, langue).split("#");
    if (ancre === undefined || chemin !== window.location.pathname) return false;
    if (window.location.hash === `#${ancre}`) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    window.location.hash = ancre;
    return true;
  };

  const clavier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((a) => Math.min(a + 1, plats.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && plats[actif]) {
      e.preventDefault();
      const cible = plats[actif];
      fermer();
      if (!ancreLocale(cible.href)) router.push(prefixer(cible.href, langue));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={t("recherche.ouvrir")}
        aria-keyshortcuts="Control+K Meta+K"
        className="bevel-sm flex items-center gap-2 border border-night-700 px-2 py-1.5 text-sm sm:px-2.5 text-chalk-400 transition-colors hover:border-gold-500/60 hover:text-gold-400"
      >
        <Search size={16} aria-hidden />
        <span className="hidden xl:inline">{t("recherche.ouvrir")}</span>
        <kbd className="hidden rounded border border-night-600 px-1 text-[0.7rem] text-chalk-500 xl:inline">Ctrl K</kbd>
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-night-950/80 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={fermer}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("recherche.ouvrir")}
            className="bevel flex max-h-[75vh] w-full max-w-xl flex-col border border-night-700 bg-night-900 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-night-800 px-4">
              <Search size={18} aria-hidden className="shrink-0 text-chalk-500" />
              <input
                autoFocus
                role="combobox"
                aria-expanded
                aria-controls={`${id}-liste`}
                aria-activedescendant={plats[actif] ? `${id}-${actif}` : undefined}
                aria-label={t("recherche.placeholder")}
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setActif(0);
                }}
                onKeyDown={clavier}
                placeholder={t("recherche.placeholder")}
                className="min-w-0 flex-1 bg-transparent py-3.5 text-chalk-100 outline-none placeholder:text-chalk-500"
              />
              <kbd className="hidden rounded border border-night-600 px-1.5 text-[0.7rem] text-chalk-500 sm:inline">Esc</kbd>
            </div>

            <div ref={liste} id={`${id}-liste`} role="listbox" className="overflow-y-auto p-2">
              {!entrees ? (
                <p className="px-3 py-6 text-center text-sm text-chalk-500">{t("recherche.chargement")}</p>
              ) : plats.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-chalk-500">{t("recherche.aucun")}</p>
              ) : (
                groupes.map((g) => (
                  <div key={g.type} className="mb-2">
                    <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.18em] text-chalk-500">
                      {t(`recherche.groupes.${g.type}`)}
                    </p>
                    {g.entrees.map((e) => {
                      const i = plats.indexOf(e);
                      const image = imageDe(e);
                      return (
                        <Link
                          key={`${e.type}-${e.href}-${e.titre}`}
                          id={`${id}-${i}`}
                          data-index={i}
                          role="option"
                          aria-selected={i === actif}
                          href={e.href}
                          onClick={(clic) => {
                            if (ancreLocale(e.href)) clic.preventDefault();
                            fermer();
                          }}
                          onMouseEnter={() => setActif(i)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2",
                            i === actif ? "bg-night-800 text-gold-400" : "text-chalk-200",
                          )}
                        >
                          <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded bg-night-800 text-xs font-bold text-chalk-500">
                            {image ? (
                              <Image src={image} alt="" width={32} height={32} className="size-full object-cover" />
                            ) : (
                              e.titre.charAt(0)
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.titre}</span>
                            {e.detail && <span className="block truncate text-xs text-chalk-500">{e.detail}</span>}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <p className="border-t border-night-800 px-4 py-2 text-xs text-chalk-500">{t("recherche.aide")}</p>
          </div>
        </div>
      )}
    </>
  );
}

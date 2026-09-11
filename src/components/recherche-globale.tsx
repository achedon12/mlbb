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
 * Recherche globale : heros, objets, notes de patch et rubriques, depuis
 * n'importe quelle page. Ctrl+K (Cmd+K sur Mac) l'ouvre et la ferme. L'index
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

  useEffect(() => {
    liste.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  const fermer = () => {
    setOuvert(false);
    setRecherche("");
    setActif(0);
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
      router.push(prefixer(cible.href, langue));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={t("recherche.ouvrir")}
        aria-keyshortcuts="Control+K Meta+K"
        className="biseau-sm flex items-center gap-2 border border-nuit-700 px-2.5 py-1.5 text-sm text-craie-400 transition-colors hover:border-or-500/60 hover:text-or-400"
      >
        <Search size={16} aria-hidden />
        <span className="hidden xl:inline">{t("recherche.ouvrir")}</span>
        <kbd className="hidden rounded border border-nuit-600 px-1 text-[0.7rem] text-craie-500 xl:inline">Ctrl K</kbd>
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-nuit-950/80 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={fermer}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("recherche.ouvrir")}
            className="biseau flex max-h-[75vh] w-full max-w-xl flex-col border border-nuit-700 bg-nuit-900 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-nuit-800 px-4">
              <Search size={18} aria-hidden className="shrink-0 text-craie-500" />
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
                className="min-w-0 flex-1 bg-transparent py-3.5 text-craie-100 outline-none placeholder:text-craie-500"
              />
              <kbd className="hidden rounded border border-nuit-600 px-1.5 text-[0.7rem] text-craie-500 sm:inline">Esc</kbd>
            </div>

            <div ref={liste} id={`${id}-liste`} role="listbox" className="overflow-y-auto p-2">
              {!entrees ? (
                <p className="px-3 py-6 text-center text-sm text-craie-500">{t("recherche.chargement")}</p>
              ) : plats.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-craie-500">{t("recherche.aucun")}</p>
              ) : (
                groupes.map((g) => (
                  <div key={g.type} className="mb-2">
                    <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.18em] text-craie-500">
                      {t(`recherche.groupes.${g.type}`)}
                    </p>
                    {g.entrees.map((e) => {
                      const i = plats.indexOf(e);
                      return (
                        <Link
                          key={`${e.type}-${e.href}-${e.titre}`}
                          id={`${id}-${i}`}
                          data-index={i}
                          role="option"
                          aria-selected={i === actif}
                          href={e.href}
                          onClick={fermer}
                          onMouseEnter={() => setActif(i)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2",
                            i === actif ? "bg-nuit-800 text-or-400" : "text-craie-200",
                          )}
                        >
                          <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded bg-nuit-800 text-xs font-bold text-craie-500">
                            {e.image ? (
                              <Image src={e.image} alt="" width={32} height={32} className="size-full object-cover" />
                            ) : (
                              e.titre.charAt(0)
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.titre}</span>
                            {e.detail && <span className="block truncate text-xs text-craie-500">{e.detail}</span>}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <p className="border-t border-nuit-800 px-4 py-2 text-xs text-craie-500">{t("recherche.aide")}</p>
          </div>
        </div>
      )}
    </>
  );
}

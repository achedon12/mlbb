"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { prefix } from "@/i18n/links";
import { ORDER_TYPES, type EntrySearch } from "@/lib/search";
import { keySearch, cn } from "@/lib/utils";

/**
 * Recherche globale : heros, objets, competences, skins, notes de patch et
 * rubriques, depuis n'importe quelle page. Ctrl+K (Cmd+K sur Mac) l'ouvre et la ferme. L'index
 * est un fichier statique par langue, demande a la premiere ouverture
 * seulement : il ne pese rien tant qu'on ne cherche pas.
 */
const INDEX = new Map<Locale, Promise<EntrySearch[]>>();

function load(locale: Locale): Promise<EntrySearch[]> {
  let promise = INDEX.get(locale);
  if (!promise) {
    promise = fetch(`/${locale}/search.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    INDEX.set(locale, promise);
  }
  return promise;
}

/** Resultats affiches par groupe. */
const BY_GROUP = 6;

export function GlobalSearch() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const [entries, setEntries] = useState<EntrySearch[] | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (!open || entries) return;
    let cancelled = false;
    load(locale).then((e) => {
      if (!cancelled) setEntries(e);
    });
    return () => {
      cancelled = true;
    };
  }, [open, entries, locale]);

  // Sans recherche, les rubriques ; sinon les correspondances, celles qui
  // commencent par le terme d'abord.
  const groups = useMemo(() => {
    if (!entries) return [];
    const term = keySearch(search.trim());
    const found = entries.flatMap((e) => {
      if (!term) return e.type === "page" ? [{ e, score: 0 }] : [];
      const title = keySearch(e.title);
      const score = title.startsWith(term)
        ? 0
        : title.includes(term)
          ? 1
          : e.detail && keySearch(e.detail).includes(term)
            ? 2
            : -1;
      return score < 0 ? [] : [{ e, score }];
    });
    return ORDER_TYPES.map((type) => ({
      type,
      entries: found
        .filter((x) => x.e.type === type)
        .sort((a, b) => a.score - b.score || a.e.title.localeCompare(b.e.title))
        .slice(0, BY_GROUP)
        .map((x) => x.e),
    })).filter((g) => g.entries.length > 0);
  }, [entries, search]);
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  // Skins et competences arrivent sans image : elles prennent l'icone de leur
  // heros, dont l'entree porte l'adresse de la fiche sans ancre.
  const icons = useMemo(
    () => new Map((entries ?? []).flatMap((e) => (e.type === "hero" && e.image ? [[e.href, e.image]] : []))),
    [entries],
  );
  const imageOf = (e: EntrySearch) => e.image ?? icons.get(e.href.split("#")[0]) ?? null;

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    setOpen(false);
    setSearch("");
    setActive(0);
  };

  /**
   * Un resultat qui vise un onglet de la page ouverte (« #skins ») ne change
   * que l'ancre : le routeur ne declencherait pas `hashchange`, que la fiche
   * ecoute pour ouvrir l'onglet. Le navigateur s'en charge alors — en videant
   * d'abord l'ancre si c'est deja la bonne, pour que l'evenement parte.
   * Renvoie vrai si la navigation est faite.
   */
  const anchorLocale = (href: string) => {
    const [path, anchor] = prefix(href, locale).split("#");
    if (anchor === undefined || path !== window.location.pathname) return false;
    if (window.location.hash === `#${anchor}`) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    window.location.hash = anchor;
    return true;
  };

  const keyboard = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      const target = flat[active];
      close();
      if (!anchorLocale(target.href)) router.push(prefix(target.href, locale));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("search.open")}
        aria-keyshortcuts="Control+K Meta+K"
        className="bevel-sm flex items-center gap-2 border border-night-700 px-2 py-1.5 text-sm sm:px-2.5 text-chalk-400 transition-colors hover:border-gold-500/60 hover:text-gold-400"
      >
        <Search size={16} aria-hidden />
        <span className="hidden xl:inline">{t("search.open")}</span>
        <kbd className="hidden rounded border border-night-600 px-1 text-[0.7rem] text-chalk-500 xl:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-night-950/80 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("search.open")}
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
                aria-activedescendant={flat[active] ? `${id}-${active}` : undefined}
                aria-label={t("search.placeholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActive(0);
                }}
                onKeyDown={keyboard}
                placeholder={t("search.placeholder")}
                className="min-w-0 flex-1 bg-transparent py-3.5 text-chalk-100 outline-none placeholder:text-chalk-500"
              />
              <kbd className="hidden rounded border border-night-600 px-1.5 text-[0.7rem] text-chalk-500 sm:inline">Esc</kbd>
            </div>

            <div ref={list} id={`${id}-liste`} role="listbox" className="overflow-y-auto p-2">
              {!entries ? (
                <p className="px-3 py-6 text-center text-sm text-chalk-500">{t("search.loading")}</p>
              ) : flat.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-chalk-500">{t("search.none")}</p>
              ) : (
                groups.map((g) => (
                  <div key={g.type} className="mb-2">
                    <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.18em] text-chalk-500">
                      {t(`search.groups.${g.type}`)}
                    </p>
                    {g.entries.map((e) => {
                      const i = flat.indexOf(e);
                      const image = imageOf(e);
                      return (
                        <Link
                          key={`${e.type}-${e.href}-${e.title}`}
                          id={`${id}-${i}`}
                          data-index={i}
                          role="option"
                          aria-selected={i === active}
                          href={e.href}
                          onClick={(click) => {
                            if (anchorLocale(e.href)) click.preventDefault();
                            close();
                          }}
                          onMouseEnter={() => setActive(i)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2",
                            i === active ? "bg-night-800 text-gold-400" : "text-chalk-200",
                          )}
                        >
                          <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded bg-night-800 text-xs font-bold text-chalk-500">
                            {image ? (
                              <Image src={image} alt="" width={32} height={32} className="size-full object-cover" />
                            ) : (
                              e.title.charAt(0)
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.title}</span>
                            {e.detail && <span className="block truncate text-xs text-chalk-500">{e.detail}</span>}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <p className="border-t border-night-800 px-4 py-2 text-xs text-chalk-500">{t("search.help")}</p>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Download,
  Link2,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { SearchField } from "@/components/search-field";
import { HeroPortrait } from "@/components/hero-portrait";
import { FilterGroup, Chip } from "@/components/chip";
import { ChoiceRank } from "@/components/rank-picker";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import {
  addRow,
  colorText,
  shift,
  decodeTier,
  moveRow,
  deserialize,
  encodeTier,
  stateDefault,
  MAX_ROWS,
  editRow,
  NAME_MAX,
  PALETTE,
  place,
  prefill,
  rowOf,
  serialize,
  deleteRow,
  TITLE_MAX,
  clearRows,
  type StateTier,
  type Row,
} from "@/lib/tier-maker";
import { LANES, ROLES } from "@/lib/draft";
import { exportImage } from "@/lib/tier-image";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { site } from "@/lib/site";
import type { Lane, Role } from "@/lib/types";
import { keySearch, cn } from "@/lib/utils";

/**
 * Tier list maker.
 *
 * Three ways to place a hero, for every screen and every hand:
 *
 * - mouse drag and drop, onto a row or in front of a hero;
 * - tap a hero, then its row — or a tier in the bar that appears at the
 *   bottom of the screen, without scrolling back up on mobile;
 * - keyboard: Enter selects, digits 1 to 9 drop into the matching row,
 *   0 sends back to the bench, arrow keys move around.
 *
 * Every action is announced to screen readers. The list is kept in the
 * browser, shared through a link (`?l=`, see `lib/tier-maker`) and
 * exported as PNG.
 */

export interface TierHero {
  slug: string;
  name: string;
  icon: string | null;
  roles: Role[];
  lanes: Lane[];
}

const KEY_LIST = "mlbb_tier_liste";
const KEY_PREVIOUS = "mlbb_tier_precedente";

function readList(key: string, known: Set<string>): StateTier | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? deserialize(raw, known) : null;
  } catch {
    return null;
  }
}

function writeList(key: string, state: StateTier | null) {
  try {
    if (state) localStorage.setItem(key, serialize(state));
    else localStorage.removeItem(key);
  } catch {
    /* storage denied: the list lives for the duration of the visit */
  }
}

const button =
  "bevel-sm inline-flex items-center justify-center gap-1.5 border border-night-600 px-3 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400 disabled:opacity-40";
const smallButton =
  "bevel-sm grid size-9 shrink-0 place-items-center border border-night-700 text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400 disabled:opacity-30";

export function TierListMaker({
  heroes,
  groups,
  ranks,
}: {
  heroes: TierHero[];
  /** Per rank, the hero indices of each tier in our tier list (S+ to C). */
  groups: Partial<Record<MeasuredRank, number[][]>>;
  ranks: MeasuredRank[];
}) {
  const t = useT();
  const locale = useLocale();
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const known = useMemo(() => new Set(heroes.map((h) => h.slug)), [heroes]);

  const [state, setState] = useState<StateTier>(() => stateDefault());
  const [load, setLoad] = useState(false);
  const [previous, setPrevious] = useState<StateTier | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [rank, setRank] = useState<MeasuredRank>(ranks[0] ?? "all");
  const [announcement, setAnnouncement] = useState("");
  const [status, setStatus] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<string | null>(null);

  // After mount: a shared list (?l=) takes precedence over the saved list,
  // which stays recoverable in one click.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("l");
    const kept = readList(KEY_LIST, known);
    if (!code) {
      /* eslint-disable react-hooks/set-state-in-effect -- storage read after mount */
      if (kept) setState(kept);
      setPrevious(readList(KEY_PREVIOUS, known));
      setLoad(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let active = true;
    decodeTier(code, known).then((shared) => {
      if (!active) return;
      if (shared) {
        const had = kept && kept.rows.some((r) => r.heroes.length);
        if (had) {
          writeList(KEY_PREVIOUS, kept);
          setPrevious(kept);
        }
        setState(shared);
        setAnnouncement(t("pages.tierMakerUI.sharedLoaded"));
      } else if (kept) {
        setState(kept);
      }
      setLoad(true);
      // The URL goes back to the tool's own: reloading keeps the edited list.
      window.history.replaceState(null, "", window.location.pathname);
    });
    return () => {
      active = false;
    };
  }, [known, t]);

  useEffect(() => {
    if (load) writeList(KEY_LIST, state);
  }, [state, load]);

  // With the keyboard, the moved hero keeps focus in its new row.
  useEffect(() => {
    const slug = focusAfter.current;
    if (!slug) return;
    focusAfter.current = null;
    root.current?.querySelector<HTMLButtonElement>(`[data-hero="${slug}"]`)?.focus();
  }, [state]);

  const places = useMemo(() => new Set(state.rows.flatMap((r) => r.heroes)), [state]);
  const reserved = useMemo(() => {
    const term = keySearch(search.trim());
    return heroes
      .filter((h) => !places.has(h.slug))
      .filter((h) => !role || h.roles.includes(role))
      .filter((h) => !lane || h.lanes.includes(lane))
      .filter((h) => !term || keySearch(h.name).includes(term));
  }, [heroes, places, role, lane, search]);

  const name = (slug: string) => bySlug.get(slug)?.name ?? slug;
  const nameRow = (r: Row | undefined) => r?.name || "—";

  function set(slug: string, target: string | null, before?: string | null, keyboard = false) {
    const next = place(state, slug, target, before);
    if (keyboard) focusAfter.current = slug;
    setState(next);
    setSelection(null);
    const r = target ? next.rows.find((x) => x.id === target) : undefined;
    setAnnouncement(
      r
        ? t("pages.tierMakerUI.announcePlaced", {
            name: name(slug),
            row: nameRow(r),
            position: r.heroes.indexOf(slug) + 1,
            n: r.heroes.length,
          })
        : t("pages.tierMakerUI.announceBench", { name: name(slug) }),
    );
  }

  function toggleSelection(slug: string) {
    if (selection === slug) {
      setSelection(null);
      setAnnouncement(t("pages.tierMakerUI.announceDeselect"));
    } else {
      setSelection(slug);
      setAnnouncement(t("pages.tierMakerUI.announceSelect", { name: name(slug) }));
    }
  }

  function shiftSelection(delta: number, keyboard: boolean) {
    if (!selection) return;
    const next = shift(state, selection, delta);
    const r = rowOf(next, selection);
    if (keyboard) focusAfter.current = selection;
    setState(next);
    if (r) {
      setAnnouncement(
        t("pages.tierMakerUI.announceMoved", {
          name: name(selection),
          position: r.heroes.indexOf(selection) + 1,
          n: r.heroes.length,
        }),
      );
    }
  }

  function keysHero(e: React.KeyboardEvent<HTMLButtonElement>, slug: string) {
    if (/^[1-9]$/.test(e.key)) {
      const r = state.rows[Number(e.key) - 1];
      if (r) {
        e.preventDefault();
        set(slug, r.id, null, true);
      }
    } else if (e.key === "0" || e.key === "Delete" || e.key === "Backspace") {
      if (places.has(slug)) {
        e.preventDefault();
        set(slug, null, null, true);
      }
    } else if (e.key === "Escape") {
      setSelection(null);
    }
  }

  /** Arrows, Home and End: from one hero to the next within the same group. */
  function navigate(e: React.KeyboardEvent<HTMLElement>) {
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-hero]")];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const step: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 };
    const j = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : step[e.key];
    if (j === undefined) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(j, buttons.length - 1))]?.focus();
  }

  function drop(e: React.DragEvent<HTMLElement>, target: string | null) {
    e.preventDefault();
    setHover(null);
    const slug = e.dataTransfer.getData("text/plain");
    if (!known.has(slug)) return;
    const before = (e.target as Element).closest("[data-hero]")?.getAttribute("data-hero");
    set(slug, target, before && before !== slug ? before : null);
  }

  function confirm(message: string): boolean {
    return places.size === 0 || window.confirm(message);
  }

  function loadMeta() {
    const list = groups[rank];
    if (!list || !confirm(t("pages.tierMakerUI.confirmReplace"))) return;
    const labelRank = t(`measuredRanks.${rank}`);
    setState(prefill(heroes.map((h) => h.slug), list, t("pages.tierMakerUI.titleMeta", { rank: labelRank })));
    setSelection(null);
    setEdition(null);
    setAnnouncement(t("pages.tierMakerUI.announceMeta", { rank: labelRank }));
  }

  function clear() {
    if (!confirm(t("pages.tierMakerUI.confirmEmpty"))) return;
    setState(clearRows(state));
    setSelection(null);
    setAnnouncement(t("pages.tierMakerUI.announceEmpty"));
  }

  function reset() {
    if (!confirm(t("pages.tierMakerUI.confirmReset"))) return;
    setState(stateDefault());
    setSelection(null);
    setEdition(null);
    setAnnouncement(t("pages.tierMakerUI.announceReset"));
  }

  function restore() {
    if (!previous) return;
    setState(previous);
    setPrevious(null);
    writeList(KEY_PREVIOUS, null);
    setAnnouncement(t("pages.tierMakerUI.announceRestored"));
  }

  function add() {
    const next = addRow(state, `n${Date.now().toString(36)}`, t("pages.tierMakerUI.newRow"));
    setState(next);
    setEdition(next.rows.at(-1)?.id ?? null);
    setAnnouncement(t("pages.tierMakerUI.announceRowAdded"));
  }

  function handleDelete(r: Row) {
    setState(deleteRow(state, r.id));
    setEdition(null);
    setAnnouncement(t("pages.tierMakerUI.announceRowRemoved", { name: nameRow(r) }));
  }

  const titleImage = state.title.trim() || t("pages.tierMakerUI.titleDefault");
  const touch = () => window.matchMedia("(pointer: coarse)").matches;

  async function download() {
    setStatus(t("pages.tierMakerUI.exporting"));
    try {
      const date = new Intl.DateTimeFormat(LOCALE_HTML[locale], { dateStyle: "long" }).format(new Date());
      const blob = await exportImage(state, {
        title: titleImage,
        footer: `${new URL(site.url).host} · ${date}`,
        heroes: bySlug,
      });
      const file = `${keySearch(titleImage).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tier-list-mlbb"}.png`;
      const piece = new File([blob], file, { type: "image/png" });
      if (touch() && navigator.canShare?.({ files: [piece] })) {
        try {
          await navigator.share({ files: [piece], title: titleImage });
          setStatus(t("pages.tierMakerUI.exportShare"));
          return;
        } catch (e) {
          if ((e as DOMException).name === "AbortError") {
            setStatus("");
            return;
          }
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus(t("pages.tierMakerUI.exportDone"));
    } catch {
      setStatus(t("pages.tierMakerUI.exportError"));
    }
  }

  async function shareLink() {
    const url = `${window.location.origin}${window.location.pathname}?l=${await encodeTier(state)}`;
    if (touch() && typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title: titleImage });
        setStatus(t("pages.tierMakerUI.linkShared"));
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus(t("pages.tierMakerUI.linkCopied"));
    } catch {
      setStatus(t("pages.tierMakerUI.linkError"));
    }
  }

  const chosen = selection ? bySlug.get(selection) : undefined;
  const rowChosen = selection ? rowOf(state, selection) : undefined;

  function tile(h: TierHero, tabIndex: number, withName: boolean) {
    const active = selection === h.slug;
    return (
      <button
        type="button"
        data-hero={h.slug}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", h.slug);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setHover(null)}
        onClick={() => toggleSelection(h.slug)}
        onKeyDown={(e) => keysHero(e, h.slug)}
        aria-pressed={active}
        tabIndex={tabIndex}
        title={h.name}
        className={cn(
          "bevel-sm flex flex-col items-center gap-0.5 p-0.5 outline-offset-1 transition-transform motion-reduce:transition-none",
          active ? "scale-105 bg-gold-500 motion-reduce:scale-100" : "hover:bg-night-800",
        )}
      >
        {/* The image, draggable by default, would steal the gesture from the button. */}
        <HeroPortrait source={h.icon} name={h.name} size="icon" decorative className="pointer-events-none" />
        {withName ? (
          <span className={cn("w-12 truncate text-center text-[0.6rem]", active ? "text-night-950" : "text-chalk-400")}>
            {h.name}
          </span>
        ) : (
          <span className="sr-only">{h.name}</span>
        )}
      </button>
    );
  }

  return (
    <div ref={root} className={cn("space-y-6", selection && "pb-36 sm:pb-24")}>
      {previous && (
        <div className="bevel-sm flex flex-wrap items-center justify-between gap-3 border border-azure-500/50 bg-azure-500/10 px-4 py-3 text-sm text-chalk-200">
          <span>{t("pages.tierMakerUI.sharedBanner")}</span>
          <span className="flex gap-2">
            <button type="button" onClick={restore} className={button}>
              <Undo2 size={15} aria-hidden />
              {t("pages.tierMakerUI.backToMyList")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPrevious(null);
                writeList(KEY_PREVIOUS, null);
              }}
              aria-label={t("pages.tierMakerUI.close")}
              className={smallButton}
            >
              <X size={15} aria-hidden />
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex-1">
          <span className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.tierMakerUI.titleList")}</span>
          <input
            type="text"
            value={state.title}
            maxLength={TITLE_MAX}
            placeholder={t("pages.tierMakerUI.titleDefault")}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            className="bevel-sm mt-1 w-full border border-night-700 bg-night-950 px-3 py-2 font-heading text-lg font-bold text-chalk-100 outline-none transition-colors placeholder:text-chalk-600 focus:border-gold-500"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} className={button}>
            <Download size={15} aria-hidden />
            {t("pages.tierMakerUI.export")}
          </button>
          <button type="button" onClick={shareLink} className={button}>
            <Link2 size={15} aria-hidden />
            {t("pages.tierMakerUI.shareLink")}
          </button>
          <button type="button" onClick={clear} className={button}>
            <RotateCcw size={15} aria-hidden />
            {t("pages.tierMakerUI.empty")}
          </button>
          <button type="button" onClick={reset} className={button}>
            <Trash2 size={15} aria-hidden />
            {t("pages.tierMakerUI.reset")}
          </button>
        </div>
      </div>
      <p aria-live="polite" className="-mt-3 min-h-5 text-sm text-chalk-300">
        {status}
      </p>

      <details className="bevel-sm border border-night-700/70 bg-night-900/40 px-4 py-3 text-sm text-chalk-300">
        <summary className="cursor-pointer font-semibold text-chalk-100">
          <Wand2 size={15} aria-hidden className="mr-1.5 inline text-gold-400" />
          {t("pages.tierMakerUI.prefillTitle")}
        </summary>
        <p className="mt-2 leading-relaxed">{t("pages.tierMakerUI.prefillIntro")}</p>
        <ChoiceRank ranks={ranks} rank={rank} onChange={setRank} className="mt-3" />
        <button type="button" onClick={loadMeta} className={cn(button, "mt-3")}>
          <Wand2 size={15} aria-hidden />
          {t("pages.tierMakerUI.prefill", { rank: t(`measuredRanks.${rank}`) })}
        </button>
      </details>

      <section aria-label={t("pages.tierMakerUI.rows")} className="space-y-1">
        {state.rows.map((r, i) => (
          <div key={r.id}>
            <div className="flex min-h-[3.75rem] border border-night-700/70 bg-night-900/60">
              {selection ? (
                <button
                  type="button"
                  onClick={(e) => set(selection, r.id, null, e.detail === 0)}
                  aria-label={t("pages.tierMakerUI.placeHere", { name: name(selection), row: nameRow(r) })}
                  className="grid w-16 shrink-0 place-items-center break-all p-1 text-center font-heading text-lg font-bold ring-inset hover:ring-2 hover:ring-white/70 sm:w-24"
                  style={{ background: r.color, color: colorText(r.color) }}
                >
                  {nameRow(r)}
                </button>
              ) : (
                <div
                  className="grid w-16 shrink-0 place-items-center break-all p-1 text-center font-heading text-lg font-bold sm:w-24"
                  style={{ background: r.color, color: colorText(r.color) }}
                >
                  {nameRow(r)}
                </div>
              )}
              <ul
                aria-label={t("pages.tierMakerUI.rowContent", { name: nameRow(r), n: r.heroes.length, i: i + 1 })}
                onKeyDown={navigate}
                onClick={(e) => {
                  if (selection && e.target === e.currentTarget) set(selection, r.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (hover !== r.id) setHover(r.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(null);
                }}
                onDrop={(e) => drop(e, r.id)}
                className={cn(
                  "flex min-w-0 flex-1 flex-wrap content-start gap-1 p-1 transition-colors",
                  hover === r.id && "bg-gold-500/15",
                  selection && "cursor-pointer hover:bg-night-850",
                )}
              >
                {r.heroes.map((s, k) => {
                  const h = bySlug.get(s);
                  return h ? <li key={s}>{tile(h, k === 0 ? 0 : -1, false)}</li> : null;
                })}
              </ul>
              <button
                type="button"
                onClick={() => setEdition(edition === r.id ? null : r.id)}
                aria-expanded={edition === r.id}
                aria-label={t("pages.tierMakerUI.editRow", { name: nameRow(r) })}
                className="grid w-9 shrink-0 place-items-center border-l border-night-700/70 text-chalk-500 transition-colors hover:text-gold-400"
              >
                <Settings2 size={16} aria-hidden />
              </button>
            </div>
            {edition === r.id && (
              <PanelRow
                row={r}
                first={i === 0}
                last={i === state.rows.length - 1}
                single={state.rows.length <= 1}
                onEdit={(fields) => setState(editRow(state, r.id, fields))}
                onMove={(delta) => setState(moveRow(state, r.id, delta))}
                onDelete={() => handleDelete(r)}
                onClose={() => setEdition(null)}
              />
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          disabled={state.rows.length >= MAX_ROWS}
          className={cn(button, "mt-2 w-full")}
        >
          <Plus size={15} aria-hidden />
          {t("pages.tierMakerUI.addRow")}
        </button>
      </section>

      <section
        aria-labelledby="pool-title"
        onDragOver={(e) => {
          e.preventDefault();
          if (hover !== "reserve") setHover("reserve");
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(null);
        }}
        onDrop={(e) => drop(e, null)}
        className={cn(
          "bevel border border-night-700/70 bg-night-900/40 p-4 transition-colors",
          hover === "reserve" && "border-gold-500/60 bg-gold-500/5",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pool-title" className="font-heading text-xl font-bold text-chalk-100">
            {t("pages.tierMakerUI.bench")}
          </h2>
          <p className="text-xs text-chalk-500">
            {t("pages.tierMakerUI.benchCount", { n: heroes.length - places.size, total: heroes.length })}
          </p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-chalk-500">{t("pages.tierMakerUI.help")}</p>

        <div className="mt-3 space-y-2">
          <SearchField dense value={search} onChange={setSearch} label={t("draftUI.search")} />
          <FilterGroup legend={t("draftUI.roleFilter")} widthLegend="w-16" className="gap-1.5">
            <Chip dense active={role === null} onClick={() => setRole(null)}>
              {t("draftUI.allRoles")}
            </Chip>
            {ROLES.map((r) => (
              <Chip dense key={r} active={role === r} onClick={() => setRole(role === r ? null : r)}>
                {t(`roles.${r}`)}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup legend={t("draftUI.laneFilter")} widthLegend="w-16" className="gap-1.5">
            <Chip dense active={lane === null} onClick={() => setLane(null)}>
              {t("draftUI.allLanes")}
            </Chip>
            {LANES.map((l) => (
              <Chip dense key={l} active={lane === l} onClick={() => setLane(lane === l ? null : l)}>
                {t(`lanes.${l}`)}
              </Chip>
            ))}
          </FilterGroup>
        </div>

        <ul
          aria-label={t("pages.tierMakerUI.bench")}
          onKeyDown={navigate}
          onClick={(e) => {
            if (selection && places.has(selection) && e.target === e.currentTarget) set(selection, null);
          }}
          className="mt-4 flex min-h-16 flex-wrap gap-1"
        >
          {reserved.map((h, k) => (
            <li key={h.slug}>{tile(h, k === 0 ? 0 : -1, true)}</li>
          ))}
          {reserved.length === 0 && (
            <li className="w-full py-4 text-center text-sm text-chalk-500">
              {places.size === heroes.length ? t("pages.tierMakerUI.benchEmpty") : t("draftUI.noHero")}
            </li>
          )}
        </ul>
      </section>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {chosen && selection && (
        <div
          role="region"
          aria-label={t("pages.tierMakerUI.actionBar", { name: chosen.name })}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-500/40 bg-night-900/95 px-3 py-2.5 shadow-2xl shadow-black/60 backdrop-blur-sm"
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <HeroPortrait source={chosen.icon} name={chosen.name} size="small" decorative />
            <span className="mr-1 font-semibold text-chalk-100">{chosen.name}</span>
            <span className="text-xs text-chalk-500">{t("pages.tierMakerUI.placeIn")}</span>
            <span className="flex flex-wrap gap-1">
              {state.rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={(e) => set(selection, r.id, null, e.detail === 0)}
                  aria-current={rowChosen?.id === r.id ? "true" : undefined}
                  aria-label={t("pages.tierMakerUI.placeHere", { name: chosen.name, row: nameRow(r) })}
                  className={cn(
                    "bevel-sm h-9 min-w-9 max-w-24 truncate px-2 text-sm font-bold",
                    rowChosen?.id === r.id && "ring-2 ring-white",
                  )}
                  style={{ background: r.color, color: colorText(r.color) }}
                >
                  {nameRow(r)}
                </button>
              ))}
            </span>
            <span className="ml-auto flex gap-1">
              {rowChosen && (
                <>
                  <button
                    type="button"
                    onClick={(e) => shiftSelection(-1, e.detail === 0)}
                    aria-label={t("pages.tierMakerUI.moveBack")}
                    className={smallButton}
                  >
                    <ArrowLeft size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => shiftSelection(1, e.detail === 0)}
                    aria-label={t("pages.tierMakerUI.moveForward")}
                    className={smallButton}
                  >
                    <ArrowRight size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => set(selection, null, null, e.detail === 0)}
                    className={cn(button, "h-9 py-0")}
                  >
                    {t("pages.tierMakerUI.toBench")}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label={t("pages.tierMakerUI.deselect")}
                className={smallButton}
              >
                <X size={15} aria-hidden />
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Row settings: name, colour, position, deletion. */
function PanelRow({
  row,
  first,
  last,
  single,
  onEdit,
  onMove,
  onDelete,
  onClose,
}: {
  row: Row;
  first: boolean;
  last: boolean;
  single: boolean;
  onEdit: (fields: Partial<Pick<Row, "name" | "color">>) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-end gap-3 border border-t-0 border-night-700/70 bg-night-950/60 p-3">
      <label className="min-w-40 flex-1">
        <span className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.tierMakerUI.rowName")}</span>
        <input
          type="text"
          autoFocus
          value={row.name}
          maxLength={NAME_MAX}
          onChange={(e) => onEdit({ name: e.target.value })}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          className="bevel-sm mt-1 w-full border border-night-700 bg-night-950 px-3 py-1.5 text-chalk-100 outline-none focus:border-gold-500"
        />
      </label>
      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.tierMakerUI.colour")}</legend>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onEdit({ color: c })}
              aria-pressed={row.color === c}
              aria-label={t("pages.tierMakerUI.colourName", { colour: c })}
              className={cn("bevel-sm size-8", row.color === c && "ring-2 ring-white")}
              style={{ background: c }}
            />
          ))}
          <label className="bevel-sm grid size-8 cursor-pointer place-items-center overflow-hidden border border-night-600">
            <span className="sr-only">{t("pages.tierMakerUI.customColour")}</span>
            <input
              type="color"
              value={row.color}
              onChange={(e) => onEdit({ color: e.target.value })}
              className="size-10 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </fieldset>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={first}
          aria-label={t("pages.tierMakerUI.moveUp")}
          className={smallButton}
        >
          <ArrowUp size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={last}
          aria-label={t("pages.tierMakerUI.moveDown")}
          className={smallButton}
        >
          <ArrowDown size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={single}
          aria-label={t("pages.tierMakerUI.deleteRow", { name: row.name || "—" })}
          className={cn(smallButton, "hover:border-blood-500 hover:text-blood-500")}
        >
          <Trash2 size={15} aria-hidden />
        </button>
        <button type="button" onClick={onClose} aria-label={t("pages.tierMakerUI.close")} className={smallButton}>
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}

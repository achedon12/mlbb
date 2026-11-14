"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eraser,
  Link2,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { HeroThumb } from "@/components/hero-picker";
import { MapDrawing } from "@/components/map-drawing";
import { SearchField } from "@/components/search-field";
import { useT } from "@/i18n/provider";
import { trackShare, type ShareMethod } from "@/lib/analytics";
import { site } from "@/lib/site";
import { exportPlanImage } from "@/lib/strategy-image";
import {
  add,
  BOARD,
  cleanText,
  COLORS,
  commit,
  decodePlan,
  EMPTY_PLAN,
  encodePlan,
  historyOf,
  LIMITS,
  MARKERS,
  move,
  readHash,
  recolor,
  redo,
  remove,
  spawnPoint,
  TEAMS,
  undo,
  writeHash,
  type Element,
  type History,
  type MarkerKey,
  type Plan,
  type Point,
  type Team,
} from "@/lib/strategy-plan";
import { cn, keySearch } from "@/lib/utils";

/**
 * Strategy planner: a whiteboard over our schematic map. Heroes of both
 * teams and objective markers are placed from the side panel, then dragged
 * (or moved with the arrow keys); arrows, freehand lines and labels are drawn
 * on the map itself. Everything is one SVG on a 1000 x 1000 board, which the
 * PNG export draws as it is.
 *
 * The plan lives in the address fragment (`#plan=`), rewritten after each
 * change: reloading keeps it, and the address is the link to share. Nothing
 * goes to a server, the fragment is not even sent to ours.
 */

export interface PlannerHero {
  slug: string;
  name: string;
  icon: string | null;
}

export interface PlannerMarker {
  name: string;
  image: string;
}

type Tool = "move" | "pen" | "arrow" | "text";
const TOOLS: { key: Tool; icon: LucideIcon }[] = [
  { key: "move", icon: MousePointer2 },
  { key: "pen", icon: Pencil },
  { key: "arrow", icon: MoveUpRight },
  { key: "text", icon: Type },
];
const COLOR_KEYS = ["gold", "white", "blue", "red", "green", "purple"] as const;
const TEAM_COLOR: Record<Team, string> = { blue: "#4da3ff", red: "#f87171" };

/** Arrow keys move a selected element by this much; with Shift, five times more. */
const STEP = 10;
/** A drag shorter than this is a tap: the element is selected, not moved. */
const TAP = 4;
/** Address rewrite delay after a change: one write for a burst of edits. */
const HASH_DELAY = 400;

const TOKEN = 34;
const button =
  "bevel-sm inline-flex min-h-11 items-center justify-center gap-2 border border-night-700 px-3 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400 disabled:pointer-events-none disabled:opacity-40";
const iconButton = `${button} max-sm:min-w-11 max-sm:px-0`;
const squareButton = `${button} min-w-11 px-0`;
const label = "text-xs uppercase tracking-wide text-chalk-500";

export function StrategyPlanner({ heroes, markers }: { heroes: PlannerHero[]; markers: Record<MarkerKey, PlannerMarker> }) {
  const t = useT();
  const [history, setHistory] = useState<History>(() => historyOf(EMPTY_PLAN));
  /** Plan shown while a drag or a stroke is under way; committed when it ends. */
  const [live, setLive] = useState<Plan | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [color, setColor] = useState(0);
  const [team, setTeam] = useState<Team>("blue");
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [labelText, setLabelText] = useState("");
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const [arrow, setArrow] = useState<{ from: Point; to: Point } | null>(null);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; start: Point; base: Plan; moved: boolean } | null>(null);

  const plan = live ?? history.present;
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const known = useMemo(() => new Set(heroes.map((h) => h.slug)), [heroes]);
  const selectedElement = plan.elements.find((e) => e.id === selected) ?? null;

  // A shared plan in the fragment, read once mounted.
  const read = useRef(false);
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const code = readHash(window.location.hash);
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL after mount
      setLoaded(true);
      return;
    }
    decodePlan(code, known).then((shared) => {
      if (shared) {
        setHistory(historyOf(shared));
        setStatus(t("pages.strategyPlannerUI.sharedLoaded"));
      } else setStatus(t("pages.strategyPlannerUI.sharedInvalid"));
      setLoaded(true);
    });
  }, [known, t]);

  // Every change goes back into the fragment, without a new history entry.
  useEffect(() => {
    if (!loaded) return;
    const plan = history.present;
    const timer = window.setTimeout(async () => {
      const code = plan.elements.length ? await encodePlan(plan) : null;
      const { pathname, search, hash } = window.location;
      window.history.replaceState(window.history.state, "", `${pathname}${search}${writeHash(hash, code)}`);
    }, HASH_DELAY);
    return () => window.clearTimeout(timer);
  }, [history.present, loaded]);

  function apply(next: Plan) {
    setHistory((h) => commit(h, next));
  }

  function nameOf(e: Element): string {
    switch (e.kind) {
      case "hero":
        return t("pages.strategyPlannerUI.element.hero", {
          name: bySlug.get(e.slug)?.name ?? e.slug,
          team: t(`pages.strategyPlannerUI.teams.${e.team}`),
        });
      case "marker":
        return markers[e.marker].name;
      case "text":
        return t("pages.strategyPlannerUI.element.text", { text: e.text });
      case "arrow":
        return t("pages.strategyPlannerUI.element.arrow", { color: t(`pages.strategyPlannerUI.colors.${COLOR_KEYS[e.color]}`) });
      case "line":
        return t("pages.strategyPlannerUI.element.line", { color: t(`pages.strategyPlannerUI.colors.${COLOR_KEYS[e.color]}`) });
    }
  }

  function place(element: Parameters<typeof add>[1]) {
    const { plan: next, id } = add(history.present, element);
    if (id === null) {
      setStatus(t("pages.strategyPlannerUI.full", { n: LIMITS.elements }));
      return null;
    }
    apply(next);
    // A token is selected to be dragged at once; a drawing is not, or the
    // next colour picked for the following stroke would recolour it.
    if (element.kind === "hero" || element.kind === "marker") setSelected(id);
    return id;
  }

  function addHero(slug: string) {
    const existing = history.present.elements.find((e) => e.kind === "hero" && e.slug === slug && e.team === team);
    if (existing) {
      setSelected(existing.id);
      focusElement(existing.id);
      return;
    }
    const count = history.present.elements.filter((e) => e.kind === "hero" && e.team === team).length;
    const [x, y] = spawnPoint(team, count);
    if (place({ kind: "hero", slug, team, x, y }) !== null) {
      setTool("move");
      setStatus(
        t("pages.strategyPlannerUI.placed", {
          name: t("pages.strategyPlannerUI.element.hero", { name: bySlug.get(slug)?.name ?? slug, team: t(`pages.strategyPlannerUI.teams.${team}`) }),
        }),
      );
    }
  }

  function addMarker(marker: MarkerKey) {
    const spot: Record<MarkerKey, Point> = {
      turtle: [290, 290],
      lord: [710, 710],
      "purple-buff": [200, 560],
      "orange-buff": [480, 800],
    };
    const count = history.present.elements.filter((e) => e.kind === "marker" && e.marker === marker).length;
    const [x, y] = spot[marker];
    if (place({ kind: "marker", marker, x: x + count * 30, y: y - count * 30 }) !== null) {
      setTool("move");
      setStatus(t("pages.strategyPlannerUI.placed", { name: markers[marker].name }));
    }
  }

  function addLabel(at: Point) {
    const text = cleanText(labelText);
    if (!text) {
      setStatus(t("pages.strategyPlannerUI.labelFirst"));
      return;
    }
    if (place({ kind: "text", color, x: at[0], y: at[1], text }) !== null) {
      setStatus(t("pages.strategyPlannerUI.placed", { name: t("pages.strategyPlannerUI.element.text", { text }) }));
    }
  }

  function deleteSelected() {
    if (!selectedElement) return;
    apply(remove(history.present, selectedElement.id));
    setStatus(t("pages.strategyPlannerUI.removed", { name: nameOf(selectedElement) }));
    setSelected(null);
  }

  function clearAll() {
    if (!history.present.elements.length) return;
    apply(EMPTY_PLAN);
    setSelected(null);
    setStatus(t("pages.strategyPlannerUI.cleared"));
  }

  function step(direction: "undo" | "redo") {
    setHistory((h) => (direction === "undo" ? undo(h) : redo(h)));
    setSelected(null);
    setStatus(t(`pages.strategyPlannerUI.${direction === "undo" ? "undone" : "redone"}`));
  }

  function chooseColor(c: number) {
    setColor(c);
    if (selectedElement && "color" in selectedElement) apply(recolor(history.present, selectedElement.id, c));
  }

  function focusElement(id: number) {
    requestAnimationFrame(() => svgRef.current?.querySelector<SVGGElement>(`[data-id="${id}"]`)?.focus());
  }

  // -- Pointer -------------------------------------------------------------

  function boardPoint(e: React.PointerEvent): Point {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return [Math.max(0, Math.min(BOARD, p.x)), Math.max(0, Math.min(BOARD, p.y))];
  }

  function onBoardDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    const p = boardPoint(e);
    if (tool === "move") {
      setSelected(null);
      return;
    }
    if (tool === "text") {
      addLabel(p);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "pen") setStroke([p]);
    else setArrow({ from: p, to: p });
  }

  function onElementDown(e: React.PointerEvent, id: number) {
    if (tool !== "move" || e.button !== 0) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    setSelected(id);
    drag.current = { id, start: boardPoint(e), base: history.present, moved: false };
  }

  function onMove(e: React.PointerEvent) {
    const p = boardPoint(e);
    const d = drag.current;
    if (d) {
      const [dx, dy] = [p[0] - d.start[0], p[1] - d.start[1]];
      if (!d.moved && Math.hypot(dx, dy) < TAP) return;
      d.moved = true;
      setLive(move(d.base, d.id, dx, dy));
    } else if (stroke) {
      const last = stroke[stroke.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3) setStroke([...stroke, p]);
    } else if (arrow) setArrow({ ...arrow, to: p });
  }

  function onUp() {
    if (drag.current) {
      if (drag.current.moved && live) apply(live);
      drag.current = null;
      setLive(null);
    } else if (stroke) {
      if (stroke.length > 1) place({ kind: "line", color, points: stroke });
      setStroke(null);
    } else if (arrow) {
      const length = Math.hypot(arrow.to[0] - arrow.from[0], arrow.to[1] - arrow.from[1]);
      if (length > 20) place({ kind: "arrow", color, from: arrow.from, to: arrow.to });
      setArrow(null);
    }
  }

  function onCancel() {
    drag.current = null;
    setLive(null);
    setStroke(null);
    setArrow(null);
  }

  // -- Keyboard ------------------------------------------------------------

  function onElementKey(e: React.KeyboardEvent, id: number) {
    const moves: Record<string, Point> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      const n = e.shiftKey ? STEP * 5 : STEP;
      apply(move(history.present, id, m[0] * n, m[1] * n));
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelected();
    }
    if (e.key === "Escape") setSelected(null);
  }

  function onPlannerKey(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      step("undo");
    } else if ((key === "z" && e.shiftKey) || key === "y") {
      e.preventDefault();
      step("redo");
    }
  }

  // -- Export and link -----------------------------------------------------

  const touch = () => window.matchMedia("(pointer: coarse)").matches;

  async function download() {
    const svg = svgRef.current;
    if (!svg) return;
    setStatus(t("pages.strategyPlannerUI.exporting"));
    try {
      const blob = await exportPlanImage(svg, `${new URL(site.url).host} · ${t("pages.strategyPlannerUI.imageTitle")}`);
      const file = "mlbb-strategy.png";
      const piece = new File([blob], file, { type: "image/png" });
      if (touch() && navigator.canShare?.({ files: [piece] })) {
        try {
          await navigator.share({ files: [piece], title: t("pages.strategyPlannerUI.imageTitle") });
          setStatus(t("pages.strategyPlannerUI.exportShared"));
          trackShare("Strategy plan image", "native");
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") {
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
      setStatus(t("pages.strategyPlannerUI.exportDone"));
      trackShare("Strategy plan image", "image");
    } catch {
      setStatus(t("pages.strategyPlannerUI.exportError"));
    }
  }

  async function shareLink() {
    const code = history.present.elements.length ? await encodePlan(history.present) : null;
    const url = `${window.location.origin}${window.location.pathname}${writeHash("", code)}`;
    let method: ShareMethod = "clipboard";
    if (touch() && typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title: t("pages.strategyPlannerUI.imageTitle") });
        method = "native";
        setStatus(t("pages.strategyPlannerUI.linkShared"));
        trackShare("Strategy plan link", method);
        return;
      } catch (err) {
        if ((err as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus(t("pages.strategyPlannerUI.linkCopied"));
      trackShare("Strategy plan link", method);
    } catch {
      setStatus(t("pages.strategyPlannerUI.linkError"));
    }
  }

  // -- Render --------------------------------------------------------------

  const results = useMemo(() => {
    const term = keySearch(search.trim());
    return heroes.filter((h) => !term || keySearch(h.name).includes(term)).sort((a, b) => a.name.localeCompare(b.name));
  }, [heroes, search]);
  const onMap = new Set(plan.elements.flatMap((e) => (e.kind === "hero" && e.team === team ? [e.slug] : [])));
  const drawing = tool !== "move";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]" onKeyDown={onPlannerKey}>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="min-w-0 space-y-3">
        {/* -- Tools and colours ------------------------------------------ */}
        <div role="toolbar" aria-label={t("pages.strategyPlannerUI.toolsLabel")} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex gap-1">
            {TOOLS.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={tool === key}
                title={t(`pages.strategyPlannerUI.tools.${key}`)}
                onClick={() => setTool(key)}
                className={cn(
                  "bevel-sm inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border px-2.5 text-sm transition-colors",
                  tool === key ? "border-gold-500 bg-night-850 text-gold-400" : "border-night-700 text-chalk-300 hover:border-gold-500/60",
                )}
              >
                <Icon size={17} aria-hidden />
                <span className="sr-only xl:not-sr-only">{t(`pages.strategyPlannerUI.tools.${key}`)}</span>
              </button>
            ))}
          </div>
          <fieldset className="flex items-center gap-1">
            <legend className="sr-only">{t("pages.strategyPlannerUI.colorLabel")}</legend>
            {COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-pressed={color === i}
                aria-label={t(`pages.strategyPlannerUI.colors.${COLOR_KEYS[i]}`)}
                title={t(`pages.strategyPlannerUI.colors.${COLOR_KEYS[i]}`)}
                onClick={() => chooseColor(i)}
                className="grid size-11 place-items-center rounded-full"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block size-6 rounded-full border-2 transition-transform",
                    color === i ? "scale-110 border-chalk-100" : "border-night-700",
                  )}
                  style={{ background: c }}
                />
              </button>
            ))}
          </fieldset>
        </div>

        {tool === "text" && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addLabel([BOARD / 2, BOARD / 2]);
            }}
          >
            <label className="min-w-0 flex-1 basis-48">
              <span className="sr-only">{t("pages.strategyPlannerUI.labelField")}</span>
              <input
                value={labelText}
                maxLength={LIMITS.text}
                onChange={(e) => setLabelText(e.target.value)}
                placeholder={t("pages.strategyPlannerUI.labelField")}
                className="bevel-sm min-h-11 w-full border border-night-700 bg-night-950 px-3 text-sm text-chalk-100 outline-none placeholder:text-chalk-500 focus:border-gold-500"
              />
            </label>
            <button type="submit" className={button}>
              <Plus size={15} aria-hidden />
              {t("pages.strategyPlannerUI.labelCentre")}
            </button>
            <p className="w-full text-xs text-chalk-500">{t("pages.strategyPlannerUI.labelHelp")}</p>
          </form>
        )}

        {/* -- The board -------------------------------------------------- */}
        <div className="relative mx-auto aspect-square w-full max-w-[44rem] overflow-hidden rounded-lg border border-night-700 bg-night-950">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${BOARD} ${BOARD}`}
            role="group"
            aria-label={t("pages.strategyPlannerUI.boardLabel")}
            aria-describedby="planner-help"
            onPointerDown={onBoardDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            className={cn("absolute inset-0 size-full touch-none select-none", drawing && "cursor-crosshair")}
          >
            <defs>
              <clipPath id="planner-token" clipPathUnits="objectBoundingBox">
                <circle cx="0.5" cy="0.5" r="0.5" />
              </clipPath>
              {COLORS.map((c, i) => (
                <marker key={c} id={`planner-arrow-${i}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 Z" fill={c} />
                </marker>
              ))}
            </defs>
            <g transform="scale(10)" aria-hidden>
              <MapDrawing />
            </g>

            {plan.elements.map((e) => (
              <PlanElement
                key={e.id}
                element={e}
                name={nameOf(e)}
                selected={e.id === selected}
                interactive={tool === "move"}
                icon={e.kind === "hero" ? (bySlug.get(e.slug)?.icon ?? null) : e.kind === "marker" ? markers[e.marker].image : null}
                initials={e.kind === "hero" ? (bySlug.get(e.slug)?.name ?? e.slug).slice(0, 2) : ""}
                onPointerDown={(ev) => onElementDown(ev, e.id)}
                onKeyDown={(ev) => onElementKey(ev, e.id)}
                onFocus={() => setSelected(e.id)}
              />
            ))}

            {stroke && stroke.length > 1 && (
              <polyline
                points={stroke.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke={COLORS[color]}
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                data-export="skip"
              />
            )}
            {arrow && (
              <line
                x1={arrow.from[0]}
                y1={arrow.from[1]}
                x2={arrow.to[0]}
                y2={arrow.to[1]}
                stroke={COLORS[color]}
                strokeWidth="8"
                strokeLinecap="round"
                markerEnd={`url(#planner-arrow-${color})`}
                data-export="skip"
              />
            )}
          </svg>
        </div>
        <p id="planner-help" className="mx-auto max-w-[44rem] text-xs text-chalk-500">
          {t("pages.strategyPlannerUI.help")}
        </p>

        {/* -- History, export, link -------------------------------------- */}
        <div className="mx-auto flex max-w-[44rem] flex-wrap gap-1.5">
          <button type="button" title={t("pages.strategyPlannerUI.undo")} className={squareButton} disabled={!history.past.length} onClick={() => step("undo")}>
            <Undo2 size={15} aria-hidden />
            <span className="sr-only">{t("pages.strategyPlannerUI.undo")}</span>
          </button>
          <button type="button" title={t("pages.strategyPlannerUI.redo")} className={squareButton} disabled={!history.future.length} onClick={() => step("redo")}>
            <Redo2 size={15} aria-hidden />
            <span className="sr-only">{t("pages.strategyPlannerUI.redo")}</span>
          </button>
          <button type="button" title={t("pages.strategyPlannerUI.delete")} className={squareButton} disabled={!selectedElement} onClick={deleteSelected}>
            <Eraser size={15} aria-hidden />
            <span className="sr-only">{t("pages.strategyPlannerUI.delete")}</span>
          </button>
          <button type="button" title={t("pages.strategyPlannerUI.clear")} className={squareButton} disabled={!history.present.elements.length} onClick={clearAll}>
            <Trash2 size={15} aria-hidden />
            <span className="sr-only">{t("pages.strategyPlannerUI.clear")}</span>
          </button>
          <span aria-hidden className="mx-1 hidden w-px self-stretch bg-night-700 sm:block" />
          <button type="button" className={cn(iconButton, "ml-auto sm:ml-0")} onClick={download}>
            <Download size={15} aria-hidden />
            <span className="max-sm:sr-only">{t("pages.strategyPlannerUI.export")}</span>
          </button>
          <button type="button" className={iconButton} onClick={shareLink}>
            <Link2 size={15} aria-hidden />
            <span className="max-sm:sr-only">{t("pages.strategyPlannerUI.share")}</span>
          </button>
        </div>
        <p aria-hidden className="mx-auto min-h-4 max-w-[44rem] text-xs text-chalk-300">
          {status}
        </p>
      </div>

      {/* -- Heroes and objectives ------------------------------------------ */}
      <aside aria-label={t("pages.strategyPlannerUI.paletteLabel")} className="min-w-0 space-y-5">
        <section aria-labelledby="planner-heroes" className="space-y-2.5">
          <h2 id="planner-heroes" className="font-heading text-lg font-bold text-chalk-100">
            {t("pages.strategyPlannerUI.heroes")}
          </h2>
          <fieldset className="grid grid-cols-2 gap-1.5">
            <legend className="sr-only">{t("pages.strategyPlannerUI.teamLabel")}</legend>
            {TEAMS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={team === s}
                onClick={() => setTeam(s)}
                className={cn(
                  "bevel-sm inline-flex min-h-11 items-center justify-center gap-2 border px-3 text-sm font-semibold transition-colors",
                  team === s
                    ? s === "blue"
                      ? "border-azure-500 bg-azure-500/15 text-chalk-100"
                      : "border-blood-500 bg-blood-500/15 text-chalk-100"
                    : "border-night-700 text-chalk-300 hover:border-gold-500/60",
                )}
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: TEAM_COLOR[s] }} />
                {t(`pages.strategyPlannerUI.teams.${s}`)}
              </button>
            ))}
          </fieldset>
          <SearchField dense value={search} onChange={setSearch} label={t("pages.strategyPlannerUI.search")} />
          <ul className="grid max-h-72 grid-cols-5 gap-1 overflow-y-auto pr-1 sm:grid-cols-8 lg:grid-cols-4">
            {results.map((h) => {
              const placed = onMap.has(h.slug);
              return (
                <li key={h.slug}>
                  <button
                    type="button"
                    onClick={() => addHero(h.slug)}
                    aria-label={t(placed ? "pages.strategyPlannerUI.selectHero" : "pages.strategyPlannerUI.addHero", {
                      name: h.name,
                      team: t(`pages.strategyPlannerUI.teams.${team}`),
                    })}
                    title={h.name}
                    className={cn(
                      "bevel-sm flex w-full flex-col items-center gap-0.5 border p-1 text-center transition-colors hover:border-gold-500/60",
                      placed ? (team === "blue" ? "border-azure-500/70" : "border-blood-500/70") : "border-night-700/70",
                    )}
                  >
                    <HeroThumb hero={h} small />
                    <span className="w-full truncate text-[0.65rem] text-chalk-300">{h.name}</span>
                  </button>
                </li>
              );
            })}
            {results.length === 0 && (
              <li className="col-span-full py-4 text-center text-sm text-chalk-500">{t("pages.strategyPlannerUI.noHero")}</li>
            )}
          </ul>
        </section>

        <section aria-labelledby="planner-objectives" className="space-y-2">
          <h2 id="planner-objectives" className="font-heading text-lg font-bold text-chalk-100">
            {t("pages.strategyPlannerUI.objectives")}
          </h2>
          <ul className="grid grid-cols-2 gap-1.5">
            {MARKERS.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => addMarker(m)}
                  aria-label={t("pages.strategyPlannerUI.addMarker", { name: markers[m].name })}
                  className="bevel-sm flex min-h-11 w-full items-center gap-2 border border-night-700/70 p-1.5 text-left text-sm text-chalk-100 transition-colors hover:border-gold-500/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local monster portrait, already small */}
                  <img src={markers[m].image} alt="" width={28} height={28} className="size-7 shrink-0 rounded-full border border-gold-500/60 object-cover" />
                  <span className="min-w-0 truncate">{markers[m].name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <p className={cn(label, "normal-case tracking-normal")}>
          {t("pages.strategyPlannerUI.count", { n: plan.elements.length, max: LIMITS.elements })}
        </p>
      </aside>
    </div>
  );
}

/** One element of the plan, drawn in board units, focusable when the move tool is on. */
function PlanElement({
  element: e,
  name,
  selected,
  interactive,
  icon,
  initials,
  onPointerDown,
  onKeyDown,
  onFocus,
}: {
  element: Element;
  name: string;
  selected: boolean;
  interactive: boolean;
  icon: string | null;
  initials: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}) {
  const ring = "#f5c451";
  const common = {
    "data-id": e.id,
    role: "button",
    "aria-label": name,
    "aria-pressed": selected,
    tabIndex: interactive ? 0 : -1,
    onPointerDown,
    onKeyDown,
    onFocus,
    className: cn("outline-none", interactive ? "cursor-grab" : "pointer-events-none"),
  } as const;

  if (e.kind === "hero" || e.kind === "marker") {
    const border = e.kind === "hero" ? TEAM_COLOR[e.team] : ring;
    return (
      <g {...common} transform={`translate(${e.x} ${e.y})`}>
        <circle r={TOKEN + 8} fill="transparent" data-export="skip" />
        <circle r={TOKEN} fill="#141b2e" />
        {icon ? (
          <image href={icon} x={-TOKEN} y={-TOKEN} width={TOKEN * 2} height={TOKEN * 2} clipPath="url(#planner-token)" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <text textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="700" fill="#eef2fb">
            {initials.toUpperCase()}
          </text>
        )}
        <circle r={TOKEN} fill="none" stroke={border} strokeWidth="5" />
        {selected && <circle r={TOKEN + 9} fill="none" stroke="#eef2fb" strokeWidth="3" strokeDasharray="8 6" data-export="skip" />}
      </g>
    );
  }

  if (e.kind === "text") {
    return (
      <g {...common}>
        <text
          x={e.x}
          y={e.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="34"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          fill={COLORS[e.color]}
          stroke="#06080f"
          strokeWidth="8"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {e.text}
        </text>
        {selected && (
          <rect
            x={e.x - e.text.length * 10 - 12}
            y={e.y - 28}
            width={e.text.length * 20 + 24}
            height="56"
            rx="8"
            fill="none"
            stroke="#eef2fb"
            strokeWidth="3"
            strokeDasharray="8 6"
            data-export="skip"
          />
        )}
      </g>
    );
  }

  const path =
    e.kind === "arrow"
      ? { d: `M${e.from[0]} ${e.from[1]} L${e.to[0]} ${e.to[1]}`, marker: `url(#planner-arrow-${e.color})` }
      : { d: `M${e.points.map((p) => p.join(" ")).join(" L")}`, marker: undefined };
  return (
    <g {...common}>
      <path d={path.d} fill="none" stroke="transparent" strokeWidth="30" strokeLinecap="round" data-export="skip" />
      {selected && <path d={path.d} fill="none" stroke="#eef2fb" strokeOpacity="0.5" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" data-export="skip" />}
      <path
        d={path.d}
        fill="none"
        stroke={COLORS[e.color]}
        strokeWidth={e.kind === "arrow" ? 8 : 7}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={path.marker}
      />
    </g>
  );
}

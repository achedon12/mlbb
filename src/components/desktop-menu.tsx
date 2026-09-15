"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NEWS, BASE, GROUPS, type Entry, type Group, type MenuNode } from "@/lib/sections";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Desktop navigation.
 *
 * Five families in dropdown menus — heroes, tier lists, game, tools,
 * news. Each entry carries an icon, a label and a short description; those
 * that group sub-pages (tier list by rank, by lane, emblems…) open a side
 * submenu on hover, on click or with the right arrow key.
 */

export function isActive(path: string, href: string) {
  // The path carries a locale prefix (/fr/heroes): compare the end.
  return path.endsWith(href) || path.includes(`${href}/`);
}

/** Label of a node: its navigation key, or its direct translation key. */
export function labelNode(t: (key: string) => string, n: MenuNode): string {
  return n.key ? t(`nav.${n.key}.label`) : t(n.label ?? "");
}

const activeIn = (path: string, n: MenuNode): boolean =>
  (n.href ? isActive(path, n.href) : false) || (n.children ?? []).some((e) => activeIn(path, e));

function Dropdown({
  group,
  open,
  onOpen,
  onClose,
}: {
  group: Group;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const path = usePathname();
  const panelId = useId();
  const groupActive = group.nodes.some((n) => activeIn(path, n));
  const { icon: Icon } = group;

  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors xl:px-3",
          groupActive || open ? "text-chalk-100" : "text-chalk-300 hover:text-chalk-100",
        )}
      >
        <Icon size={16} aria-hidden className={groupActive ? "text-gold-400" : ""} />
        {t(`nav.groups.${group.key}`)}
        <ChevronDown size={14} aria-hidden className={cn("transition-transform duration-200", open && "rotate-180")} />
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-3 -bottom-px h-0.5 bg-gold-500 transition-opacity",
            groupActive ? "opacity-100" : "opacity-0",
          )}
        />
      </button>

      <div id={panelId} hidden={!open} className="absolute left-0 top-full z-50 pt-2">
        {/*
          The bevel (clip-path) sits on a background layer: applied to the
          panel itself, it would clip the submenus that overflow it.
        */}
        <div className={cn("relative p-2", group.large ? "w-[36rem]" : "w-80")}>
          <div
            aria-hidden
            className="bevel absolute inset-0 border border-night-700/80 bg-night-900/98 shadow-2xl shadow-night-950/60 backdrop-blur"
          />
          <ul className={cn("relative grid gap-0.5", group.large && "grid-cols-2")}>
            {group.nodes.map((n) => (
              <li key={n.href ?? n.key}>
                {n.children ? (
                  <NodeWithSubmenu node={n} path={path} onNavigate={onClose} />
                ) : (
                  <LinkMenu
                    entry={n as Entry}
                    active={isActive(path, n.href!)}
                    onClick={onClose}
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
 * Entry that groups sub-pages. The row leads to its page when it has one;
 * the arrow, or hovering, opens the list of sub-pages on the right.
 */
function NodeWithSubmenu({ node, path, onNavigate }: { node: MenuNode; path: string; onNavigate: () => void }) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const arrow = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const name = labelNode(t, node);
  const active = activeIn(path, node);

  const openAndFocus = () => {
    setOpen(true);
    // The submenu has just been rendered: move focus into it on the next frame.
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>("a")?.focus());
  };

  const byKeyboard = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" && !open) {
      e.preventDefault();
      openAndFocus();
    } else if (e.key === "ArrowLeft" && open) {
      e.preventDefault();
      setOpen(false);
      arrow.current?.focus();
    }
  };

  const content = (
    <>
      {node.icon && (
        <span
          className={cn(
            "bevel-sm grid size-9 shrink-0 place-items-center transition-colors",
            active ? "bg-gold-500 text-night-950" : "bg-night-800 text-chalk-300 group-hover:text-gold-400",
          )}
        >
          <node.icon size={17} aria-hidden />
        </span>
      )}
      <span className="min-w-0 text-left">
        <span className={cn("block text-sm font-semibold", active ? "text-gold-400" : "text-chalk-100")}>{name}</span>
        {node.key && <span className="block text-xs text-chalk-400">{t(`nav.${node.key}.desc`)}</span>}
      </span>
    </>
  );
  const classRow = cn(
    "group flex min-w-0 flex-1 items-start gap-3 rounded-md p-2.5 transition-colors",
    open || active ? "bg-night-800/70" : "hover:bg-night-800/60",
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={byKeyboard}
    >
      <div className="flex items-stretch">
        {node.href ? (
          <Link href={node.href} onClick={onNavigate} className={classRow}>
            {content}
          </Link>
        ) : (
          <button type="button" onClick={() => (open ? setOpen(false) : openAndFocus())} className={classRow}>
            {content}
          </button>
        )}
        <button
          ref={arrow}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={t("nav.submenu", { name: name })}
          onClick={() => (open ? setOpen(false) : openAndFocus())}
          className="grid w-8 shrink-0 place-items-center rounded-md text-chalk-500 transition-colors hover:text-gold-400"
        >
          <ChevronRight size={16} aria-hidden className={cn("transition-transform", open && "translate-x-0.5")} />
        </button>
      </div>

      {/*
        Rendered hidden rather than on opening: the sub-page links stay in the
        server HTML, the only copy of them since the mobile menu renders its
        content on opening.
      */}
      <div id={id} hidden={!open} className="absolute left-full top-0 z-50 pl-2">
        <ul
          ref={list}
          className="bevel min-w-52 border border-night-700/80 bg-night-900/98 p-1.5 shadow-2xl shadow-night-950/60 backdrop-blur"
        >
          {node.children!.map((e) => {
            const childActive = e.href ? path.endsWith(e.href) : false;
            return (
              <li key={e.href}>
                <Link
                  href={e.href!}
                  onClick={onNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    childActive ? "bg-night-800 text-gold-400" : "text-chalk-200 hover:bg-night-800/70 hover:text-gold-400",
                  )}
                >
                  {labelNode(t, e)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * A menu item: icon, label and short description. The same on desktop and
 * on mobile.
 */
export function LinkMenu({
  entry,
  active,
  onClick,
  className,
}: {
  entry: Entry;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  const t = useT();
  const { href, key, icon: Ic } = entry;
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex gap-3 rounded-md p-2.5 transition-colors",
        active ? "bg-night-800/80" : "hover:bg-night-800/60",
        className,
      )}
    >
      <span
        className={cn(
          "bevel-sm grid size-9 shrink-0 place-items-center transition-colors",
          active ? "bg-gold-500 text-night-950" : "bg-night-800 text-chalk-300 group-hover:text-gold-400",
        )}
      >
        <Ic size={17} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-semibold", active ? "text-gold-400" : "text-chalk-100")}>
          {t(`nav.${key}.label`)}
        </span>
        <span className="block text-xs text-chalk-400">{t(`nav.${key}.desc`)}</span>
      </span>
    </Link>
  );
}

export function DesktopMenu() {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onClick = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <nav ref={container} aria-label={t("nav.main")} className="hidden items-center gap-0.5 lg:flex">
      {GROUPS.map((g) => (
        <Dropdown
          key={g.key}
          group={g}
          open={open === g.key}
          onOpen={() => setOpen(g.key)}
          onClose={() => setOpen((o) => (o === g.key ? null : o))}
        />
      ))}
    </nav>
  );
}

// Re-exported for the mobile menu.
export { NEWS, BASE, GROUPS };
export type { Entry, Group, MenuNode };

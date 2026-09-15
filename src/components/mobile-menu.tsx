"use client";

import { useId, useState } from "react";
import Link from "@/components/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { isActive, GROUPS, LinkMenu, labelNode, type Entry, type Group, type MenuNode } from "./desktop-menu";

/**
 * Narrow-width navigation menu: the same five families as desktop, as
 * collapsible sections; entries with sub-pages expand as an accordion rather
 * than a side panel, which the screen has no room to show.
 */

function Section({
  group,
  path,
  isOpen,
  onToggle,
  onNavigate,
}: {
  group: Group;
  path: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const t = useT();
  const id = useId();
  const { icon: Icon } = group;
  return (
    <div className="border-b border-night-800 last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-3 text-left text-sm font-semibold text-chalk-100"
      >
        <Icon size={17} aria-hidden className="text-gold-400" />
        <span className="flex-1">{t(`nav.groups.${group.key}`)}</span>
        <ChevronDown size={16} aria-hidden className={cn("text-chalk-500 transition-transform", isOpen && "rotate-180")} />
      </button>
      <ul id={id} hidden={!isOpen} className="pb-2">
        {group.nodes.map((n) => (
          <li key={n.href ?? n.key}>
            {n.children ? (
              <NodeMobile node={n} path={path} onNavigate={onNavigate} />
            ) : (
              <LinkMenu entry={n as Entry} active={isActive(path, n.href!)} onClick={onNavigate} className="items-center" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Entry with sub-pages: its own page when it has one, and the expandable list of sub-pages. */
function NodeMobile({ node, path, onNavigate }: { node: MenuNode; path: string; onNavigate: () => void }) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(() => (node.children ?? []).some((e) => e.href && path.endsWith(e.href)));
  const name = labelNode(t, node);
  const Icon = node.icon;

  const head = (
    <>
      {Icon && (
        <span className="bevel-sm grid size-9 shrink-0 place-items-center bg-night-800 text-chalk-300">
          <Icon size={17} aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-chalk-100">{name}</span>
        {node.key && <span className="block text-xs text-chalk-400">{t(`nav.${node.key}.desc`)}</span>}
      </span>
    </>
  );

  return (
    <div>
      <div className="flex items-stretch">
        {node.href ? (
          <Link href={node.href} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2.5">
            {head}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2.5 text-left"
          >
            {head}
          </button>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={t("nav.submenu", { name: name })}
          onClick={() => setOpen((o) => !o)}
          className="grid w-11 shrink-0 place-items-center text-chalk-500"
        >
          <ChevronDown size={16} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>
      <ul id={id} hidden={!open} className="mb-1 ml-8 border-l border-night-700 pl-3">
        {node.children!.map((e) => {
          const active = e.href ? path.endsWith(e.href) : false;
          return (
            <li key={e.href}>
              <Link
                href={e.href!}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn("block rounded-md px-3 py-2 text-sm", active ? "text-gold-400" : "text-chalk-300")}
              >
                {labelNode(t, e)}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MobileMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  // The sections are only rendered once the menu has been opened: rendered
  // hidden on every page, they were over 550 elements (a third of the home
  // page's DOM) to hydrate for nothing. Their links stay in the server HTML
  // through the desktop menu.
  const [rendered, setRendered] = useState(false);
  const path = usePathname();
  // The current page's family opens by itself.
  const [section, setSection] = useState<string | null>(null);
  const current = GROUPS.find((g) =>
    g.nodes.some((n) => (n.href && isActive(path, n.href)) || (n.children ?? []).some((e) => e.href && isActive(path, e.href))),
  )?.key;
  const isOpen = section ?? current ?? GROUPS[0].key;

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => {
          setRendered(true);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-controls="menu-mobile"
        aria-label={open ? t("nav.close") : t("nav.open")}
        className="grid size-9 place-items-center text-chalk-300 transition-colors hover:text-gold-400"
      >
        {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>

      <div
        hidden={!open}
        onClick={close}
        className="fixed inset-0 top-16 z-30 bg-night-950/60 backdrop-blur-sm"
        aria-hidden
      />

      <nav
        id="menu-mobile"
        aria-label={t("nav.main")}
        hidden={!open}
        className="absolute inset-x-0 top-16 z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-night-700 bg-night-950 px-3 pb-4 shadow-2xl shadow-night-950/60"
      >
        {rendered &&
          GROUPS.map((g) => (
            <Section
              key={g.key}
              group={g}
              path={path}
              isOpen={isOpen === g.key}
              onToggle={() => setSection(isOpen === g.key ? "" : g.key)}
              onNavigate={close}
            />
          ))}
      </nav>
    </div>
  );
}

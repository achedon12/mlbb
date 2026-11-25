import { ArrowRight } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import type { Column, Entry, Section } from "@/lib/sections";
import { SupportNavEntry } from "./support-links";

/**
 * Content of a header section: its columns of pages, the rows of short links
 * (tier list by rank, by lane…) and the link to the section's hub. Rendered
 * by `SiteNav`, in the browser, when the section opens.
 *
 * Wide screens get the section's name and lead on the left, the columns
 * beside it; the mobile sheet shows the columns alone, one under the other,
 * and the hub link last.
 *
 * `current` is the page's path without its locale: its link is marked.
 */
export function NavPanel({ section, current }: { section: Section; current: string }) {
  const t = useT();
  const hub = t(`nav.hubs.${section.key}`);
  return (
    <div className="xl:page-wrap xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-10 xl:py-7">
      <div className="hidden xl:block">
        <p className="display-caps text-[2.75rem] text-chalk-100">{t(`nav.groups.${section.key}`)}</p>
        <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
        <p className="mt-3 text-sm leading-relaxed text-chalk-400">{t(`nav.sectionLead.${section.key}`)}</p>
        <HubLink href={section.hub} label={hub} current={current} className="mt-5" />
      </div>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))]">
        {section.columns.map((c) => (
          <NavColumn key={c.key} column={c} current={current} />
        ))}
        {/* An external link, shown only once the server says a platform is set. */}
        {section.key === "community" && (
          <div className="min-w-0 self-end">
            <SupportNavEntry />
          </div>
        )}
      </div>
      <HubLink href={section.hub} label={hub} current={current} className="mt-5 xl:hidden" />
    </div>
  );
}

/**
 * The same links as `NavPanel`, as a bare list: what a closed section puts in
 * the page's HTML. Crawlers and the browser without JavaScript still find
 * every address of the menu, at a fraction of the full panel's weight (no
 * icon, no description, no layout), and the full panel is only built when
 * the section opens.
 */
export function NavLinks({ section }: { section: Section }) {
  const t = useT();
  const links = [
    { href: section.hub, label: t(`nav.hubs.${section.key}`) },
    ...section.columns.flatMap((c) => [
      ...c.entries.map((e) => ({ href: e.href, label: t(`nav.${e.key}.label`) })),
      ...(c.rows ?? []).flatMap((r) => r.links.map((l) => ({ href: l.href, label: t(l.label) }))),
    ]),
  ];
  const unique = links.filter((l, i) => links.findIndex((x) => x.href === l.href) === i);
  return (
    <ul>
      {unique.map((l) => (
        <li key={l.href}>
          <Link href={l.href} prefetch={false}>
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const currentProps = (href: string, current: string) => (href === current ? { "aria-current": "page" as const } : {});

function HubLink({ href, label, current, className }: { href: string; label: string; current: string; className?: string }) {
  return (
    <Link
      href={href}
      {...currentProps(href, current)}
      className={`btn btn-primary btn-sm ${className ?? ""}`}
    >
      {label}
      <ArrowRight size={15} aria-hidden />
    </Link>
  );
}

function NavColumn({ column, current }: { column: Column; current: string }) {
  const t = useT();
  return (
    <div className="min-w-0">
      <p className="mb-1.5 px-2 font-heading text-sm font-bold uppercase tracking-wide text-gold-400">{t(`nav.columns.${column.key}`)}</p>
      {column.entries.length > 0 && (
        <ul>
          {column.entries.map((e) => (
            <li key={e.href}>
              <NavEntry entry={e} current={current} />
            </li>
          ))}
        </ul>
      )}
      {column.rows?.map((row) => (
        <div key={row.key} className="mt-2 px-2">
          <p className="mb-1.5 text-xs text-chalk-500">{t(`nav.${row.key}.label`)}</p>
          <ul className="flex flex-wrap gap-1.5">
            {row.links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  {...currentProps(l.href, current)}
                  className="bevel-sm block bg-night-800 px-2.5 py-1.5 text-xs text-chalk-300 transition-colors hover:bg-night-700 hover:text-gold-300 aria-[current=page]:bg-gold-400 aria-[current=page]:text-night-950"
                >
                  {t(l.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function NavEntry({ entry, current }: { entry: Entry; current: string }) {
  const t = useT();
  const { href, key, icon: Icon } = entry;
  return (
    <Link
      href={href}
      {...currentProps(href, current)}
      className="bevel-sm group flex items-center gap-3 px-2 py-2 transition-colors hover:bg-night-800/70 aria-[current=page]:bg-night-800"
    >
      <span className="bevel-sm grid size-8 shrink-0 place-items-center bg-night-800 text-chalk-300 transition-colors group-hover:text-gold-400 group-aria-[current=page]:bg-gold-500 group-aria-[current=page]:text-night-950">
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-chalk-100 group-aria-[current=page]:text-gold-400">
          {t(`nav.${key}.label`)}
        </span>
        <span className="hidden text-xs leading-snug text-chalk-500 sm:block">{t(`nav.${key}.desc`)}</span>
      </span>
    </Link>
  );
}

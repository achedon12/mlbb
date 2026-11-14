import { ArrowRight } from "lucide-react";
import Link from "@/components/link";
import type { T } from "@/i18n/translations";
import type { Column, Entry, Section } from "@/lib/sections";

/**
 * Content of a header section: its columns of pages, the rows of short links
 * (tier list by rank, by lane…) and the link to the section's hub. Rendered on
 * the server, once per page, and toggled by `SiteNav`.
 *
 * Wide screens get the section's name and lead on the left, the columns
 * beside it; the mobile sheet shows the columns alone, one under the other,
 * and the hub link last.
 */
export function NavPanel({ section, t }: { section: Section; t: T }) {
  const hub = t(`nav.hubs.${section.key}`);
  return (
    <div className="xl:page-wrap xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-10 xl:py-7">
      <div className="hidden xl:block">
        <p className="font-heading text-2xl font-bold text-chalk-100">{t(`nav.groups.${section.key}`)}</p>
        <div aria-hidden className="gold-rule mt-1.5 h-0.5 w-12" />
        <p className="mt-3 text-sm leading-relaxed text-chalk-400">{t(`nav.sectionLead.${section.key}`)}</p>
        <HubLink href={section.hub} label={hub} className="mt-5" />
      </div>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))]">
        {section.columns.map((c) => (
          <NavColumn key={c.key} column={c} t={t} />
        ))}
      </div>
      <HubLink href={section.hub} label={hub} className="mt-5 xl:hidden" />
    </div>
  );
}

function HubLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`bevel-sm inline-flex items-center gap-2 bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400 ${className ?? ""}`}
    >
      {label}
      <ArrowRight size={15} aria-hidden />
    </Link>
  );
}

function NavColumn({ column, t }: { column: Column; t: T }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 px-2 text-xs font-semibold text-gold-400">{t(`nav.columns.${column.key}`)}</p>
      {column.entries.length > 0 && (
        <ul>
          {column.entries.map((e) => (
            <li key={e.href}>
              <NavEntry entry={e} t={t} />
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
                  className="bevel-sm block border border-night-700 bg-night-950/40 px-2.5 py-1.5 text-xs text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400 aria-[current=page]:border-gold-500/70 aria-[current=page]:text-gold-400"
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

function NavEntry({ entry, t }: { entry: Entry; t: T }) {
  const { href, key, icon: Icon } = entry;
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-night-800/70 aria-[current=page]:bg-night-800/80"
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

import type { Metadata } from "next";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import { TOOL_GROUPS } from "@/lib/sections";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.toolsHub.metaTitle"),
    description: t("pages.toolsHub.metaDescription"),
    path: "/tools",
  });
}

/**
 * Tools hub: every tool of the site, grouped by what it is for — the same
 * groups as the header's Tools panel, from `TOOL_GROUPS`. Each group is a
 * column on a wide screen, so the whole catalogue reads in one screen.
 */
export default async function ToolsPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const count = new Set(TOOL_GROUPS.flatMap((g) => g.entries.map((e) => e.href))).size;

  return (
    <>
      <PageHeader
        title={t("pages.toolsHub.title")}
        lead={t("pages.toolsHub.lead")}
        meta={[t("pages.toolsHub.nTools", { n: count })]}
      />
      <div className="page-wrap py-8 sm:py-12">
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {TOOL_GROUPS.map((group) => {
            const heading = `tools-${group.key}`;
            return (
              <section key={group.key} aria-labelledby={heading} className="min-w-0">
                <h2 id={heading} className="font-heading text-xl font-bold text-chalk-100">
                  {t(`nav.columns.${group.key}`)}
                </h2>
                <div aria-hidden className="gold-rule mt-1.5 h-0.5 w-12" />
                <ul className="mt-4 space-y-2.5">
                  {group.entries.map(({ href, key, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="bevel-sm group flex items-start gap-3 border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
                      >
                        <span className="bevel-sm grid size-10 shrink-0 place-items-center bg-night-800 text-gold-400">
                          <Icon size={19} aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-chalk-100 transition-colors group-hover:text-gold-400">
                            {t(`nav.${key}.label`)}
                          </span>
                          <span className="mt-0.5 block text-sm text-chalk-500">{t(`nav.${key}.desc`)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

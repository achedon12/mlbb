import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { allHeroes, countItems, patches, sync } from "@/lib/data";
import { rankingFull } from "@/lib/tier-list";
import type { Locale } from "@/i18n/config";
import { LOCALE_HTML } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.apiDoc.title"),
    description: t("pages.apiDoc.metaDescription"),
    share: t("pages.apiDoc.ogDescription"),
    path: "/api-doc",
  });
}

interface Route {
  path: string;
  key: string;
  settings?: { name: string; values: string; role: string }[];
  example: string;
}

const ROUTES: Route[] = [
  {
    path: "/api/v1/heroes",
    key: "heroes",
    settings: [
      { name: "role", values: "Tank, Fighter, Assassin, Mage, Marksman, Support", role: "roleParam" },
      { name: "lane", values: "Gold, Jungle, Mid, Exp, Roam", role: "laneParam" },
    ],
    example: "/api/v1/heroes?role=Tank&lane=Roam",
  },
  {
    path: "/api/v1/heroes/{slug}",
    key: "heroSlug",
    example: "/api/v1/heroes/khufra",
  },
  {
    path: "/api/v1/items",
    key: "items",
    settings: [
      { name: "category", values: "Attack, Magic, Defense, Movement, Jungling, Roaming", role: "catParam" },
    ],
    example: "/api/v1/items?category=Defense",
  },
  {
    path: "/api/v1/patches",
    key: "patches",
    example: "/api/v1/patches",
  },
  {
    path: "/api/v1/rankings",
    key: "rankings",
    example: "/api/v1/rankings",
  },
];

export default async function ApiPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  return (
    <>
      <PageHeader
        title={t("pages.apiDoc.title")}
        lead={t("pages.apiDoc.lead")}
      >
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {[
            [t("pages.apiDoc.statHeroes"), allHeroes.length],
            [t("pages.apiDoc.statItems"), countItems],
            [t("pages.apiDoc.statPatches"), patches.length],
            [t("pages.apiDoc.statRanked"), rankingFull.length],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
              <dd className="mt-0.5 font-heading text-xl font-bold text-gold-400">{value}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-12">
        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.apiDoc.endpoints")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <div className="mt-6 space-y-4">
            {ROUTES.map((r) => (
              <Card key={r.path}>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="bevel-sm bg-night-700 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-400">
                    GET
                  </span>
                  <code className="font-mono text-sm text-chalk-100">{r.path}</code>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-chalk-300">{t(`pages.apiDoc.routes.${r.key}.summary`)}</p>

                {r.settings && (
                  <dl className="mt-4 space-y-2 border-t border-night-800 pt-3 text-sm">
                    {r.settings.map((p) => (
                      <div key={p.name} className="flex flex-wrap gap-x-3">
                        <dt className="font-mono text-xs text-gold-400">?{p.name}=</dt>
                        <dd className="min-w-0 flex-1">
                          <span className="text-chalk-300">{t(`pages.apiDoc.routes.${r.key}.${p.role}`)}</span>
                          <span className="mt-0.5 block text-xs text-chalk-500">
                            {p.values}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                <a
                  href={r.example}
                  className="mt-4 inline-block font-mono text-xs text-azure-400 underline underline-offset-4 hover:text-gold-400"
                >
                  {r.example}
                </a>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.apiDoc.shapeTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">
            {t("pages.apiDoc.shapeText")}
          </p>

          <pre className="bevel mt-4 relative overflow-x-auto border border-night-700/70 bg-night-950 p-4 text-xs leading-relaxed text-chalk-300">
{`{
  "data": [ … ],
  "total": 133,
  "source": {
    "name": "Mobile Legends Wiki",
    "url": "https://mobilelegends.fandom.com",
    "license": "CC BY-SA"
  }
}`}
          </pre>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.apiDoc.termsTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <ul className="mt-4 space-y-3 leading-relaxed text-chalk-300">
            <li>
              <strong className="text-chalk-100">{t("pages.apiDoc.c1label")}</strong>{" "}{t("pages.apiDoc.c1text")}
            </li>
            <li>
              <strong className="text-chalk-100">{t("pages.apiDoc.c2label")}</strong>{" "}{t("pages.apiDoc.c2text")}
            </li>
            <li>
              <strong className="text-chalk-100">{t("pages.apiDoc.c3label")}</strong>{" "}{t("pages.apiDoc.c3text")}
            </li>
            <li>
              <strong className="text-chalk-100">{t("pages.apiDoc.c4label")}</strong>{" "}{t("pages.apiDoc.c4text")}
            </li>
          </ul>
        </section>

        <p className="border-t border-night-800 pt-6 text-sm text-chalk-500">
          {t("pages.apiDoc.syncNote", { date: new Date(sync.date).toLocaleDateString(LOCALE_HTML[locale]) })}
        </p>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { BookOpen, FileCode, GitPullRequest } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { allHeroes, heroAnalyses } from "@/lib/data";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.contribute.metaTitle"),
    description: t("pages.contribute.metaDescription"),
    path: "/contribute",
  });
}

/** Un champ d'un type de l'analyse ; sa description vient du catalogue. */
interface Field {
  name: string;
  type: string;
  key: string;
  optional?: boolean;
}

/** Les trois types d'une analyse, dans l'ordre de `src/lib/types.ts`. */
const GROUPS: { key: string; fields: Field[] }[] = [
  {
    key: "analysis",
    fields: [
      { name: "slug", type: "string", key: "slug" },
      { name: "summary", type: "string", key: "summary" },
      { name: "analysis", type: "string", key: "analysis" },
      { name: "skills", type: "Skill[]", key: "skills" },
      { name: "strengths", type: "string[]", key: "strengths" },
      { name: "weaknesses", type: "string[]", key: "weaknesses" },
      { name: "strongAgainst", type: "string[]", key: "strongAgainst" },
      { name: "weakAgainst", type: "string[]", key: "weakAgainst" },
      { name: "builds", type: "Build[]", key: "builds" },
    ],
  },
  {
    key: "skill",
    fields: [
      { name: "type", type: '"Passive" | "Skill 1" | "Skill 2" | "Ultimate"', key: "skill.type" },
      { name: "name", type: "string", key: "skill.name" },
      { name: "description", type: "string", key: "skill.description" },
      { name: "cooldown", type: "number[]", key: "skill.cooldown", optional: true },
      { name: "cost", type: "number[]", key: "skill.cost", optional: true },
    ],
  },
  {
    key: "build",
    fields: [
      { name: "name", type: "string", key: "build.name" },
      { name: "context", type: "string", key: "build.context" },
      { name: "items", type: "string[]", key: "build.items" },
      { name: "emblem", type: "string", key: "build.emblem" },
      { name: "talent", type: "string", key: "build.talent" },
      { name: "spell", type: "string", key: "build.spell" },
    ],
  },
];

const STYLE = ["accents", "terms", "original", "values", "concrete"];
const STEPS = ["fork", "add", "check", "open", "reread", "merge"];

const TEMPLATE = "docs/modele-analyse.ts";

/**
 * Le modele du depot, affiche tel quel : la page ne peut pas diverger du
 * fichier, que le compilateur verifie contre le type.
 */
function readTemplate(): string | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), TEMPLATE), "utf8");
  } catch {
    return null;
  }
}

/** Le catalogue marque le code entre accents graves : `npm run lint`. */
function withCode(text: string) {
  return text.split(/`([^`]+)`/).map((chunk, i) =>
    i % 2 ? (
      <code key={i} className="rounded bg-night-800 px-1 py-0.5 font-mono text-[0.85em] text-chalk-100">
        {chunk}
      </code>
    ) : (
      chunk
    ),
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-2xl font-bold text-chalk-100">{title}</h2>
      <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function ContributePage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const template = readTemplate();
  const linkExternal = "inline-flex items-center gap-2 text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500";

  return (
    <>
      <PageHeader title={t("pages.contribute.title")} lead={t("pages.contribute.lead")}>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {[
            [t("pages.contribute.statAnalyses"), heroAnalyses.length],
            [t("pages.contribute.statPending"), allHeroes.length - heroAnalyses.length],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
              <dd className="mt-0.5 font-heading text-xl font-bold text-gold-400">{value}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <Section title={t("pages.contribute.principleTitle")}>
          <div className="space-y-4 leading-relaxed text-chalk-300">
            <p>{withCode(t("pages.contribute.principle1"))}</p>
            <p>{withCode(t("pages.contribute.principle2"))}</p>
          </div>
        </Section>

        <Section title={t("pages.contribute.fieldsTitle")}>
          <p className="mb-5 leading-relaxed text-chalk-300">{withCode(t("pages.contribute.fieldsIntro"))}</p>
          <div className="space-y-5">
            {GROUPS.map((g) => (
              <Card key={g.key}>
                <h3 className="font-heading text-lg font-bold text-gold-400">{t(`pages.contribute.group.${g.key}`)}</h3>
                <dl className="mt-3 divide-y divide-night-800">
                  {g.fields.map((c) => (
                    <div key={c.key} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-5">
                      <dt className="min-w-0">
                        <code className="font-mono text-sm text-chalk-100">{c.name}</code>
                        <span className="mt-0.5 block break-words font-mono text-xs text-chalk-500">
                          {c.type}
                          {c.optional && ` · ${t("pages.contribute.optional")}`}
                        </span>
                      </dt>
                      <dd className="text-sm leading-relaxed text-chalk-300">
                        {withCode(t(`pages.contribute.fields.${c.key}`))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        </Section>

        <Section title={t("pages.contribute.templateTitle")}>
          <p className="leading-relaxed text-chalk-300">{withCode(t("pages.contribute.templateIntro"))}</p>
          {template && (
            <pre
              tabIndex={0}
              role="region"
              aria-label={t("pages.contribute.templateTitle")}
              className="bevel mt-4 max-h-[36rem] overflow-auto border border-night-700/70 bg-night-950 p-4 text-xs leading-relaxed text-chalk-300 outline-none focus-visible:border-gold-500"
            >
              <code>{template}</code>
            </pre>
          )}
          <a href={`${site.depot}/blob/main/${TEMPLATE}`} rel="noreferrer" className={`mt-4 ${linkExternal}`}>
            <FileCode size={16} aria-hidden />
            {t("pages.contribute.templateLink")}
          </a>
        </Section>

        <Section title={t("pages.contribute.styleTitle")}>
          <ul className="space-y-3">
            {STYLE.map((key) => (
              <li key={key} className="flex gap-3 leading-relaxed text-chalk-300">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 bg-gold-500" />
                <span>{withCode(t(`pages.contribute.style.${key}`))}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("pages.contribute.reviewTitle")}>
          <ol className="space-y-4">
            {STEPS.map((key, i) => (
              <li key={key} className="flex gap-4 leading-relaxed text-chalk-300">
                <span
                  aria-hidden
                  className="bevel-sm grid size-8 shrink-0 place-items-center bg-night-800 font-heading text-sm font-bold text-gold-400"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 pt-1">{withCode(t(`pages.contribute.review.${key}`))}</span>
              </li>
            ))}
          </ol>
          <Card className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-gold-500/30">
            <a href={`${site.depot}/compare`} rel="noreferrer" className={linkExternal}>
              <GitPullRequest size={16} aria-hidden />
              {t("pages.contribute.prLink")}
            </a>
            <a href={`${site.depot}/blob/main/CONTRIBUTING.md`} rel="noreferrer" className={linkExternal}>
              <BookOpen size={16} aria-hidden />
              {t("pages.contribute.guideLink")}
            </a>
          </Card>
        </Section>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { BookOpen, FileCode, GitPullRequest } from "lucide-react";
import { Carte, EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { heros, herosAnalyses } from "@/lib/donnees";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.contribute.metaTitle"),
    description: t("pages.contribute.metaDescription"),
    chemin: "/contribute",
  });
}

/** Un champ d'un type de l'analyse ; sa description vient du catalogue. */
interface Champ {
  nom: string;
  type: string;
  cle: string;
  facultatif?: boolean;
}

/** Les trois types d'une analyse, dans l'ordre de `src/lib/types.ts`. */
const GROUPES: { cle: string; champs: Champ[] }[] = [
  {
    cle: "analysis",
    champs: [
      { nom: "slug", type: "string", cle: "slug" },
      { nom: "resume", type: "string", cle: "summary" },
      { nom: "analyse", type: "string", cle: "analysis" },
      { nom: "competences", type: "Competence[]", cle: "skills" },
      { nom: "forces", type: "string[]", cle: "strengths" },
      { nom: "faiblesses", type: "string[]", cle: "weaknesses" },
      { nom: "fortContre", type: "string[]", cle: "strongAgainst" },
      { nom: "faibleContre", type: "string[]", cle: "weakAgainst" },
      { nom: "builds", type: "Build[]", cle: "builds" },
    ],
  },
  {
    cle: "skill",
    champs: [
      { nom: "type", type: '"Passif" | "Competence 1" | "Competence 2" | "Ultime"', cle: "skill.type" },
      { nom: "nom", type: "string", cle: "skill.name" },
      { nom: "description", type: "string", cle: "skill.description" },
      { nom: "recharge", type: "number[]", cle: "skill.cooldown", facultatif: true },
      { nom: "cout", type: "number[]", cle: "skill.cost", facultatif: true },
    ],
  },
  {
    cle: "build",
    champs: [
      { nom: "nom", type: "string", cle: "build.name" },
      { nom: "contexte", type: "string", cle: "build.context" },
      { nom: "objets", type: "string[]", cle: "build.items" },
      { nom: "embleme", type: "string", cle: "build.emblem" },
      { nom: "talent", type: "string", cle: "build.talent" },
      { nom: "sort", type: "string", cle: "build.spell" },
    ],
  },
];

const STYLE = ["accents", "terms", "original", "values", "concrete"];
const ETAPES = ["fork", "add", "check", "open", "reread", "merge"];

const MODELE = "docs/modele-analyse.ts";

/**
 * Le modele du depot, affiche tel quel : la page ne peut pas diverger du
 * fichier, que le compilateur verifie contre le type.
 */
function lireModele(): string | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), MODELE), "utf8");
  } catch {
    return null;
  }
}

/** Le catalogue marque le code entre accents graves : `npm run lint`. */
function avecCode(texte: string) {
  return texte.split(/`([^`]+)`/).map((morceau, i) =>
    i % 2 ? (
      <code key={i} className="rounded bg-night-800 px-1 py-0.5 font-mono text-[0.85em] text-chalk-100">
        {morceau}
      </code>
    ) : (
      morceau
    ),
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-2xl font-bold text-chalk-100">{titre}</h2>
      <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function PageContribuer({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const modele = lireModele();
  const lienExterne = "inline-flex items-center gap-2 text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500";

  return (
    <>
      <EnTetePage titre={t("pages.contribute.title")} chapeau={t("pages.contribute.lead")}>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {[
            [t("pages.contribute.statAnalyses"), herosAnalyses.length],
            [t("pages.contribute.statPending"), heros.length - herosAnalyses.length],
          ].map(([label, valeur]) => (
            <div key={String(label)}>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
              <dd className="mt-0.5 font-heading text-xl font-bold text-gold-400">{valeur}</dd>
            </div>
          ))}
        </dl>
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <Section titre={t("pages.contribute.principleTitle")}>
          <div className="space-y-4 leading-relaxed text-chalk-300">
            <p>{avecCode(t("pages.contribute.principle1"))}</p>
            <p>{avecCode(t("pages.contribute.principle2"))}</p>
          </div>
        </Section>

        <Section titre={t("pages.contribute.fieldsTitle")}>
          <p className="mb-5 leading-relaxed text-chalk-300">{avecCode(t("pages.contribute.fieldsIntro"))}</p>
          <div className="space-y-5">
            {GROUPES.map((g) => (
              <Carte key={g.cle}>
                <h3 className="font-heading text-lg font-bold text-gold-400">{t(`pages.contribute.group.${g.cle}`)}</h3>
                <dl className="mt-3 divide-y divide-night-800">
                  {g.champs.map((c) => (
                    <div key={c.cle} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-5">
                      <dt className="min-w-0">
                        <code className="font-mono text-sm text-chalk-100">{c.nom}</code>
                        <span className="mt-0.5 block break-words font-mono text-xs text-chalk-500">
                          {c.type}
                          {c.facultatif && ` · ${t("pages.contribute.optional")}`}
                        </span>
                      </dt>
                      <dd className="text-sm leading-relaxed text-chalk-300">
                        {avecCode(t(`pages.contribute.fields.${c.cle}`))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Carte>
            ))}
          </div>
        </Section>

        <Section titre={t("pages.contribute.templateTitle")}>
          <p className="leading-relaxed text-chalk-300">{avecCode(t("pages.contribute.templateIntro"))}</p>
          {modele && (
            <pre
              tabIndex={0}
              role="region"
              aria-label={t("pages.contribute.templateTitle")}
              className="bevel mt-4 max-h-[36rem] overflow-auto border border-night-700/70 bg-night-950 p-4 text-xs leading-relaxed text-chalk-300 outline-none focus-visible:border-gold-500"
            >
              <code>{modele}</code>
            </pre>
          )}
          <a href={`${site.depot}/blob/main/${MODELE}`} rel="noreferrer" className={`mt-4 ${lienExterne}`}>
            <FileCode size={16} aria-hidden />
            {t("pages.contribute.templateLink")}
          </a>
        </Section>

        <Section titre={t("pages.contribute.styleTitle")}>
          <ul className="space-y-3">
            {STYLE.map((cle) => (
              <li key={cle} className="flex gap-3 leading-relaxed text-chalk-300">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 bg-gold-500" />
                <span>{avecCode(t(`pages.contribute.style.${cle}`))}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section titre={t("pages.contribute.reviewTitle")}>
          <ol className="space-y-4">
            {ETAPES.map((cle, i) => (
              <li key={cle} className="flex gap-4 leading-relaxed text-chalk-300">
                <span
                  aria-hidden
                  className="bevel-sm grid size-8 shrink-0 place-items-center bg-night-800 font-heading text-sm font-bold text-gold-400"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 pt-1">{avecCode(t(`pages.contribute.review.${cle}`))}</span>
              </li>
            ))}
          </ol>
          <Carte className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-gold-500/30">
            <a href={`${site.depot}/compare`} rel="noreferrer" className={lienExterne}>
              <GitPullRequest size={16} aria-hidden />
              {t("pages.contribute.prLink")}
            </a>
            <a href={`${site.depot}/blob/main/CONTRIBUTING.md`} rel="noreferrer" className={lienExterne}>
              <BookOpen size={16} aria-hidden />
              {t("pages.contribute.guideLink")}
            </a>
          </Carte>
        </Section>
      </div>
    </>
  );
}

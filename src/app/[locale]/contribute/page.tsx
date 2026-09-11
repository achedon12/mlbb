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
    titre: t("pages.contribute.metaTitre"),
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
    cle: "analyse",
    champs: [
      { nom: "slug", type: "string", cle: "slug" },
      { nom: "resume", type: "string", cle: "resume" },
      { nom: "analyse", type: "string", cle: "analyse" },
      { nom: "competences", type: "Competence[]", cle: "competences" },
      { nom: "forces", type: "string[]", cle: "forces" },
      { nom: "faiblesses", type: "string[]", cle: "faiblesses" },
      { nom: "fortContre", type: "string[]", cle: "fortContre" },
      { nom: "faibleContre", type: "string[]", cle: "faibleContre" },
      { nom: "builds", type: "Build[]", cle: "builds" },
    ],
  },
  {
    cle: "competence",
    champs: [
      { nom: "type", type: '"Passif" | "Competence 1" | "Competence 2" | "Ultime"', cle: "competence.type" },
      { nom: "nom", type: "string", cle: "competence.nom" },
      { nom: "description", type: "string", cle: "competence.description" },
      { nom: "recharge", type: "number[]", cle: "competence.recharge", facultatif: true },
      { nom: "cout", type: "number[]", cle: "competence.cout", facultatif: true },
    ],
  },
  {
    cle: "build",
    champs: [
      { nom: "nom", type: "string", cle: "build.nom" },
      { nom: "contexte", type: "string", cle: "build.contexte" },
      { nom: "objets", type: "string[]", cle: "build.objets" },
      { nom: "embleme", type: "string", cle: "build.embleme" },
      { nom: "talent", type: "string", cle: "build.talent" },
      { nom: "sort", type: "string", cle: "build.sort" },
    ],
  },
];

const STYLE = ["accents", "termes", "original", "valeurs", "concret"];
const ETAPES = ["fork", "ajout", "verifier", "ouvrir", "relire", "fusion"];

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
      <code key={i} className="rounded bg-nuit-800 px-1 py-0.5 font-mono text-[0.85em] text-craie-100">
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
      <h2 className="font-titre text-2xl font-bold text-craie-100">{titre}</h2>
      <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function PageContribuer({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const modele = lireModele();
  const lienExterne = "inline-flex items-center gap-2 text-sm font-semibold text-or-400 underline underline-offset-4 hover:text-or-500";

  return (
    <>
      <EnTetePage titre={t("pages.contribute.titre")} chapeau={t("pages.contribute.chapeau")}>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {[
            [t("pages.contribute.statAnalyses"), herosAnalyses.length],
            [t("pages.contribute.statAttente"), heros.length - herosAnalyses.length],
          ].map(([label, valeur]) => (
            <div key={String(label)}>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{label}</dt>
              <dd className="mt-0.5 font-titre text-xl font-bold text-or-400">{valeur}</dd>
            </div>
          ))}
        </dl>
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <Section titre={t("pages.contribute.principeTitre")}>
          <div className="space-y-4 leading-relaxed text-craie-300">
            <p>{avecCode(t("pages.contribute.principe1"))}</p>
            <p>{avecCode(t("pages.contribute.principe2"))}</p>
          </div>
        </Section>

        <Section titre={t("pages.contribute.champsTitre")}>
          <p className="mb-5 leading-relaxed text-craie-300">{avecCode(t("pages.contribute.champsIntro"))}</p>
          <div className="space-y-5">
            {GROUPES.map((g) => (
              <Carte key={g.cle}>
                <h3 className="font-titre text-lg font-bold text-or-400">{t(`pages.contribute.groupe.${g.cle}`)}</h3>
                <dl className="mt-3 divide-y divide-nuit-800">
                  {g.champs.map((c) => (
                    <div key={c.cle} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-5">
                      <dt className="min-w-0">
                        <code className="font-mono text-sm text-craie-100">{c.nom}</code>
                        <span className="mt-0.5 block break-words font-mono text-xs text-craie-500">
                          {c.type}
                          {c.facultatif && ` · ${t("pages.contribute.facultatif")}`}
                        </span>
                      </dt>
                      <dd className="text-sm leading-relaxed text-craie-300">
                        {avecCode(t(`pages.contribute.champs.${c.cle}`))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Carte>
            ))}
          </div>
        </Section>

        <Section titre={t("pages.contribute.modeleTitre")}>
          <p className="leading-relaxed text-craie-300">{avecCode(t("pages.contribute.modeleIntro"))}</p>
          {modele && (
            <pre
              tabIndex={0}
              role="region"
              aria-label={t("pages.contribute.modeleTitre")}
              className="biseau mt-4 max-h-[36rem] overflow-auto border border-nuit-700/70 bg-nuit-950 p-4 text-xs leading-relaxed text-craie-300 outline-none focus-visible:border-or-500"
            >
              <code>{modele}</code>
            </pre>
          )}
          <a href={`${site.depot}/blob/main/${MODELE}`} rel="noreferrer" className={`mt-4 ${lienExterne}`}>
            <FileCode size={16} aria-hidden />
            {t("pages.contribute.modeleLien")}
          </a>
        </Section>

        <Section titre={t("pages.contribute.styleTitre")}>
          <ul className="space-y-3">
            {STYLE.map((cle) => (
              <li key={cle} className="flex gap-3 leading-relaxed text-craie-300">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 bg-or-500" />
                <span>{avecCode(t(`pages.contribute.style.${cle}`))}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section titre={t("pages.contribute.relectureTitre")}>
          <ol className="space-y-4">
            {ETAPES.map((cle, i) => (
              <li key={cle} className="flex gap-4 leading-relaxed text-craie-300">
                <span
                  aria-hidden
                  className="biseau-sm grid size-8 shrink-0 place-items-center bg-nuit-800 font-titre text-sm font-bold text-or-400"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 pt-1">{avecCode(t(`pages.contribute.relecture.${cle}`))}</span>
              </li>
            ))}
          </ol>
          <Carte className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-or-500/30">
            <a href={`${site.depot}/compare`} rel="noreferrer" className={lienExterne}>
              <GitPullRequest size={16} aria-hidden />
              {t("pages.contribute.lienPR")}
            </a>
            <a href={`${site.depot}/blob/main/CONTRIBUTING.md`} rel="noreferrer" className={lienExterne}>
              <BookOpen size={16} aria-hidden />
              {t("pages.contribute.lienGuide")}
            </a>
          </Carte>
        </Section>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { creerT } from "@/i18n/traductions";
import { assainirHtml, donneesLd } from "@/lib/html";
import { notFound } from "next/navigation";
import { CorpsArticle } from "@/components/article";
import { CreditWiki } from "@/components/credit-wiki";
import { FilAriane } from "@/components/fil-ariane";
import { NouveauHeros } from "@/components/nouveau-heros";
import { PatchHeros } from "@/components/patch-heros";
import { SommairePatch } from "@/components/sommaire-patch";
import { herosParSlug, illustrations, patchsDetail, patchsDetailles } from "@/lib/donnees";
import { article, articles, enHtml } from "@/lib/contenu";
import { compterAjustements, dateLongue, listeNoms } from "@/lib/fraicheur";
import { site } from "@/lib/site";
import type { PatchDetaille } from "@/lib/types";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { donneesBillet, metaPage } from "@/i18n/seo";
import { ChangementsHeros, nombreHerosModifies } from "./changements-heros";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

const patchs = patchsDetail;

/**
 * « MLBB Patch 2.1.88: All Hero Buffs & Nerfs (42 changes) » : le nombre de
 * heros touches, tire des notes, dit d'emblee l'ampleur du patch.
 */
function titrePatch(locale: Langue, patch: PatchDetaille): string {
  const t = creerT(locale);
  const n = nombreHerosModifies(patch);
  if (n === 0) return t("pages.seo.patch.titre", { v: patch.version });
  const forme = new Intl.PluralRules(locale).select(n) === "one" ? "one" : "other";
  return t(`pages.seo.patch.titreChangements.${forme}`, { v: patch.version, n });
}

/**
 * Une meme route sert deux choses : les notes officielles reprises du wiki,
 * designees par leur numero de version, et les analyses redigees, designees
 * par leur slug. Les deux ne peuvent pas entrer en collision — un numero de
 * version n'est jamais un slug d'article.
 */
export function generateStaticParams() {
  return [
    ...Object.keys(patchs).map((version) => ({ slug: version })),
    ...articles("patch-notes").map((a) => ({ slug: a.slug })),
  ];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const patch = patchs[slug];

  if (patch) {
    const t = creerT(locale);
    // Description en donnees : date, ajustements par sens et premiers heros touches.
    const noms = [...new Set(patch.ajustements.map((a) => herosParSlug.get(a.slug)?.nom ?? a.nom))].slice(0, 4);
    const version = patch.date ? `${patch.version} (${dateLongue(locale, patch.date)})` : patch.version;
    return metaPage(locale, {
      titre: titrePatch(locale, patch),
      description: noms.length
        ? t("pages.seo.patch.description", {
            version,
            ...compterAjustements(patch.ajustements),
            heros: listeNoms(locale, noms),
          })
        : t("pages.patchNotes.officielleDescription", { version: patch.version }),
      partage: t("pages.patchNotes.officiellePartage", { version: patch.version }),
      chemin: `/patch-notes/${slug}`,
      type: "article",
      publie: patch.date ?? undefined,
    });
  }

  const a = article("patch-notes", slug, locale);
  if (!a) return {};

  return metaPage(locale, {
    titre: a.titre,
    description: a.chapeau,
    chemin: `/patch-notes/${slug}`,
    type: "article",
    motsCles: a.motsCles,
    publie: a.date,
    auteur: a.auteur,
  });
}

export default async function PagePatch({ params }: Params) {
  const { locale, slug } = await params;
  const patch = patchsDetailles(locale)[slug];
  const t = creerT(locale);

  // ── Notes officielles reprises du wiki ────────────────────────────────
  if (patch) {
    // Un patch pas encore traduit est servi dans sa langue d'origine.
    const traduit = patch !== patchsDetail[slug];
    const donneesStructurees = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: titrePatch(locale, patch),
      ...(patch.date ? { datePublished: patch.date, dateModified: patch.date } : {}),
      inLanguage: traduit ? LOCALE_HTML[locale] : "en",
      isBasedOn: patch.lien,
      publisher: { "@type": "Organization", name: site.nom, url: site.url },
      mainEntityOfPage: `${site.url}/${locale}/patch-notes/${slug}`,
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
        />

        <div className="mx-auto max-w-6xl px-4 py-12">
          <FilAriane
            miettes={[
              { nom: t("nav.patchNotes.label"), href: "/patch-notes" },
              {
                nom: `Patch ${patch.version}`,
                freres: Object.values(patchsDetail)
                  .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
                  .map((p) => ({ nom: `Patch ${p.version}`, href: `/patch-notes/${p.version}` })),
              },
            ]}
          />

          <header className="mt-6 border-b border-nuit-800 pb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-or-400">
              {t("pages.patchNotes.officielles")}
            </p>
            <h1 className="mt-2 font-titre text-4xl font-bold text-craie-100">
              Patch {patch.version}
            </h1>
            <p className="mt-3 text-sm text-craie-500">
              {t("pages.patchNotes.nSections", { n: patch.sommaire.length })}
              {patch.date && (
                <>
                  {" · "}
                  <time dateTime={patch.date}>
                    {t("pages.patchNotes.publieLe", { date: dateLongue(locale, patch.date) })}
                  </time>
                </>
              )}
            </p>
          </header>

          {patch.ajustements.length > 0 && (
            <ChangementsHeros
              patch={patch}
              langue={locale}
              ancreDetail={patch.sections.find((s) => s.role === "ajustements")?.ancre ?? null}
            />
          )}

          {/*
            Le sommaire accompagne la lecture plutot que de la preceder : une
            note de patch se parcourt par sections, on n'en lit presque jamais
            l'integralite.
          */}
          <div className="mt-10 gap-10 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="mb-10 lg:mb-0">
              {patch.sommaire.length > 0 && <SommairePatch entrees={patch.sommaire} />}
            </aside>

            <article className="min-w-0 max-w-3xl">
              {/*
                Les notes sont rendues section par section, dans leur ordre
                d'origine. Deux sections sont reprises par un composant riche a
                leur place exacte — la presentation des nouveaux heros et le
                tableau des ajustements — le reste garde le HTML du wiki, nettoye
                a la synchronisation. La source est creditee sous l'article,
                comme l'exige sa licence.
              */}
              {patch.sections.map((section, i) => (
                <section key={section.ancre ?? i} className="mb-12">
                  {section.titre && (
                    <>
                      <h2
                        id={section.ancre ?? undefined}
                        className="scroll-mt-24 font-titre text-2xl font-bold text-craie-100"
                      >
                        {section.titre}
                      </h2>
                      <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
                    </>
                  )}

                  <div className={section.titre ? "mt-5" : undefined}>
                    {section.role === "nouveaux" ? (
                      <div className="space-y-10">
                        {patch.nouveaux.map((h) => {
                          const fiche = herosParSlug.get(h.slug);
                          const illus = illustrations[h.slug] ?? {};
                          const illustration =
                            (h.epithete ? illus[h.epithete] : undefined) ??
                            Object.values(illus)[0] ??
                            null;
                          return (
                            <NouveauHeros
                              key={h.slug}
                              langue={locale}
                              heros={{
                                ...h,
                                portrait: fiche?.visuels.portrait ?? null,
                                illustration,
                                roles: fiche?.roles ?? [],
                                fiche: Boolean(fiche),
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : section.role === "ajustements" ? (
                      <PatchHeros
                        ajustements={patch.ajustements.map((a) => ({
                          ...a,
                          portrait:
                            herosParSlug.get(a.slug)?.visuels.icone ??
                            herosParSlug.get(a.slug)?.visuels.portrait ??
                            null,
                          fiche: herosParSlug.has(a.slug),
                        }))}
                        bilan={patch.bilan}
                      />
                    ) : (
                      <div
                        className="prose-mlbb"
                        dangerouslySetInnerHTML={{ __html: assainirHtml(section.html) }}
                      />
                    )}
                  </div>
                </section>
              ))}

              <CreditWiki
                t={t}
                href={patch.lien}
                cle={traduit ? "pages.patchNotes.creditTraduit" : "pages.patchNotes.credit"}
                className="mt-12 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500"
              />
            </article>
          </div>
        </div>
      </>
    );
  }

  // ── Analyse redigee ───────────────────────────────────────────────────
  const a = article("patch-notes", slug, locale);
  if (!a) notFound();

  const donneesStructurees = donneesBillet(a, `/patch-notes/${slug}`, locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <CorpsArticle
        langue={locale}
        article={a}
        html={enHtml(a.contenu)}
        retour={{ href: "/patch-notes", label: t("pages.patchNotes.tous") }}
      />
    </>
  );
}

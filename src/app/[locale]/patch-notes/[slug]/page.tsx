import type { Metadata } from "next";
import { assainirHtml, donneesLd } from "@/lib/html";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CorpsArticle } from "@/components/article";
import { FilAriane } from "@/components/fil-ariane";
import { NouveauHeros } from "@/components/nouveau-heros";
import { PatchHeros } from "@/components/patch-heros";
import { SommairePatch } from "@/components/sommaire-patch";
import { herosParSlug, illustrations, patchsDetail } from "@/lib/donnees";
import { article, articles, enHtml } from "@/lib/contenu";
import { site } from "@/lib/site";
import type { Langue } from "@/i18n/config";
import { metaLangues } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

const patchs = patchsDetail;

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
    return {
      title: `Patch ${patch.version}`,
      description: `Notes officielles de la mise a jour ${patch.version} de Mobile Legends: Bang Bang : nouveaux heros, ajustements et changements d'objets.`,
      alternates: metaLangues(locale, `/patch-notes/${slug}`),
      openGraph: {
        type: "article",
        title: `Patch ${patch.version} — ${site.nom}`,
        description: `Notes de la mise a jour ${patch.version}.`,
        url: `/${locale}/patch-notes/${slug}`,
      },
    };
  }

  const a = article("patch-notes", slug);
  if (!a) return {};

  return {
    title: a.titre,
    description: a.chapeau,
    keywords: a.motsCles,
    alternates: metaLangues(locale, `/patch-notes/${slug}`),
    openGraph: {
      type: "article",
      title: a.titre,
      description: a.chapeau,
      url: `/${locale}/patch-notes/${slug}`,
      publishedTime: a.date,
      authors: [a.auteur],
    },
  };
}

export default async function PagePatch({ params }: Params) {
  const { locale, slug } = await params;
  const patch = patchs[slug];

  // ── Notes officielles reprises du wiki ────────────────────────────────
  if (patch) {
    const donneesStructurees = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `Patch ${patch.version}`,
      inLanguage: "en",
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
              { nom: "Patch notes", href: "/patch-notes" },
              { nom: `Patch ${patch.version}` },
            ]}
          />
          <Link
            href="/patch-notes"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-craie-500 transition-colors hover:text-or-400"
          >
            <ArrowLeft size={15} aria-hidden />
            Tous les patch notes
          </Link>

          <header className="mt-6 border-b border-nuit-800 pb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-or-400">
              Notes officielles
            </p>
            <h1 className="mt-2 font-titre text-4xl font-bold text-craie-100">
              Patch {patch.version}
            </h1>
            <p className="mt-3 text-sm text-craie-500">
              {patch.sommaire.length} sections
            </p>
          </header>

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

              <p className="mt-12 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500">
            Notes reprises du{" "}
            <a
              href={patch.lien}
              rel="noreferrer nofollow"
              target="_blank"
              className="text-or-400 hover:underline"
            >
              wiki Mobile Legends
            </a>
                , sous licence CC BY-SA. Le texte original est publie par
                Moonton ; ce site n&apos;en modifie pas le contenu.
              </p>
            </article>
          </div>
        </div>
      </>
    );
  }

  // ── Analyse redigee ───────────────────────────────────────────────────
  const a = article("patch-notes", slug);
  if (!a) notFound();

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.titre,
    description: a.chapeau,
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: "fr-FR",
    keywords: a.motsCles.join(", "),
    author: { "@type": "Person", name: a.auteur, url: `https://github.com/${a.auteur}` },
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}/patch-notes/${slug}`,
  };

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
        retour={{ href: "/patch-notes", label: "Tous les patch notes" }}
      />
    </>
  );
}

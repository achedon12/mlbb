import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CorpsArticle } from "@/components/article";
import detailPatchs from "@/data/genere/patchs-detail.json";
import { article, articles, enHtml } from "@/lib/contenu";
import { site } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

interface PatchDetaille {
  version: string;
  titre: string;
  lien: string;
  sommaire: { niveau: number; titre: string }[];
  html: string;
}

const patchs = detailPatchs as unknown as Record<string, PatchDetaille>;

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
  const { slug } = await params;
  const patch = patchs[slug];

  if (patch) {
    return {
      title: `Patch ${patch.version}`,
      description: `Notes officielles de la mise a jour ${patch.version} de Mobile Legends: Bang Bang : nouveaux heros, ajustements et changements d'objets.`,
      alternates: { canonical: `/patch-notes/${slug}` },
      openGraph: {
        type: "article",
        title: `Patch ${patch.version} — ${site.nom}`,
        description: `Notes de la mise a jour ${patch.version}.`,
        url: `/patch-notes/${slug}`,
      },
    };
  }

  const a = article("patch-notes", slug);
  if (!a) return {};

  return {
    title: a.titre,
    description: a.chapeau,
    keywords: a.motsCles,
    alternates: { canonical: `/patch-notes/${slug}` },
    openGraph: {
      type: "article",
      title: a.titre,
      description: a.chapeau,
      url: `/patch-notes/${slug}`,
      publishedTime: a.date,
      authors: [a.auteur],
    },
  };
}

export default async function PagePatch({ params }: Params) {
  const { slug } = await params;
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
      mainEntityOfPage: `${site.url}/patch-notes/${slug}`,
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
        />

        <article className="mx-auto max-w-3xl px-4 py-12">
          <Link
            href="/patch-notes"
            className="inline-flex items-center gap-1.5 text-sm text-craie-500 transition-colors hover:text-or-400"
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

            {patch.sommaire.length > 0 && (
              <nav aria-label="Sommaire" className="mt-6">
                <ul className="flex flex-wrap gap-2">
                  {patch.sommaire.map((s) => (
                    <li
                      key={s.titre}
                      className="biseau-sm border border-nuit-700 px-2.5 py-1 text-xs text-craie-500"
                    >
                      {s.titre}
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </header>

          {/*
            Contenu repris du wiki communautaire, nettoye a la synchronisation.
            La source est creditee sous l'article, comme l'exige sa licence.
          */}
          <div
            className="prose-mlbb mt-10"
            dangerouslySetInnerHTML={{ __html: patch.html }}
          />

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
            , sous licence CC BY-SA. Le texte original est publie par Moonton ;
            ce site n&apos;en modifie pas le contenu.
          </p>
        </article>
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
    mainEntityOfPage: `${site.url}/patch-notes/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />
      <CorpsArticle
        article={a}
        html={enHtml(a.contenu)}
        retour={{ href: "/patch-notes", label: "Tous les patch notes" }}
      />
    </>
  );
}

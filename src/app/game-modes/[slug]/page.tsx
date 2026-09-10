import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { FilAriane } from "@/components/fil-ariane";
import { donneesLd } from "@/lib/html";
import { modes, modesParSlug } from "@/lib/donnees";
import { ACCENT_MODE_DEFAUT, FICHES_MODES } from "@/lib/modes";
import { site } from "@/lib/site";
import type { SectionMode } from "@/lib/types";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return modes.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const mode = modesParSlug.get(slug);
  if (!mode) return {};
  const description = FICHES_MODES[slug]?.texte ?? mode.description ?? undefined;
  return {
    title: `Mode ${mode.nom}`,
    description,
    alternates: { canonical: `/game-modes/${slug}` },
    openGraph: {
      title: `${mode.nom} — ${site.nom}`,
      description,
      url: `/game-modes/${slug}`,
    },
  };
}

/** Regroupe les points de liste consecutifs pour les rendre dans un seul `<ul>`. */
function rendreElements(elements: SectionMode["elements"]) {
  const blocs: React.ReactNode[] = [];
  let liste: string[] = [];

  const viderListe = (cle: number) => {
    if (!liste.length) return;
    blocs.push(
      <ul key={`ul-${cle}`} className="space-y-2.5">
        {liste.map((texte, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-craie-300">
            <span aria-hidden className="mt-2 size-1 shrink-0 bg-or-500" />
            {texte}
          </li>
        ))}
      </ul>,
    );
    liste = [];
  };

  elements.forEach((e, i) => {
    if (e.type === "li") {
      liste.push(e.texte);
    } else {
      viderListe(i);
      blocs.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed text-craie-300">
          {e.texte}
        </p>,
      );
    }
  });
  viderListe(elements.length);
  return blocs;
}

export default async function PageMode({ params }: Params) {
  const { slug } = await params;
  const mode = modesParSlug.get(slug);
  if (!mode) notFound();

  const fiche = FICHES_MODES[slug];
  const [sombre, clair] = fiche?.accent ?? ACCENT_MODE_DEFAUT;

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Mode ${mode.nom} — Mobile Legends: Bang Bang`,
    description: fiche?.texte ?? mode.description ?? undefined,
    inLanguage: "fr-FR",
    author: { "@type": "Person", name: site.auteur },
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    mainEntityOfPage: `${site.url}/game-modes/${slug}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />

      {/* Banniere de tete, reprenant l'accent du mode. */}
      <div className="relative isolate overflow-hidden border-b border-nuit-700/70">
        <div
          aria-hidden
          className="absolute inset-0 -z-20"
          style={{ background: `linear-gradient(115deg, ${sombre} 0%, #0a0e1a 58%, #06080f 100%)` }}
        />
        {mode.image && (
          <Image
            aria-hidden
            src={mode.image}
            alt=""
            width={520}
            height={520}
            priority
            className="pointer-events-none absolute -right-10 top-1/2 -z-10 h-[150%] w-auto -translate-y-1/2 object-contain opacity-25 blur-[1px] sm:opacity-30"
          />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-nuit-950/90 via-nuit-950/50 to-transparent" />

        <div className="mx-auto max-w-4xl px-4 py-12">
          <FilAriane
            miettes={[
              { nom: "Accueil", href: "/" },
              { nom: "Modes de jeu", href: "/game-modes" },
              { nom: mode.nom },
            ]}
          />
          {fiche && (
            <p className="mt-6 font-titre text-xs font-bold uppercase tracking-[0.2em]" style={{ color: clair }}>
              {fiche.accroche}
            </p>
          )}
          <h1 className="mt-2 font-titre text-4xl font-bold text-craie-100 sm:text-5xl">{mode.nom}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-craie-200">{fiche?.texte ?? mode.description}</p>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-12">
        {mode.description && (!fiche || fiche.texte !== mode.description) && (
          <p className="mb-10 border-l-2 pl-4 leading-relaxed text-craie-300" style={{ borderColor: clair }}>
            {mode.description}
          </p>
        )}

        {mode.sections.length > 0 ? (
          <div className="space-y-10">
            {mode.sections.map((section) => (
              <section key={section.titre}>
                <h2 className="font-titre text-xl font-bold text-craie-100">{section.titre}</h2>
                <div aria-hidden className="filet-or mt-2 h-0.5 w-12" />
                <div className="mt-4 space-y-4">{rendreElements(section.elements)}</div>
              </section>
            ))}
          </div>
        ) : (
          <p className="leading-relaxed text-craie-500">
            Le detail de ce mode n&apos;est pas encore documente.
          </p>
        )}

        <p className="mt-12 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500">
          Contenu repris et traduit du{" "}
          <a
            href="https://mobilelegends.fandom.com/wiki/Game_Modes"
            rel="noreferrer nofollow"
            target="_blank"
            className="text-or-400 hover:underline"
          >
            wiki Mobile Legends
          </a>
          , sous licence CC BY-SA.
        </p>
      </article>
    </>
  );
}

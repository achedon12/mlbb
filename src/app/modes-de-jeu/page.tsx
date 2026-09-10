import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EnTetePage } from "@/components/ui";
import { modes } from "@/lib/donnees";
import { ACCENT_MODE_DEFAUT, FICHES_MODES } from "@/lib/modes";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Modes de jeu",
  description:
    "Les modes de jeu de Mobile Legends: Bang Bang — Classique, Classe, Baston, Vs. IA, Personnalise et Arcade — presentes un par un, regles detaillees a l'appui.",
  alternates: { canonical: "/modes-de-jeu" },
  openGraph: {
    title: `Modes de jeu — ${site.nom}`,
    description: "Les modes de jeu de Mobile Legends: Bang Bang et ce qui les distingue.",
    url: "/modes-de-jeu",
  },
};

const donneesStructurees = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Modes de jeu de Mobile Legends: Bang Bang",
  numberOfItems: modes.length,
  itemListElement: modes.map((m, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: m.nom,
    url: `${site.url}/modes-de-jeu/${m.slug}`,
    description: FICHES_MODES[m.slug]?.texte,
  })),
};

export default function PageModes() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees).replace(/</g, "\\u003c") }}
      />
      <EnTetePage
        titre="Modes de jeu"
        chapeau="Du 5 contre 5 classique aux parties rapides en Baston, chaque mode change les regles. Choisissez-en un pour en decouvrir le detail."
      />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-5">
          {modes.map((mode) => {
            const fiche = FICHES_MODES[mode.slug];
            const [sombre, clair] = fiche?.accent ?? ACCENT_MODE_DEFAUT;
            return (
              <Link
                key={mode.slug}
                href={`/modes-de-jeu/${mode.slug}`}
                className="biseau group relative isolate block overflow-hidden border border-nuit-700/70 transition-colors hover:border-nuit-600"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 -z-20"
                  style={{ background: `linear-gradient(115deg, ${sombre} 0%, #0a0e1a 55%, #06080f 100%)` }}
                />
                {mode.image && (
                  <Image
                    aria-hidden
                    src={mode.image}
                    alt=""
                    width={360}
                    height={360}
                    className="pointer-events-none absolute -right-6 top-1/2 -z-10 h-[130%] w-auto -translate-y-1/2 object-contain opacity-25 blur-[1px] transition duration-500 group-hover:opacity-35 sm:-right-2 sm:opacity-30"
                  />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0 -z-10 bg-gradient-to-r from-nuit-950/85 via-nuit-950/45 to-transparent"
                />

                <div className="flex min-h-[180px] flex-col justify-end gap-3 p-6 sm:min-h-[200px] sm:p-8">
                  {fiche && (
                    <p
                      className="font-titre text-[0.7rem] font-bold uppercase tracking-[0.2em]"
                      style={{ color: clair }}
                    >
                      {fiche.accroche}
                    </p>
                  )}
                  <h2 className="font-titre text-2xl font-bold text-craie-100 sm:text-3xl">{mode.nom}</h2>
                  <p className="max-w-xl text-sm leading-relaxed text-craie-300">
                    {fiche?.texte ?? mode.description}
                  </p>
                  <span
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-0.5"
                    style={{ color: clair }}
                  >
                    Decouvrir le mode
                    <ArrowRight size={16} aria-hidden />
                  </span>
                </div>

                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ background: `linear-gradient(90deg, ${clair}, transparent)` }}
                />
              </Link>
            );
          })}
        </div>

        <p className="mt-8 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500">
          Contenus repris et traduits du{" "}
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
      </div>
    </>
  );
}

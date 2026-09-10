import type { Metadata } from "next";
import Image from "next/image";
import { EnTetePage } from "@/components/ui";
import { modes } from "@/lib/donnees";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Modes de jeu",
  description:
    "Les modes de jeu de Mobile Legends: Bang Bang — Classique, Classe, Baston, Vs. IA, Personnalise et Arcade — avec leur presentation.",
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
  })),
};

export default function PageModes() {
  return (
    <>
      <script
        type="application/ld+json"
        // Donnees d'un catalogue simple : aucune valeur issue d'une saisie tierce.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees).replace(/</g, "\\u003c") }}
      />
      <EnTetePage
        titre="Modes de jeu"
        chapeau="Du 5 contre 5 classique aux parties rapides en Baston, chaque mode change les regles. Voici ceux que propose le jeu, et ce qui les distingue."
      />

      <div className="mx-auto max-w-4xl px-4 py-12">
        <ul className="space-y-4">
          {modes.map((mode) => (
            <li
              key={mode.slug}
              className="biseau flex flex-col gap-4 border border-nuit-700/70 bg-nuit-900/60 p-5 sm:flex-row sm:items-start"
            >
              {mode.image && (
                <span className="biseau-sm relative h-24 w-full shrink-0 overflow-hidden bg-nuit-800 sm:h-20 sm:w-32">
                  <Image
                    src={mode.image}
                    alt={mode.nom}
                    fill
                    sizes="(min-width: 640px) 128px, 100vw"
                    className="object-contain"
                  />
                </span>
              )}
              <div className="min-w-0">
                <h2 className="font-titre text-lg font-bold text-craie-100">{mode.nom}</h2>
                {mode.description && (
                  <p className="mt-2 text-sm leading-relaxed text-craie-300">{mode.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500">
          Presentations reprises du{" "}
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

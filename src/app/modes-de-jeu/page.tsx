import type { Metadata } from "next";
import Image from "next/image";
import { EnTetePage } from "@/components/ui";
import { modes } from "@/lib/donnees";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Modes de jeu",
  description:
    "Les modes de jeu de Mobile Legends: Bang Bang — Classique, Classe, Baston, Vs. IA, Personnalise et Arcade — presentes un par un.",
  alternates: { canonical: "/modes-de-jeu" },
  openGraph: {
    title: `Modes de jeu — ${site.nom}`,
    description: "Les modes de jeu de Mobile Legends: Bang Bang et ce qui les distingue.",
    url: "/modes-de-jeu",
  },
};

/**
 * Presentation editoriale des modes, en francais. Le catalogue synchronise
 * (`modes`) ne fournit que le nom et le visuel officiels ; l'accroche, le
 * texte et la couleur d'accent sont ecrits ici, mode par mode.
 */
type FicheMode = {
  accroche: string;
  texte: string;
  /** Deux teintes, du plus sombre au plus clair, pour le degrade d'accent. */
  accent: [string, string];
};

const FICHES: Record<string, FicheMode> = {
  classic: {
    accroche: "Le 5 contre 5 de reference",
    texte:
      "Deux equipes de cinq, trois voies, un Nexus a detruire. Le mode fondateur, sans enjeu de classement : l'ideal pour decouvrir un heros ou s'echauffer.",
    accent: ["#1b4f96", "#4da3ff"],
  },
  ranked: {
    accroche: "Grimpez les rangs",
    texte:
      "La file competitive. Chaque victoire rapporte des etoiles et fait monter d'Avertissement jusqu'a Gloire Mythique, avec bannissements et selection en draft a partir d'Epique.",
    accent: ["#8a6415", "#f5c451"],
  },
  brawl: {
    accroche: "Une seule voie, tout de suite",
    texte:
      "Carte unique a une lane, heros tire au sort. Des parties courtes et nerveuses, sans jungle ni longue phase de retour a la base.",
    accent: ["#8f2626", "#ff6b6b"],
  },
  "vs-ai": {
    accroche: "Affrontez l'ordinateur",
    texte:
      "Des adversaires controles par l'IA, a difficulte reglable. Pour tester un build ou apprivoiser un nouveau heros sans la pression du classement.",
    accent: ["#146b62", "#4de0d0"],
  },
  custom: {
    accroche: "Vos regles",
    texte:
      "Creez une partie sur mesure : composition des equipes, spectateurs, carte et parametres libres. Le mode des tournois et des matchs entre amis.",
    accent: ["#4b3a99", "#a98bff"],
  },
  "arcade-mode": {
    accroche: "Les modes ephemeres",
    texte:
      "Une rotation de modes speciaux et festifs — Chasse Magique, Survie et autres variantes — proposes pour une duree limitee.",
    accent: ["#8f2f74", "#ff77c2"],
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
    description: FICHES[m.slug]?.texte,
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

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-5">
          {modes.map((mode) => {
            const fiche = FICHES[mode.slug];
            const [sombre, clair] = fiche?.accent ?? ["#1c2742", "#2a3758"];
            return (
              <article
                key={mode.slug}
                className="biseau group relative isolate overflow-hidden border border-nuit-700/70"
                style={
                  {
                    "--accent": clair,
                    "--accent-sombre": sombre,
                  } as React.CSSProperties
                }
              >
                {/* Fond : degrade teinte par l'accent du mode. */}
                <div
                  aria-hidden
                  className="absolute inset-0 -z-20"
                  style={{
                    background: `linear-gradient(115deg, ${sombre} 0%, #0a0e1a 55%, #06080f 100%)`,
                  }}
                />
                {/* Visuel officiel, en grand, deborde a droite comme un filigrane. */}
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
                {/* Voile pour garantir la lisibilite du texte cote gauche. */}
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
                  <h2 className="font-titre text-2xl font-bold text-craie-100 sm:text-3xl">
                    {mode.nom}
                  </h2>
                  <p className="max-w-xl text-sm leading-relaxed text-craie-300">
                    {fiche?.texte ?? mode.description}
                  </p>
                </div>

                {/* Liseré d'accent en bas, rappel du biseau du jeu. */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ background: `linear-gradient(90deg, ${clair}, transparent)` }}
                />
              </article>
            );
          })}
        </div>

        <p className="mt-8 border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500">
          Visuels officiels des modes repris du{" "}
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

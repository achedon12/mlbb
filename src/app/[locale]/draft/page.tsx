import type { Metadata } from "next";
import { OutilDraft } from "@/components/outil-draft";
import { EnTetePage } from "@/components/ui";
import statistiques from "@/data/jeu/statistiques.json";
import { heros } from "@/lib/donnees";
import type { HerosDraft } from "@/lib/draft";
import { classementComplet } from "@/lib/tier-list";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Aide au draft",
  description:
    "Renseignez la composition adverse : l'outil propose quoi prendre sur chaque lane, et explique pourquoi — contres, synergies et taux de victoire.",
  alternates: { canonical: "/draft" },
  openGraph: {
    title: `Aide au draft — ${site.nom}`,
    description: "Quoi prendre face a la composition d'en face, et pourquoi.",
    url: "/draft",
  },
};

interface Relation {
  fortContre: string[];
  faibleContre: string[];
  synergies: string[];
}

const relations = statistiques.relations as unknown as Record<string, Relation>;

export default function PageDraft() {
  const taux = new Map(classementComplet.map((e) => [e.heros.slug, e.victoire]));

  // On n'envoie au client que ce dont l'outil se sert : la fiche complete
  // d'un heros porte des competences et des skins qui n'entrent pas dans le
  // calcul et pesent lourd multiplies par 133.
  const donnees: HerosDraft[] = heros.map((h) => ({
    slug: h.slug,
    nom: h.nom,
    lanes: h.lanes,
    icone: h.visuels.icone ?? h.visuels.portrait,
    victoire: taux.get(h.slug) ?? null,
    fortContre: relations[h.slug]?.fortContre ?? [],
    faibleContre: relations[h.slug]?.faibleContre ?? [],
    synergies: relations[h.slug]?.synergies ?? [],
  }));

  return (
    <>
      <EnTetePage
        titre="Aide au draft"
        chapeau="Renseignez ce que vous voyez en face, lane par lane. L'outil propose des reponses et dit ce qui les justifie. Ajoutez vos propres picks au fur et a mesure : les suggestions s'ajustent."
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <OutilDraft heros={donnees} />

        <p className="mt-14 border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-500">
          Les contres et les synergies proviennent des relations remontees par
          le jeu, pas d&apos;une opinion. Elles ne couvrent pas tous les duels :
          un heros sans contre connu dans une composition n&apos;est pas pour
          autant un mauvais choix — il n&apos;a simplement rien de particulier a
          y opposer.
        </p>
      </div>
    </>
  );
}

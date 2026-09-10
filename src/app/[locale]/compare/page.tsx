import type { Metadata } from "next";
import { ComparateurHeros, type HerosComparable } from "@/components/comparateur-heros";
import { EnTetePage } from "@/components/ui";
import { heros } from "@/lib/donnees";
import { tauxParSlug } from "@/lib/tier-list";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Comparateur de heros",
  description:
    "Comparez deux heros de Mobile Legends: Bang Bang cote a cote : offensive, resistance, effets, difficulte, taux de victoire et de ban, roles et positions.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: `Comparateur de heros — ${site.nom}`,
    description: "Deux heros compares cote a cote : notes, taux de victoire et de ban, roles.",
    url: "/compare",
  },
};

export default function PageComparateur() {
  const comparables: HerosComparable[] = heros.map((h) => {
    const taux = tauxParSlug.get(h.slug);
    return {
      slug: h.slug,
      nom: h.nom,
      icone: h.visuels.icone ?? h.visuels.portrait,
      roles: h.roles,
      lanes: h.lanes,
      notes: h.notes,
      victoire: taux?.victoire ?? null,
      ban: taux?.ban ?? null,
      palier: taux?.palier ?? null,
      skins: h.skins.length,
    };
  });

  return (
    <>
      <EnTetePage
        titre="Comparateur"
        chapeau="Choisissez deux heros et lisez leurs forces cote a cote : notes du wiki, taux de victoire et de ban remontes par le jeu, roles et positions. La meilleure valeur de chaque ligne est mise en avant."
      />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ComparateurHeros heros={comparables} />
      </div>
    </>
  );
}

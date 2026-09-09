import type { Metadata } from "next";
import { GuideEmblemes } from "@/components/guide-emblemes";
import { EnTetePage } from "@/components/ui";
import { emblemes, sortsDeCombat, talents } from "@/data/emblemes";
import visuelsEmblemes from "@/data/genere/visuels-emblemes.json";
import visuelsSorts from "@/data/genere/visuels-sorts.json";
import visuelsTalents from "@/data/genere/visuels-talents.json";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Emblemes, talents et sorts",
  description:
    "Quel embleme, quel talent et quel sort de combat prendre selon votre role dans Mobile Legends: Bang Bang. Choisissez votre embleme, la page s'organise autour.",
  alternates: { canonical: "/emblemes" },
  openGraph: {
    title: `Emblemes, talents et sorts — ${site.nom}`,
    description: "Que prendre selon votre role : emblemes, talents et sorts de combat.",
    url: "/emblemes",
  },
};

const images: Record<string, string> = {
  ...(visuelsEmblemes as Record<string, string>),
  ...(visuelsTalents as Record<string, string>),
  ...(visuelsSorts as Record<string, string>),
};

export default function PageEmblemes() {
  return (
    <>
      <EnTetePage
        titre="Emblemes et talents"
        chapeau="La vraie question n'est pas quels talents existent, mais lesquels prendre pour le role que vous jouez. Choisissez votre embleme : le reste de la page se reorganise autour."
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <GuideEmblemes
          emblemes={[...emblemes]}
          talents={[...talents]}
          sorts={[...sortsDeCombat]}
          images={images}
        />
      </div>
    </>
  );
}

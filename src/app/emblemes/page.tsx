import type { Metadata } from "next";
import Image from "next/image";
import { EnTetePage } from "@/components/ui";
import { emblemes, sortsDeCombat, talents } from "@/data/emblemes";
import visuelsEmblemes from "@/data/genere/visuels-emblemes.json";
import visuelsSorts from "@/data/genere/visuels-sorts.json";
import visuelsTalents from "@/data/genere/visuels-talents.json";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Emblemes, talents et sorts",
  description:
    "Les emblemes, les talents et les sorts de combat de Mobile Legends: Bang Bang, avec leur visuel et le type de heros auquel chacun est destine.",
  alternates: { canonical: "/emblemes" },
  openGraph: {
    title: `Emblemes, talents et sorts — ${site.nom}`,
    description: "Emblemes, talents et sorts de combat, et a qui chacun est destine.",
    url: "/emblemes",
  },
};

const IMAGES: Record<string, string> = {
  ...(visuelsEmblemes as Record<string, string>),
  ...(visuelsTalents as Record<string, string>),
  ...(visuelsSorts as Record<string, string>),
};

export default function PageEmblemes() {
  const decisifs = talents.filter((t) => t.decisif);
  const attributs = talents.filter((t) => !t.decisif);

  return (
    <>
      <EnTetePage
        titre="Emblemes et talents"
        chapeau="Le choix d'un embleme, d'un talent ou d'un sort se joue sur le role tenu, pas sur la valeur brute du bonus. Chaque entree precise a qui elle s'adresse."
      />

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        <Section titre="Emblemes" nombre={emblemes.length}>
          <Grille>
            {emblemes.map((e) => (
              <Vignette
                key={e.cle}
                image={IMAGES[e.cle]}
                nom={e.nom}
                accent={e.bonus}
                description={e.pourQui}
              />
            ))}
          </Grille>
        </Section>

        <Section
          titre="Talents decisifs"
          nombre={decisifs.length}
          chapeau="Le dernier etage du talent : c'est lui qui change reellement une partie."
        >
          <Grille>
            {decisifs.map((t) => (
              <Vignette
                key={t.cle}
                image={IMAGES[t.cle]}
                nom={t.nom}
                accent={t.description}
                description={t.pourQui}
              />
            ))}
          </Grille>
        </Section>

        <Section
          titre="Attributs"
          nombre={attributs.length}
          chapeau="Les premiers etages ajustent les statistiques. Ils comptent, sans decider."
        >
          <Grille>
            {attributs.map((t) => (
              <Vignette
                key={t.cle}
                image={IMAGES[t.cle]}
                nom={t.nom}
                accent={t.description}
                description={t.pourQui}
              />
            ))}
          </Grille>
        </Section>

        <Section titre="Sorts de combat" nombre={sortsDeCombat.length}>
          <Grille>
            {sortsDeCombat.map((s) => (
              <Vignette
                key={s.cle}
                image={IMAGES[s.cle]}
                nom={s.nom}
                accent={`${s.recharge} s · ${s.description}`}
                description={s.pourQui}
              />
            ))}
          </Grille>
        </Section>
      </div>
    </>
  );
}

function Section({
  titre,
  nombre,
  chapeau,
  children,
}: {
  titre: string;
  nombre: number;
  chapeau?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="font-titre text-2xl font-bold text-craie-100">{titre}</h2>
        <span className="text-sm text-craie-500">{nombre}</span>
      </div>
      <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
      {chapeau && <p className="mt-3 max-w-2xl text-sm text-craie-500">{chapeau}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Grille({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>
  );
}

/** Vignette compacte : visuel, nom, effet, puis a qui elle s'adresse. */
function Vignette({
  image,
  nom,
  accent,
  description,
}: {
  image?: string;
  nom: string;
  accent: string;
  description: string;
}) {
  return (
    <li className="biseau flex gap-3 border border-nuit-700/70 bg-nuit-900/60 p-3">
      <span className="relative size-12 shrink-0">
        {image ? (
          <Image src={image} alt="" fill sizes="48px" className="object-contain" />
        ) : (
          <span className="grid size-full place-items-center bg-nuit-800 text-xs text-craie-500">
            —
          </span>
        )}
      </span>
      <div className="min-w-0">
        <h3 className="font-titre font-bold leading-tight text-craie-100">{nom}</h3>
        <p className="mt-0.5 text-xs leading-snug text-or-400">{accent}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-craie-500">{description}</p>
      </div>
    </li>
  );
}

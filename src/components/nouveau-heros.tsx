import Image from "next/image";
import Link from "@/components/lien";
import { ArrowRight, Sparkles } from "lucide-react";
import type { NouveauHeros } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Enrichissement resolu cote serveur : visuels et existence de fiche. */
export interface NouveauHerosEnrichi extends NouveauHeros {
  portrait: string | null;
  illustration: string | null;
  roles: string[];
  fiche: boolean;
}

/**
 * Presentation d'un heros introduit par le patch.
 *
 * La partie la plus marquante d'une mise a jour merite mieux qu'un mur de
 * texte : une banniere avec l'illustration du heros, puis ses competences en
 * cartes — role, nom, effets — pour saisir son kit d'un coup d'oeil.
 */
export function NouveauHeros({ heros }: { heros: NouveauHerosEnrichi }) {
  return (
    <div>
      {/* Banniere : illustration en fond, identite par-dessus. */}
      <div
        id={heros.ancre ?? undefined}
        className="biseau relative scroll-mt-24 overflow-hidden border border-nuit-800"
      >
        {heros.illustration && (
          <Image
            src={heros.illustration}
            alt=""
            fill
            sizes="(min-width: 1024px) 48rem, 100vw"
            className="object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-r from-nuit-950 via-nuit-950/85 to-nuit-950/30" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-nuit-950 to-transparent"
        />

        <div className="relative flex items-center gap-4 p-5 sm:p-6">
          {heros.portrait && (
            <span className="biseau-sm relative size-16 shrink-0 overflow-hidden border border-or-500/40 sm:size-20">
              <Image src={heros.portrait} alt={heros.nom} fill sizes="80px" className="object-cover" />
            </span>
          )}

          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-or-400">
              <Sparkles size={13} aria-hidden />
              Nouveau heros
            </p>
            {heros.epithete && (
              <p className="mt-1 font-titre text-sm text-craie-300">{heros.epithete}</p>
            )}
            <h3 className="font-titre text-3xl font-bold text-craie-100 sm:text-4xl">
              {heros.nom}
            </h3>
            {heros.roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {heros.roles.map((role) => (
                  <span
                    key={role}
                    className="biseau-sm border border-nuit-700 bg-nuit-900/70 px-2 py-0.5 text-xs font-medium text-craie-300"
                  >
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Histoire et trait distinctif. */}
      {(heros.lore.length > 0 || heros.feature) && (
        <div className="mt-4 space-y-3">
          {heros.lore.map((ligne, i) => (
            <p key={i} className="text-sm leading-relaxed text-craie-300">
              {ligne}
            </p>
          ))}
          {heros.feature && (
            <p className="biseau-sm border-l-2 border-or-500 bg-nuit-900/60 px-4 py-3 text-sm leading-relaxed text-craie-200">
              <span className="font-semibold text-or-400">Particularite — </span>
              {heros.feature}
            </p>
          )}
        </div>
      )}

      {/* Kit : une carte par competence. */}
      {heros.competences.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {heros.competences.map((c, i) => {
            const combo = /combo/i.test(c.role);
            return (
              <div
                key={i}
                className={cn(
                  "biseau-sm border bg-nuit-900/50 p-4",
                  combo ? "border-sang-500/25" : "border-nuit-700/70",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "biseau-sm px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                      combo
                        ? "bg-sang-500/15 text-sang-500"
                        : "bg-or-500/15 text-or-400",
                    )}
                  >
                    {c.role}
                  </span>
                  {c.nom && (
                    <span className="font-titre text-sm font-bold text-craie-100">{c.nom}</span>
                  )}
                </div>
                {c.description.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {c.description.map((d, j) => (
                      <li key={j} className="text-sm leading-relaxed text-craie-300">
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {heros.fiche && (
        <Link
          href={`/heroes/${heros.slug}`}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-or-400 hover:text-or-500"
        >
          Voir la fiche complete de {heros.nom}
          <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

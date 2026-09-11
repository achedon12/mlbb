import Image from "next/image";
import Link from "@/components/lien";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
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
export function NouveauHeros({ heros, langue }: { heros: NouveauHerosEnrichi; langue: Langue }) {
  const t = creerT(langue);
  return (
    <div>
      {/* Banniere : illustration en fond, identite par-dessus. */}
      <div
        id={heros.ancre ?? undefined}
        className="bevel relative scroll-mt-24 overflow-hidden border border-night-800"
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
        <div className="absolute inset-0 bg-linear-to-r from-night-950 via-night-950/85 to-night-950/30" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-night-950 to-transparent"
        />

        <div className="relative flex items-center gap-4 p-5 sm:p-6">
          {heros.portrait && (
            <span className="bevel-sm relative size-16 shrink-0 overflow-hidden border border-gold-500/40 sm:size-20">
              <Image src={heros.portrait} alt={heros.nom} fill sizes="80px" className="object-cover" />
            </span>
          )}

          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold-400">
              <Sparkles size={13} aria-hidden />
              {t("nouveauHeros.titre")}
            </p>
            {heros.epithete && (
              <p className="mt-1 font-heading text-sm text-chalk-300">{heros.epithete}</p>
            )}
            <h3 className="font-heading text-3xl font-bold text-chalk-100 sm:text-4xl">
              {heros.nom}
            </h3>
            {heros.roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {heros.roles.map((role) => (
                  <span
                    key={role}
                    className="bevel-sm border border-night-700 bg-night-900/70 px-2 py-0.5 text-xs font-medium text-chalk-300"
                  >
                    {t(`roles.${role}`)}
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
            <p key={i} className="text-sm leading-relaxed text-chalk-300">
              {ligne}
            </p>
          ))}
          {heros.feature && (
            <p className="bevel-sm border-l-2 border-gold-500 bg-night-900/60 px-4 py-3 text-sm leading-relaxed text-chalk-200">
              <span className="font-semibold text-gold-400">{t("nouveauHeros.particularite")}</span>
              {heros.feature}
            </p>
          )}
        </div>
      )}

      {/* Kit : une carte par competence. */}
      {heros.competences.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {heros.competences.map((c, i) => {
            // Le role peut etre traduit ; le « + » des competences combinees
            // (« 1st + 2nd Combo Skill ») survit, lui, a la traduction.
            const combo = /combo|\+/i.test(c.role);
            return (
              <div
                key={i}
                className={cn(
                  "bevel-sm border bg-night-900/50 p-4",
                  combo ? "border-blood-500/25" : "border-night-700/70",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "bevel-sm px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                      combo
                        ? "bg-blood-500/15 text-blood-500"
                        : "bg-gold-500/15 text-gold-400",
                    )}
                  >
                    {c.role}
                  </span>
                  {c.nom && (
                    <span className="font-heading text-sm font-bold text-chalk-100">{c.nom}</span>
                  )}
                </div>
                {c.description.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {c.description.map((d, j) => (
                      <li key={j} className="text-sm leading-relaxed text-chalk-300">
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
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-500"
        >
          {t("nouveauHeros.voirFiche", { nom: heros.nom })}
          <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

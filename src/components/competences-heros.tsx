"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Competence, CompetenceWiki } from "@/lib/types";
import { Tiroir } from "@/components/tiroir";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/**
 * Competences d'un heros.
 *
 * Deux sources se rejoignent ici : le wiki fournit le **nom officiel** de
 * chaque competence — qui est aussi la cle de son icone — ainsi que sa
 * description d'origine, et l'analyse redigee fournit un commentaire en
 * francais quand quelqu'un l'a ecrit. Les deux listes suivent le meme ordre
 * (passif, competence 1, competence 2, ultime), c'est ce qui permet de les
 * apparier.
 *
 * Le nom affiche est celui du wiki, jamais une traduction : le jeu est en
 * anglais, et une traduction maison empecherait le lecteur de retrouver la
 * competence en partie.
 *
 * La vue est compacte : icone, type et nom tiennent sur une ligne de tuiles.
 * Le detail — description, recharge, cout — s'ouvre au clic sur une tuile et se
 * referme au second : sous les tuiles sur grand ecran, dans un tiroir sur
 * mobile.
 */
const TYPES = ["Passif", "Competence 1", "Competence 2", "Ultime"] as const;

interface Fiche {
  nom: string;
  type: string;
  icone?: string;
  description: string | null;
  recharge?: number[];
  cout?: number[];
}

export function CompetencesHeros({
  wiki,
  icones,
  redigees,
}: {
  wiki: (CompetenceWiki | null)[];
  icones: Record<string, string>;
  redigees: Competence[] | null;
}) {
  const t = useT();
  const id = useId();
  const [ouverte, setOuverte] = useState<number | null>(null);
  const officielles = wiki.slice(0, 4);
  const nombre = Math.max(officielles.length, redigees?.length ?? 0);

  if (nombre === 0) {
    return <p className="text-chalk-500">{t("skills.notFetched")}</p>;
  }

  const fiches: Fiche[] = Array.from({ length: nombre }, (_, i) => {
    const officielle = officielles[i];
    const redigee = redigees?.[i];
    const nomWiki = officielle?.name;
    return {
      nom: nomWiki ?? redigee?.name ?? t("skills.Competence"),
      type: redigee?.type ?? TYPES[i] ?? "Competence",
      icone: nomWiki ? icones[nomWiki] : undefined,
      // L'analyse redigee prime : elle explique, la description officielle se
      // contente d'enoncer. A defaut, le texte du jeu vaut mieux que rien.
      description: redigee?.description ?? officielle?.description ?? null,
      recharge: redigee?.cooldown,
      cout: redigee?.cost,
    };
  });
  const detail = ouverte === null ? null : fiches[ouverte];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fiches.map((c, i) => {
          const active = ouverte === i;
          return (
            <button
              key={i}
              type="button"
              aria-expanded={active}
              aria-controls={`${id}-detail`}
              onClick={() => setOuverte(active ? null : i)}
              className={cn(
                "bevel-sm flex items-center gap-3 border p-2.5 text-left transition-colors",
                active
                  ? "border-gold-500/70 bg-night-850"
                  : "border-night-700/70 bg-night-900/60 hover:border-gold-500/40",
              )}
            >
              <span className="relative size-11 shrink-0 overflow-hidden">
                {c.icone ? (
                  <Image
                    src={c.icone}
                    alt=""
                    fill
                    unoptimized
                    className="object-contain"
                  />
                ) : (
                  <span className="grid size-full place-items-center bg-night-800 text-xs text-chalk-500">
                    —
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-gold-400">
                  {t(`skills.${c.type}`)}
                </span>
                <span className="block truncate text-sm font-semibold text-chalk-100">{c.nom}</span>
              </span>
              <ChevronDown
                size={14}
                aria-hidden
                className={cn("shrink-0 text-chalk-500 transition-transform", active && "rotate-180")}
              />
            </button>
          );
        })}
      </div>

      {detail ? (
        <>
          <div id={`${id}-detail`} role="region" aria-live="polite" className="mt-3 hidden lg:block">
            <DetailCompetence fiche={detail} />
          </div>
          <Tiroir titre={detail.nom} onFermer={() => setOuverte(null)}>
            <DetailCompetence fiche={detail} sansCadre />
          </Tiroir>
        </>
      ) : (
        <p id={`${id}-detail`} className="mt-3 text-xs text-chalk-500">
          {t("skills.hint")}
        </p>
      )}
    </div>
  );
}

function DetailCompetence({ fiche, sansCadre = false }: { fiche: Fiche; sansCadre?: boolean }) {
  const t = useT();
  return (
    <div className={cn("p-4", !sansCadre && "bevel border border-night-700/70 bg-night-900/60")}>
      <div className="flex items-center gap-3 pr-10 lg:pr-0">
        {fiche.icone && (
          <span className="relative size-10 shrink-0 overflow-hidden">
            <Image src={fiche.icone} alt="" fill unoptimized className="object-contain" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-gold-400">
            {t(`skills.${fiche.type}`)}
          </p>
          <h3 className="font-heading text-lg font-bold text-chalk-100">{fiche.nom}</h3>
        </div>
      </div>
      <p className={cn("mt-2 leading-relaxed", fiche.description ? "text-chalk-300" : "text-sm text-chalk-500")}>
        {fiche.description ?? t("skills.noDescription")}
      </p>
      {(fiche.recharge || fiche.cout) && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-night-800 pt-3 text-sm">
          {fiche.recharge && (
            <div className="flex gap-2">
              <dt className="text-chalk-500">{t("skills.cooldown")}</dt>
              <dd className="text-chalk-100">{fiche.recharge.join(" / ")} s</dd>
            </div>
          )}
          {fiche.cout && (
            <div className="flex gap-2">
              <dt className="text-chalk-500">{t("skills.cost")}</dt>
              <dd className="text-chalk-100">{fiche.cout.join(" / ")}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import type { Embleme, SortDeCombat, Talent } from "@/data/emblemes";
import { useT } from "@/i18n/fournisseur";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Guide des emblemes.
 *
 * Presente en document de reference plutot qu'en vitrine : un rail de roles
 * toujours visible a gauche, et des lignes denses a droite. Une grille de
 * cartes obligeait a balayer la page en zigzag pour comparer deux talents ;
 * alignes, ils se lisent d'un seul mouvement vertical.
 *
 * Le role choisi ne filtre pas, il ordonne : ce qu'on ne prend pas reste
 * visible, en retrait. Masquer priverait le lecteur de la comparaison qui
 * justifie son choix.
 */
export function GuideEmblemes({
  emblemes,
  talents,
  sorts,
  images,
}: {
  emblemes: Embleme[];
  talents: Talent[];
  sorts: SortDeCombat[];
  images: Record<string, string>;
}) {
  const t = useT();
  const [role, setRole] = useState<Role | null>(null);

  const ordonner = <T extends { roles: Role[] }>(liste: T[]) =>
    role
      ? [...liste].sort(
          (a, b) => Number(b.roles.includes(role)) - Number(a.roles.includes(role)),
        )
      : liste;

  const adapte = (roles: Role[]) => !role || roles.includes(role);

  return (
    <div className="gap-10 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
      {/* ── Rail des roles ───────────────────────────────────────────── */}
      <aside className="mb-10 lg:mb-0">
        <div className="lg:sticky lg:top-24">
          <p className="font-titre text-xs font-semibold uppercase tracking-wider text-craie-500">
            Votre role
          </p>

          <ul className="mt-3 flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
            {emblemes.map((e) => {
              const choisi = role === e.role;
              return (
                <li key={e.cle} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setRole(choisi ? null : e.role)}
                    aria-pressed={choisi}
                    title={e.pourQui}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-l-2 px-2.5 py-2 text-left transition-colors",
                      choisi
                        ? "border-or-500 bg-or-500/10 text-craie-100"
                        : "border-transparent text-craie-500 hover:border-nuit-600 hover:text-craie-300",
                    )}
                  >
                    <Visuel source={images[e.cle]} taille={28} />
                    <span className="hidden text-sm font-medium lg:block">{e.role}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {role && (
            <button
              type="button"
              onClick={() => setRole(null)}
              className="mt-3 px-2.5 text-xs text-craie-500 underline underline-offset-4 hover:text-or-400"
            >
              Retirer le filtre
            </button>
          )}

          <p className="mt-6 hidden max-w-48 text-xs leading-relaxed text-craie-500 lg:block">
            Choisir un role remonte ce qui lui convient. Le reste passe en
            retrait, sans disparaitre.
          </p>
        </div>
      </aside>

      {/* ── Contenu ──────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-12">
        <Section
          titre={t("emblemesUI.talents")}
          chapeau={t("emblemesUI.talentsDesc")}
          entrees={ordonner(talents.filter((t) => t.decisif))}
          images={images}
          adapte={adapte}
        />
        <Section
          titre={t("emblemesUI.attributs")}
          chapeau={t("emblemesUI.attributsDesc")}
          entrees={ordonner(talents.filter((t) => !t.decisif))}
          images={images}
          adapte={adapte}
        />
        <Section
          titre={t("emblemesUI.sorts")}
          chapeau={t("emblemesUI.sortsDesc")}
          entrees={ordonner(sorts)}
          images={images}
          adapte={adapte}
        />
      </div>
    </div>
  );
}

interface Entree {
  cle: string;
  nom: string;
  roles: Role[];
  description?: string;
  recharge?: number;
  pourQui: string;
}

function Section({
  titre,
  chapeau,
  entrees,
  images,
  adapte,
}: {
  titre: string;
  chapeau: string;
  entrees: Entree[];
  images: Record<string, string>;
  adapte: (roles: Role[]) => boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="font-titre text-xl font-bold text-craie-100">{titre}</h2>
        <span className="text-sm text-craie-500">{entrees.length}</span>
      </div>
      <p className="mt-1 text-sm text-craie-500">{chapeau}</p>

      {/* Lignes plutot que cartes : deux entrees se comparent alignees. */}
      <ul className="mt-4 divide-y divide-nuit-800 border-y border-nuit-800">
        {entrees.map((e) => {
          const retenu = adapte(e.roles);
          return (
            <li
              key={e.cle}
              className={cn(
                "flex gap-4 py-3 transition-opacity",
                retenu ? "" : "opacity-40",
              )}
            >
              <Visuel source={images[e.cle]} taille={40} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="font-titre font-bold leading-tight text-craie-100">
                    {e.nom}
                  </h3>
                  {e.recharge !== undefined && (
                    <span className="text-xs tabular-nums text-or-400">
                      {e.recharge} s
                    </span>
                  )}
                </div>
                {e.description && (
                  <p className="mt-0.5 text-sm leading-snug text-craie-300">
                    {e.description}
                  </p>
                )}
                <p className="mt-1 text-xs leading-relaxed text-craie-500">{e.pourQui}</p>
              </div>

              <ul className="hidden shrink-0 flex-wrap content-start gap-1 sm:flex sm:w-40">
                {e.roles.map((r) => (
                  <li
                    key={r}
                    className="border border-nuit-700 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-craie-500"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Visuel({ source, taille }: { source?: string; taille: number }) {
  return (
    <span
      className="relative shrink-0"
      style={{ width: taille, height: taille }}
    >
      {source ? (
        <Image
          src={source}
          alt=""
          fill
          sizes={`${taille}px`}
          loading="eager"
          className="object-contain"
        />
      ) : (
        <span className="grid size-full place-items-center bg-nuit-800 text-xs text-craie-500">
          —
        </span>
      )}
    </span>
  );
}

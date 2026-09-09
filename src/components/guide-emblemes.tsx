"use client";

import { useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import type { Embleme, SortDeCombat, Talent } from "@/data/emblemes";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Guide des emblemes.
 *
 * La question que se pose un joueur n'est pas « quels talents existent »
 * mais « que dois-je prendre pour mon role ». La page part donc du role :
 * on choisit son embleme, et talents comme sorts se reorganisent pour mettre
 * en tete ceux qui lui conviennent.
 *
 * Rien n'est masque pour autant — le reste est simplement relegue et grise :
 * un joueur doit pouvoir voir ce qu'il ne prend pas, et pourquoi.
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
  const [role, setRole] = useState<Role | null>(null);

  const trier = <T extends { roles: Role[] }>(liste: T[]) =>
    role
      ? [...liste].sort(
          (a, b) => Number(b.roles.includes(role)) - Number(a.roles.includes(role)),
        )
      : liste;

  const pertinent = (roles: Role[]) => !role || roles.includes(role);

  const decisifs = trier(talents.filter((t) => t.decisif));
  const attributs = trier(talents.filter((t) => !t.decisif));
  const combats = trier(sorts);

  return (
    <div className="space-y-14">
      {/* ── Choix du role ────────────────────────────────────────────── */}
      <section>
        <Titre>Choisissez votre embleme</Titre>
        <p className="mt-3 max-w-2xl text-sm text-craie-500">
          Le reste de la page s&apos;organise autour de ce choix : les talents
          et les sorts adaptes passent en tete.
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {emblemes.map((e) => {
            const choisi = role === e.role;
            return (
              <li key={e.cle}>
                <button
                  type="button"
                  onClick={() => setRole(choisi ? null : e.role)}
                  aria-pressed={choisi}
                  className={cn(
                    "biseau flex w-full items-center gap-4 border p-4 text-left transition-colors",
                    choisi
                      ? "border-or-500 bg-or-500/10"
                      : "border-nuit-700/70 bg-nuit-900/60 hover:border-or-500/50",
                  )}
                >
                  <Visuel source={images[e.cle]} grande />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-titre text-lg font-bold text-craie-100">
                        {e.nom}
                      </span>
                      {choisi && <Check size={15} className="text-or-400" aria-hidden />}
                    </span>
                    <span className="mt-0.5 block text-xs text-or-400">{e.bonus}</span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-craie-500">
                      {e.pourQui}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Bloc
        titre="Talents decisifs"
        chapeau="Le dernier etage du talent : c'est lui qui change reellement une partie."
        entrees={decisifs}
        images={images}
        pertinent={pertinent}
        role={role}
      />

      <Bloc
        titre="Attributs"
        chapeau="Les premiers etages ajustent les statistiques. Ils comptent, sans decider."
        entrees={attributs}
        images={images}
        pertinent={pertinent}
        role={role}
      />

      <Bloc
        titre="Sorts de combat"
        chapeau="Un seul emplacement : le sort choisi doit repondre a ce qui manque au heros."
        entrees={combats}
        images={images}
        pertinent={pertinent}
        role={role}
      />
    </div>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h2 className="font-titre text-2xl font-bold text-craie-100">{children}</h2>
      <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
    </>
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

function Bloc({
  titre,
  chapeau,
  entrees,
  images,
  pertinent,
  role,
}: {
  titre: string;
  chapeau: string;
  entrees: Entree[];
  images: Record<string, string>;
  pertinent: (roles: Role[]) => boolean;
  role: Role | null;
}) {
  const retenus = role ? entrees.filter((e) => pertinent(e.roles)).length : 0;

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-3">
        <Titre>{titre}</Titre>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-craie-500">
        {chapeau}
        {role && (
          <span className="text-craie-300">
            {" "}
            {retenus} adapte{retenus > 1 ? "s" : ""} a votre embleme.
          </span>
        )}
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entrees.map((e) => {
          const adapte = pertinent(e.roles);
          return (
            <li key={e.cle}>
              <article
                className={cn(
                  "biseau flex h-full gap-3 border p-3 transition-opacity",
                  adapte
                    ? "border-nuit-700/70 bg-nuit-900/60"
                    : "border-nuit-800 bg-nuit-900/30 opacity-45",
                )}
              >
                <Visuel source={images[e.cle]} />
                <div className="min-w-0">
                  <h3 className="flex items-baseline gap-2 font-titre font-bold leading-tight text-craie-100">
                    {e.nom}
                    {e.recharge !== undefined && (
                      <span className="shrink-0 text-xs font-medium text-craie-500">
                        {e.recharge} s
                      </span>
                    )}
                  </h3>
                  {e.description && (
                    <p className="mt-1 text-xs leading-snug text-craie-300">{e.description}</p>
                  )}
                  <p className="mt-1.5 text-xs leading-relaxed text-craie-500">{e.pourQui}</p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Visuel({ source, grande = false }: { source?: string; grande?: boolean }) {
  return (
    <span className={cn("relative shrink-0", grande ? "size-14" : "size-11")}>
      {source ? (
        <Image
          src={source}
          alt=""
          fill
          sizes={grande ? "56px" : "44px"}
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

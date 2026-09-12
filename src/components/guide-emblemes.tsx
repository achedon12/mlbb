"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "@/components/lien";
import { slugEmbleme, type Embleme, type SortDeCombat, type Talent } from "@/data/emblemes";
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
function texteEmb(t: (k: string) => string, cle: string, champ: string, repli: string | undefined) {
  const k = `emblemData.${cle}.${champ}`;
  const v = t(k);
  return v === k ? (repli ?? "") : v;
}

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
  const choisi = role ? emblemes.find((e) => e.role === role) : undefined;

  return (
    <div className="gap-10 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
      {/* ── Rail des roles ───────────────────────────────────────────── */}
      <aside className="mb-10 lg:mb-0">
        <div className="lg:sticky lg:top-24">
          <p className="font-heading text-xs font-semibold uppercase tracking-wider text-chalk-500">
            {t("emblemsUI.yourRole")}
          </p>

          <ul className="mt-3 flex gap-1.5 relative overflow-x-auto lg:flex-col lg:overflow-visible">
            {emblemes.map((e) => {
              const choisi = role === e.role;
              return (
                <li key={e.key} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setRole(choisi ? null : e.role)}
                    aria-pressed={choisi}
                    title={texteEmb(t, e.key, "bestFor", e.bestFor)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-l-2 px-2.5 py-2 text-left transition-colors",
                      choisi
                        ? "border-gold-500 bg-gold-500/10 text-chalk-100"
                        : "border-transparent text-chalk-500 hover:border-night-600 hover:text-chalk-300",
                    )}
                  >
                    <Visuel source={images[e.key]} taille={28} />
                    <span className="hidden text-sm font-medium lg:block">{t(`roles.${e.role}`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {role && (
            <button
              type="button"
              onClick={() => setRole(null)}
              className="mt-3 px-2.5 text-xs text-chalk-500 underline underline-offset-4 hover:text-gold-400"
            >
              {t("emblemsUI.removeFilter")}
            </button>
          )}

          {/* L'embleme choisi a sa page : heros qui le jouent, talents pris avec. */}
          {choisi && (
            <Link
              href={`/emblems/${slugEmbleme(choisi)}`}
              className="mt-2 block px-2.5 text-xs font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500"
            >
              {t("emblemsUI.seePage", { nom: texteEmb(t, choisi.key, "name", choisi.name) })} →
            </Link>
          )}

          <p className="mt-6 hidden max-w-48 text-xs leading-relaxed text-chalk-500 lg:block">
            {t("emblemsUI.roleHelp")}
          </p>
        </div>
      </aside>

      {/* ── Contenu ──────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-12">
        <Section
          titre={t("emblemsUI.talents")}
          chapeau={t("emblemsUI.talentsDesc")}
          entrees={ordonner(talents.filter((t) => t.decisive))}
          images={images}
          adapte={adapte}
        />
        <Section
          titre={t("emblemsUI.attributes")}
          chapeau={t("emblemsUI.attributesDesc")}
          entrees={ordonner(talents.filter((t) => !t.decisive))}
          images={images}
          adapte={adapte}
        />
        <Section
          titre={t("emblemsUI.spells")}
          chapeau={t("emblemsUI.spellsDesc")}
          entrees={ordonner(sorts)}
          images={images}
          adapte={adapte}
          lien={(cle) => `/spells/${cle}`}
        />
      </div>
    </div>
  );
}

interface Entree {
  key: string;
  name: string;
  roles: Role[];
  description?: string;
  cooldown?: number;
  bestFor: string;
}

function Section({
  titre,
  chapeau,
  entrees,
  images,
  adapte,
  lien,
}: {
  titre: string;
  chapeau: string;
  entrees: Entree[];
  images: Record<string, string>;
  adapte: (roles: Role[]) => boolean;
  /** Adresse de la page de chaque entree, quand elle en a une (les sorts). */
  lien?: (cle: string) => string;
}) {
  const t = useT();
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="font-heading text-xl font-bold text-chalk-100">{titre}</h2>
        <span className="text-sm text-chalk-500">{entrees.length}</span>
      </div>
      <p className="mt-1 text-sm text-chalk-500">{chapeau}</p>

      {/* Lignes plutot que cartes : deux entrees se comparent alignees. */}
      <ul className="mt-4 divide-y divide-night-800 border-y border-night-800">
        {entrees.map((e) => {
          const retenu = adapte(e.roles);
          return (
            <li
              key={e.key}
              className={cn(
                "flex gap-4 py-3 transition-opacity",
                retenu ? "" : "opacity-40",
              )}
            >
              <Visuel source={images[e.key]} taille={40} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="font-heading font-bold leading-tight text-chalk-100">
                    {lien ? (
                      <Link href={lien(e.key)} className="underline-offset-4 hover:text-gold-400 hover:underline">
                        {texteEmb(t, e.key, "name", e.name)}
                      </Link>
                    ) : (
                      texteEmb(t, e.key, "name", e.name)
                    )}
                  </h3>
                  {e.cooldown !== undefined && (
                    <span className="text-xs tabular-nums text-gold-400">
                      {e.cooldown} s
                    </span>
                  )}
                </div>
                {e.description && (
                  <p className="mt-0.5 text-sm leading-snug text-chalk-300">
                    {texteEmb(t, e.key, "description", e.description)}
                  </p>
                )}
                <p className="mt-1 text-xs leading-relaxed text-chalk-500">{texteEmb(t, e.key, "bestFor", e.bestFor)}</p>
              </div>

              <ul className="hidden shrink-0 flex-wrap content-start gap-1 sm:flex sm:w-40">
                {e.roles.map((r) => (
                  <li
                    key={r}
                    className="border border-night-700 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-chalk-500"
                  >
                    {t(`roles.${r}`)}
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
        <span className="grid size-full place-items-center bg-night-800 text-xs text-chalk-500">
          —
        </span>
      )}
    </span>
  );
}

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Palier } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface HerosComparable {
  slug: string;
  nom: string;
  icone: string | null;
  roles: string[];
  lanes: string[];
  notes: {
    offensive: number | null;
    resistance: number | null;
    effets: number | null;
    difficulte: number | null;
  };
  victoire: number | null;
  ban: number | null;
  palier: Palier | null;
  skins: number;
}

const COULEUR_PALIER: Record<Palier, string> = {
  "S+": "border-sang-500/40 text-sang-500",
  S: "border-or-500/40 text-or-400",
  A: "border-emerald-500/40 text-emerald-400",
  B: "border-azur-500/40 text-azur-400",
  C: "border-nuit-600 text-craie-500",
};

const ATTRIBUTS = [
  { cle: "offensive", label: "Offensive" },
  { cle: "resistance", label: "Resistance" },
  { cle: "effets", label: "Effets / controle" },
  { cle: "difficulte", label: "Difficulte" },
] as const;

/**
 * Comparateur de deux heros.
 *
 * On choisit deux heros ; leurs notes, taux et roles se lisent cote a cote. Sur
 * chaque attribut, la meilleure valeur est mise en avant, pour trancher d'un
 * coup d'oeil plutot que de comparer chiffre a chiffre.
 */
export function ComparateurHeros({ heros }: { heros: HerosComparable[] }) {
  const parSlug = useMemo(() => new Map(heros.map((h) => [h.slug, h])), [heros]);
  const [gauche, setGauche] = useState(heros[0]?.slug ?? "");
  const [droite, setDroite] = useState(heros[1]?.slug ?? "");

  const a = parSlug.get(gauche) ?? null;
  const b = parSlug.get(droite) ?? null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <Selecteur label="Premier heros" heros={heros} valeur={gauche} onChange={setGauche} />
        <Selecteur label="Second heros" heros={heros} valeur={droite} onChange={setDroite} />
      </div>

      {a && b && (
        <div className="mt-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <EnTeteHeros heros={a} />
            <EnTeteHeros heros={b} />
          </div>

          {/* Taux remontes par le jeu. */}
          <div className="mt-6 space-y-2">
            <LigneMesure label="Taux de victoire" suffixe="%" a={a.victoire} b={b.victoire} />
            <LigneMesure label="Taux de ban" suffixe="%" a={a.ban} b={b.ban} plusHautMieux={false} />
            <LigneMesure label="Skins" a={a.skins} b={b.skins} />
          </div>

          {/* Notes editoriales du wiki, comparees en barres. */}
          <div className="mt-8 space-y-5">
            {ATTRIBUTS.map(({ cle, label }) => (
              <LigneAttribut
                key={cle}
                label={label}
                a={a.notes[cle]}
                b={b.notes[cle]}
                // Une difficulte plus basse est plutot un avantage : on ne met
                // personne « en tete » dessus, on montre juste les valeurs.
                neutre={cle === "difficulte"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Selecteur({
  label,
  heros,
  valeur,
  onChange,
}: {
  label: string;
  heros: HerosComparable[];
  valeur: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-craie-500">{label}</span>
      <select
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className="biseau-sm w-full border border-nuit-700 bg-nuit-900 px-3 py-2.5 text-craie-100 outline-none transition-colors focus:border-or-500"
      >
        {heros.map((h) => (
          <option key={h.slug} value={h.slug}>
            {h.nom}
          </option>
        ))}
      </select>
    </label>
  );
}

function EnTeteHeros({ heros }: { heros: HerosComparable }) {
  return (
    <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
      <div className="flex items-center gap-3">
        <span className="biseau-sm relative size-14 shrink-0 overflow-hidden bg-nuit-800">
          {heros.icone && (
            <Image src={heros.icone} alt={heros.nom} fill sizes="56px" className="object-cover" />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/heros/${heros.slug}`}
              className="truncate font-titre text-lg font-bold text-craie-100 hover:text-or-400"
            >
              {heros.nom}
            </Link>
            {heros.palier && (
              <span
                className={cn(
                  "biseau-sm shrink-0 border px-1.5 py-0.5 text-[0.7rem] font-bold",
                  COULEUR_PALIER[heros.palier],
                )}
              >
                {heros.palier}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-craie-500">
            {heros.roles.join(" · ")}
            {heros.lanes.length > 0 && ` — ${heros.lanes.join(" · ")}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function LigneMesure({
  label,
  a,
  b,
  suffixe = "",
  plusHautMieux = true,
}: {
  label: string;
  a: number | null;
  b: number | null;
  suffixe?: string;
  plusHautMieux?: boolean;
}) {
  const meilleur =
    a == null || b == null ? 0 : a === b ? 0 : (a > b) === plusHautMieux ? -1 : 1;
  const fmt = (v: number | null) => (v == null ? "—" : `${v}${suffixe}`);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-nuit-800 pb-2 text-sm">
      <span className={cn("text-right font-semibold", meilleur === -1 ? "text-or-400" : "text-craie-300")}>
        {fmt(a)}
      </span>
      <span className="text-center text-xs uppercase tracking-wide text-craie-500">{label}</span>
      <span className={cn("font-semibold", meilleur === 1 ? "text-or-400" : "text-craie-300")}>
        {fmt(b)}
      </span>
    </div>
  );
}

function LigneAttribut({
  label,
  a,
  b,
  neutre,
}: {
  label: string;
  a: number | null;
  b: number | null;
  neutre: boolean;
}) {
  const va = a ?? 0;
  const vb = b ?? 0;
  const aMieux = !neutre && va > vb;
  const bMieux = !neutre && vb > va;

  return (
    <div>
      <p className="mb-1 text-center text-xs uppercase tracking-wide text-craie-500">{label}</p>
      <div className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2">
        <Barre valeur={va} sens="droite" fort={aMieux} />
        <span className="text-center text-sm font-bold text-craie-200">
          {a ?? "—"} / {b ?? "—"}
        </span>
        <Barre valeur={vb} sens="gauche" fort={bMieux} />
      </div>
    </div>
  );
}

function Barre({ valeur, sens, fort }: { valeur: number; sens: "gauche" | "droite"; fort: boolean }) {
  return (
    <div className={cn("h-2.5 overflow-hidden rounded-full bg-nuit-800", sens === "droite" && "rotate-180")}>
      <div
        className={cn("h-full rounded-full", fort ? "bg-or-500" : "bg-nuit-600")}
        style={{ width: `${Math.min(100, (valeur / 10) * 100)}%` }}
      />
    </div>
  );
}

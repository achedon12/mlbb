"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Palier } from "@/lib/types";
import { useT } from "@/i18n/fournisseur";
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
  { cle: "offensive", cleI18n: "offensive" },
  { cle: "resistance", cleI18n: "resistance" },
  { cle: "effets", cleI18n: "effets" },
  { cle: "difficulte", cleI18n: "difficulte" },
] as const;

/**
 * Comparateur de deux heros.
 *
 * On choisit deux heros ; leurs notes, taux et roles se lisent cote a cote. Sur
 * chaque attribut, la meilleure valeur est mise en avant, pour trancher d'un
 * coup d'oeil plutot que de comparer chiffre a chiffre.
 */
export function ComparateurHeros({ heros }: { heros: HerosComparable[] }) {
  const t = useT();
  const parSlug = useMemo(() => new Map(heros.map((h) => [h.slug, h])), [heros]);
  const [gauche, setGauche] = useState(heros[0]?.slug ?? "");
  const [droite, setDroite] = useState(heros[1]?.slug ?? "");

  const a = parSlug.get(gauche) ?? null;
  const b = parSlug.get(droite) ?? null;

  // Le choix passe par l'URL cote client, ce qui garde la page statique et rend
  // la comparaison partageable. Le rendu serveur et la premiere hydratation
  // partent des deux premiers heros (identiques des deux cotes, donc sans
  // desaccord) ; apres le montage seulement, on adopte ?a=&b= s'ils designent
  // des heros connus, puis chaque changement se reporte dans l'URL.
  const monte = useRef(false);
  useEffect(() => {
    if (!monte.current) {
      monte.current = true;
      const params = new URLSearchParams(window.location.search);
      const ia = params.get("a");
      const ib = params.get("b");
      let lu = false;
      if (ia && parSlug.has(ia)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de l'URL apres montage
        setGauche(ia);
        lu = true;
      }
      if (ib && parSlug.has(ib)) {
        setDroite(ib);
        lu = true;
      }
      if (lu) return;
    }
    if (!gauche || !droite) return;
    window.history.replaceState(null, "", `?${new URLSearchParams({ a: gauche, b: droite })}`);
  }, [gauche, droite, parSlug]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <Selecteur label={t("compareUI.premier")} heros={heros} valeur={gauche} onChange={setGauche} />
        <Selecteur label={t("compareUI.second")} heros={heros} valeur={droite} onChange={setDroite} />
      </div>

      {a && b && (
        <div className="mt-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <EnTeteHeros heros={a} />
            <EnTeteHeros heros={b} />
          </div>

          {/* Taux remontes par le jeu. */}
          <div className="mt-6 space-y-2">
            <LigneMesure label={t("compareUI.tauxVictoire")} suffixe="%" a={a.victoire} b={b.victoire} />
            <LigneMesure label={t("compareUI.tauxBan")} suffixe="%" a={a.ban} b={b.ban} plusHautMieux={false} />
            <LigneMesure label={t("compareUI.skins")} a={a.skins} b={b.skins} />
          </div>

          {/* Notes editoriales du wiki, comparees en barres. */}
          <div className="mt-8 space-y-5">
            {ATTRIBUTS.map(({ cle, cleI18n }) => (
              <LigneAttribut
                key={cle}
                label={t(`compareUI.${cleI18n}`)}
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

/** Nom ramene a une cle de recherche : sans casse ni accents. */
const cleRecherche = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Choix d'un heros, par recherche.
 *
 * Un menu deroulant de 133 noms oblige a faire defiler la liste ; ici, on tape
 * les premieres lettres et la liste se resserre. Le champ affiche le heros
 * choisi tant qu'on ne cherche pas. Clavier : fleches pour parcourir, Entree
 * pour choisir, Echap pour abandonner.
 */
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
  const t = useT();
  const id = useId();
  const choisi = heros.find((h) => h.slug === valeur) ?? null;
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [actif, setActif] = useState(0);

  const resultats = useMemo(() => {
    const q = cleRecherche(recherche.trim());
    return q ? heros.filter((h) => cleRecherche(h.nom).includes(q)) : heros;
  }, [heros, recherche]);

  // L'option active reste visible quand on la deplace au clavier.
  useEffect(() => {
    if (!ouvert) return;
    const slug = resultats[actif]?.slug;
    if (slug) document.getElementById(`${id}-${slug}`)?.scrollIntoView({ block: "nearest" });
  }, [actif, ouvert, resultats, id]);

  const choisir = (h: HerosComparable) => {
    onChange(h.slug);
    setRecherche("");
    setOuvert(false);
  };

  const clavier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setActif((a) => Math.min(a + 1, resultats.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && ouvert && resultats[actif]) {
      e.preventDefault();
      choisir(resultats[actif]);
    } else if (e.key === "Escape") {
      setOuvert(false);
      setRecherche("");
    }
  };

  return (
    <div className="relative">
      <label
        htmlFor={`${id}-champ`}
        className="mb-1.5 block text-xs uppercase tracking-wide text-craie-500"
      >
        {label}
      </label>
      <div className="biseau-sm flex items-center gap-2 border border-nuit-700 bg-nuit-900 px-2.5 transition-colors focus-within:border-or-500">
        {!ouvert && choisi?.icone && (
          <span className="relative size-6 shrink-0 overflow-hidden bg-nuit-800">
            <Image src={choisi.icone} alt="" fill sizes="24px" className="object-cover" />
          </span>
        )}
        <input
          id={`${id}-champ`}
          role="combobox"
          aria-expanded={ouvert}
          aria-controls={`${id}-liste`}
          aria-autocomplete="list"
          aria-activedescendant={
            ouvert && resultats[actif] ? `${id}-${resultats[actif].slug}` : undefined
          }
          autoComplete="off"
          value={ouvert ? recherche : (choisi?.nom ?? "")}
          placeholder={t("compareUI.rechercher")}
          onFocus={() => {
            setOuvert(true);
            setRecherche("");
            setActif(0);
          }}
          onBlur={() => setOuvert(false)}
          onChange={(e) => {
            setRecherche(e.target.value);
            setActif(0);
            setOuvert(true);
          }}
          onKeyDown={clavier}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-craie-100 outline-none placeholder:text-craie-500"
        />
        <ChevronDown
          size={16}
          aria-hidden
          className={cn("shrink-0 text-craie-500 transition-transform", ouvert && "rotate-180")}
        />
      </div>

      {ouvert && (
        <ul
          id={`${id}-liste`}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto border border-nuit-700 bg-nuit-900 py-1 shadow-xl shadow-black/40"
        >
          {resultats.length === 0 ? (
            <li className="px-3 py-2 text-sm text-craie-500">{t("compareUI.aucun")}</li>
          ) : (
            resultats.map((h, i) => (
              <li
                key={h.slug}
                id={`${id}-${h.slug}`}
                role="option"
                aria-selected={h.slug === valeur}
                // Empeche le champ de perdre le focus avant la prise en compte du clic.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(h)}
                onMouseEnter={() => setActif(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm",
                  i === actif ? "bg-nuit-800 text-or-400" : "text-craie-200",
                  h.slug === valeur && "font-semibold",
                )}
              >
                <span className="relative size-7 shrink-0 overflow-hidden bg-nuit-800">
                  {h.icone && <Image src={h.icone} alt="" fill sizes="28px" className="object-cover" />}
                </span>
                {h.nom}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function EnTeteHeros({ heros }: { heros: HerosComparable }) {
  const t = useT();
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
              href={`/heroes/${heros.slug}`}
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
            {heros.roles.map((r) => t(`roles.${r}`)).join(" · ")}
            {heros.lanes.length > 0 && ` — ${heros.lanes.map((l) => t(`lanes.${l}`)).join(" · ")}`}
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

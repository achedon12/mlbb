"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLangue } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

export interface PointCourbe {
  date: string;
  valeur: number | null;
}

/** Evenement date a marquer d'un trait vertical : un patch. */
export interface Repere {
  date: string;
  libelle: string;
}

/** Serie superposee aux autres, alignee jour par jour sur `dates`. */
export interface SerieCourbe {
  nom: string;
  valeurs: (number | null)[];
  /** Classe de couleur du trait (`text-…`), reprise par la legende et le survol. */
  couleur: string;
  /** Trait en tirets : l'identite de la serie ne repose pas sur la seule couleur. */
  tirets?: boolean;
}

/** Une serie (`points`) ou plusieurs, alignees sur les memes dates (`dates` et `series`). */
type Donnees =
  | { points: PointCourbe[]; dates?: never; series?: never }
  | { dates: string[]; series: SerieCourbe[]; points?: never };

// Hauteur et marges du dessin, en pixels : la largeur suit celle du cadre,
// si bien qu'une unite du dessin vaut un pixel et le texte garde sa taille.
const H = 200;
const GAUCHE = 42;
const DROITE = 8;
const HAUT = 16;
const BAS = 26;
const TIRETS = "6 4";

/**
 * Courbe d'un taux au fil des jours, dessinee en SVG : pas de bibliotheque de
 * graphiques pour une ligne et trois graduations. Un jour sans mesure coupe
 * le trace plutot que de relier deux points qui n'ont rien a voir. Le survol
 * (souris ou doigt) affiche la valeur du jour.
 *
 * Plusieurs series se superposent sur une echelle commune : legende sous le
 * dessin, nom de chaque serie au bout de sa ligne, et une infobulle qui donne
 * au survol la valeur de chacune.
 */
export function CourbeTaux({
  reperes = [],
  decimales = 1,
  libelle,
  ...donnees
}: Donnees & {
  reperes?: Repere[];
  decimales?: number;
  /** Resume lu par les lecteurs d'ecran a la place du dessin. */
  libelle: string;
}) {
  const langue = useLangue();
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const [survol, setSurvol] = useState<number | null>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(520);

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const observateur = new ResizeObserver(([e]) => setL(Math.max(240, Math.round(e.contentRect.width))));
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  const multiple = donnees.series !== undefined;
  const dates = donnees.series ? donnees.dates : donnees.points.map((p) => p.date);
  const traces: SerieCourbe[] = donnees.series ?? [
    { nom: "", valeurs: donnees.points.map((p) => p.valeur), couleur: "text-or-400" },
  ];
  const n = dates.length;

  const valeurs = traces.flatMap((s) => s.valeurs.filter((v): v is number => v !== null));
  if (valeurs.length < 2) return <div ref={cadre} />;

  const plusBas = Math.min(...valeurs);
  const plusHaut = Math.max(...valeurs);
  const marge = Math.max((plusHaut - plusBas) * 0.15, decimales >= 2 ? 0.05 : 0.3);
  const min = plusBas - marge;
  const max = plusHaut + marge;

  const x = (i: number) => GAUCHE + (i / Math.max(n - 1, 1)) * (L - GAUCHE - DROITE);
  const y = (v: number) => HAUT + (1 - (v - min) / (max - min)) * (H - HAUT - BAS);

  const traceDe = (serie: (number | null)[]) => {
    let d = "";
    let continu = false;
    serie.forEach((v, i) => {
      if (v === null) {
        continu = false;
        return;
      }
      d += `${continu ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      continu = true;
    });
    return d;
  };
  const chemins = traces.map((s) => traceDe(s.valeurs));
  // L'aire sous la courbe n'a de sens que pour une serie seule, sans trou.
  const sansTrou = !multiple && traces[0].valeurs.every((v) => v !== null);
  const aire = sansTrou ? `${chemins[0]}L${x(n - 1)},${H - BAS}L${x(0)},${H - BAS}Z` : null;

  const nombre = new Intl.NumberFormat(langue, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  const jour = new Intl.DateTimeFormat(langue, { day: "numeric", month: "short", timeZone: "UTC" });
  const date = (s: string) => jour.format(new Date(`${s}T00:00:00Z`));

  const graduations = [plusHaut, (plusHaut + plusBas) / 2, plusBas];
  const etiquettes = [0, Math.floor((n - 1) / 2), n - 1];
  const visibles = reperes.map((r) => ({ ...r, i: dates.indexOf(r.date) })).filter((r) => r.i >= 0);
  const actif = survol !== null && traces.some((s) => s.valeurs[survol] != null) ? survol : null;
  const aDroite = actif !== null && actif > n / 2;

  // Nom de chaque serie au bout de sa ligne : la plus haute au-dessus, les
  // autres en dessous, pour que deux fins proches ne se chevauchent pas.
  const fins = traces
    .map((s, k) => {
      let i = s.valeurs.length - 1;
      while (i >= 0 && s.valeurs[i] === null) i--;
      return { k, i, v: i >= 0 ? s.valeurs[i]! : null };
    })
    .filter((f): f is { k: number; i: number; v: number } => f.v !== null)
    .sort((a, b) => b.v - a.v);

  const suivre = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * L;
    const i = Math.round(((px - GAUCHE) / (L - GAUCHE - DROITE)) * (n - 1));
    setSurvol(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={cadre} className="relative">
      <svg
        viewBox={`0 0 ${L} ${H}`}
        role="img"
        aria-label={libelle}
        className={cn("block h-[200px] w-full touch-pan-y select-none", !multiple && traces[0].couleur)}
        onPointerMove={suivre}
        onPointerDown={suivre}
        onPointerLeave={() => setSurvol(null)}
      >
        <defs>
          <linearGradient id={`${id}-aire`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {graduations.map((v, i) => (
          <g key={i}>
            <line x1={GAUCHE} x2={L - DROITE} y1={y(v)} y2={y(v)} className="stroke-nuit-700" strokeDasharray="3 4" />
            <text x={GAUCHE - 6} y={y(v) + 4} textAnchor="end" className="fill-craie-500 text-[11px] tabular-nums">
              {nombre.format(v)}
            </text>
          </g>
        ))}

        {etiquettes.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            className="fill-craie-500 text-[11px]"
          >
            {date(dates[i])}
          </text>
        ))}

        {visibles.map((r) => (
          <g key={r.date + r.libelle}>
            <line x1={x(r.i)} x2={x(r.i)} y1={HAUT - 6} y2={H - BAS} className="stroke-azur-400/70" strokeDasharray="2 3" />
            <text
              x={x(r.i) + (r.i > n / 2 ? -4 : 4)}
              y={HAUT - 6}
              textAnchor={r.i > n / 2 ? "end" : "start"}
              className="fill-azur-400 text-[10px]"
            >
              {r.libelle}
            </text>
          </g>
        ))}

        {aire && <path d={aire} fill={`url(#${id}-aire)`} />}
        {traces.map((s, k) => (
          <path
            key={k}
            d={chemins[k]}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.tirets ? TIRETS : undefined}
            className={s.couleur}
          />
        ))}

        {multiple &&
          actif === null &&
          fins.map((f, rang) => (
            <text
              key={f.k}
              x={x(f.i) - 4}
              y={Math.min(Math.max(y(f.v) + (rang === 0 ? -8 : 16), HAUT + 10), H - BAS - 4)}
              textAnchor="end"
              paintOrder="stroke"
              strokeWidth={4}
              strokeLinejoin="round"
              className="fill-craie-200 stroke-nuit-900 text-[11px] font-semibold"
            >
              {traces[f.k].nom}
            </text>
          ))}

        {actif !== null && (
          <g>
            <line x1={x(actif)} x2={x(actif)} y1={HAUT} y2={H - BAS} className="stroke-craie-500/60" />
            {traces.map((s, k) =>
              s.valeurs[actif] == null ? null : (
                <circle
                  key={k}
                  cx={x(actif)}
                  cy={y(s.valeurs[actif]!)}
                  r={4.5}
                  fill="currentColor"
                  className={cn("stroke-nuit-950", s.couleur)}
                  strokeWidth={2}
                />
              ),
            )}
            {!multiple && (
              <text
                x={x(actif) + (aDroite ? -8 : 8)}
                y={Math.max(y(traces[0].valeurs[actif]!) - 10, HAUT + 10)}
                textAnchor={aDroite ? "end" : "start"}
                className="fill-craie-100 text-[12px] font-semibold tabular-nums"
              >
                {`${date(dates[actif])} · ${nombre.format(traces[0].valeurs[actif]!)} %`}
              </text>
            )}
          </g>
        )}
      </svg>

      {/* Plusieurs series : la valeur du jour de chacune, dans une infobulle. */}
      {multiple && actif !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1 z-10 w-max max-w-[60%] border border-nuit-700 bg-nuit-950/95 px-2.5 py-1.5 text-xs shadow-lg shadow-black/40"
          style={{ left: x(actif), transform: aDroite ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}
        >
          <p className="font-semibold text-craie-100">{date(dates[actif])}</p>
          <ul className="mt-1 space-y-0.5">
            {traces.map((s, k) => (
              <li key={k} className="flex items-center gap-2 text-craie-300">
                <Pastille serie={s} />
                <span className="min-w-0 flex-1 truncate">{s.nom}</span>
                <span className="font-semibold tabular-nums text-craie-100">
                  {s.valeurs[actif] == null ? "—" : `${nombre.format(s.valeurs[actif]!)} %`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {multiple && (
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-craie-300">
          {traces.map((s, k) => (
            <li key={k} className="flex items-center gap-2">
              <Pastille serie={s} />
              {s.nom}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Echantillon du trait d'une serie, pour la legende et l'infobulle. */
function Pastille({ serie }: { serie: SerieCourbe }) {
  return (
    <svg aria-hidden width="18" height="6" className={cn("shrink-0", serie.couleur)}>
      <line
        x1="1"
        x2="17"
        y1="3"
        y2="3"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={serie.tirets ? "4 3" : undefined}
      />
    </svg>
  );
}

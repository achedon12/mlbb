"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLangue } from "@/i18n/fournisseur";

export interface PointCourbe {
  date: string;
  valeur: number | null;
}

/** Evenement date a marquer d'un trait vertical : un patch. */
export interface Repere {
  date: string;
  libelle: string;
}

// Hauteur et marges du dessin, en pixels : la largeur suit celle du cadre,
// si bien qu'une unite du dessin vaut un pixel et le texte garde sa taille.
const H = 200;
const GAUCHE = 42;
const DROITE = 8;
const HAUT = 16;
const BAS = 26;

/**
 * Courbe d'un taux au fil des jours, dessinee en SVG : pas de bibliotheque de
 * graphiques pour une ligne et trois graduations. Un jour sans mesure coupe
 * le trace plutot que de relier deux points qui n'ont rien a voir. Le survol
 * (souris ou doigt) affiche la valeur du jour.
 */
export function CourbeTaux({
  points,
  reperes = [],
  decimales = 1,
  libelle,
}: {
  points: PointCourbe[];
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

  const valeurs = points.flatMap((p) => (p.valeur === null ? [] : [p.valeur]));
  if (valeurs.length < 2) return <div ref={cadre} />;

  const plusBas = Math.min(...valeurs);
  const plusHaut = Math.max(...valeurs);
  const marge = Math.max((plusHaut - plusBas) * 0.15, decimales >= 2 ? 0.05 : 0.3);
  const min = plusBas - marge;
  const max = plusHaut + marge;

  const x = (i: number) => GAUCHE + (i / Math.max(points.length - 1, 1)) * (L - GAUCHE - DROITE);
  const y = (v: number) => HAUT + (1 - (v - min) / (max - min)) * (H - HAUT - BAS);

  let trace = "";
  let continu = false;
  points.forEach((p, i) => {
    if (p.valeur === null) {
      continu = false;
      return;
    }
    trace += `${continu ? "L" : "M"}${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`;
    continu = true;
  });
  // L'aire sous la courbe n'a de sens que sans trou.
  const sansTrou = points.every((p) => p.valeur !== null);
  const aire = sansTrou ? `${trace}L${x(points.length - 1)},${H - BAS}L${x(0)},${H - BAS}Z` : null;

  const nombre = new Intl.NumberFormat(langue, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  const jour = new Intl.DateTimeFormat(langue, { day: "numeric", month: "short", timeZone: "UTC" });
  const date = (s: string) => jour.format(new Date(`${s}T00:00:00Z`));

  const graduations = [plusHaut, (plusHaut + plusBas) / 2, plusBas];
  const etiquettes = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const visibles = reperes
    .map((r) => ({ ...r, i: points.findIndex((p) => p.date === r.date) }))
    .filter((r) => r.i >= 0);
  const actif = survol !== null && points[survol]?.valeur != null ? survol : null;

  const suivre = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * L;
    const i = Math.round(((px - GAUCHE) / (L - GAUCHE - DROITE)) * (points.length - 1));
    setSurvol(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <div ref={cadre}>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        role="img"
        aria-label={libelle}
        className="block h-[200px] w-full touch-pan-y select-none text-or-400"
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
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            className="fill-craie-500 text-[11px]"
          >
            {date(points[i].date)}
          </text>
        ))}

        {visibles.map((r) => (
          <g key={r.date + r.libelle}>
            <line x1={x(r.i)} x2={x(r.i)} y1={HAUT - 6} y2={H - BAS} className="stroke-azur-400/70" strokeDasharray="2 3" />
            <text
              x={x(r.i) + (r.i > points.length / 2 ? -4 : 4)}
              y={HAUT - 6}
              textAnchor={r.i > points.length / 2 ? "end" : "start"}
              className="fill-azur-400 text-[10px]"
            >
              {r.libelle}
            </text>
          </g>
        ))}

        {aire && <path d={aire} fill={`url(#${id}-aire)`} />}
        <path d={trace} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {actif !== null && (
          <g>
            <line x1={x(actif)} x2={x(actif)} y1={HAUT} y2={H - BAS} className="stroke-craie-500/60" />
            <circle
              cx={x(actif)}
              cy={y(points[actif].valeur!)}
              r={4.5}
              fill="currentColor"
              className="stroke-nuit-950"
              strokeWidth={2}
            />
            <text
              x={x(actif) + (actif > points.length / 2 ? -8 : 8)}
              y={Math.max(y(points[actif].valeur!) - 10, HAUT + 10)}
              textAnchor={actif > points.length / 2 ? "end" : "start"}
              className="fill-craie-100 text-[12px] font-semibold tabular-nums"
            >
              {`${date(points[actif].date)} · ${nombre.format(points[actif].valeur!)} %`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

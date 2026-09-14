import { cn } from "@/lib/utils";

/**
 * Radar de heros : une toile par heros sur des axes communs, chaque valeur
 * ramenee entre 0 et 1. SVG pur, sans script ni mesure de la page : il se rend
 * tel quel cote serveur comme dans un composant client, et le `viewBox` le met
 * a la largeur du cadre. Le dessin n'est qu'une forme : les valeurs exactes
 * vivent dans le tableau que la page place a cote, et le resume (`resume`)
 * le dit aux lecteurs d'ecran.
 */

export type PatternTrait = "solid" | "dashed" | "dotted";

/** Motif du trait : l'identite d'une serie ne repose pas sur la seule couleur. */
export const DASHES: Record<PatternTrait, string | undefined> = { solid: undefined, dashed: "6 4", dotted: "1.5 3.5" };

/** Couleur et motif de chaque heros compare, dans l'ordre des selecteurs. */
export const SERIES_STYLES: { color: string; pattern: PatternTrait }[] = [
  { color: "text-gold-400", pattern: "solid" },
  { color: "text-azure-400", pattern: "dashed" },
  { color: "text-emerald-400", pattern: "dotted" },
];

export interface SeriesRadar {
  name: string;
  /** Une valeur par axe, entre 0 et 1 ; null pour un axe non mesure. */
  values: (number | null)[];
  /** Classe de couleur (`text-…`), reprise par la legende. */
  color: string;
  pattern?: PatternTrait;
}

/** Notes du jeu (sur 10), puis taux de victoire et de ban : les six axes du comparateur. */
export const AXES_RADAR = ["offense", "durability", "abilityEffects", "difficulty", "win", "ban"] as const;

/**
 * Valeur ramenee entre 0,1 et 1 sur l'etendue [min, max] du rang : le heros
 * le plus bas reste visible, pres du centre, plutot que confondu avec lui.
 */
export function normalize(v: number | null, [min, max]: readonly [number, number]): number | null {
  if (v === null) return null;
  if (max <= min) return 0.55;
  return 0.1 + 0.9 * Math.min(1, Math.max(0, (v - min) / (max - min)));
}

/** Valeurs d'un heros sur AXES_RADAR : notes sur 10, taux ramenes sur l'etendue du rang. */
export function valuesRadar(
  notes: { offense: number | null; durability: number | null; abilityEffects: number | null; difficulty: number | null },
  rate: { win: number; ban: number } | null,
  bounds: { win: readonly [number, number]; ban: readonly [number, number] } | null,
): (number | null)[] {
  const note = (v: number | null) => (v === null ? null : Math.min(1, Math.max(0, v / 10)));
  return [
    note(notes.offense),
    note(notes.durability),
    note(notes.abilityEffects),
    note(notes.difficulty),
    rate && bounds ? normalize(rate.win, bounds.win) : null,
    rate && bounds ? normalize(rate.ban, bounds.ban) : null,
  ];
}

// Dessin : une unite vaut un pixel quand le cadre fait 360 de large.
const L = 360;
const H = 292;
const CX = 180;
const CY = 150;
const R = 92;

/** Libelle d'axe sur deux lignes au plus, coupe entre deux mots vers le milieu. */
function cut(label: string): string[] {
  if (label.length <= 13 || !label.includes(" ")) return [label];
  const words = label.split(" ");
  let best = 1;
  for (let i = 1; i < words.length; i += 1) {
    const gap = (k: number) => Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
    if (gap(i) < gap(best)) best = i;
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

export function HeroRadar({
  id,
  axes,
  series,
  title,
  summary,
  className,
}: {
  /** Prefixe des identifiants du dessin, unique dans la page. */
  id: string;
  /** Libelle de chaque axe, dans l'ordre des valeurs. */
  axes: string[];
  series: SeriesRadar[];
  title: string;
  /** Resume lu a la place du dessin : ou trouver les valeurs exactes. */
  summary: string;
  className?: string;
}) {
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => [CX + Math.cos(angle(i)) * R * v, CY + Math.sin(angle(i)) * R * v] as const;
  const polygon = (values: number[]) => values.map((v, i) => point(i, v).map((c) => c.toFixed(1)).join(",")).join(" ");

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        role="img"
        aria-labelledby={`${id}-titre ${id}-resume`}
        className="mx-auto block h-auto w-full max-w-[26rem]"
      >
        <title id={`${id}-titre`}>{title}</title>
        <desc id={`${id}-resume`}>{summary}</desc>
        <g fill="none" stroke="currentColor" className="text-night-700">
          {[0.25, 0.5, 0.75, 1].map((a) => (
            <polygon key={a} points={polygon(Array(n).fill(a))} strokeWidth={a === 1 ? 1.2 : 0.7} />
          ))}
          {axes.map((_, i) => {
            const [x, y] = point(i, 1);
            return <line key={i} x1={CX} y1={CY} x2={x.toFixed(1)} y2={y.toFixed(1)} strokeWidth={0.7} />;
          })}
        </g>
        {series.map((s, k) => (
          <g key={k} className={s.color}>
            <polygon
              points={polygon(s.values.map((v) => v ?? 0))}
              fill="currentColor"
              fillOpacity={0.1}
              stroke="currentColor"
              strokeWidth={2}
              strokeDasharray={DASHES[s.pattern ?? "solid"]}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => {
              if (v === null) return null;
              const [x, y] = point(i, v);
              return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={2.6} fill="currentColor" />;
            })}
          </g>
        ))}
        {axes.map((label, i) => {
          const [x, y] = point(i, 1.16);
          const cos = Math.cos(angle(i));
          const sin = Math.sin(angle(i));
          const rows = cut(label);
          const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
          // En haut, le texte monte au-dessus du sommet ; en bas, il descend ; sur les cotes, il se centre.
          const y0 = sin < -0.5 ? y - 12 * (rows.length - 1) : sin > 0.5 ? y + 9 : y + 4 - 6 * (rows.length - 1);
          return (
            <text key={i} x={x.toFixed(1)} y={y0.toFixed(1)} textAnchor={anchor} className="fill-chalk-300 text-[11px]">
              {rows.map((l, k) => (
                <tspan key={k} x={x.toFixed(1)} dy={k === 0 ? 0 : 12}>
                  {l}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-chalk-300">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <TraitLegend color={s.color} pattern={s.pattern} />
            {s.name}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Echantillon du trait d'une serie, pour une legende ou un en-tete. */
export function TraitLegend({ color, pattern = "solid", className }: { color: string; pattern?: PatternTrait; className?: string }) {
  return (
    <svg aria-hidden width="20" height="6" className={cn("shrink-0", color, className)}>
      <line x1="1" y1="3" x2="19" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={DASHES[pattern]} />
    </svg>
  );
}

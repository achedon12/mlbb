import { LANE_PATHS, MAP_POINTS, TERRAIN_BLOCKS } from "@/lib/game-map";

/**
 * Our schematic plan of the Land of Dawn, as SVG shapes on a 100 x 100
 * square: terrain, both bases, the river, the objective pits and the three
 * lanes (`lib/game-map`). Drawn by the map guide and, under the plan, by the
 * strategy planner, inside their own `<svg>`. Plain colours only, no external
 * resource: the planner turns it into a PNG as it is.
 */
const PITS = MAP_POINTS.filter((p) => p.group === "objective").flatMap((p) => p.positions);

export function MapDrawing() {
  return (
    <>
      <rect width="100" height="100" fill="#0e1424" />
      {TERRAIN_BLOCKS.map(([x, y, w, h]) => (
        <g key={`${x}-${y}`} fill="#1c2742">
          <rect x={x} y={y} width={w} height={h} rx="1.5" />
          <rect x={y} y={x} width={h} height={w} rx="1.5" />
        </g>
      ))}
      <path d="M0 100 V72 A28 28 0 0 1 28 100 Z" fill="#2b7fe0" fillOpacity="0.2" />
      <path d="M100 0 H72 A28 28 0 0 0 100 28 Z" fill="#d94848" fillOpacity="0.2" />
      <polygon points="5,-5 105,95 95,105 -5,5" fill="#4da3ff" fillOpacity="0.16" />
      <line x1="0" y1="0" x2="100" y2="100" stroke="#4da3ff" strokeOpacity="0.35" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
      {PITS.map((p) => (
        <circle
          key={`${p.x}-${p.y}`}
          cx={p.x}
          cy={p.y}
          r="7"
          fill="#06080f"
          fillOpacity="0.7"
          stroke="#e0a92e"
          strokeOpacity="0.6"
          strokeWidth="0.5"
          strokeDasharray="1.2 1"
        />
      ))}
      {Object.values(LANE_PATHS).map((d) => (
        <g key={d} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={d} stroke="#2a3758" strokeWidth="5" />
          <path d={d} stroke="#99a4c0" strokeOpacity="0.5" strokeWidth="0.4" strokeDasharray="2 2" />
        </g>
      ))}
    </>
  );
}

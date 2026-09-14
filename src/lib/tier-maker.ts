/**
 * Createur de tier list : etat, operations et partage par lien.
 *
 * Module pur, sans donnees : la page lui passe le roster. Chaque operation
 * rend un nouvel etat ; l'interface n'a qu'a le ranger.
 *
 * Le lien partage porte toute la liste dans `?l=` : titre, rangees (nom,
 * couleur, heros par slug), en texte compresse puis en base64url. Les slugs
 * plutot que des indices : un lien reste valable quand un heros s'ajoute au
 * roster. Un lien de 133 heros tient en moins d'un kilo-octet.
 */

export interface Row {
  id: string;
  name: string;
  color: string;
  heroes: string[];
}

export interface StateTier {
  title: string;
  rows: Row[];
}

export const ROWS_DEFAULT: { name: string; color: string }[] = [
  { name: "S+", color: "#ff5a5f" },
  { name: "S", color: "#ff9f43" },
  { name: "A", color: "#ffd166" },
  { name: "B", color: "#06d6a0" },
  { name: "C", color: "#4da3ff" },
  { name: "D", color: "#a78bfa" },
];

/** Couleurs proposees d'un clic ; le selecteur du navigateur donne le reste. */
export const PALETTE = [...ROWS_DEFAULT.map((r) => r.color), "#f472b6", "#94a3b8"];

export const MAX_ROWS = 12;
export const NAME_MAX = 20;
export const TITLE_MAX = 60;
const COLOR_NEUTRAL = "#94a3b8";
/** Au-dela, un lien est rejete sans etre lu : aucune liste legitime n'en approche. */
const CODE_MAX = 12_000;
const TEXT_MAX = 40_000;

export function stateDefault(title = ""): StateTier {
  return { title, rows: ROWS_DEFAULT.map((r, i) => ({ id: `d${i}`, ...r, heroes: [] })) };
}

export function rowOf(state: StateTier, slug: string): Row | undefined {
  return state.rows.find((r) => r.heroes.includes(slug));
}

/**
 * Pose un heros dans une rangee, avant `avant` s'il y est, sinon a la fin ;
 * `cible` nul le rend a la reserve.
 */
export function place(state: StateTier, slug: string, target: string | null, before?: string | null): StateTier {
  const tierRows = state.rows.map((r) => ({ ...r, heroes: r.heroes.filter((s) => s !== slug) }));
  const r = target ? tierRows.find((x) => x.id === target) : undefined;
  if (r) {
    const i = before ? r.heroes.indexOf(before) : -1;
    r.heroes.splice(i >= 0 ? i : r.heroes.length, 0, slug);
  }
  return { ...state, rows: tierRows };
}

/** Avance ou recule un heros dans sa rangee. */
export function shift(state: StateTier, slug: string, delta: number): StateTier {
  return {
    ...state,
    rows: state.rows.map((r) => {
      const i = r.heroes.indexOf(slug);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= r.heroes.length) return r;
      const heroes = [...r.heroes];
      [heroes[i], heroes[j]] = [heroes[j], heroes[i]];
      return { ...r, heroes };
    }),
  };
}

/** Monte ou descend un heros d'une rangee, a la fin de la nouvelle. */
export function changeOfRow(state: StateTier, slug: string, delta: number): StateTier {
  const i = state.rows.findIndex((r) => r.heroes.includes(slug));
  const target = state.rows[i + delta];
  return i < 0 || !target ? state : place(state, slug, target.id);
}

export function addRow(state: StateTier, id: string, name: string): StateTier {
  if (state.rows.length >= MAX_ROWS) return state;
  const color = PALETTE[state.rows.length % PALETTE.length];
  return { ...state, rows: [...state.rows, { id, name: clean(name, NAME_MAX), color, heroes: [] }] };
}

/** Retire une rangee ; ses heros retournent a la reserve. */
export function deleteRow(state: StateTier, id: string): StateTier {
  if (state.rows.length <= 1) return state;
  return { ...state, rows: state.rows.filter((r) => r.id !== id) };
}

export function moveRow(state: StateTier, id: string, delta: number): StateTier {
  const i = state.rows.findIndex((r) => r.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.rows.length) return state;
  const tierRows = [...state.rows];
  [tierRows[i], tierRows[j]] = [tierRows[j], tierRows[i]];
  return { ...state, rows: tierRows };
}

export function editRow(state: StateTier, id: string, fields: Partial<Pick<Row, "name" | "color">>): StateTier {
  return {
    ...state,
    rows: state.rows.map((r) =>
      r.id !== id
        ? r
        : {
            ...r,
            ...(fields.name !== undefined ? { name: fields.name.replace(/[\t\n\r]/g, " ").slice(0, NAME_MAX) } : {}),
            ...(fields.color && /^#[0-9a-f]{6}$/i.test(fields.color) ? { color: fields.color.toLowerCase() } : {}),
          },
    ),
  };
}

export function clearRows(state: StateTier): StateTier {
  return { ...state, rows: state.rows.map((r) => ({ ...r, heroes: [] })) };
}

/**
 * Liste de depart tiree de notre tier list : `groupes` donne, palier par
 * palier (S+ a C), les indices des heros dans `slugs`, du plus fort au plus
 * faible. La rangee D reste vide : notre classement s'arrete a C.
 */
export function prefill(slugs: string[], groups: number[][], title = ""): StateTier {
  const state = stateDefault(title);
  return {
    ...state,
    rows: state.rows.map((r, i) => ({ ...r, heroes: (groups[i] ?? []).flatMap((n) => slugs[n] ?? []) })),
  };
}

/** Texte lisible sur un fond de cette couleur : sombre sur clair, clair sur sombre. */
export function colorText(background: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(background);
  if (!m) return "#ffffff";
  const [r, g, b] = m.slice(1).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#0a0e1a" : "#ffffff";
}

// ─────────────────────────────────────────────────────────────
// Partage par lien
// ─────────────────────────────────────────────────────────────

function clean(text: string, max: number): string {
  return text.replace(/[\t\n\r]/g, " ").trim().slice(0, max);
}

/** Une ligne pour le titre, puis une par rangee : nom, couleur, heros. */
export function serialize(state: StateTier): string {
  return [
    clean(state.title, TITLE_MAX),
    ...state.rows.map((r) =>
      [clean(r.name, NAME_MAX), r.color.replace(/^#/, "").toLowerCase(), r.heroes.join(",")].join("\t"),
    ),
  ].join("\n");
}

/**
 * Relit une liste, sans faire confiance au lien : heros inconnus et doublons
 * ecartes, couleurs invalides remplacees, nombre de rangees borne.
 */
export function deserialize(text: string, known: Set<string>): StateTier | null {
  const [title = "", ...rows] = text.split("\n");
  if (!rows.length) return null;
  const seen = new Set<string>();
  const tierRows = rows.slice(0, MAX_ROWS).map((row, i) => {
    const [name = "", color = "", list = ""] = row.split("\t");
    const heroes: string[] = [];
    for (const slug of list.split(",")) {
      if (known.has(slug) && !seen.has(slug)) {
        seen.add(slug);
        heroes.push(slug);
      }
    }
    return {
      id: `p${i}`,
      name: clean(name, NAME_MAX),
      color: /^[0-9a-f]{6}$/i.test(color) ? `#${color.toLowerCase()}` : COLOR_NEUTRAL,
      heroes,
    };
  });
  return { title: clean(title, TITLE_MAX), rows: tierRows };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const o of bytes) binary += String.fromCharCode(o);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(code)) return null;
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Passe des octets dans un flux de (de)compression, en s'arretant au-dela de `max`. */
async function transform(
  bytes: Uint8Array,
  feed: CompressionStream | DecompressionStream,
  max = Infinity,
): Promise<Uint8Array | null> {
  try {
    const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(feed).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const output = new Uint8Array(total);
    let i = 0;
    for (const m of chunks) {
      output.set(m, i);
      i += m.length;
    }
    return output;
  } catch {
    return null;
  }
}

const compressionAvailable = () => typeof CompressionStream !== "undefined";

/**
 * Code du lien : « 2 » + texte compresse, ou « 1 » + texte brut quand la
 * compression manque ou ne gagne rien (une liste presque vide).
 */
export async function encodeTier(state: StateTier, compress = true): Promise<string> {
  const bytes = new TextEncoder().encode(serialize(state));
  const raw = `1${toBase64Url(bytes)}`;
  if (!compress || !compressionAvailable()) return raw;
  const compressed = await transform(bytes, new CompressionStream("deflate-raw"));
  const code = compressed ? `2${toBase64Url(compressed)}` : raw;
  return code.length < raw.length ? code : raw;
}

export async function decodeTier(code: string, known: Set<string>): Promise<StateTier | null> {
  if (!code || code.length > CODE_MAX) return null;
  const bytes = fromBase64Url(code.slice(1));
  if (!bytes) return null;
  let text: Uint8Array | null = null;
  if (code[0] === "1") text = bytes;
  else if (code[0] === "2" && typeof DecompressionStream !== "undefined") {
    text = await transform(bytes, new DecompressionStream("deflate-raw"), TEXT_MAX);
  }
  if (!text || text.length > TEXT_MAX) return null;
  try {
    return deserialize(new TextDecoder("utf-8", { fatal: true }).decode(text), known);
  } catch {
    return null;
  }
}

import { removeTags } from "./tags.mjs";
/**
 * Calculs purs de la synchronisation des mesures : series quotidiennes,
 * historique cumule et compacte, choix des guides de joueurs et combos de
 * competences. Isoles du script pour etre testes sans reseau.
 */

const DAY = 86400000;
export const numberDay = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);
export const dateOfDay = (n) => new Date(n * DAY).toISOString().slice(0, 10);
export const rounded = (v, decimals) =>
  typeof v === "number" ? Math.round(v * 10 ** decimals) / 10 ** decimals : null;

/** Lundi de la semaine d'un numero de jour : le jour 0, 1er janvier 1970, etait un jeudi. */
const monday = (n) => n - ((((n + 3) % 7) + 7) % 7);

/**
 * Series alignees sur une meme date de debut, un point tous les `pas` jours
 * (1 : quotidienne, 7 : hebdomadaire). Un point manquant reste un trou (null)
 * plutot que de decaler les suivants.
 */
export function dailyStreak(points, step = 1) {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = numberDay(sorted[0].date);
  const n = (numberDay(sorted.at(-1).date) - first) / step + 1;
  const series = {
    start: sorted[0].date,
    winRate: Array(n).fill(null),
    banRate: Array(n).fill(null),
    pickRate: Array(n).fill(null),
  };
  for (const p of sorted) {
    const k = (numberDay(p.date) - first) / step;
    series.winRate[k] = p.winRate;
    series.banRate[k] = p.banRate;
    series.pickRate[k] = p.pickRate;
  }
  return series;
}

/** Inverse de serieQuotidienne : un point par jour (ou par semaine) mesure. */
export function pointsOf(series, step = 1) {
  if (!series?.winRate) return [];
  const start = numberDay(series.start);
  return series.winRate.flatMap((v, k) =>
    v == null
      ? []
      : [{
          date: dateOfDay(start + k * step),
          winRate: v,
          banRate: series.banRate?.[k] ?? null,
          pickRate: series.pickRate?.[k] ?? null,
        }],
  );
}

/** Jours gardes au jour pres dans l'historique ; au-dela, une moyenne par semaine. */
export const DAILY_DAYS = 90;

/** Precision des moyennes hebdomadaires, celle des mesures du jeu. */
const DECIMALS = { winRate: 1, banRate: 1, pickRate: 2 };

function average(values, decimals) {
  const measured = values.filter((v) => typeof v === "number");
  return measured.length ? rounded(measured.reduce((a, b) => a + b, 0) / measured.length, decimals) : null;
}

/**
 * Serie stockee d'un heros : les `jours` derniers jours au jour pres, les
 * semaines plus anciennes en moyennes, rangees sous `semaines` (datees de leur
 * lundi, un point tous les sept jours). La coupure tombe un lundi : seules des
 * semaines entieres sont moyennees, et une semaine compactee ne bouge plus.
 * Si une semaine deja compactee recoit malgre tout des jours (fenetre
 * raccourcie, rattrapage), la moyenne existante prime : elle portait plus de
 * mesures.
 */
export function compactHistory(points, weeksExisting = [], days = DAILY_DAYS) {
  if (points.length === 0) return null;
  const last = Math.max(...points.map((p) => numberDay(p.date)));
  const cutoff = monday(last - days + 1);
  const recent = points.filter((p) => numberDay(p.date) >= cutoff);

  const byWeek = new Map();
  for (const p of points) {
    const n = numberDay(p.date);
    if (n >= cutoff) continue;
    const key = dateOfDay(monday(n));
    byWeek.set(key, [...(byWeek.get(key) ?? []), p]);
  }
  const weeks = new Map(
    [...byWeek].map(([date, ps]) => [
      date,
      {
        date,
        winRate: average(ps.map((p) => p.winRate), DECIMALS.winRate),
        banRate: average(ps.map((p) => p.banRate), DECIMALS.banRate),
        pickRate: average(ps.map((p) => p.pickRate), DECIMALS.pickRate),
      },
    ]),
  );
  for (const s of weeksExisting) weeks.set(s.date, s);

  const series = dailyStreak(recent);
  const weekly = dailyStreak([...weeks.values()], 7);
  return weekly ? { ...series, weeks: weekly } : series;
}

/**
 * Historique long, tous rangs confondus. L'API ne remonte que trente jours :
 * chaque synchronisation verse les siens ici, et le fichier grandit patch
 * apres patch — d'une moyenne par semaine au-dela de JOURS_QUOTIDIENS, pour
 * rester compact. Un jour deja connu prend la mesure la plus recente. Un
 * fichier d'avant la compaction, tout au jour pres, se lit tel quel.
 */
export function mergeHistory(existing, trends, days = DAILY_DAYS) {
  const output = {};
  for (const slug of new Set([...Object.keys(existing), ...Object.keys(trends)])) {
    const byDate = new Map();
    for (const p of [...pointsOf(existing[slug]), ...pointsOf(trends[slug]?.all)]) byDate.set(p.date, p);
    const series = compactHistory([...byDate.values()], pointsOf(existing[slug]?.weeks, 7), days);
    if (series) output[slug] = series;
  }
  return output;
}

/**
 * Seuils de rank_level des auteurs de guides, sur l'echelle de
 * src/lib/ranks.ts : Epique des 76, Legende des 106, puis les
 * etoiles mythiques a partir de 136 — Honneur a 25 etoiles, Gloire a 50. Le
 * niveau publie est le meilleur rang atteint par l'auteur.
 */
export const AUTHOR_BANDS = {
  all: [0, Infinity],
  epic: [76, 106],
  legend: [106, 136],
  mythic: [136, 161],
  honor: [161, 186],
  glory: [186, Infinity],
};

/**
 * Guide retenu pour un rang : le plus vote parmi les auteurs de ce rang ; a
 * defaut, d'un rang superieur. Null quand aucun auteur n'atteint le rang.
 */
export function chooseGuide(candidates, rank) {
  const [bottom, top] = AUTHOR_BANDS[rank];
  const byVotes = (a, b) => b.votes - a.votes || b.views - a.views;
  return (
    candidates.filter((g) => g.authorRank >= bottom && g.authorRank < top).sort(byVotes)[0] ??
    candidates.filter((g) => g.authorRank >= bottom).sort(byVotes)[0] ??
    null
  );
}

/**
 * Tranches de duree des duos, en minutes : celles de la courbe de duree d'un
 * heros (evolution.json), de 10 a 20 minutes et plus. L'API publie aussi
 * « moins de 6 », « 6-8 » et « 8-10 » : des parties abandonnees ou a
 * l'echantillon trop maigre (un duo a 92 % entre 6 et 8 minutes), ecartees.
 */
export const BUCKETS_DUO = [
  ["min_win_rate10_12", 10],
  ["min_win_rate12_14", 12],
  ["min_win_rate14_16", 14],
  ["min_win_rate16_18", 16],
  ["min_win_rate18_20", 18],
  ["min_win_rate20", 20],
];

/**
 * Duos d'un heros dans un rang, depuis `/heroes/{h}/compatibility` : les
 * partenaires qui font le plus monter son taux de victoire (`sub_hero`) et
 * ceux qui le font le plus baisser (`sub_hero_last`), cinq de chaque cote.
 * `increase_win_rate` devient un ecart en points ; le taux du duo par tranche
 * de duree, un pourcentage — null quand la tranche est vide (0 pile).
 * Null quand l'API n'a aucun partenaire connu pour ce rang.
 */
export function duosOfRank(block, byId, slug, max = 10) {
  const phases = (a) => {
    const values = BUCKETS_DUO.map(([key]) => (typeof a[key] === "number" && a[key] > 0 ? rounded(a[key] * 100, 1) : null));
    return values.some((v) => v !== null) ? values : null;
  };
  const partners = (list) =>
    (Array.isArray(list) ? list : [])
      .map((a) => ({ a, slug: byId.get(a?.heroid) }))
      .filter(({ a, slug: s }) => s && s !== slug && typeof a.increase_win_rate === "number")
      .map(({ a, slug: s }) => {
        const p = phases(a);
        return { slug: s, advantage: Math.round(a.increase_win_rate * 1000) / 10, ...(p ? { phases: p } : {}) };
      });
  const best = partners(block?.sub_hero).filter((d) => d.advantage > 0).sort((a, b) => b.advantage - a.advantage);
  const worst = partners(block?.sub_hero_last).filter((d) => d.advantage < 0).sort((a, b) => a.advantage - b.advantage);
  if (best.length === 0 && worst.length === 0) return null;
  return {
    winRate: typeof block.main_hero_win_rate === "number" ? rounded(block.main_hero_win_rate * 100, 1) : null,
    best: best.slice(0, max),
    worst: worst.slice(0, max),
  };
}

/**
 * Duos du fichier existant completes par une nouvelle lecture, rang par rang :
 * un rang que l'API n'a pas servi cette fois garde sa mesure precedente.
 */
export function mergeDuos(existing, incoming) {
  const output = {};
  for (const slug of new Set([...Object.keys(existing ?? {}), ...Object.keys(incoming ?? {})])) {
    output[slug] = { ...(existing?.[slug] ?? {}), ...(incoming?.[slug] ?? {}) };
  }
  return output;
}

/** duos.json : fenetre de mesure, puis un heros par ligne, dans l'ordre des slugs. */
export function serializeDuos(days, heroes) {
  const rows = Object.keys(heroes)
    .sort()
    .map((slug) => `    ${JSON.stringify(slug)}: ${JSON.stringify(heroes[slug])}`);
  return `{\n  "days": ${days},\n  "heroes": ${rows.length > 0 ? `{\n${rows.join(",\n")}\n  }` : "{}"}\n}\n`;
}

const normalizeName = (name) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ORDER_COMBOS = ["laning", "teamfight"];

/** « LANING COMBOS » → laning ; null pour un titre inconnu. */
const typeCombo = (title) => ORDER_COMBOS.find((t) => normalizeName(title).startsWith(t)) ?? null;

/**
 * Combos d'un heros, depuis les enregistrements de l'API (`skill-combos`).
 *
 * Chaque competence y arrive en identifiant de jeu. La fiche du heros cote API
 * (`skills` : id, nom) donne son nom, qui retrouve le nom affiche par le site
 * (`competencesSite`, le wiki) et son icone locale (`icones`, par nom). Une
 * forme transformee reprend le nom d'une competence sous un autre identifiant :
 * elle garde l'icone du CDN, qui la distingue. L'attaque de base, absente des
 * fiches, porte un identifiant rond (celui du heros suivi de 00).
 */
export function heroCombos(records, skills, skillsSite, icons) {
  const namesSite = new Map(skillsSite.filter((c) => c?.name).map((c) => [normalizeName(c.name), c.name]));
  const byId = new Map(skills.map((s) => [s.id, s]));
  const firstId = new Map();
  for (const s of skills) if (!firstId.has(normalizeName(s.name))) firstId.set(normalizeName(s.name), s.id);

  const toSkill = (raw) => {
    const id = raw?.data?.skillid;
    const remote = raw?.data?.skillicon ? String(raw.data.skillicon) : null;
    const skill = byId.get(id);
    if (!skill) return id % 100 === 0 ? { name: null, icon: remote, basicAttack: true } : { name: null, icon: remote };
    const key = normalizeName(skill.name);
    const name = namesSite.get(key) ?? (skill.name || null);
    if (firstId.get(key) === id && name && icons[name]) return { name, icon: icons[name] };
    return { name, icon: remote ?? skill.icon ?? null };
  };

  const rank = (c) => (c.type ? ORDER_COMBOS.indexOf(c.type) : ORDER_COMBOS.length);
  return records
    .map((r) => r?.data)
    .filter((d) => d?.desc && Array.isArray(d.skill_id) && d.skill_id.length > 0)
    .map((d) => ({
      type: typeCombo(d.title),
      description: removeTags(d.desc).replace(/\s+/g, " ").trim(),
      skills: d.skill_id.map(toSkill),
    }))
    .sort((a, b) => rank(a) - rank(b));
}

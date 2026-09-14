"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { RateCurve, type SeriesCurve } from "@/components/rate-curve";
import { HeroPortrait } from "@/components/hero-portrait";
import { FilterGroup, Chip } from "@/components/chip";
import { AXES_RADAR, HeroRadar, SERIES_STYLES, TraitLegend, valuesRadar, type PatternTrait } from "@/components/hero-radar";
import Link from "@/components/link";
import { MEASURED_RANKS, type MeasuredRank } from "@/lib/measured-ranks";
import { alignSeries, type WinStreak } from "@/lib/trends";
import type { Tier } from "@/lib/types";
import { useLocale, useT } from "@/i18n/provider";
import { keySearch, cn } from "@/lib/utils";

/** Taux d'un rang : victoire et ban en %, palier de la tier list. */
export type RateRank = [win: number, ban: number, tier: Tier];

export interface HeroComparable {
  slug: string;
  name: string;
  icon: string | null;
  roles: string[];
  lanes: string[];
  notes: {
    offense: number | null;
    durability: number | null;
    abilityEffects: number | null;
    difficulty: number | null;
  };
  /** Un rang absent n'a pas de classement pour ce heros. */
  rate: Partial<Record<MeasuredRank, RateRank>>;
  skins: number;
}

/** Etendue des taux d'un rang sur tout le catalogue : l'echelle du radar. */
export interface BoundsRank {
  win: [number, number];
  ban: [number, number];
}

const COLOR_TIER: Record<Tier, string> = {
  "S+": "border-blood-500/40 text-blood-500",
  S: "border-gold-500/40 text-gold-400",
  A: "border-emerald-500/40 text-emerald-400",
  B: "border-azure-500/40 text-azure-400",
  C: "border-night-600 text-chalk-500",
};
const ORDER_TIERS: Tier[] = ["S+", "S", "A", "B", "C"];

/** Cle de traduction de chaque note du jeu. */
const LABEL_NOTE: Record<keyof HeroComparable["notes"], string> = {
  offense: "offense",
  durability: "durability",
  abilityEffects: "abilityEffects",
  difficulty: "difficulty",
};

/** Deux heros au moins, trois au plus : au-dela, radar et courbes deviennent illisibles. */
const MAX_HEROES = 3;
const SETTINGS = ["a", "b", "c"] as const;

/**
 * Comparateur de deux ou trois heros.
 *
 * Notes du jeu et taux du rang choisi se lisent dans un radar, puis dans un
 * tableau ou la meilleure valeur de chaque ligne ressort ; les courbes de
 * victoire sur trente jours se superposent dessous. Chaque heros garde sa
 * couleur et son motif de trait d'un bout a l'autre.
 */
export function HeroComparator({
  heroes,
  ranks,
  bounds,
}: {
  heroes: HeroComparable[];
  /** Rangs qui ont un classement, tous rangs confondus en tete. */
  ranks: MeasuredRank[];
  bounds: Partial<Record<MeasuredRank, BoundsRank>>;
}) {
  const t = useT();
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const [choice, setChoice] = useState<string[]>(() => heroes.slice(0, 2).map((h) => h.slug));
  const [rank, setRank] = useState<MeasuredRank>("all");
  const buttonAdd = useRef<HTMLButtonElement>(null);
  const thirdField = useRef<HTMLInputElement>(null);

  // Le choix passe par l'URL cote client, ce qui garde la page statique et rend
  // la comparaison partageable. Le rendu serveur et la premiere hydratation
  // partent des deux premiers heros (identiques des deux cotes, donc sans
  // desaccord) ; apres le montage seulement, on adopte ?a=&b=&c=&rang= s'ils
  // designent des heros et un rang connus, puis chaque changement se reporte
  // dans l'URL.
  const rise = useRef(false);
  useEffect(() => {
    if (!rise.current) {
      rise.current = true;
      const params = new URLSearchParams(window.location.search);
      const readValues = [...new Set(SETTINGS.map((p) => params.get(p)).filter((s): s is string => !!s && bySlug.has(s)))];
      const r = params.get("rang") as MeasuredRank | null;
      let lu = false;
      if (readValues.length > 0) {
        // Un seul heros dans l'adresse (lien « Comparer » d'une fiche) : le
        // second est le premier du catalogue qui n'est pas lui.
        const other = heroes.find((h) => h.slug !== readValues[0])?.slug;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de l'URL apres montage
        setChoice(readValues.length > 1 ? readValues.slice(0, MAX_HEROES) : other ? [readValues[0], other] : readValues);
        lu = true;
      }
      if (r && r !== "all" && ranks.includes(r)) {
        setRank(r);
        lu = true;
      }
      if (lu) return;
    }
    if (choice.length < 2) return;
    const params = new URLSearchParams(choice.map((slug, i) => [SETTINGS[i], slug]));
    if (rank !== "all") params.set("rang", rank);
    window.history.replaceState(null, "", `?${params}`);
  }, [choice, rank, bySlug, heroes, ranks]);

  // Choisir un heros deja pris ailleurs echange les deux places.
  const change = (i: number) => (slug: string) =>
    setChoice((c) => {
      const next = [...c];
      const j = next.indexOf(slug);
      if (j >= 0 && j !== i) next[j] = next[i];
      next[i] = slug;
      return next;
    });
  const add = () => {
    const free = heroes.find((h) => !choice.includes(h.slug));
    if (!free) return;
    setChoice((c) => [...c, free.slug]);
    // Le bouton disparait : le focus passe au nouveau champ, qui ouvre sa liste.
    requestAnimationFrame(() => thirdField.current?.focus());
  };
  const remove = () => {
    setChoice((c) => c.slice(0, 2));
    requestAnimationFrame(() => buttonAdd.current?.focus());
  };

  const chosen = choice.map((s) => bySlug.get(s)).filter((h): h is HeroComparable => h !== undefined);
  const labels = [t("compareUI.first"), t("compareUI.second"), t("compareUI.third")];
  const three = chosen.length === MAX_HEROES;

  return (
    <div>
      <div className={cn("grid gap-3 sm:gap-5", choice.length === MAX_HEROES ? "sm:grid-cols-3" : "grid-cols-2")}>
        {choice.map((slug, i) => (
          <Picker
            key={i}
            label={labels[i]}
            heroes={heroes}
            value={slug}
            onChange={change(i)}
            pattern={SERIES_STYLES[i]}
            refField={i === 2 ? thirdField : undefined}
            remove={i === 2 ? remove : undefined}
          />
        ))}
      </div>
      {choice.length < MAX_HEROES && (
        <button
          ref={buttonAdd}
          type="button"
          onClick={add}
          className="bevel-sm mt-3 inline-flex items-center gap-2 border border-dashed border-night-600 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          <Plus size={15} aria-hidden />
          {t("compareUI.add")}
        </button>
      )}

      {chosen.length >= 2 && (
        <div className="mt-8">
          <div className={cn("grid gap-2 sm:gap-5", three ? "grid-cols-3" : "grid-cols-2")}>
            {chosen.map((h, i) => (
              <HeroHeader key={h.slug} hero={h} rank={rank} style={SERIES_STYLES[i]} compact={three} />
            ))}
          </div>

          {ranks.length > 1 && (
            <FilterGroup legend={t("measuredRanks.label")} widthLegend="" className="mt-6 justify-center">
              {ranks.map((r) => (
                <Chip key={r} dense active={r === rank} onClick={() => setRank(r)}>
                  {t(`measuredRanks.${r}`)}
                </Chip>
              ))}
            </FilterGroup>
          )}

          <Profile heroes={chosen} rank={rank} bounds={bounds[rank] ?? null} />
          <ComparisonTable heroes={chosen} rank={rank} />
          <ComparedCurves heroes={chosen} rank={rank} />
        </div>
      )}
    </div>
  );
}

/** Radar des notes du jeu et des taux du rang, une toile par heros. */
function Profile({ heroes, rank, bounds }: { heroes: HeroComparable[]; rank: MeasuredRank; bounds: BoundsRank | null }) {
  const t = useT();
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const title = t("compareUI.profile", { rang: t(`measuredRanks.${rank}`) });
  const axes = AXES_RADAR.map((a) =>
    t(a === "win" ? "compareUI.winRate" : a === "ban" ? "compareUI.banRate" : `compareUI.${a}`),
  );
  const series = heroes.map((h, i) => {
    const x = h.rate[rank];
    return {
      name: h.name,
      ...SERIES_STYLES[i],
      values: valuesRadar(h.notes, x ? { win: x[0], ban: x[1] } : null, bounds),
    };
  });
  return (
    <section className="mt-8" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-center text-xs uppercase tracking-wide text-chalk-500">
        {title}
      </h2>
      <HeroRadar
        id={id}
        axes={axes}
        series={series}
        title={title}
        summary={t("compareUI.radarSummary")}
        className="bevel mt-3 border border-night-700/70 bg-night-900/60 p-3 sm:p-4"
      />
      <p className="mt-2 text-center text-xs text-chalk-500">{t("compareUI.radarScale")}</p>
    </section>
  );
}

interface RowTable {
  key: string;
  label: string;
  values: (number | null)[];
  shown: (v: number, i: number) => React.ReactNode;
  /** 1 : la plus haute l'emporte ; -1 : la plus basse ; 0 : personne en tete. */
  direction: 1 | -1 | 0;
}

/**
 * Valeurs exactes, un heros par colonne : le pendant lisible du radar. Sur
 * chaque ligne, la meilleure valeur ressort, en couleur et en toutes lettres
 * pour les lecteurs d'ecran.
 */
function ComparisonTable({ heroes, rank }: { heroes: HeroComparable[]; rank: MeasuredRank }) {
  const t = useT();
  const locale = useLocale();
  const percent = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const rate = heroes.map((h) => h.rate[rank] ?? null);
  const note = (key: keyof HeroComparable["notes"], direction: 1 | 0): RowTable => ({
    key,
    label: t(`compareUI.${LABEL_NOTE[key]}`),
    values: heroes.map((h) => h.notes[key]),
    shown: (v) => integer.format(v),
    direction,
  });
  const rows: RowTable[] = [
    {
      key: "tier",
      label: t("compareUI.tier"),
      values: rate.map((x) => (x ? ORDER_TIERS.length - ORDER_TIERS.indexOf(x[2]) : null)),
      shown: (_, i) => (
        <span className={cn("bevel-sm inline-block border px-1.5 py-0.5 text-[0.7rem] font-bold", COLOR_TIER[rate[i]![2]])}>
          {rate[i]![2]}
        </span>
      ),
      direction: 1,
    },
    {
      key: "win",
      label: t("compareUI.winRate"),
      values: rate.map((x) => x?.[0] ?? null),
      shown: (v) => percent.format(v / 100),
      direction: 1,
    },
    {
      key: "ban",
      label: t("compareUI.banRate"),
      values: rate.map((x) => x?.[1] ?? null),
      shown: (v) => percent.format(v / 100),
      direction: -1,
    },
    note("offense", 1),
    note("durability", 1),
    note("abilityEffects", 1),
    // Une difficulte plus basse n'est pas un avantage en soi : personne en tete.
    note("difficulty", 0),
    { key: "skins", label: t("compareUI.skins"), values: heroes.map((h) => h.skins), shown: (v) => integer.format(v), direction: 1 },
  ];
  const names = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(heroes.map((h) => h.name));

  return (
    <div className="bevel mt-6 relative overflow-x-auto border border-night-700/70 bg-night-900/60 px-3 py-2 sm:px-4">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("compareUI.table", { noms: names, rang: t(`measuredRanks.${rank}`) })}</caption>
        <thead>
          <tr className="border-b border-night-800">
            <th scope="col" className="py-2">
              <span className="sr-only">{t("compareUI.criterion")}</span>
            </th>
            {heroes.map((h, i) => (
              <th scope="col" key={h.slug} className="px-1.5 py-2 text-right font-heading font-bold text-chalk-100">
                <span className="inline-flex items-center justify-end gap-1.5">
                  <TraitLegend {...SERIES_STYLES[i]} className="hidden min-[420px]:block" />
                  {h.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-night-800">
          {rows.map((l) => {
            const measured = l.values.filter((v): v is number => v !== null);
            const target = l.direction === 1 ? Math.max(...measured) : Math.min(...measured);
            // Personne en tete quand tous sont a egalite ou qu'une seule valeur est connue.
            const tieBreak = l.direction !== 0 && measured.length > 1 && new Set(measured).size > 1;
            return (
              <tr key={l.key}>
                <th scope="row" className="py-2 pr-2 text-left text-xs font-medium uppercase tracking-wide text-chalk-500">
                  {l.label}
                </th>
                {l.values.map((v, i) => {
                  const best = tieBreak && v === target;
                  return (
                    <td
                      key={i}
                      className={cn("px-1.5 py-2 text-right font-semibold tabular-nums", best ? "text-gold-400" : "text-chalk-300")}
                    >
                      {v === null ? "—" : l.shown(v, i)}
                      {best && <span className="sr-only"> ({t("compareUI.best")})</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type TrendsWin = Partial<Record<MeasuredRank, WinStreak>>;

const DAYS_CURVE = 30;

/** Requetes deja lancees, par heros : revenir a un heros ne recharge rien. */
const requests = new Map<string, Promise<TrendsWin>>();

function loadTrends(slug: string): Promise<TrendsWin> {
  let request = requests.get(slug);
  if (!request) {
    request = fetch(`/trends/${slug}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<TrendsWin>;
    });
    // Un echec ne reste pas en memoire : la prochaine selection retente.
    request.catch(() => requests.delete(slug));
    requests.set(slug, request);
  }
  return request;
}

const measures = (s: WinStreak | undefined) => (s?.winRate ?? []).filter((v): v is number => v !== null);

/**
 * Taux de victoire des heros choisis sur trente jours, superposes. Le
 * catalogue du comparateur n'a pas l'historique : chaque heros choisi fait
 * venir son fichier statique (`/trends/<slug>.json`), une fois par visite.
 * Les courbes suivent le rang du comparateur ; a defaut de mesure a ce rang,
 * elles passent au premier rang que tous ont en commun, et le disent.
 */
function ComparedCurves({ heroes, rank }: { heroes: HeroComparable[]; rank: MeasuredRank }) {
  const t = useT();
  const locale = useLocale();
  const [charges, setCharges] = useState<Record<string, TrendsWin | "error">>({});
  const key = heroes.map((h) => h.slug).join(",");

  useEffect(() => {
    for (const slug of key.split(",")) {
      loadTrends(slug).then(
        (d) => setCharges((c) => ({ ...c, [slug]: d })),
        () => setCharges((c) => ({ ...c, [slug]: "error" })),
      );
    }
  }, [key]);

  const title = (
    <h2 className="text-center text-xs uppercase tracking-wide text-chalk-500">
      {t("compareUI.curves", { n: DAYS_CURVE })}
    </h2>
  );
  const message = (text: string) => (
    <section className="mt-8">
      {title}
      <p role="status" className="bevel mt-3 grid h-[200px] place-items-center border border-night-700/70 bg-night-900/60 px-4 text-center text-sm text-chalk-500">
        {text}
      </p>
    </section>
  );

  const data = heroes.map((h) => charges[h.slug]);
  if (data.some((d) => d === undefined)) return message(t("compareUI.loading"));
  if (data.some((d) => d === "error")) return message(t("compareUI.curvesError"));
  const series30 = data as TrendsWin[];

  const byHero = series30.map((d) => MEASURED_RANKS.filter((r) => measures(d[r]).length > 1));
  const common = MEASURED_RANKS.filter((r) => byHero.every((l) => l.includes(r)));
  const ranks = common.length > 0 ? common : MEASURED_RANKS.filter((r) => byHero.some((l) => l.includes(r)));
  if (ranks.length === 0) return message(t("compareUI.noHeroCurve"));
  const chosen = ranks.includes(rank) ? rank : ranks[0];

  // Couleur et motif attaches a la place du heros, comme dans le radar : le
  // troisieme garde les siens meme quand un autre n'a pas de mesure.
  const sides = heroes.map((h, i) => ({ heroes: h, series: series30[i][chosen], ...SERIES_STYLES[i] }));
  const { dates, values } = alignSeries(
    sides.map((c) => ({ start: c.series?.start ?? "", values: c.series?.winRate ?? [] })),
  );
  const from = Math.max(0, dates.length - DAYS_CURVE);
  const dashes = (m: PatternTrait) => m !== "solid";
  const series: SeriesCurve[] = sides.flatMap((c, k) =>
    measures(c.series).length > 1
      ? [{ name: c.heroes.name, values: values[k].slice(from), color: c.color, dashes: dashes(c.pattern) }]
      : [],
  );
  const without = sides.filter((c) => measures(c.series).length < 2);

  const count = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const details = series
    .map((s) => {
      const v = s.values.filter((x): x is number => x !== null);
      return t("compareUI.heroSummary", { nom: s.name, debut: count.format(v[0]), fin: count.format(v.at(-1)!) });
    })
    .join(" ; ");

  return (
    <section className="mt-8">
      {title}
      {chosen !== rank && (
        <p className="mt-2 text-center text-xs text-chalk-500">
          {t("compareUI.curvesOtherRank", { rang: t(`measuredRanks.${chosen}`) })}
        </p>
      )}
      <div className="bevel mt-3 border border-night-700/70 bg-night-900/60 p-3 sm:p-4">
        <RateCurve
          dates={dates.slice(from)}
          series={series}
          label={t("compareUI.curvesSummary", {
            n: DAYS_CURVE,
            rang: t(`measuredRanks.${chosen}`).toLocaleLowerCase(locale),
            details,
          })}
        />
      </div>
      {without.map((c) => (
        <p key={c.heroes.slug} className="mt-2 text-xs text-chalk-500">
          {t("compareUI.noCurveAtRank", { nom: c.heroes.name })}
        </p>
      ))}
    </section>
  );
}

/**
 * Choix d'un heros, par recherche.
 *
 * Un menu deroulant de 133 noms oblige a faire defiler la liste ; ici, on tape
 * les premieres lettres et la liste se resserre. Le champ affiche le heros
 * choisi tant qu'on ne cherche pas. Clavier : fleches pour parcourir, Entree
 * pour choisir, Echap pour abandonner.
 */
function Picker({
  label,
  heroes,
  value,
  onChange,
  pattern,
  refField,
  remove,
}: {
  label: string;
  heroes: HeroComparable[];
  value: string;
  onChange: (v: string) => void;
  /** Couleur et trait du heros dans le radar et les courbes. */
  pattern: { color: string; pattern: PatternTrait };
  refField?: React.Ref<HTMLInputElement>;
  /** Present pour un selecteur facultatif : bouton pour le retirer. */
  remove?: () => void;
}) {
  const t = useT();
  const id = useId();
  const chosen = heroes.find((h) => h.slug === value) ?? null;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = keySearch(search.trim());
    return q ? heroes.filter((h) => keySearch(h.name).includes(q)) : heroes;
  }, [heroes, search]);

  // L'option active reste visible quand on la deplace au clavier.
  useEffect(() => {
    if (!open) return;
    const slug = results[active]?.slug;
    if (slug) document.getElementById(`${id}-${slug}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, results, id]);

  const choose = (h: HeroComparable) => {
    onChange(h.slug);
    setSearch("");
    setOpen(false);
  };

  const keyboard = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={`${id}-champ`} className="flex items-center gap-2 text-xs uppercase tracking-wide text-chalk-500">
          <TraitLegend color={pattern.color} pattern={pattern.pattern} />
          {label}
        </label>
        {remove && (
          <button
            type="button"
            onClick={remove}
            aria-label={t("compareUI.remove", { nom: chosen?.name ?? label })}
            className="-my-1 rounded-sm p-1 text-chalk-500 transition-colors hover:text-blood-500"
          >
            <X size={15} aria-hidden />
          </button>
        )}
      </div>
      <div className="bevel-sm flex items-center gap-2 border border-night-700 bg-night-900 px-2.5 transition-colors focus-within:border-gold-500">
        {!open && chosen && (
          <HeroPortrait source={chosen.icon} name={chosen.name} size="micro" decorative />
        )}
        <input
          ref={refField}
          id={`${id}-champ`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-liste`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[active] ? `${id}-${results[active].slug}` : undefined
          }
          autoComplete="off"
          value={open ? search : (chosen?.name ?? "")}
          placeholder={t("compareUI.search")}
          onFocus={() => {
            setOpen(true);
            setSearch("");
            setActive(0);
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setSearch(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={keyboard}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-chalk-100 outline-none placeholder:text-chalk-500"
        />
        <ChevronDown
          size={16}
          aria-hidden
          className={cn("shrink-0 text-chalk-500 transition-transform", open && "rotate-180")}
        />
      </div>

      {open && (
        <ul
          id={`${id}-liste`}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto border border-night-700 bg-night-900 py-1 shadow-xl shadow-black/40"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-chalk-500">{t("compareUI.none")}</li>
          ) : (
            results.map((h, i) => (
              <li
                key={h.slug}
                id={`${id}-${h.slug}`}
                role="option"
                aria-selected={h.slug === value}
                // Empeche le champ de perdre le focus avant la prise en compte du clic.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(h)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm",
                  i === active ? "bg-night-800 text-gold-400" : "text-chalk-200",
                  h.slug === value && "font-semibold",
                )}
              >
                <HeroPortrait source={h.icon} name={h.name} size="mini" decorative />
                {h.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function HeroHeader({
  hero: heroes,
  rank,
  style,
  compact,
}: {
  hero: HeroComparable;
  rank: MeasuredRank;
  style: { color: string; pattern: PatternTrait };
  /** Trois heros de front : portrait au-dessus du nom sur les petits ecrans. */
  compact: boolean;
}) {
  const t = useT();
  const tier = heroes.rate[rank]?.[2] ?? null;
  return (
    <div className={cn("bevel min-w-0 border border-night-700/70 bg-night-900/60", compact ? "p-2.5 sm:p-4" : "p-4")}>
      <div className={cn("flex gap-3", compact ? "flex-col items-center text-center sm:flex-row sm:text-left" : "items-center")}>
        <HeroPortrait source={heroes.icon} name={heroes.name} size={compact ? "medium" : "thumb"} />
        <div className="min-w-0 max-w-full">
          <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", compact && "justify-center sm:justify-start")}>
            <Link
              href={`/heroes/${heroes.slug}`}
              className={cn("font-heading font-bold text-chalk-100 hover:text-gold-400", compact ? "text-base sm:text-lg" : "truncate text-lg")}
            >
              {heroes.name}
            </Link>
            {tier && (
              <span className={cn("bevel-sm shrink-0 border px-1.5 py-0.5 text-[0.7rem] font-bold", COLOR_TIER[tier])}>
                {tier}
              </span>
            )}
          </div>
          <p className={cn("mt-0.5 text-xs text-chalk-500", compact ? "line-clamp-2 sm:truncate" : "truncate")}>
            {heroes.roles.map((r) => t(`roles.${r}`)).join(" · ")}
            {heroes.lanes.length > 0 && ` — ${heroes.lanes.map((l) => t(`lanes.${l}`)).join(" · ")}`}
          </p>
          <TraitLegend color={style.color} pattern={style.pattern} className={cn("mt-1.5", compact && "mx-auto sm:mx-0")} />
        </div>
      </div>
    </div>
  );
}

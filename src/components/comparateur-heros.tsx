"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { CourbeTaux, type SerieCourbe } from "@/components/courbe-taux";
import { PortraitHeros } from "@/components/portrait-heros";
import { GroupeFiltres, Puce } from "@/components/puce";
import { AXES_RADAR, RadarHeros, STYLES_SERIES, TraitLegende, valeursRadar, type MotifTrait } from "@/components/radar-heros";
import Link from "@/components/lien";
import { RANGS_MESURE, type RangMesure } from "@/lib/rangs-mesure";
import { alignerSeries, type SerieVictoire } from "@/lib/tendances";
import type { Palier } from "@/lib/types";
import { useLangue, useT } from "@/i18n/fournisseur";
import { cleRecherche, cn } from "@/lib/utils";

/** Taux d'un rang : victoire et ban en %, palier de la tier list. */
export type TauxRang = [victoire: number, ban: number, palier: Palier];

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
  /** Un rang absent n'a pas de classement pour ce heros. */
  taux: Partial<Record<RangMesure, TauxRang>>;
  skins: number;
}

/** Etendue des taux d'un rang sur tout le catalogue : l'echelle du radar. */
export interface BornesRang {
  victoire: [number, number];
  ban: [number, number];
}

const COULEUR_PALIER: Record<Palier, string> = {
  "S+": "border-sang-500/40 text-sang-500",
  S: "border-or-500/40 text-or-400",
  A: "border-emerald-500/40 text-emerald-400",
  B: "border-azur-500/40 text-azur-400",
  C: "border-nuit-600 text-craie-500",
};
const ORDRE_PALIERS: Palier[] = ["S+", "S", "A", "B", "C"];

/** Deux heros au moins, trois au plus : au-dela, radar et courbes deviennent illisibles. */
const MAX_HEROS = 3;
const PARAMETRES = ["a", "b", "c"] as const;

/**
 * Comparateur de deux ou trois heros.
 *
 * Notes du jeu et taux du rang choisi se lisent dans un radar, puis dans un
 * tableau ou la meilleure valeur de chaque ligne ressort ; les courbes de
 * victoire sur trente jours se superposent dessous. Chaque heros garde sa
 * couleur et son motif de trait d'un bout a l'autre.
 */
export function ComparateurHeros({
  heros,
  rangs,
  bornes,
}: {
  heros: HerosComparable[];
  /** Rangs qui ont un classement, tous rangs confondus en tete. */
  rangs: RangMesure[];
  bornes: Partial<Record<RangMesure, BornesRang>>;
}) {
  const t = useT();
  const parSlug = useMemo(() => new Map(heros.map((h) => [h.slug, h])), [heros]);
  const [choix, setChoix] = useState<string[]>(() => heros.slice(0, 2).map((h) => h.slug));
  const [rang, setRang] = useState<RangMesure>("all");
  const boutonAjout = useRef<HTMLButtonElement>(null);
  const champTroisieme = useRef<HTMLInputElement>(null);

  // Le choix passe par l'URL cote client, ce qui garde la page statique et rend
  // la comparaison partageable. Le rendu serveur et la premiere hydratation
  // partent des deux premiers heros (identiques des deux cotes, donc sans
  // desaccord) ; apres le montage seulement, on adopte ?a=&b=&c=&rang= s'ils
  // designent des heros et un rang connus, puis chaque changement se reporte
  // dans l'URL.
  const monte = useRef(false);
  useEffect(() => {
    if (!monte.current) {
      monte.current = true;
      const params = new URLSearchParams(window.location.search);
      const lus = [...new Set(PARAMETRES.map((p) => params.get(p)).filter((s): s is string => !!s && parSlug.has(s)))];
      const r = params.get("rang") as RangMesure | null;
      let lu = false;
      if (lus.length > 0) {
        // Un seul heros dans l'adresse (lien « Comparer » d'une fiche) : le
        // second est le premier du catalogue qui n'est pas lui.
        const autre = heros.find((h) => h.slug !== lus[0])?.slug;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de l'URL apres montage
        setChoix(lus.length > 1 ? lus.slice(0, MAX_HEROS) : autre ? [lus[0], autre] : lus);
        lu = true;
      }
      if (r && r !== "all" && rangs.includes(r)) {
        setRang(r);
        lu = true;
      }
      if (lu) return;
    }
    if (choix.length < 2) return;
    const params = new URLSearchParams(choix.map((slug, i) => [PARAMETRES[i], slug]));
    if (rang !== "all") params.set("rang", rang);
    window.history.replaceState(null, "", `?${params}`);
  }, [choix, rang, parSlug, heros, rangs]);

  // Choisir un heros deja pris ailleurs echange les deux places.
  const changer = (i: number) => (slug: string) =>
    setChoix((c) => {
      const suivant = [...c];
      const j = suivant.indexOf(slug);
      if (j >= 0 && j !== i) suivant[j] = suivant[i];
      suivant[i] = slug;
      return suivant;
    });
  const ajouter = () => {
    const libre = heros.find((h) => !choix.includes(h.slug));
    if (!libre) return;
    setChoix((c) => [...c, libre.slug]);
    // Le bouton disparait : le focus passe au nouveau champ, qui ouvre sa liste.
    requestAnimationFrame(() => champTroisieme.current?.focus());
  };
  const retirer = () => {
    setChoix((c) => c.slice(0, 2));
    requestAnimationFrame(() => boutonAjout.current?.focus());
  };

  const choisis = choix.map((s) => parSlug.get(s)).filter((h): h is HerosComparable => h !== undefined);
  const libelles = [t("compareUI.premier"), t("compareUI.second"), t("compareUI.troisieme")];
  const trois = choisis.length === MAX_HEROS;

  return (
    <div>
      <div className={cn("grid gap-3 sm:gap-5", choix.length === MAX_HEROS ? "sm:grid-cols-3" : "grid-cols-2")}>
        {choix.map((slug, i) => (
          <Selecteur
            key={i}
            label={libelles[i]}
            heros={heros}
            valeur={slug}
            onChange={changer(i)}
            motif={STYLES_SERIES[i]}
            refChamp={i === 2 ? champTroisieme : undefined}
            retirer={i === 2 ? retirer : undefined}
          />
        ))}
      </div>
      {choix.length < MAX_HEROS && (
        <button
          ref={boutonAjout}
          type="button"
          onClick={ajouter}
          className="biseau-sm mt-3 inline-flex items-center gap-2 border border-dashed border-nuit-600 px-3 py-1.5 text-sm text-craie-300 transition-colors hover:border-or-500/60 hover:text-or-400"
        >
          <Plus size={15} aria-hidden />
          {t("compareUI.ajouter")}
        </button>
      )}

      {choisis.length >= 2 && (
        <div className="mt-8">
          <div className={cn("grid gap-2 sm:gap-5", trois ? "grid-cols-3" : "grid-cols-2")}>
            {choisis.map((h, i) => (
              <EnTeteHeros key={h.slug} heros={h} rang={rang} style={STYLES_SERIES[i]} compact={trois} />
            ))}
          </div>

          {rangs.length > 1 && (
            <GroupeFiltres legende={t("rangsMesure.label")} largeurLegende="" className="mt-6 justify-center">
              {rangs.map((r) => (
                <Puce key={r} dense actif={r === rang} onClick={() => setRang(r)}>
                  {t(`rangsMesure.${r}`)}
                </Puce>
              ))}
            </GroupeFiltres>
          )}

          <Profil heros={choisis} rang={rang} bornes={bornes[rang] ?? null} />
          <TableauComparatif heros={choisis} rang={rang} />
          <CourbesComparees heros={choisis} rang={rang} />
        </div>
      )}
    </div>
  );
}

/** Radar des notes du jeu et des taux du rang, une toile par heros. */
function Profil({ heros, rang, bornes }: { heros: HerosComparable[]; rang: RangMesure; bornes: BornesRang | null }) {
  const t = useT();
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const titre = t("compareUI.profil", { rang: t(`rangsMesure.${rang}`) });
  const axes = AXES_RADAR.map((a) =>
    t(a === "victoire" ? "compareUI.tauxVictoire" : a === "ban" ? "compareUI.tauxBan" : `compareUI.${a}`),
  );
  const series = heros.map((h, i) => {
    const x = h.taux[rang];
    return {
      nom: h.nom,
      ...STYLES_SERIES[i],
      valeurs: valeursRadar(h.notes, x ? { victoire: x[0], ban: x[1] } : null, bornes),
    };
  });
  return (
    <section className="mt-8" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-center text-xs uppercase tracking-wide text-craie-500">
        {titre}
      </h2>
      <RadarHeros
        id={id}
        axes={axes}
        series={series}
        titre={titre}
        resume={t("compareUI.radarResume")}
        className="biseau mt-3 border border-nuit-700/70 bg-nuit-900/60 p-3 sm:p-4"
      />
      <p className="mt-2 text-center text-xs text-craie-500">{t("compareUI.radarEchelle")}</p>
    </section>
  );
}

interface LigneTableau {
  cle: string;
  label: string;
  valeurs: (number | null)[];
  affiche: (v: number, i: number) => React.ReactNode;
  /** 1 : la plus haute l'emporte ; -1 : la plus basse ; 0 : personne en tete. */
  sens: 1 | -1 | 0;
}

/**
 * Valeurs exactes, un heros par colonne : le pendant lisible du radar. Sur
 * chaque ligne, la meilleure valeur ressort, en couleur et en toutes lettres
 * pour les lecteurs d'ecran.
 */
function TableauComparatif({ heros, rang }: { heros: HerosComparable[]; rang: RangMesure }) {
  const t = useT();
  const langue = useLangue();
  const pourcent = new Intl.NumberFormat(langue, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const entier = new Intl.NumberFormat(langue);
  const taux = heros.map((h) => h.taux[rang] ?? null);
  const note = (cle: keyof HerosComparable["notes"], sens: 1 | 0): LigneTableau => ({
    cle,
    label: t(`compareUI.${cle}`),
    valeurs: heros.map((h) => h.notes[cle]),
    affiche: (v) => entier.format(v),
    sens,
  });
  const lignes: LigneTableau[] = [
    {
      cle: "palier",
      label: t("compareUI.palier"),
      valeurs: taux.map((x) => (x ? ORDRE_PALIERS.length - ORDRE_PALIERS.indexOf(x[2]) : null)),
      affiche: (_, i) => (
        <span className={cn("biseau-sm inline-block border px-1.5 py-0.5 text-[0.7rem] font-bold", COULEUR_PALIER[taux[i]![2]])}>
          {taux[i]![2]}
        </span>
      ),
      sens: 1,
    },
    {
      cle: "victoire",
      label: t("compareUI.tauxVictoire"),
      valeurs: taux.map((x) => x?.[0] ?? null),
      affiche: (v) => pourcent.format(v / 100),
      sens: 1,
    },
    {
      cle: "ban",
      label: t("compareUI.tauxBan"),
      valeurs: taux.map((x) => x?.[1] ?? null),
      affiche: (v) => pourcent.format(v / 100),
      sens: -1,
    },
    note("offensive", 1),
    note("resistance", 1),
    note("effets", 1),
    // Une difficulte plus basse n'est pas un avantage en soi : personne en tete.
    note("difficulte", 0),
    { cle: "skins", label: t("compareUI.skins"), valeurs: heros.map((h) => h.skins), affiche: (v) => entier.format(v), sens: 1 },
  ];
  const noms = new Intl.ListFormat(langue, { style: "long", type: "conjunction" }).format(heros.map((h) => h.nom));

  return (
    <div className="biseau mt-6 relative overflow-x-auto border border-nuit-700/70 bg-nuit-900/60 px-3 py-2 sm:px-4">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("compareUI.tableau", { noms, rang: t(`rangsMesure.${rang}`) })}</caption>
        <thead>
          <tr className="border-b border-nuit-800">
            <th scope="col" className="py-2">
              <span className="sr-only">{t("compareUI.critere")}</span>
            </th>
            {heros.map((h, i) => (
              <th scope="col" key={h.slug} className="px-1.5 py-2 text-right font-titre font-bold text-craie-100">
                <span className="inline-flex items-center justify-end gap-1.5">
                  <TraitLegende {...STYLES_SERIES[i]} className="hidden min-[420px]:block" />
                  {h.nom}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-nuit-800">
          {lignes.map((l) => {
            const mesurees = l.valeurs.filter((v): v is number => v !== null);
            const cible = l.sens === 1 ? Math.max(...mesurees) : Math.min(...mesurees);
            // Personne en tete quand tous sont a egalite ou qu'une seule valeur est connue.
            const departage = l.sens !== 0 && mesurees.length > 1 && new Set(mesurees).size > 1;
            return (
              <tr key={l.cle}>
                <th scope="row" className="py-2 pr-2 text-left text-xs font-medium uppercase tracking-wide text-craie-500">
                  {l.label}
                </th>
                {l.valeurs.map((v, i) => {
                  const meilleur = departage && v === cible;
                  return (
                    <td
                      key={i}
                      className={cn("px-1.5 py-2 text-right font-semibold tabular-nums", meilleur ? "text-or-400" : "text-craie-300")}
                    >
                      {v === null ? "—" : l.affiche(v, i)}
                      {meilleur && <span className="sr-only"> ({t("compareUI.meilleur")})</span>}
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

type TendancesVictoire = Partial<Record<RangMesure, SerieVictoire>>;

const JOURS_COURBE = 30;

/** Requetes deja lancees, par heros : revenir a un heros ne recharge rien. */
const requetes = new Map<string, Promise<TendancesVictoire>>();

function chargerTendances(slug: string): Promise<TendancesVictoire> {
  let requete = requetes.get(slug);
  if (!requete) {
    requete = fetch(`/tendances/${slug}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<TendancesVictoire>;
    });
    // Un echec ne reste pas en memoire : la prochaine selection retente.
    requete.catch(() => requetes.delete(slug));
    requetes.set(slug, requete);
  }
  return requete;
}

const mesures = (s: SerieVictoire | undefined) => (s?.victoire ?? []).filter((v): v is number => v !== null);

/**
 * Taux de victoire des heros choisis sur trente jours, superposes. Le
 * catalogue du comparateur n'a pas l'historique : chaque heros choisi fait
 * venir son fichier statique (`/tendances/<slug>.json`), une fois par visite.
 * Les courbes suivent le rang du comparateur ; a defaut de mesure a ce rang,
 * elles passent au premier rang que tous ont en commun, et le disent.
 */
function CourbesComparees({ heros, rang }: { heros: HerosComparable[]; rang: RangMesure }) {
  const t = useT();
  const langue = useLangue();
  const [charges, setCharges] = useState<Record<string, TendancesVictoire | "erreur">>({});
  const cle = heros.map((h) => h.slug).join(",");

  useEffect(() => {
    for (const slug of cle.split(",")) {
      chargerTendances(slug).then(
        (d) => setCharges((c) => ({ ...c, [slug]: d })),
        () => setCharges((c) => ({ ...c, [slug]: "erreur" })),
      );
    }
  }, [cle]);

  const titre = (
    <h2 className="text-center text-xs uppercase tracking-wide text-craie-500">
      {t("compareUI.courbes", { n: JOURS_COURBE })}
    </h2>
  );
  const message = (texte: string) => (
    <section className="mt-8">
      {titre}
      <p role="status" className="biseau mt-3 grid h-[200px] place-items-center border border-nuit-700/70 bg-nuit-900/60 px-4 text-center text-sm text-craie-500">
        {texte}
      </p>
    </section>
  );

  const donnees = heros.map((h) => charges[h.slug]);
  if (donnees.some((d) => d === undefined)) return message(t("compareUI.chargement"));
  if (donnees.some((d) => d === "erreur")) return message(t("compareUI.erreurCourbes"));
  const series30 = donnees as TendancesVictoire[];

  const parHeros = series30.map((d) => RANGS_MESURE.filter((r) => mesures(d[r]).length > 1));
  const communs = RANGS_MESURE.filter((r) => parHeros.every((l) => l.includes(r)));
  const rangs = communs.length > 0 ? communs : RANGS_MESURE.filter((r) => parHeros.some((l) => l.includes(r)));
  if (rangs.length === 0) return message(t("compareUI.aucuneCourbeHeros"));
  const choisi = rangs.includes(rang) ? rang : rangs[0];

  // Couleur et motif attaches a la place du heros, comme dans le radar : le
  // troisieme garde les siens meme quand un autre n'a pas de mesure.
  const cotes = heros.map((h, i) => ({ heros: h, serie: series30[i][choisi], ...STYLES_SERIES[i] }));
  const { dates, valeurs } = alignerSeries(
    cotes.map((c) => ({ debut: c.serie?.debut ?? "", valeurs: c.serie?.victoire ?? [] })),
  );
  const depuis = Math.max(0, dates.length - JOURS_COURBE);
  const tirets = (m: MotifTrait) => m !== "plein";
  const series: SerieCourbe[] = cotes.flatMap((c, k) =>
    mesures(c.serie).length > 1
      ? [{ nom: c.heros.nom, valeurs: valeurs[k].slice(depuis), couleur: c.couleur, tirets: tirets(c.motif) }]
      : [],
  );
  const sans = cotes.filter((c) => mesures(c.serie).length < 2);

  const nombre = new Intl.NumberFormat(langue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const details = series
    .map((s) => {
      const v = s.valeurs.filter((x): x is number => x !== null);
      return t("compareUI.resumeHeros", { nom: s.nom, debut: nombre.format(v[0]), fin: nombre.format(v.at(-1)!) });
    })
    .join(" ; ");

  return (
    <section className="mt-8">
      {titre}
      {choisi !== rang && (
        <p className="mt-2 text-center text-xs text-craie-500">
          {t("compareUI.courbesAutreRang", { rang: t(`rangsMesure.${choisi}`) })}
        </p>
      )}
      <div className="biseau mt-3 border border-nuit-700/70 bg-nuit-900/60 p-3 sm:p-4">
        <CourbeTaux
          dates={dates.slice(depuis)}
          series={series}
          libelle={t("compareUI.resumeCourbes", {
            n: JOURS_COURBE,
            rang: t(`rangsMesure.${choisi}`).toLocaleLowerCase(langue),
            details,
          })}
        />
      </div>
      {sans.map((c) => (
        <p key={c.heros.slug} className="mt-2 text-xs text-craie-500">
          {t("compareUI.sansCourbe", { nom: c.heros.nom })}
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
function Selecteur({
  label,
  heros,
  valeur,
  onChange,
  motif,
  refChamp,
  retirer,
}: {
  label: string;
  heros: HerosComparable[];
  valeur: string;
  onChange: (v: string) => void;
  /** Couleur et trait du heros dans le radar et les courbes. */
  motif: { couleur: string; motif: MotifTrait };
  refChamp?: React.Ref<HTMLInputElement>;
  /** Present pour un selecteur facultatif : bouton pour le retirer. */
  retirer?: () => void;
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
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={`${id}-champ`} className="flex items-center gap-2 text-xs uppercase tracking-wide text-craie-500">
          <TraitLegende couleur={motif.couleur} motif={motif.motif} />
          {label}
        </label>
        {retirer && (
          <button
            type="button"
            onClick={retirer}
            aria-label={t("compareUI.retirer", { nom: choisi?.nom ?? label })}
            className="-my-1 rounded-sm p-1 text-craie-500 transition-colors hover:text-sang-500"
          >
            <X size={15} aria-hidden />
          </button>
        )}
      </div>
      <div className="biseau-sm flex items-center gap-2 border border-nuit-700 bg-nuit-900 px-2.5 transition-colors focus-within:border-or-500">
        {!ouvert && choisi && (
          <PortraitHeros source={choisi.icone} nom={choisi.nom} taille="micro" decoratif />
        )}
        <input
          ref={refChamp}
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
                <PortraitHeros source={h.icone} nom={h.nom} taille="mini" decoratif />
                {h.nom}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function EnTeteHeros({
  heros,
  rang,
  style,
  compact,
}: {
  heros: HerosComparable;
  rang: RangMesure;
  style: { couleur: string; motif: MotifTrait };
  /** Trois heros de front : portrait au-dessus du nom sur les petits ecrans. */
  compact: boolean;
}) {
  const t = useT();
  const palier = heros.taux[rang]?.[2] ?? null;
  return (
    <div className={cn("biseau min-w-0 border border-nuit-700/70 bg-nuit-900/60", compact ? "p-2.5 sm:p-4" : "p-4")}>
      <div className={cn("flex gap-3", compact ? "flex-col items-center text-center sm:flex-row sm:text-left" : "items-center")}>
        <PortraitHeros source={heros.icone} nom={heros.nom} taille={compact ? "moyenne" : "vignette"} />
        <div className="min-w-0 max-w-full">
          <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", compact && "justify-center sm:justify-start")}>
            <Link
              href={`/heroes/${heros.slug}`}
              className={cn("font-titre font-bold text-craie-100 hover:text-or-400", compact ? "text-base sm:text-lg" : "truncate text-lg")}
            >
              {heros.nom}
            </Link>
            {palier && (
              <span className={cn("biseau-sm shrink-0 border px-1.5 py-0.5 text-[0.7rem] font-bold", COULEUR_PALIER[palier])}>
                {palier}
              </span>
            )}
          </div>
          <p className={cn("mt-0.5 text-xs text-craie-500", compact ? "line-clamp-2 sm:truncate" : "truncate")}>
            {heros.roles.map((r) => t(`roles.${r}`)).join(" · ")}
            {heros.lanes.length > 0 && ` — ${heros.lanes.map((l) => t(`lanes.${l}`)).join(" · ")}`}
          </p>
          <TraitLegende couleur={style.couleur} motif={style.motif} className={cn("mt-1.5", compact && "mx-auto sm:mx-0")} />
        </div>
      </div>
    </div>
  );
}

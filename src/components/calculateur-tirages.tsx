"use client";

import { useEffect, useId, useRef, useState } from "react";
import { classesPuce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  BORNES,
  PREREGLAGES,
  analyser,
  courbe,
  dixAvantageux,
  lireEntier,
  lirePourcent,
  type ChampTirage,
  type Prereglage,
  type Tirage,
} from "@/lib/tirages";
import { cn } from "@/lib/utils";

/**
 * Calculateur de tirages : chances d'obtenir le lot pour un budget ou un
 * nombre de tirages, moyenne, paliers et courbe. Tout se calcule dans le
 * navigateur, a chaque frappe.
 */

type Mode = "budget" | "tirages";

interface Saisies {
  cout: string;
  coutDix: string;
  probabilite: string;
  garantie: string;
  budget: string;
  tirages: string;
}

function Champ({
  libelle,
  valeur,
  onChange,
  suffixe,
  decimal = false,
  erreur,
}: {
  libelle: string;
  valeur: string;
  onChange: (valeur: string) => void;
  suffixe?: string;
  decimal?: boolean;
  /** Message affiche sous le champ quand la saisie est refusee. */
  erreur?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-craie-500">
        {libelle}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? `${id}-erreur` : undefined}
          className={cn(
            "biseau-sm min-h-11 w-full border border-nuit-700 bg-nuit-900 py-2.5 pl-3 text-lg tabular-nums text-craie-100 outline-none transition-colors focus:border-or-500 aria-invalid:border-sang-500/70",
            suffixe ? "pr-9" : "pr-3",
          )}
        />
        {suffixe && (
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-craie-500">
            {suffixe}
          </span>
        )}
      </div>
      {erreur && (
        <p id={`${id}-erreur`} className="mt-1 text-xs text-sang-500">
          {erreur}
        </p>
      )}
    </div>
  );
}

/** Champ facultatif : vide vaut « absent », une saisie illisible vaut NaN pour etre signalee. */
const facultatif = (s: string) => (s.trim() === "" ? null : (lireEntier(s) ?? Number.NaN));

export function CalculateurTirages() {
  const t = useT();
  const langue = useLangue();
  const locale = LOCALE_HTML[langue];
  const entier = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const uneDecimale = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const pourcentage = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const fin = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });

  // Depart sur un evenement reel, pour que la page montre d'emblee un calcul parlant.
  const depart = PREREGLAGES[1];
  const [saisies, setSaisies] = useState<Saisies>(() => ({
    ...versSaisies(depart.tirage),
    budget: entier.format(1000),
    tirages: "100",
  }));
  const [mode, setMode] = useState<Mode>("budget");
  const maj = (champ: keyof Saisies) => (v: string) => setSaisies((s) => ({ ...s, [champ]: v }));

  function versSaisies(tir: Tirage) {
    return {
      cout: String(tir.cout),
      coutDix: tir.coutDix === null ? "" : String(tir.coutDix),
      probabilite: decimal.format(tir.probabilite),
      garantie: tir.garantie === null ? "" : String(tir.garantie),
    };
  }

  const tirage: Tirage = {
    cout: lireEntier(saisies.cout) ?? Number.NaN,
    coutDix: facultatif(saisies.coutDix),
    probabilite: lirePourcent(saisies.probabilite) ?? Number.NaN,
    garantie: facultatif(saisies.garantie),
  };
  const resultat = analyser(
    tirage,
    mode === "budget"
      ? { type: "budget", diamants: lireEntier(saisies.budget) ?? Number.NaN }
      : { type: "tirages", nombre: lireEntier(saisies.tirages) ?? Number.NaN },
  );
  const erreurs = new Set<ChampTirage>(resultat.etat === "invalide" ? resultat.erreurs : []);
  const messageErreur = (champ: ChampTirage) =>
    erreurs.has(champ)
      ? t(`pages.tiragesUI.erreur.${champ}`, {
          max: entier.format(
            { cout: BORNES.cout, coutDix: BORNES.coutDix, garantie: BORNES.garantie, budget: BORNES.budget, tirages: BORNES.tirages, probabilite: 100 }[champ],
          ),
          min: decimal.format(BORNES.probaMin),
        })
      : undefined;

  /** Chances en pourcent, sans jamais afficher 0 % ou 100 % pour une valeur qui n'y est pas. */
  const chance = (p: number) => {
    if (p >= 1) return pourcentage.format(1);
    if (p <= 0) return pourcentage.format(0);
    if (p < 0.0001) return `< ${fin.format(0.0001)}`;
    if (p > 0.9999) return `> ${fin.format(0.9999)}`;
    return p < 0.01 || p > 0.99 ? fin.format(p) : pourcentage.format(p);
  };

  const actif = PREREGLAGES.find((p) => {
    const s = versSaisies(p.tirage);
    return s.cout === saisies.cout && s.coutDix === saisies.coutDix && s.probabilite === saisies.probabilite && s.garantie === saisies.garantie;
  });
  const dateWiki = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <Carte>
        <fieldset>
          <legend className="text-xs uppercase tracking-wide text-craie-500">{t("pages.tiragesUI.prereglages")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PREREGLAGES.map((p) => (
              <button
                key={p.cle}
                type="button"
                aria-pressed={actif?.cle === p.cle}
                onClick={() => setSaisies((s) => ({ ...s, ...versSaisies(p.tirage) }))}
                className={cn(classesPuce(actif?.cle === p.cle), "min-h-11 text-left")}
              >
                {p.nom} · {t(`pages.tiragesUI.lot.${p.cle}`)}
              </button>
            ))}
          </div>
        </fieldset>
        {actif && <NotePrereglage p={actif} date={dateWiki.format(new Date(`${actif.releve}T00:00:00Z`))} />}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Champ libelle={t("pages.tiragesUI.cout")} valeur={saisies.cout} onChange={maj("cout")} erreur={messageErreur("cout")} />
          <Champ libelle={t("pages.tiragesUI.coutDix")} valeur={saisies.coutDix} onChange={maj("coutDix")} erreur={messageErreur("coutDix")} />
          <Champ
            libelle={t("pages.tiragesUI.probabilite")}
            valeur={saisies.probabilite}
            onChange={maj("probabilite")}
            suffixe="%"
            decimal
            erreur={messageErreur("probabilite")}
          />
          <Champ libelle={t("pages.tiragesUI.garantie")} valeur={saisies.garantie} onChange={maj("garantie")} erreur={messageErreur("garantie")} />
        </div>
        {resultat.etat === "ok" && tirage.coutDix !== null && !dixAvantageux(tirage) && (
          <p className="mt-3 text-xs text-craie-500">{t("pages.tiragesUI.dixIgnore")}</p>
        )}

        <fieldset className="mt-6 border-t border-nuit-800 pt-5">
          <legend className="sr-only">{t("pages.tiragesUI.modeLegende")}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden className="mr-1 text-xs uppercase tracking-wide text-craie-500">
              {t("pages.tiragesUI.modeLegende")}
            </span>
            {(["budget", "tirages"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(classesPuce(mode === m), "min-h-11")}
              >
                {t(m === "budget" ? "pages.tiragesUI.modeBudget" : "pages.tiragesUI.modeTirages")}
              </button>
            ))}
          </div>
          <div className="mt-4 max-w-xs">
            {mode === "budget" ? (
              <Champ libelle={t("pages.tiragesUI.budget")} valeur={saisies.budget} onChange={maj("budget")} erreur={messageErreur("budget")} />
            ) : (
              <Champ libelle={t("pages.tiragesUI.tirages")} valeur={saisies.tirages} onChange={maj("tirages")} erreur={messageErreur("tirages")} />
            )}
          </div>
        </fieldset>
      </Carte>

      <div aria-live="polite">
        {resultat.etat === "invalide" ? (
          <Carte>
            <p className="text-sm leading-relaxed text-craie-300">{t("pages.tiragesUI.invalide")}</p>
          </Carte>
        ) : (
          <Carte className="border-or-500/30">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-titre text-5xl font-bold tabular-nums text-or-400">{chance(resultat.probabilite)}</span>
              <span className="text-lg text-craie-100">{t("pages.tiragesUI.chances")}</span>
            </p>
            <p className="mt-3 leading-relaxed text-craie-300">
              {resultat.tirages === 0
                ? t("pages.tiragesUI.resumeAucun", { cout: entier.format(tirage.cout) })
                : t(mode === "budget" ? "pages.tiragesUI.resumeBudget" : "pages.tiragesUI.resumeTirages", {
                    diamants: entier.format(resultat.diamants),
                    tirages: entier.format(resultat.tirages),
                    chance: chance(resultat.probabilite),
                  })}{" "}
              {t("pages.tiragesUI.resumeMoyenne", {
                tirages: uneDecimale.format(resultat.tiragesEsperes),
                diamants: entier.format(Math.round(resultat.diamantsEsperesParDix ?? resultat.diamantsEsperesUnParUn)),
              })}{" "}
              {tirage.garantie !== null &&
                t("pages.tiragesUI.resumeGarantie", {
                  n: entier.format(tirage.garantie),
                  diamants: entier.format(resultat.paliers[2].tirages === tirage.garantie ? resultat.paliers[2].diamants : 0) === "0"
                    ? entier.format(0)
                    : entier.format(resultat.paliers[2].diamants),
                })}
            </p>
          </Carte>
        )}
      </div>

      {resultat.etat === "ok" && (
        <>
          <Carte>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Stat libelle={t("pages.tiragesUI.statTirages")} valeur={entier.format(resultat.tirages)} />
              <Stat libelle={t("pages.tiragesUI.statDiamants")} valeur={entier.format(resultat.diamants)} />
              <Stat libelle={t("pages.tiragesUI.statMoyenneTirages")} valeur={uneDecimale.format(resultat.tiragesEsperes)} />
              <Stat
                libelle={t("pages.tiragesUI.statMoyenneUnParUn")}
                valeur={entier.format(Math.round(resultat.diamantsEsperesUnParUn))}
              />
              {resultat.diamantsEsperesParDix !== null && (
                <Stat
                  libelle={t("pages.tiragesUI.statMoyenneParDix")}
                  valeur={entier.format(Math.round(resultat.diamantsEsperesParDix))}
                />
              )}
            </dl>

            <h2 className="mt-6 font-titre text-lg font-bold text-craie-100">{t("pages.tiragesUI.paliersTitre")}</h2>
            <div className="relative mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-nuit-700 text-xs uppercase tracking-wide text-craie-500">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">{t("pages.tiragesUI.colChances")}</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">{t("pages.tiragesUI.colTirages")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t("pages.tiragesUI.colDiamants")}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.paliers.map((p) => (
                    <tr key={p.cible} className="border-b border-nuit-800">
                      <th scope="row" className="py-2.5 pr-4 font-medium text-craie-100">{pourcentage.format(p.cible)}</th>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-craie-200">{entier.format(p.tirages)}</td>
                      <td className="py-2.5 text-right tabular-nums text-craie-200">{entier.format(p.diamants)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          <Carte>
            <h2 className="font-titre text-lg font-bold text-craie-100">{t("pages.tiragesUI.courbeTitre")}</h2>
            <CourbeTirages
              tirage={tirage}
              tirages={resultat.tirages}
              probabilite={resultat.probabilite}
              paliers={resultat.paliers.map((p) => p.tirages)}
              libelle={t("pages.tiragesUI.courbeLibelle", {
                p50: entier.format(resultat.paliers[0].tirages),
                p90: entier.format(resultat.paliers[1].tirages),
                p99: entier.format(resultat.paliers[2].tirages),
              })}
              format={{ entier, pourcentage, chance }}
              textes={{ axe: t("pages.tiragesUI.axeTirages"), vous: t("pages.tiragesUI.vous"), garantie: t("pages.tiragesUI.garantieCourbe") }}
            />
          </Carte>
        </>
      )}

      <p className="text-sm leading-relaxed text-craie-500">{t("pages.tiragesUI.ouTrouver")}</p>
    </div>
  );
}

function NotePrereglage({ p, date }: { p: Prereglage; date: string }) {
  const t = useT();
  return (
    <p className="mt-3 text-xs leading-relaxed text-craie-500">
      {t("pages.tiragesUI.prereglageNote", { date, lot: t(`pages.tiragesUI.lot.${p.cle}`) })}{" "}
      <a href={p.source} rel="noopener" className="underline transition-colors hover:text-or-400">
        {t("pages.tiragesUI.lienWiki")}
      </a>
    </p>
  );
}

function Stat({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-nuit-800 pb-2">
      <dt className="text-sm text-craie-400">{libelle}</dt>
      <dd className="font-titre text-lg font-bold tabular-nums text-craie-100">{valeur}</dd>
    </div>
  );
}

// Hauteur et marges du dessin, en pixels : la largeur suit celle du cadre.
const H = 220;
const GAUCHE = 44;
const DROITE = 14;
const HAUT = 14;
const BAS = 28;
const GRADUATIONS = [0, 0.5, 0.9, 1];

/**
 * Courbe des chances cumulees selon le nombre de tirages, en SVG. L'axe va
 * un peu au-dela du palier de 99 %, et du point de l'utilisateur tant qu'il
 * reste lisible ; la marche de la garantie est tracee telle quelle.
 */
function CourbeTirages({
  tirage,
  tirages,
  probabilite,
  paliers,
  libelle,
  format,
  textes,
}: {
  tirage: Tirage;
  tirages: number;
  probabilite: number;
  paliers: number[];
  libelle: string;
  format: { entier: Intl.NumberFormat; pourcentage: Intl.NumberFormat; chance: (p: number) => string };
  textes: { axe: string; vous: string; garantie: string };
}) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const cadre = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(600);

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const observateur = new ResizeObserver(([e]) => setL(Math.max(260, Math.round(e.contentRect.width))));
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  const p99 = paliers[paliers.length - 1];
  // Au-dela de trois fois le palier de 99 %, la courbe ne serait plus qu'un plateau : le point sort du cadre.
  const max = Math.max(10, Math.ceil(Math.max(p99 * 1.15, Math.min(tirages, p99 * 3))));
  const points = courbe(tirage, max, 160);
  const x = (n: number) => GAUCHE + (Math.min(n, max) / max) * (L - GAUCHE - DROITE);
  const y = (p: number) => HAUT + (1 - p) * (H - HAUT - BAS);
  const trace = points.map((pt, i) => `${i ? "L" : "M"}${x(pt.n).toFixed(1)},${y(pt.p).toFixed(1)}`).join("");
  const aire = `${trace}L${x(max)},${y(0)}L${x(0)},${y(0)}Z`;
  const horsCadre = tirages > max;
  const aDroite = x(tirages) > L / 2;

  return (
    <div ref={cadre} className="mt-3">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={libelle} className="block h-[220px] w-full select-none text-or-400">
        <defs>
          <linearGradient id={`${id}-aire`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {GRADUATIONS.map((g) => (
          <g key={g}>
            <line x1={GAUCHE} x2={L - DROITE} y1={y(g)} y2={y(g)} className="stroke-nuit-700" strokeDasharray="3 4" />
            <text x={GAUCHE - 6} y={y(g) + 4} textAnchor="end" className="fill-craie-500 text-[11px] tabular-nums">
              {format.pourcentage.format(g)}
            </text>
          </g>
        ))}
        {[0, Math.round(max / 2), max].map((n, i) => (
          <text
            key={i}
            x={x(n)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            className="fill-craie-500 text-[11px] tabular-nums"
          >
            {i === 2 ? `${format.entier.format(n)} ${textes.axe}` : format.entier.format(n)}
          </text>
        ))}

        {tirage.garantie !== null && tirage.garantie <= max && (
          <g>
            <line x1={x(tirage.garantie)} x2={x(tirage.garantie)} y1={HAUT} y2={y(0)} className="stroke-azur-400/70" strokeDasharray="2 3" />
            <text
              x={x(tirage.garantie) + (x(tirage.garantie) > L / 2 ? -4 : 4)}
              y={y(0) - 6}
              textAnchor={x(tirage.garantie) > L / 2 ? "end" : "start"}
              className="fill-azur-400 text-[10px]"
            >
              {textes.garantie}
            </text>
          </g>
        )}

        <path d={aire} fill={`url(#${id}-aire)`} />
        <path d={trace} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />

        {tirages > 0 && (
          <g>
            <line x1={x(tirages)} x2={x(tirages)} y1={y(probabilite)} y2={y(0)} className="stroke-craie-500/60" strokeDasharray="3 3" />
            <circle cx={x(tirages)} cy={y(probabilite)} r={5} fill="currentColor" className="stroke-nuit-950" strokeWidth={2} />
            <text
              x={x(tirages) + (aDroite ? -9 : 9)}
              y={Math.min(Math.max(y(probabilite) + 16, HAUT + 12), y(0) - 20)}
              textAnchor={aDroite ? "end" : "start"}
              paintOrder="stroke"
              strokeWidth={4}
              strokeLinejoin="round"
              className="fill-craie-100 stroke-nuit-900 text-[12px] font-semibold tabular-nums"
            >
              {`${textes.vous}${horsCadre ? " →" : ""} · ${format.chance(probabilite)}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

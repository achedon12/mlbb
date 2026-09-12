"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, Clock, Sparkles, Trophy } from "lucide-react";
import { Carte } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  FUSEAU_SERVEUR,
  PAYS_PAR_LANGUE,
  decalageFuseau,
  decomposer,
  libelleDecalage,
  prochaineFinSaison,
  prochaineRemiseHebdo,
  prochaineRemiseQuotidienne,
  prochainStarlight,
  type FinSaison,
} from "@/lib/heure-serveur";
import { cn } from "@/lib/utils";

/**
 * Horloge du serveur, comptes a rebours des remises et heure locale de la
 * remise dans les principaux pays de chaque langue du site.
 *
 * Le premier rendu part de l'instant `reference`, fixe par le serveur : HTML et
 * hydratation disent la meme chose, et les moteurs lisent un tableau complet.
 * L'horloge du navigateur prend ensuite le relais, calee sur chaque seconde.
 */
const ORDRE_LANGUES: Langue[] = ["fr", "en", "it", "es"];

// Une seule minuterie pour toute la page, partagee par les abonnes.
let instant = 0;
let minuterie: ReturnType<typeof setTimeout> | undefined;
const abonnes = new Set<() => void>();

function battre() {
  instant = Date.now();
  abonnes.forEach((rappel) => rappel());
  minuterie = setTimeout(battre, 1000 - (instant % 1000) + 10);
}

function abonnerHorloge(rappel: () => void) {
  abonnes.add(rappel);
  if (abonnes.size === 1) battre();
  return () => {
    abonnes.delete(rappel);
    if (abonnes.size === 0) clearTimeout(minuterie);
  };
}

const lireInstant = () => instant || (instant = Date.now());
const abonnerRien = () => () => {};
const lireFuseau = () => Intl.DateTimeFormat().resolvedOptions().timeZone || null;

/** Formateurs Intl, crees une fois par langue, forme et fuseau. */
function useFormats(langue: Langue) {
  return useMemo(() => {
    const locale = LOCALE_HTML[langue];
    const cache = new Map<string, Intl.DateTimeFormat>();
    const format = (forme: string, options: Intl.DateTimeFormatOptions) => (ms: number, fuseau: string) => {
      const cle = `${forme}|${fuseau}`;
      let f = cache.get(cle);
      if (!f) {
        f = new Intl.DateTimeFormat(locale, { ...options, timeZone: fuseau });
        cache.set(cle, f);
      }
      return f.format(ms);
    };
    const jours = new Intl.NumberFormat(locale, { style: "unit", unit: "day", unitDisplay: "narrow" });
    const pays = new Intl.DisplayNames(locale, { type: "region" });
    return {
      heure: format("h", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }),
      heureCourte: format("hc", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      date: format("d", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      jourHeure: format("jh", { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      dateHeure: format("dh", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      jours: (n: number) => jours.format(n),
      pays: (code: string) => pays.of(code) ?? code,
    };
  }, [langue]);
}

function Rebours({ ms, jours }: { ms: number; jours: (n: number) => string }) {
  const d = decomposer(ms);
  const deux = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {d.jours > 0 && `${jours(d.jours)} `}
      {deux(d.heures)}:{deux(d.minutes)}:{deux(d.secondes)}
    </span>
  );
}

export function HorlogeServeur({ reference, fins }: { reference: number; fins: FinSaison[] }) {
  const t = useT();
  const langue = useLangue();
  const f = useFormats(langue);
  const maintenant = useSyncExternalStore(abonnerHorloge, lireInstant, () => reference);
  // Fuseau du lecteur : inconnu du serveur, lu une fois la page hydratee.
  const fuseau = useSyncExternalStore(abonnerRien, lireFuseau, () => null);
  const ici = fuseau ?? "UTC";

  const quotidienne = prochaineRemiseQuotidienne(maintenant);
  const hebdo = prochaineRemiseHebdo(maintenant);
  const echeances: { cle: string; icone: LucideIcon; cible: number }[] = [
    { cle: "daily", icone: Clock, cible: quotidienne },
    { cle: "weekly", icone: CalendarClock, cible: hebdo },
    { cle: "starlight", icone: Sparkles, cible: prochainStarlight(maintenant) },
  ];
  const finSaison = prochaineFinSaison(fins, maintenant);
  const zone = fuseau ? t("tools.serverTime.localTime") : "UTC";
  const langues = [langue, ...ORDRE_LANGUES.filter((l) => l !== langue)];

  return (
    <div className="space-y-12">
      <Carte className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-chalk-500">
          {t("tools.serverTime.serverTime")}
        </p>
        <p role="timer" className="mt-2 font-heading text-6xl font-bold tabular-nums text-gold-400 sm:text-7xl" suppressHydrationWarning>
          {f.heure(maintenant, FUSEAU_SERVEUR)}
        </p>
        <p className="mt-1 text-chalk-300" suppressHydrationWarning>
          {f.date(maintenant, FUSEAU_SERVEUR)} · UTC−8
        </p>
        <p className="mt-3 text-sm text-chalk-500" suppressHydrationWarning>
          {fuseau
            ? t("tools.serverTime.yourTime", { heure: f.heure(maintenant, fuseau), fuseau })
            : t("tools.serverTime.utcTime", { heure: f.heure(maintenant, "UTC") })}
        </p>
      </Carte>

      <section aria-labelledby="rebours-titre">
        <h2 id="rebours-titre" className="font-heading text-2xl font-bold text-chalk-100">
          {t("tools.serverTime.countdownTitle")}
        </h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {echeances.map(({ cle, icone: Icone, cible }) => (
            <li key={cle}>
              <Carte className="h-full">
                <p className="flex items-center gap-2 text-sm font-semibold text-chalk-200">
                  <Icone size={16} aria-hidden className="text-gold-400" />
                  {t(`tools.serverTime.deadline.${cle}`)}
                </p>
                <p role="timer" className="mt-2 font-heading text-4xl font-bold text-chalk-100">
                  <Rebours ms={cible - maintenant} jours={f.jours} />
                </p>
                <p className="mt-1 text-sm text-chalk-500" suppressHydrationWarning>
                  {t("tools.serverTime.on", { date: f.dateHeure(cible, ici), zone })}
                </p>
              </Carte>
            </li>
          ))}
          <li>
            <Carte className="h-full">
              <p className="flex items-center gap-2 text-sm font-semibold text-chalk-200">
                <Trophy size={16} aria-hidden className="text-gold-400" />
                {t("tools.serverTime.deadline.season")}
              </p>
              {finSaison ? (
                <>
                  <p role="timer" className="mt-2 font-heading text-4xl font-bold text-chalk-100">
                    <Rebours ms={finSaison.fin - maintenant} jours={f.jours} />
                  </p>
                  <p className="mt-1 text-sm text-chalk-500" suppressHydrationWarning>
                    {t("tools.serverTime.seasonEnd", {
                      n: finSaison.saison,
                      date: f.dateHeure(finSaison.fin, ici),
                      zone,
                      v: finSaison.patch,
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 font-heading text-2xl font-bold text-chalk-300">
                    {t("tools.serverTime.seasonEndUnknown")}
                  </p>
                  <p className="mt-1 text-sm text-chalk-500">{t("tools.serverTime.seasonEndUnknownDetail")}</p>
                </>
              )}
            </Carte>
          </li>
        </ul>

        {fuseau && (
          <p className="bevel-sm mt-4 border border-gold-500/40 bg-gold-500/10 p-4 text-sm text-chalk-200">
            {t("tools.serverTime.yourPlace", {
              fuseau,
              decalage: libelleDecalage(decalageFuseau(fuseau, maintenant)),
              quotidienne: f.heureCourte(quotidienne, fuseau),
              hebdo: f.jourHeure(hebdo, fuseau),
            })}
          </p>
        )}
      </section>

      <section aria-labelledby="pays-titre">
        <h2 id="pays-titre" className="font-heading text-2xl font-bold text-chalk-100">
          {t("tools.serverTime.countriesTitle")}
        </h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <p className="mt-3 max-w-2xl text-sm text-chalk-400">{t("tools.serverTime.countriesIntro")}</p>

        <div className="mt-6 space-y-8">
          {langues.map((l) => (
            <div key={l}>
              <h3 className="font-heading text-lg font-bold text-gold-400">{t(`tools.serverTime.group.${l}`)}</h3>
              <div className="mt-2 relative overflow-x-auto">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <caption className="sr-only">
                    {t("tools.serverTime.legend", { groupe: t(`tools.serverTime.group.${l}`) })}
                  </caption>
                  <thead className="text-xs uppercase tracking-wide text-chalk-500">
                    <tr>
                      <th scope="col" className="py-2 pr-3 font-medium">{t("tools.serverTime.colCountry")}</th>
                      <th scope="col" className="py-2 pr-3 font-medium">{t("tools.serverTime.colDaily")}</th>
                      <th scope="col" className="py-2 pr-3 font-medium">{t("tools.serverTime.colWeekly")}</th>
                      <th scope="col" className="py-2 font-medium">{t("tools.serverTime.colNow")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAYS_PAR_LANGUE[l].map((p) => {
                      const vous = p.fuseau === fuseau;
                      return (
                        <tr key={`${p.pays}-${p.fuseau}`} className={cn("border-t border-night-800", vous && "bg-gold-500/10")}>
                          <th scope="row" className="py-2 pr-3 font-medium text-chalk-100">
                            <span suppressHydrationWarning>
                              {f.pays(p.pays)}
                              {p.ville && ` (${p.ville})`}
                            </span>
                            <span className="block text-xs font-normal text-chalk-500" suppressHydrationWarning>
                              {libelleDecalage(decalageFuseau(p.fuseau, maintenant))}
                              {vous && ` · ${t("tools.serverTime.you")}`}
                            </span>
                          </th>
                          <td className="py-2 pr-3 tabular-nums text-chalk-200" suppressHydrationWarning>
                            {f.heureCourte(quotidienne, p.fuseau)}
                          </td>
                          <td className="py-2 pr-3 text-chalk-200" suppressHydrationWarning>
                            {f.jourHeure(hebdo, p.fuseau)}
                          </td>
                          <td className="py-2 tabular-nums text-chalk-400" suppressHydrationWarning>
                            {f.heureCourte(maintenant, p.fuseau)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

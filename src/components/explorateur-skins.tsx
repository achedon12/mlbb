"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CarteSkin, proprietesCarteSkin } from "@/components/carte-skin";
import { ChampRecherche } from "@/components/champ-recherche";
import { GroupeFiltres, Puce, classesPuce } from "@/components/puce";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  RANGS_RARETE,
  ROLES_INDEX,
  chargerCatalogue,
  estOrigine,
  estSorti,
  filtrerSkins,
  grouperParDate,
  libelleRarete,
  libelleSerie,
  rareteDeRang,
  tronquerGroupes,
  type Catalogue,
} from "@/lib/catalogue-skins";
import type { Role } from "@/lib/types";

/** Skins affiches par pas : un millier de vignettes d'un coup ne servirait personne. */
const PAS = 48;

interface Filtres {
  recherche: string;
  heros: string | null;
  role: Role | null;
  serie: string | null;
  rarete: number | null;
  annee: number | null;
}
const VIDES: Filtres = { recherche: "", heros: null, role: null, serie: null, rarete: null, annee: null };

const CLASSE_CHOIX =
  "bevel-sm w-full border border-night-700 bg-night-900 px-3 py-2 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500";

/**
 * Explorateur du calendrier : recherche et filtres (heros, role, serie,
 * rarete, annee) sur tous les skins sortis.
 *
 * Sans filtre, il laisse voir la vue d'ensemble rendue par le serveur
 * (`children`). L'index des skins n'est demande qu'au premier geste dans les
 * filtres, ou d'emblee quand l'adresse en porte (`?serie=Collector`) : les
 * filtres passent par l'URL, ce qui rend une vue partageable.
 */
export function ExplorateurSkins({
  heros,
  series,
  annees,
  reference,
  children,
}: {
  heros: [slug: string, nom: string][];
  series: string[];
  annees: number[];
  /** Date des donnees : au-dela, un skin n'est pas encore sorti. */
  reference: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const langue = useLangue();
  const [f, setF] = useState<Filtres>(VIDES);
  const [limite, setLimite] = useState(PAS);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [erreur, setErreur] = useState(false);
  const actif = !!(f.recherche.trim() || f.heros || f.role || f.serie || f.rarete !== null || f.annee !== null);
  const nombre = useMemo(() => new Intl.NumberFormat(LOCALE_HTML[langue]), [langue]);

  const maj = (partiel: Partial<Filtres>) => {
    setF((avant) => ({ ...avant, ...partiel }));
    setLimite(PAS);
  };

  // Meme principe que le catalogue des heros : l'URL n'est lue qu'apres le
  // montage (serveur et hydratation partent de vide), puis chaque changement
  // s'y reporte.
  const monte = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!monte.current) {
      monte.current = true;
      const nombreDe = (cle: string, valides: readonly number[]) => {
        const n = Number(params.get(cle));
        return params.get(cle) && valides.includes(n) ? n : null;
      };
      const lus: Filtres = {
        recherche: params.get("q") ?? "",
        heros: heros.some(([s]) => s === params.get("heros")) ? params.get("heros") : null,
        role: ROLES_INDEX.find((r) => r === params.get("role")) ?? null,
        serie: series.find((s) => s === params.get("serie")) ?? null,
        rarete: nombreDe("rarete", RANGS_RARETE),
        annee: nombreDe("annee", annees),
      };
      if (Object.values(lus).some((v) => v !== null && v !== "")) {
        setF(lus); // eslint-disable-line react-hooks/set-state-in-effect -- lecture de l'URL apres montage
        return;
      }
    }
    const valeurs: [string, string | null][] = [
      ["q", f.recherche.trim() || null],
      ["heros", f.heros],
      ["role", f.role],
      ["serie", f.serie],
      ["rarete", f.rarete === null ? null : String(f.rarete)],
      ["annee", f.annee === null ? null : String(f.annee)],
    ];
    for (const [cle, valeur] of valeurs) {
      if (valeur) params.set(cle, valeur);
      else params.delete(cle);
    }
    const suffixe = params.toString();
    window.history.replaceState(null, "", `${suffixe ? `?${suffixe}` : window.location.pathname}${window.location.hash}`);
  }, [f, heros, series, annees]);

  useEffect(() => {
    if (!actif || catalogue) return;
    let annule = false;
    chargerCatalogue(langue).then(
      (c) => !annule && setCatalogue(c),
      () => !annule && setErreur(true),
    );
    return () => {
      annule = true;
    };
  }, [actif, catalogue, langue]);

  const resultats = useMemo(() => {
    if (!catalogue || !actif) return null;
    const parSlug = new Map(catalogue.heros.map((h) => [h.slug, h]));
    const sortis = catalogue.skins.filter((s) => !estOrigine(s) && estSorti(s, reference));
    const liste = filtrerSkins(sortis, parSlug, f);
    return { parSlug, total: liste.length, groupes: grouperParDate(liste, "recent") };
  }, [catalogue, actif, f, reference]);

  const formatMois = new Intl.DateTimeFormat(LOCALE_HTML[langue], { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      {/* Le premier geste dans les filtres suffit a demander l'index. */}
      <div
        className="space-y-4"
        onFocusCapture={() => void chargerCatalogue(langue).catch(() => undefined)}
        onPointerEnter={() => void chargerCatalogue(langue).catch(() => undefined)}
      >
        <ChampRecherche
          valeur={f.recherche}
          onChange={(recherche) => maj({ recherche })}
          libelle={t("pages.calendrierSkinsUI.rechercher")}
          className="max-w-md"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Choix
            libelle={t("pages.calendrierSkinsUI.heros")}
            valeur={f.heros ?? ""}
            onChange={(v) => maj({ heros: v || null })}
            tous={t("pages.calendrierSkinsUI.tous")}
            options={heros.map(([slug, nom]) => [slug, nom])}
          />
          <Choix
            libelle={t("pages.calendrierSkinsUI.serie")}
            valeur={f.serie ?? ""}
            onChange={(v) => maj({ serie: v || null })}
            tous={t("pages.calendrierSkinsUI.toutes")}
            options={series.map((s) => [s, libelleSerie(t, s)])}
          />
          <Choix
            libelle={t("pages.calendrierSkinsUI.annee")}
            valeur={f.annee === null ? "" : String(f.annee)}
            onChange={(v) => maj({ annee: v ? Number(v) : null })}
            tous={t("pages.calendrierSkinsUI.toutes")}
            options={annees.map((a) => [String(a), String(a)])}
          />
        </div>
        <GroupeFiltres legende={t("pages.calendrierSkinsUI.role")}>
          {ROLES_INDEX.map((r) => (
            <Puce key={r} dense actif={f.role === r} onClick={() => maj({ role: f.role === r ? null : r })}>
              {t(`roles.${r}`)}
            </Puce>
          ))}
        </GroupeFiltres>
        <GroupeFiltres legende={t("pages.calendrierSkinsUI.rarete")}>
          {RANGS_RARETE.map((rang) => (
            <Puce key={rang} dense actif={f.rarete === rang} onClick={() => maj({ rarete: f.rarete === rang ? null : rang })}>
              <span aria-hidden className="mr-1.5 inline-block size-2 border-2" style={{ borderColor: rareteDeRang(rang).couleur }} />
              {libelleRarete(t, rang)}
            </Puce>
          ))}
        </GroupeFiltres>
        {actif && (
          <button type="button" onClick={() => maj(VIDES)} className={classesPuce(false, true)}>
            {t("pages.calendrierSkinsUI.effacer")}
          </button>
        )}
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {actif &&
          (erreur
            ? t("pages.calendrierSkinsUI.erreur")
            : !resultats
              ? t("pages.calendrierSkinsUI.chargement")
              : t(resultats.total === 1 ? "pages.calendrierSkinsUI.resultat" : "pages.calendrierSkinsUI.resultats", {
                  n: nombre.format(resultats.total),
                }))}
      </p>

      <div className="mt-6">
        {!actif
          ? children
          : resultats && (
              <div className="space-y-10">
                {tronquerGroupes(resultats.groupes, limite).map((a) => (
                  <section key={a.annee}>
                    <h3 className="font-heading text-2xl font-bold text-chalk-100">
                      {a.annee}{" "}
                      <span className="text-sm font-normal text-chalk-500">
                        {t(a.total === 1 ? "pages.calendrierSkinsUI.nSkins1" : "pages.calendrierSkinsUI.nSkins", {
                          n: nombre.format(a.total),
                        })}
                      </span>
                    </h3>
                    {a.mois.map((m) => (
                      <div key={m.mois ?? "inconnu"} className="mt-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gold-400">
                          {m.mois ? formatMois.format(Date.UTC(a.annee, m.mois - 1, 1)) : t("pages.calendrierSkinsUI.moisInconnu")}
                        </h4>
                        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                          {m.skins.map((s) => (
                            <li key={s.id}>
                              <CarteSkin
                                {...proprietesCarteSkin(
                                  s,
                                  resultats.parSlug.get(s.heros)?.nom ?? s.heros,
                                  t,
                                  LOCALE_HTML[langue],
                                  nombre,
                                )}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                ))}
                {resultats.total > limite && (
                  <button type="button" onClick={() => setLimite((l) => l + PAS)} className={classesPuce(false)}>
                    {t("pages.calendrierSkinsUI.plus", { n: nombre.format(Math.min(PAS, resultats.total - limite)) })}
                  </button>
                )}
              </div>
            )}
      </div>
    </div>
  );
}

function Choix({
  libelle,
  valeur,
  onChange,
  tous,
  options,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  tous: string;
  options: [valeur: string, libelle: string][];
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-chalk-500">{libelle}</span>
      <select value={valeur} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${CLASSE_CHOIX}`}>
        <option value="">{tous}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

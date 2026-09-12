"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Link2, Plus, RotateCcw, X } from "lucide-react";
import { BarresDuree } from "@/components/barres-duree";
import { CarteSuggestion, SelecteurHeros, VignetteHeros } from "@/components/choix-heros";
import Link from "@/components/lien";
import { ChoixRang } from "@/components/selecteur-rang";
import { Carte, Jauge } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import type { T } from "@/i18n/t";
import {
  analyserEquipe,
  ecrireParametres,
  lireParametres,
  MIN_ALERTES,
  NOTES,
  TAILLE_EQUIPE,
  type Alerte,
  type Analyse,
  type HerosEquipe,
  type MesuresRang,
  type Tranche,
  type TypeDegats,
} from "@/lib/composition";
import { LANES, ROLES } from "@/lib/draft";
import type { RangMesure } from "@/lib/rangs-mesure";
import { formaterEcart } from "@/lib/tendances";
import type { Lane, Palier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Analyse d'une composition d'equipe.
 *
 * Jusqu'a cinq heros, sans position imposee ; tout le calcul vient de
 * `lib/composition`. Le catalogue arrive avec la page, les mesures du rang
 * choisi a part (`/composition/<rang>.json`), une fois par visite. Equipe et
 * rang passent par l'URL (`?h=…&rang=…`), lue apres le montage : la page reste
 * statique, et une composition se partage par son lien.
 */

/** Requetes deja lancees, par rang : revenir a un rang ne recharge rien. */
const requetes = new Map<RangMesure, Promise<MesuresRang>>();

function chargerMesures(rang: RangMesure): Promise<MesuresRang> {
  let requete = requetes.get(rang);
  if (!requete) {
    requete = fetch(`/composition/${rang}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<MesuresRang>;
    });
    // Un echec ne reste pas en memoire : revenir au rang retente.
    requete.catch(() => requetes.delete(rang));
    requetes.set(rang, requete);
  }
  return requete;
}

/** Nombres dans la langue de la page. */
interface Formats {
  /** Une decimale : taux, moyennes. */
  nombre: (v: number) => string;
  entier: (v: number) => string;
  /** Ecart signe, en points. */
  ecart: (v: number) => string;
}

const titre3 = "font-heading text-lg font-bold text-chalk-100";
const intitule = "text-xs uppercase tracking-wide text-chalk-500";

export function AnalyseEquipe({
  heros,
  rangs,
  libellesDegats,
}: {
  heros: HerosEquipe[];
  rangs: RangMesure[];
  /** Libelles des types de degats, resolus par le serveur (`donneesHeros` n'est pas envoye au navigateur). */
  libellesDegats: Record<TypeDegats, string>;
}) {
  const t = useT();
  const langue = useLangue();
  const [slugs, setSlugs] = useState<string[]>([]);
  const [rang, setRang] = useState<RangMesure>("all");
  const [ouvert, setOuvert] = useState(false);
  const [charges, setCharges] = useState<Partial<Record<RangMesure, MesuresRang | "erreur">>>({});
  const [copie, setCopie] = useState<"ok" | "erreur" | null>(null);

  const parSlug = useMemo(() => new Map(heros.map((h) => [h.slug, h])), [heros]);

  // Serveur et premiere hydratation partent d'une equipe vide (identiques,
  // donc sans desaccord) ; apres le montage seulement, on adopte ?h= et
  // ?rang=, puis chaque changement se reporte dans l'URL.
  const monte = useRef(false);
  useEffect(() => {
    if (!monte.current) {
      monte.current = true;
      const lu = lireParametres(window.location.search, new Set(parSlug.keys()), rangs);
      if (lu.slugs.length || lu.rang) {
        /* eslint-disable react-hooks/set-state-in-effect -- lecture de l'URL apres montage */
        if (lu.slugs.length) setSlugs(lu.slugs);
        if (lu.rang) setRang(lu.rang);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    const suffixe = ecrireParametres(window.location.search, slugs, rang);
    window.history.replaceState(null, "", suffixe ? `?${suffixe}` : window.location.pathname);
  }, [slugs, rang, parSlug, rangs]);

  useEffect(() => {
    chargerMesures(rang).then(
      (m) => setCharges((c) => ({ ...c, [rang]: m })),
      () => setCharges((c) => ({ ...c, [rang]: "erreur" })),
    );
  }, [rang]);

  const etat = charges[rang];
  const mesures = etat && etat !== "erreur" ? etat : null;
  const analyse = useMemo(() => analyserEquipe({ catalogue: heros, slugs, mesures }), [heros, slugs, mesures]);

  const formats = useMemo<Formats>(() => {
    const locale = LOCALE_HTML[langue];
    const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const entier = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    return { nombre: (v) => decimal.format(v), entier: (v) => entier.format(v), ecart: (v) => formaterEcart(v, locale) };
  }, [langue]);

  function ajouter(slug: string) {
    setSlugs((l) => (l.includes(slug) || l.length >= TAILLE_EQUIPE ? l : [...l, slug]));
    setOuvert(false);
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopie("ok");
    } catch {
      setCopie("erreur");
    }
    setTimeout(() => setCopie(null), 3000);
  }

  const { equipe, affectation } = analyse;
  const laneDe = new Map(Object.entries(affectation.lanes).map(([lane, slug]) => [slug, lane as Lane]));
  const complet = equipe.length >= TAILLE_EQUIPE;

  return (
    <div className="space-y-12">
      <section aria-labelledby="equipe-titre">
        <h2 id="equipe-titre" className="font-heading text-2xl font-bold text-chalk-100">
          {t("equipeUI.votreEquipe")}
        </h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <p className="mt-3 text-sm text-chalk-500">
          {t("equipeUI.votreEquipeDesc", { n: equipe.length, max: TAILLE_EQUIPE })}
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-5">
          {equipe.map((h) => (
            <li key={h.slug}>
              <Emplacement
                heros={h}
                lane={laneDe.get(h.slug) ?? null}
                stats={mesures?.stats[h.slug] ?? null}
                formats={formats}
                onRetirer={() => setSlugs((l) => l.filter((s) => s !== h.slug))}
              />
            </li>
          ))}
          {!complet && (
            <li>
              <button
                type="button"
                onClick={() => setOuvert(true)}
                className="bevel-sm flex h-full min-h-14 w-full items-center justify-center gap-2 border border-dashed border-night-600 px-3 py-3 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400 sm:min-h-32 sm:flex-col"
              >
                <Plus size={18} aria-hidden />
                {t("equipeUI.ajouter")}
              </button>
            </li>
          )}
          {/* Places restantes, pour voir d'un coup d'oeil ce qui manque ; sur mobile, le bouton suffit. */}
          {Array.from({ length: Math.max(0, TAILLE_EQUIPE - equipe.length - 1) }, (_, i) => (
            <li key={`vide-${i}`} aria-hidden className="hidden sm:block">
              <span className="bevel-sm block h-full min-h-32 border border-dashed border-night-800" />
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <ChoixRang rangs={rangs} rang={rang} onChange={setRang} />
          {equipe.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copier}
                className="bevel-sm inline-flex items-center gap-2 border border-night-700 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                <Link2 size={14} aria-hidden />
                {t("equipeUI.copier")}
              </button>
              <button
                type="button"
                onClick={() => setSlugs([])}
                className="bevel-sm inline-flex items-center gap-2 border border-night-700 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                <RotateCcw size={14} aria-hidden />
                {t("draftUI.toutEffacer")}
              </button>
              <span role="status" className="text-xs text-chalk-300">
                {copie === "ok" && t("equipeUI.lienCopie")}
                {copie === "erreur" && t("equipeUI.copieImpossible")}
              </span>
            </div>
          )}
        </div>
      </section>

      {equipe.length === 0 ? (
        <p className="max-w-2xl leading-relaxed text-chalk-500">{t("equipeUI.intro")}</p>
      ) : (
        <Resultats
          analyse={analyse}
          mesures={mesures}
          erreur={etat === "erreur"}
          rang={rang}
          parSlug={parSlug}
          libellesDegats={libellesDegats}
          formats={formats}
          onAjouter={ajouter}
        />
      )}

      {ouvert && (
        <SelecteurHeros
          heros={heros}
          exclus={new Set(slugs)}
          lane={equipe.length ? (affectation.manquantes[0] ?? null) : null}
          titre={t("equipeUI.choisir")}
          onChoisir={ajouter}
          onFermer={() => setOuvert(false)}
        />
      )}
    </div>
  );
}

/** Un heros de l'equipe : sa lane attribuee, son palier et son taux au rang. */
function Emplacement({
  heros: h,
  lane,
  stats,
  formats,
  onRetirer,
}: {
  heros: HerosEquipe;
  lane: Lane | null;
  stats: [number, Palier] | null;
  formats: Formats;
  onRetirer: () => void;
}) {
  const t = useT();
  return (
    <div className="bevel-sm relative flex h-full items-center gap-3 border border-azure-500/40 bg-night-900/60 p-2 pr-9 sm:min-h-32 sm:flex-col sm:gap-1.5 sm:px-2 sm:pb-2.5 sm:pt-3 sm:text-center">
      <VignetteHeros heros={h} />
      <div className="min-w-0 flex-1 sm:w-full">
        <Link
          href={`/heroes/${h.slug}`}
          className="block truncate font-heading font-bold text-chalk-100 transition-colors hover:text-gold-400"
        >
          {h.nom}
        </Link>
        <p className={cn("truncate text-xs", lane ? "text-chalk-300" : "text-blood-500")}>
          {lane ? t(`lanes.${lane}`) : t("equipeUI.horsLane")}
        </p>
        {stats && (
          <p className="text-xs tabular-nums text-chalk-500">
            <span className="font-semibold text-gold-400">{stats[1]}</span> · {formats.nombre(stats[0])} %
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRetirer}
        aria-label={t("draftUI.retirer", { nom: h.nom })}
        className="absolute right-1 top-1 grid size-7 place-items-center text-chalk-500 transition-colors hover:text-blood-500"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

function texteAlerte(a: Alerte, t: T, formats: Formats, nomDe: (slug: string) => string): string {
  switch (a.type) {
    case "lanes":
      return t("equipeUI.alertes.lanes", {
        lanes: a.lanes.map((l) => t(`lanes.${l}`)).join(", "),
        noms: a.enTrop.map(nomDe).join(", "),
      });
    case "tank":
      return t("equipeUI.alertes.tank");
    case "degats":
      return t(`equipeUI.alertes.degats.${a.dominant}`);
    default:
      return t(`equipeUI.alertes.${a.type}`, { v: formats.nombre(a.valeur) });
  }
}

function Resultats({
  analyse,
  mesures,
  erreur,
  rang,
  parSlug,
  libellesDegats,
  formats,
  onAjouter,
}: {
  analyse: Analyse;
  mesures: MesuresRang | null;
  erreur: boolean;
  rang: RangMesure;
  parSlug: Map<string, HerosEquipe>;
  libellesDegats: Record<TypeDegats, string>;
  formats: Formats;
  onAjouter: (slug: string) => void;
}) {
  const t = useT();
  const nomDe = (slug: string) => parSlug.get(slug)?.nom ?? slug;
  const { equipe, affectation, alertes, degats, notes, courbe } = analyse;
  const pts = t("contres.pts");
  const v = analyse.victoire;
  const tranche = (x: Tranche) =>
    x.to === null ? t("equipeUI.minutesPlus", { de: x.from }) : t("equipeUI.minutes", { de: x.from, a: x.to });

  const tuiles: [string, string, number][] = [
    [t("equipeUI.tauxMoyen"), v === null ? "—" : `${formats.nombre(v)} %`, v === null ? 0 : v >= 50.5 ? 1 : v <= 49.5 ? -1 : 0],
    [t("equipeUI.lanesCouvertes"), `${LANES.length - affectation.manquantes.length} / ${LANES.length}`, 0],
    [t("equipeUI.synergiesCompte"), mesures ? formats.entier(analyse.synergies.length) : "—", 0],
    [t("equipeUI.menacesCompte"), mesures ? formats.entier(analyse.menaces.length) : "—", 0],
  ];

  return (
    <>
      <section aria-labelledby="analyse-titre" className="space-y-10">
        <div>
          <h2 id="analyse-titre" className="font-heading text-2xl font-bold text-chalk-100">
            {t("equipeUI.analyse")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tuiles.map(([libelle, valeur, signe]) => (
              <div key={libelle} className="bevel-sm border border-night-700/70 bg-night-900/60 px-3 py-2">
                <dt className="text-[0.7rem] uppercase tracking-wide text-chalk-500">{libelle}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-lg font-semibold tabular-nums text-chalk-100",
                    signe === 1 && "text-emerald-400",
                    signe === -1 && "text-blood-500",
                  )}
                >
                  {valeur}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Points d'attention ─────────────────────────────────────── */}
        <div>
          <h3 className={titre3}>{t("equipeUI.alertes.titre")}</h3>
          {alertes.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {alertes.map((a) => (
                <li
                  key={a.type}
                  className="bevel-sm flex gap-2.5 border border-blood-500/30 bg-night-900/60 px-3 py-2 text-sm leading-relaxed text-chalk-100"
                >
                  <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-blood-500" />
                  {texteAlerte(a, t, formats, nomDe)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex gap-2.5 text-sm leading-relaxed text-chalk-300">
              <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-emerald-400" />
              {equipe.length >= TAILLE_EQUIPE
                ? t("equipeUI.alertes.aucune")
                : equipe.length < MIN_ALERTES
                  ? t("equipeUI.alertes.tropPeu", { n: MIN_ALERTES })
                  : t("equipeUI.alertes.aucunePartielle")}
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Lanes et roles ───────────────────────────────────────── */}
          <Carte>
            <h3 className={titre3}>{t("equipeUI.lanesRoles")}</h3>
            <ul className="mt-3 space-y-1.5">
              {LANES.map((lane) => {
                const slug = affectation.lanes[lane];
                const h = slug ? parSlug.get(slug) : null;
                return (
                  <li key={lane} className="flex min-h-7 items-center gap-2 text-sm">
                    <span className={cn("w-24 shrink-0", intitule)}>{t(`lanes.${lane}`)}</span>
                    {h ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <VignetteHeros heros={h} petite />
                        <span className="truncate text-chalk-100">{h.nom}</span>
                      </span>
                    ) : (
                      <span className="italic text-chalk-500">{t("equipeUI.aPourvoir")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {affectation.enTrop.length > 0 && (
              <p className="mt-2 text-xs text-blood-500">
                {t("equipeUI.sansLane", { noms: affectation.enTrop.map(nomDe).join(", ") })}
              </p>
            )}

            <p className={cn("mt-5", intitule)}>{t("equipeUI.roles")}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <li
                  key={r}
                  className={cn(
                    "bevel-sm border px-2 py-1 text-xs",
                    analyse.roles[r] ? "border-night-600 text-chalk-100" : "border-night-800 text-chalk-500",
                  )}
                >
                  {t(`roles.${r}`)} <span className="font-semibold tabular-nums">{formats.entier(analyse.roles[r])}</span>
                </li>
              ))}
            </ul>
          </Carte>

          {/* ── Profil : degats et notes du jeu ──────────────────────── */}
          <Carte>
            <h3 className={titre3}>{t("equipeUI.profil")}</h3>
            {degats.partPhysique !== null && (
              <>
                <p className={cn("mt-3", intitule)}>{t("equipeUI.degats")}</p>
                <div
                  role="img"
                  aria-label={t("equipeUI.partDegats", {
                    physique: formats.entier(degats.partPhysique * 100),
                    magique: formats.entier((1 - degats.partPhysique) * 100),
                  })}
                  className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-night-800"
                >
                  <span className="h-full bg-gold-500" style={{ width: `${degats.partPhysique * 100}%` }} />
                  <span className="h-full bg-azure-500" style={{ width: `${(1 - degats.partPhysique) * 100}%` }} />
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-300">
                  {(["physical", "magic", "mixed"] as const).map(
                    (d) =>
                      degats[d] > 0 && (
                        <li key={d} className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className={cn(
                              "size-2 rounded-full",
                              d === "physical" ? "bg-gold-500" : d === "magic" ? "bg-azure-500" : "bg-chalk-500",
                            )}
                          />
                          {libellesDegats[d]}
                          <span className="font-semibold tabular-nums text-chalk-100">{formats.entier(degats[d])}</span>
                        </li>
                      ),
                  )}
                </ul>
              </>
            )}

            <p className={cn("mt-5", intitule)}>{t("equipeUI.notes")}</p>
            <dl className="mt-2 space-y-2">
              {NOTES.map((n) => {
                const valeur = notes[n];
                if (valeur === null) return null;
                return (
                  <div key={n} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm">
                    <dt className="text-chalk-300">{t(`compareUI.${n}`)}</dt>
                    <dd>
                      <Jauge valeur={valeur} texte={formats.nombre(valeur)} />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Carte>
        </div>

        {mesures ? (
          <>
            {/* ── Duree de partie ────────────────────────────────────── */}
            <div>
              <h3 className={titre3}>{t("equipeUI.duree")}</h3>
              {courbe ? (
                <>
                  <p className="mt-1 text-sm text-chalk-500">
                    {t("equipeUI.dureeIntro", { rang: t(`rangsMesure.${rang}`) })}
                  </p>
                  <p className="mt-3 text-sm text-chalk-300">
                    <span className="font-semibold text-gold-400">{t(`equipeUI.profilDuree.${courbe.profil}`)}</span>
                    {" · "}
                    {t("equipeUI.pic", { tranche: tranche(courbe.tranches[courbe.pic]) })}
                  </p>
                  <BarresDuree
                    tranches={courbe.tranches.map((x, i) => ({ ...x, winRate: courbe.victoire[i] }))}
                    nombre={formats.nombre}
                    libelle={tranche}
                    className="mt-4"
                  />
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-chalk-500">
                    {courbe.parHeros.map(({ slug, profil }) => (
                      <li key={slug}>
                        <span className="text-chalk-100">{nomDe(slug)}</span> · {t(`equipeUI.profilCourt.${profil}`)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-chalk-500">{t("equipeUI.sansDuree")}</p>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* ── Synergies ─────────────────────────────────────────── */}
              <div>
                <h3 className={titre3}>{t("equipeUI.synergies")}</h3>
                <p className="mt-1 text-sm text-chalk-500">{t("equipeUI.synergiesIntro")}</p>
                {analyse.synergies.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {analyse.synergies.map((p) => {
                      const a = parSlug.get(p.a);
                      const b = parSlug.get(p.b);
                      return (
                        <li
                          key={`${p.a}-${p.b}`}
                          className="bevel-sm flex items-center gap-2 border border-night-700/70 bg-night-900/60 px-3 py-2 text-sm"
                        >
                          {a && <VignetteHeros heros={a} petite />}
                          {b && <VignetteHeros heros={b} petite />}
                          <span className="min-w-0 flex-1 text-chalk-100">
                            {nomDe(p.a)} + {nomDe(p.b)}
                          </span>
                          {p.points !== null ? (
                            <span className="shrink-0 font-semibold tabular-nums text-emerald-400">
                              {formats.ecart(p.points)} {pts}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-chalk-500">{t("equipeUI.synergieConnue")}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-chalk-500">{t("equipeUI.aucuneSynergie")}</p>
                )}
              </div>

              {/* ── Menaces ───────────────────────────────────────────── */}
              <div>
                <h3 className={titre3}>{t("equipeUI.menaces")}</h3>
                <p className="mt-1 text-sm text-chalk-500">{t("equipeUI.menacesIntro")}</p>
                {analyse.menaces.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {analyse.menaces.map((m) => {
                      const h = parSlug.get(m.slug);
                      return (
                        <li
                          key={m.slug}
                          className="bevel-sm flex items-start gap-3 border border-blood-500/30 bg-night-900/60 px-3 py-2"
                        >
                          {h && <VignetteHeros heros={h} />}
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/heroes/${m.slug}`}
                              className="font-heading font-bold text-chalk-100 transition-colors hover:text-gold-400"
                            >
                              {nomDe(m.slug)}
                            </Link>
                            <p className="text-xs leading-snug text-chalk-300">
                              {t("equipeUI.gene", { n: m.cibles.length })}{" "}
                              {m.cibles.map(([s, p]) => `${nomDe(s)} (${formats.ecart(p)} ${pts})`).join(", ")}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-chalk-500">{t("equipeUI.aucuneMenace")}</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p
            role="status"
            className="bevel-sm border border-dashed border-night-700 px-4 py-3 text-sm text-chalk-500"
          >
            {erreur ? t("equipeUI.erreur") : t("equipeUI.chargement")}
          </p>
        )}
      </section>

      {/* ── Picks pour les lanes libres ──────────────────────────────── */}
      {analyse.suggestions.length > 0 && (
        <section aria-labelledby="completer-titre">
          <h2 id="completer-titre" className="font-heading text-2xl font-bold text-chalk-100">
            {t("equipeUI.completer")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-3 max-w-2xl text-sm text-chalk-500">{t("equipeUI.completerIntro")}</p>

          <div className="mt-6 space-y-5">
            {analyse.suggestions.map(({ lane, picks }) => (
              <div key={lane}>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-gold-400">
                  {t(`lanes.${lane}`)}
                </h3>
                {picks.length > 0 ? (
                  <ul className="mt-2 grid gap-2 md:grid-cols-3">
                    {picks.map((s, i) => (
                      <li key={s.heros.slug}>
                        <CarteSuggestion
                          suggestion={s}
                          premiere={i === 0}
                          titrePrendre={t("draftUI.choisirEn", { nom: s.heros.nom, lane: t(`lanes.${lane}`) })}
                          onPrendre={() => onAjouter(s.heros.slug)}
                          vide={t("equipeUI.aucuneRaison")}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-chalk-500">{t("draftUI.aucunHeros")}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

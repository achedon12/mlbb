"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Share2 } from "lucide-react";
import { CarteSkin, proprietesCarteSkin } from "@/components/carte-skin";
import { ChampRecherche } from "@/components/champ-recherche";
import { ChoixUnique, GroupeFiltres, Puce, classesPuce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  LIBELLE_MONNAIE,
  ROLES_INDEX,
  chargerCatalogue,
  libelleRarete,
  libelleSerie,
  rareteDeRang,
  statsSeries,
  textePrix,
  type Catalogue,
  type SkinCatalogue,
} from "@/lib/catalogue-skins";
import {
  CLE_COLLECTION,
  bilanCollection,
  ecrirePossession,
  lirePossession,
  skinsCollectionnables,
  type Bilan,
} from "@/lib/collection";
import type { Role } from "@/lib/types";
import { cleRecherche, cn } from "@/lib/utils";

type Vue = "tous" | "possedes" | "manquants";
const VUES: Vue[] = ["tous", "possedes", "manquants"];
/** Series montrees d'abord ; les autres se deplient. */
const SERIES_VISIBLES = 10;

const basculer = (ensemble: ReadonlySet<string>, cle: string) => {
  const suivant = new Set(ensemble);
  if (suivant.has(cle)) suivant.delete(cle);
  else suivant.add(cle);
  return suivant;
};

/**
 * Calculateur de collection : le joueur coche ses heros et ses skins, et voit
 * ce qu'ils valent au prix de la boutique du jeu, en diamants.
 *
 * L'index des skins est demande au chargement de l'outil, jamais embarque
 * dans la page. La collection se garde dans le navigateur (`localStorage`) :
 * rien ne part vers un serveur.
 */
export function CalculateurCollection() {
  const t = useT();
  const langue = useLangue();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [erreur, setErreur] = useState(false);
  const [heros, setHeros] = useState<ReadonlySet<string>>(new Set());
  const [skins, setSkins] = useState<ReadonlySet<string>>(new Set());
  const [recherche, setRecherche] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [serie, setSerie] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>("tous");
  const [ouverts, setOuverts] = useState<ReadonlySet<string>>(new Set());
  const [toutesSeries, setToutesSeries] = useState(false);
  const [partage, setPartage] = useState<"" | "copie" | "partage" | "echec">("");

  const nombre = useMemo(() => new Intl.NumberFormat(LOCALE_HTML[langue]), [langue]);
  const pourcent = useMemo(
    () => new Intl.NumberFormat(LOCALE_HTML[langue], { style: "percent", maximumFractionDigits: 0 }),
    [langue],
  );

  // Index et sauvegarde arrivent ensemble : la collection ne s'affiche qu'une fois les deux lus.
  useEffect(() => {
    let annule = false;
    chargerCatalogue(langue).then(
      (c) => {
        if (annule) return;
        let brut: string | null = null;
        try {
          brut = localStorage.getItem(CLE_COLLECTION);
        } catch {
          // Stockage refuse (navigation privee stricte) : la collection reste le temps de la visite.
        }
        const p = lirePossession(brut);
        setHeros(new Set(p.heros));
        setSkins(new Set(p.skins));
        setCatalogue(c);
      },
      () => !annule && setErreur(true),
    );
    return () => {
      annule = true;
    };
  }, [langue]);

  useEffect(() => {
    if (!catalogue) return;
    try {
      localStorage.setItem(CLE_COLLECTION, ecrirePossession({ heros, skins }));
    } catch {
      // Idem : pas de sauvegarde possible, le calcul reste juste.
    }
  }, [catalogue, heros, skins]);

  const donnees = useMemo(() => {
    if (!catalogue) return null;
    const collectionnables = skinsCollectionnables(catalogue);
    const parHeros = new Map<string, SkinCatalogue[]>();
    for (const s of collectionnables) parHeros.set(s.heros, [...(parHeros.get(s.heros) ?? []), s]);
    return {
      parHeros,
      noms: new Map(catalogue.heros.map((h) => [h.slug, h.nom])),
      herosTries: [...catalogue.heros].sort((a, b) => a.nom.localeCompare(b.nom, "en")),
      series: statsSeries(collectionnables).map((s) => s.serie),
    };
  }, [catalogue]);

  const bilan = useMemo(() => (catalogue ? bilanCollection(catalogue, { heros, skins }) : null), [catalogue, heros, skins]);

  const liste = useMemo(() => {
    if (!donnees) return [];
    const terme = cleRecherche(recherche.trim());
    return donnees.herosTries.flatMap((h) => {
      if (role && !h.roles.includes(role)) return [];
      const nomTrouve = !terme || cleRecherche(h.nom).includes(terme);
      let sk = donnees.parHeros.get(h.slug) ?? [];
      if (serie) sk = sk.filter((s) => s.serie === serie);
      if (!nomTrouve) sk = sk.filter((s) => cleRecherche(s.nom).includes(terme));
      if (vue === "possedes") sk = sk.filter((s) => skins.has(s.id));
      if (vue === "manquants") sk = sk.filter((s) => !skins.has(s.id));
      // Le heros reste s'il passe lui-meme les filtres, ou s'il lui reste des skins a montrer.
      const herosPasse = nomTrouve && !serie && (vue === "tous" || (vue === "possedes") === heros.has(h.slug));
      if (!herosPasse && sk.length === 0) return [];
      // Une recherche par nom de skin ou une serie deplie d'office les heros concernes.
      return [{ h, sk, deplie: (!!terme && !nomTrouve) || !!serie }];
    });
  }, [donnees, recherche, role, serie, vue, heros, skins]);

  if (erreur) {
    return (
      <Carte>
        <p className="text-sm text-craie-300">{t("pages.collectionUI.erreur")}</p>
      </Carte>
    );
  }
  if (!catalogue || !donnees || !bilan) {
    return (
      <Carte aria-busy>
        <p className="text-sm text-craie-500">{t("pages.collectionUI.chargement")}</p>
      </Carte>
    );
  }

  function toutPourHeros(slug: string) {
    const ids = (donnees!.parHeros.get(slug) ?? []).map((s) => s.id);
    const complet = heros.has(slug) && ids.every((id) => skins.has(id));
    setHeros((avant) => {
      const n = new Set(avant);
      if (complet) n.delete(slug);
      else n.add(slug);
      return n;
    });
    setSkins((avant) => {
      const n = new Set(avant);
      for (const id of ids) {
        if (complet) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  }

  const tousHeros = donnees.herosTries.every((h) => heros.has(h.slug));
  const vide = heros.size === 0 && skins.size === 0;

  function resume(b: Bilan): string {
    const rare = b.plusRares[0];
    return [
      t("pages.collectionUI.resumeTexte", {
        heros: `${nombre.format(b.heros.possedes)}/${nombre.format(b.heros.total)}`,
        skins: `${nombre.format(b.skins.possedes)}/${nombre.format(b.skins.total)}`,
        diamants: nombre.format(b.diamants),
      }),
      rare ? t("pages.collectionUI.resumeRare", { nom: rare.nom, heros: donnees!.noms.get(rare.heros) ?? rare.heros }) : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function partager(b: Bilan) {
    const texte = resume(b);
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("pages.collectionUI.resumeTitre"), text: texte, url });
        setPartage("partage");
        return;
      }
      await navigator.clipboard.writeText(`${texte}\n${url}`);
      setPartage("copie");
    } catch (e) {
      // Fermer la feuille de partage n'est pas un echec.
      if ((e as Error).name !== "AbortError") setPartage("echec");
    }
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* ── Bilan ─────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:order-2" aria-labelledby="bilan-titre">
          <Carte className="border-or-500/30">
            <h2 id="bilan-titre" className="text-xs uppercase tracking-wide text-craie-500">
              {t("pages.collectionUI.valeurTitre")}
            </h2>
            <p aria-live="polite" className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-titre text-4xl font-bold tabular-nums text-or-400">{nombre.format(bilan.diamants)}</span>
              <span className="text-craie-100">{t("skinsUI.diamants").toLowerCase()}</span>
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Ligne
                libelle={t("pages.collectionUI.heros")}
                valeur={`${nombre.format(bilan.heros.possedes)} / ${nombre.format(bilan.heros.total)}`}
                detail={t("pages.collectionUI.enDiamants", { n: nombre.format(bilan.heros.diamants) })}
              />
              <Ligne
                libelle={t("pages.collectionUI.skins")}
                valeur={`${nombre.format(bilan.skins.possedes)} / ${nombre.format(bilan.skins.total)}`}
                detail={t("pages.collectionUI.enDiamants", { n: nombre.format(bilan.skins.diamants) })}
              />
              {bilan.heros.pointsBataille > 0 && (
                <Ligne
                  libelle={t("skinsUI.pointsBataille")}
                  valeur={nombre.format(bilan.heros.pointsBataille)}
                  detail={t("pages.collectionUI.bpDetail")}
                />
              )}
              {Object.entries(bilan.skins.autres).map(([m, n]) => (
                <Ligne
                  key={m}
                  libelle={t(`skinsUI.${LIBELLE_MONNAIE[m as keyof typeof LIBELLE_MONNAIE]}`)}
                  valeur={nombre.format(n)}
                  detail={t("pages.collectionUI.autreDetail")}
                />
              ))}
            </dl>
            {(bilan.skins.sansDiamant > 0 || bilan.heros.sansDiamant > 0) && (
              <p className="mt-3 text-xs leading-relaxed text-craie-500">
                {t("pages.collectionUI.sansDiamant", {
                  skins: nombre.format(bilan.skins.sansDiamant),
                  heros: nombre.format(bilan.heros.sansDiamant),
                })}
              </p>
            )}
            {vide ? (
              <p className="mt-4 border-t border-nuit-800 pt-3 text-sm text-craie-300">{t("pages.collectionUI.vide")}</p>
            ) : (
              <div className="mt-4 border-t border-nuit-800 pt-4">
                <p className="text-sm leading-relaxed text-craie-200">{resume(bilan)}</p>
                <button
                  type="button"
                  onClick={() => partager(bilan)}
                  className={cn(classesPuce(true), "mt-3 inline-flex items-center gap-2")}
                >
                  <Share2 size={15} aria-hidden />
                  {t("pages.collectionUI.partager")}
                </button>
                <p aria-live="polite" className="mt-2 text-xs text-craie-500">
                  {partage && t(`pages.collectionUI.partage_${partage}`)}
                </p>
              </div>
            )}
          </Carte>
        </aside>

        {/* ── Selection ─────────────────────────────────────────────── */}
        <div className="min-w-0 lg:order-1">
          <h2 className="font-titre text-2xl font-bold text-craie-100">{t("pages.collectionUI.selectionTitre")}</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <div className="mt-5 space-y-4">
            <ChampRecherche valeur={recherche} onChange={setRecherche} libelle={t("pages.collectionUI.rechercher")} />
            <ChoixUnique
              legende={t("pages.collectionUI.role")}
              valeurs={ROLES_INDEX}
              actif={role}
              onChange={setRole}
              libelle={(r) => t(`roles.${r}`)}
            />
            <GroupeFiltres legende={t("pages.collectionUI.afficher")}>
              {VUES.map((v) => (
                <Puce key={v} dense actif={vue === v} onClick={() => setVue(v)}>
                  {t(`pages.collectionUI.vue_${v}`)}
                </Puce>
              ))}
            </GroupeFiltres>
            <label className="block max-w-xs">
              <span className="text-xs uppercase tracking-wide text-craie-500">{t("pages.collectionUI.serie")}</span>
              <select
                value={serie ?? ""}
                onChange={(e) => setSerie(e.target.value || null)}
                className="biseau-sm mt-1.5 w-full border border-nuit-700 bg-nuit-900 px-3 py-2 text-sm text-craie-100 outline-none focus:border-or-500"
              >
                <option value="">{t("pages.collectionUI.toutesSeries")}</option>
                {donnees.series.map((s) => (
                  <option key={s} value={s}>
                    {libelleSerie(t, s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHeros(tousHeros ? new Set() : new Set(donnees.herosTries.map((h) => h.slug)))}
                className={classesPuce(false, true)}
              >
                {t(tousHeros ? "pages.collectionUI.aucunHeros" : "pages.collectionUI.tousHeros")}
              </button>
              {!vide && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("pages.collectionUI.confirmerEffacer"))) {
                      setHeros(new Set());
                      setSkins(new Set());
                    }
                  }}
                  className={classesPuce(false, true)}
                >
                  {t("pages.collectionUI.effacer")}
                </button>
              )}
            </div>
          </div>

          <p aria-live="polite" className="mt-5 text-sm text-craie-500">
            {t(liste.length === 1 ? "pages.collectionUI.compteHeros1" : "pages.collectionUI.compteHeros", {
              n: nombre.format(liste.length),
            })}
          </p>

          <ul className="mt-3 divide-y divide-nuit-800 border-y border-nuit-800">
            {liste.map(({ h, sk, deplie }) => {
              const tous = donnees.parHeros.get(h.slug) ?? [];
              const possedes = tous.filter((s) => skins.has(s.id)).length;
              const complet = heros.has(h.slug) && possedes === tous.length;
              const ouvert = deplie || ouverts.has(h.slug);
              return (
                <li key={h.slug} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={heros.has(h.slug)}
                        onChange={() => setHeros((avant) => basculer(avant, h.slug))}
                        className="size-4 shrink-0 accent-or-500"
                      />
                      {h.icone ? (
                        <Image src={h.icone} alt="" width={32} height={32} className="biseau-sm size-8 shrink-0 object-cover" />
                      ) : null}
                      <span className="truncate font-semibold text-craie-100">{h.nom}</span>
                    </label>
                    <span className="text-xs tabular-nums text-craie-500">
                      {t("pages.collectionUI.skinsDuHeros", { n: nombre.format(possedes), total: nombre.format(tous.length) })}
                    </span>
                    <button
                      type="button"
                      onClick={() => toutPourHeros(h.slug)}
                      aria-label={t(complet ? "pages.collectionUI.toutDecocherHeros" : "pages.collectionUI.toutCocherHeros", {
                        nom: h.nom,
                      })}
                      className={classesPuce(false, true)}
                    >
                      {t(complet ? "pages.collectionUI.toutDecocher" : "pages.collectionUI.toutCocher")}
                    </button>
                    {sk.length > 0 && !deplie && (
                      <button
                        type="button"
                        aria-expanded={ouvert}
                        aria-controls={`skins-${h.slug}`}
                        onClick={() => setOuverts((avant) => basculer(avant, h.slug))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-or-400 hover:text-or-500"
                      >
                        {t("pages.collectionUI.voirSkins")}
                        <span className="sr-only"> — {h.nom}</span>
                        <ChevronDown size={14} aria-hidden className={cn("transition-transform", ouvert && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  {ouvert && sk.length > 0 && (
                    <ul id={`skins-${h.slug}`} className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                      {sk.map((s) => {
                        const coche = skins.has(s.id);
                        const r = rareteDeRang(s.rarete);
                        return (
                          <li key={s.id}>
                            <label
                              className={cn(
                                "biseau-sm relative block cursor-pointer overflow-hidden border-2 transition-colors",
                                !coche && "border-nuit-700",
                              )}
                              style={coche ? { borderColor: r.couleur, boxShadow: `0 0 10px ${r.halo}` } : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={coche}
                                onChange={() => setSkins((avant) => basculer(avant, s.id))}
                                className="absolute left-1.5 top-1.5 z-10 size-4 accent-or-500"
                              />
                              <span className="relative block aspect-[240/390] bg-nuit-800">
                                {s.image && (
                                  <Image
                                    src={s.image}
                                    alt=""
                                    width={120}
                                    height={195}
                                    className={cn("size-full object-cover transition-opacity", !coche && "opacity-55")}
                                  />
                                )}
                              </span>
                              <span className="block bg-nuit-900 px-1.5 py-1 text-[0.65rem] leading-tight">
                                <span className="block truncate text-craie-100">{s.nom}</span>
                                <span className="block truncate" style={{ color: r.couleur }}>
                                  {libelleRarete(t, s.rarete)}
                                </span>
                                <span className="block truncate text-craie-500">
                                  {textePrix(s.prix, t, nombre) ?? s.obtention ?? t("pages.collectionUI.sansPrix")}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          {liste.length === 0 && <p className="mt-6 text-sm text-craie-500">{t("pages.collectionUI.aucun")}</p>}
        </div>
      </div>

      {/* ── Detail ────────────────────────────────────────────────── */}
      {!vide && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section>
            <h2 className="font-titre text-xl font-bold text-craie-100">{t("pages.collectionUI.rareteTitre")}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("pages.collectionUI.rareteTitre")}</caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-craie-500">
                    <th scope="col" className="py-2 font-medium">{t("pages.collectionUI.colRarete")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t("pages.collectionUI.colPossedes")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t("pages.collectionUI.colDiamants")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nuit-800">
                  {bilan.parRarete.map((r) => (
                    <tr key={r.rang}>
                      <th scope="row" className="py-2 text-left font-normal" style={{ color: rareteDeRang(r.rang).couleur }}>
                        {libelleRarete(t, r.rang)}
                      </th>
                      <td className="py-2 text-right tabular-nums text-craie-200">
                        {nombre.format(r.possedes)} / {nombre.format(r.total)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-craie-200">{nombre.format(r.diamants)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bilan.plusRares.length > 0 && (
              <>
                <h2 className="mt-8 font-titre text-xl font-bold text-craie-100">{t("pages.collectionUI.raresTitre")}</h2>
                <p className="mt-1 text-sm text-craie-500">{t("pages.collectionUI.raresAide")}</p>
                <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
                  {bilan.plusRares.map((s) => (
                    <li key={s.id}>
                      <CarteSkin
                        {...proprietesCarteSkin(s, donnees.noms.get(s.heros) ?? s.heros, t, LOCALE_HTML[langue], nombre)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section>
            <h2 className="font-titre text-xl font-bold text-craie-100">{t("pages.collectionUI.seriesTitre")}</h2>
            <p className="mt-1 text-sm text-craie-500">{t("pages.collectionUI.seriesAide")}</p>
            <ul className="mt-4 space-y-3">
              {(toutesSeries ? bilan.parSerie : bilan.parSerie.slice(0, SERIES_VISIBLES)).map((s) => (
                <li key={s.serie}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-craie-100">{libelleSerie(t, s.serie)}</span>
                    <span className="shrink-0 tabular-nums text-craie-400">
                      {nombre.format(s.possedes)} / {nombre.format(s.total)} · {pourcent.format(s.possedes / s.total)}
                    </span>
                  </div>
                  <div aria-hidden className="mt-1 h-1.5 bg-nuit-700">
                    <div className="h-full bg-or-400" style={{ width: `${(s.possedes / s.total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {bilan.parSerie.length > SERIES_VISIBLES && (
              <button
                type="button"
                onClick={() => setToutesSeries((v) => !v)}
                aria-expanded={toutesSeries}
                className={cn(classesPuce(false, true), "mt-4")}
              >
                {toutesSeries
                  ? t("pages.collectionUI.moinsSeries")
                  : t("pages.collectionUI.toutesLesSeries", { n: nombre.format(bilan.parSerie.length) })}
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Ligne({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-craie-400">{libelle}</dt>
      <dd className="text-right">
        <span className="tabular-nums text-craie-100">{valeur}</span>
        {detail && <span className="block text-xs text-craie-500">{detail}</span>}
      </dd>
    </div>
  );
}

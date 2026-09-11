"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Download,
  Link2,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { ChampRecherche } from "@/components/champ-recherche";
import { PortraitHeros } from "@/components/portrait-heros";
import { GroupeFiltres, Puce } from "@/components/puce";
import { ChoixRang } from "@/components/selecteur-rang";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  ajouterRangee,
  couleurTexte,
  decaler,
  decoderTier,
  deplacerRangee,
  deserialiser,
  encoderTier,
  etatDefaut,
  MAX_RANGEES,
  modifierRangee,
  NOM_MAX,
  PALETTE,
  placer,
  preremplir,
  rangeeDe,
  serialiser,
  supprimerRangee,
  TITRE_MAX,
  viderRangees,
  type EtatTier,
  type Rangee,
} from "@/lib/createur-tier";
import { LANES, ROLES } from "@/lib/draft";
import { exporterImage } from "@/lib/image-tier";
import type { RangMesure } from "@/lib/rangs-mesure";
import { site } from "@/lib/site";
import type { Lane, Role } from "@/lib/types";
import { cleRecherche, cn } from "@/lib/utils";

/**
 * Createur de tier list.
 *
 * Trois facons de ranger un heros, pour tous les ecrans et toutes les mains :
 *
 * - glisser-deposer a la souris, sur une rangee ou devant un heros ;
 * - toucher un heros, puis sa rangee — ou un palier de la barre qui apparait
 *   en bas de l'ecran, sans avoir a remonter la page sur mobile ;
 * - au clavier : Entree selectionne, les chiffres 1 a 9 posent dans la
 *   rangee correspondante, 0 rend a la reserve, les fleches parcourent.
 *
 * Chaque geste est annonce aux lecteurs d'ecran. La liste se garde dans le
 * navigateur, se partage par un lien (`?l=`, voir `lib/createur-tier`) et
 * s'exporte en PNG.
 */

export interface HerosTier {
  slug: string;
  nom: string;
  icone: string | null;
  roles: Role[];
  lanes: Lane[];
}

const CLE_LISTE = "mlbb_tier_liste";
const CLE_PRECEDENTE = "mlbb_tier_precedente";

function lireListe(cle: string, connus: Set<string>): EtatTier | null {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? deserialiser(brut, connus) : null;
  } catch {
    return null;
  }
}

function ecrireListe(cle: string, etat: EtatTier | null) {
  try {
    if (etat) localStorage.setItem(cle, serialiser(etat));
    else localStorage.removeItem(cle);
  } catch {
    /* stockage refuse : la liste vit le temps de la visite */
  }
}

const bouton =
  "bevel-sm inline-flex items-center justify-center gap-1.5 border border-night-600 px-3 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400 disabled:opacity-40";
const petitBouton =
  "bevel-sm grid size-9 shrink-0 place-items-center border border-night-700 text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400 disabled:opacity-30";

export function CreateurTierList({
  heros,
  groupes,
  rangs,
}: {
  heros: HerosTier[];
  /** Par rang, les indices des heros de chaque palier de notre tier list (S+ a C). */
  groupes: Partial<Record<RangMesure, number[][]>>;
  rangs: RangMesure[];
}) {
  const t = useT();
  const langue = useLangue();
  const parSlug = useMemo(() => new Map(heros.map((h) => [h.slug, h])), [heros]);
  const connus = useMemo(() => new Set(heros.map((h) => h.slug)), [heros]);

  const [etat, setEtat] = useState<EtatTier>(() => etatDefaut());
  const [charge, setCharge] = useState(false);
  const [precedente, setPrecedente] = useState<EtatTier | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [rang, setRang] = useState<RangMesure>(rangs[0] ?? "all");
  const [annonce, setAnnonce] = useState("");
  const [statut, setStatut] = useState("");
  const racine = useRef<HTMLDivElement>(null);
  const focusApres = useRef<string | null>(null);

  // Apres le montage : une liste partagee (?l=) passe devant la liste gardee,
  // qui reste recuperable d'un clic.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("l");
    const gardee = lireListe(CLE_LISTE, connus);
    if (!code) {
      /* eslint-disable react-hooks/set-state-in-effect -- stockage lu apres montage */
      if (gardee) setEtat(gardee);
      setPrecedente(lireListe(CLE_PRECEDENTE, connus));
      setCharge(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let actif = true;
    decoderTier(code, connus).then((partagee) => {
      if (!actif) return;
      if (partagee) {
        const avait = gardee && gardee.rangees.some((r) => r.heros.length);
        if (avait) {
          ecrireListe(CLE_PRECEDENTE, gardee);
          setPrecedente(gardee);
        }
        setEtat(partagee);
        setAnnonce(t("pages.createurTierUI.partageeChargee"));
      } else if (gardee) {
        setEtat(gardee);
      }
      setCharge(true);
      // L'adresse redevient celle de l'outil : recharger garde la liste modifiee.
      window.history.replaceState(null, "", window.location.pathname);
    });
    return () => {
      actif = false;
    };
  }, [connus, t]);

  useEffect(() => {
    if (charge) ecrireListe(CLE_LISTE, etat);
  }, [etat, charge]);

  // Au clavier, le heros deplace garde le focus dans sa nouvelle rangee.
  useEffect(() => {
    const slug = focusApres.current;
    if (!slug) return;
    focusApres.current = null;
    racine.current?.querySelector<HTMLButtonElement>(`[data-heros="${slug}"]`)?.focus();
  }, [etat]);

  const places = useMemo(() => new Set(etat.rangees.flatMap((r) => r.heros)), [etat]);
  const reserve = useMemo(() => {
    const terme = cleRecherche(recherche.trim());
    return heros
      .filter((h) => !places.has(h.slug))
      .filter((h) => !role || h.roles.includes(role))
      .filter((h) => !lane || h.lanes.includes(lane))
      .filter((h) => !terme || cleRecherche(h.nom).includes(terme));
  }, [heros, places, role, lane, recherche]);

  const nom = (slug: string) => parSlug.get(slug)?.nom ?? slug;
  const nomRangee = (r: Rangee | undefined) => r?.nom || "—";

  function poser(slug: string, cible: string | null, avant?: string | null, clavier = false) {
    const suivant = placer(etat, slug, cible, avant);
    if (clavier) focusApres.current = slug;
    setEtat(suivant);
    setSelection(null);
    const r = cible ? suivant.rangees.find((x) => x.id === cible) : undefined;
    setAnnonce(
      r
        ? t("pages.createurTierUI.annoncePlace", {
            nom: nom(slug),
            rangee: nomRangee(r),
            position: r.heros.indexOf(slug) + 1,
            n: r.heros.length,
          })
        : t("pages.createurTierUI.annonceReserve", { nom: nom(slug) }),
    );
  }

  function basculerSelection(slug: string) {
    if (selection === slug) {
      setSelection(null);
      setAnnonce(t("pages.createurTierUI.annonceDeselection"));
    } else {
      setSelection(slug);
      setAnnonce(t("pages.createurTierUI.annonceSelection", { nom: nom(slug) }));
    }
  }

  function decalerSelection(delta: number, clavier: boolean) {
    if (!selection) return;
    const suivant = decaler(etat, selection, delta);
    const r = rangeeDe(suivant, selection);
    if (clavier) focusApres.current = selection;
    setEtat(suivant);
    if (r) {
      setAnnonce(
        t("pages.createurTierUI.annonceDeplace", {
          nom: nom(selection),
          position: r.heros.indexOf(selection) + 1,
          n: r.heros.length,
        }),
      );
    }
  }

  function toucheHeros(e: React.KeyboardEvent<HTMLButtonElement>, slug: string) {
    if (/^[1-9]$/.test(e.key)) {
      const r = etat.rangees[Number(e.key) - 1];
      if (r) {
        e.preventDefault();
        poser(slug, r.id, null, true);
      }
    } else if (e.key === "0" || e.key === "Delete" || e.key === "Backspace") {
      if (places.has(slug)) {
        e.preventDefault();
        poser(slug, null, null, true);
      }
    } else if (e.key === "Escape") {
      setSelection(null);
    }
  }

  /** Fleches, Debut et Fin : d'un heros a l'autre dans le meme groupe. */
  function naviguer(e: React.KeyboardEvent<HTMLElement>) {
    const boutons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-heros]")];
    const i = boutons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const pas: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 };
    const j = e.key === "Home" ? 0 : e.key === "End" ? boutons.length - 1 : pas[e.key];
    if (j === undefined) return;
    e.preventDefault();
    boutons[Math.max(0, Math.min(j, boutons.length - 1))]?.focus();
  }

  function deposer(e: React.DragEvent<HTMLElement>, cible: string | null) {
    e.preventDefault();
    setSurvol(null);
    const slug = e.dataTransfer.getData("text/plain");
    if (!connus.has(slug)) return;
    const avant = (e.target as Element).closest("[data-heros]")?.getAttribute("data-heros");
    poser(slug, cible, avant && avant !== slug ? avant : null);
  }

  function confirmer(message: string): boolean {
    return places.size === 0 || window.confirm(message);
  }

  function chargerMeta() {
    const liste = groupes[rang];
    if (!liste || !confirmer(t("pages.createurTierUI.confirmerRemplacement"))) return;
    const libelleRang = t(`rangsMesure.${rang}`);
    setEtat(preremplir(heros.map((h) => h.slug), liste, t("pages.createurTierUI.titreMeta", { rang: libelleRang })));
    setSelection(null);
    setEdition(null);
    setAnnonce(t("pages.createurTierUI.annonceMeta", { rang: libelleRang }));
  }

  function vider() {
    if (!confirmer(t("pages.createurTierUI.confirmerVider"))) return;
    setEtat(viderRangees(etat));
    setSelection(null);
    setAnnonce(t("pages.createurTierUI.annonceVide"));
  }

  function reinitialiser() {
    if (!confirmer(t("pages.createurTierUI.confirmerReinitialiser"))) return;
    setEtat(etatDefaut());
    setSelection(null);
    setEdition(null);
    setAnnonce(t("pages.createurTierUI.annonceReinitialise"));
  }

  function restaurer() {
    if (!precedente) return;
    setEtat(precedente);
    setPrecedente(null);
    ecrireListe(CLE_PRECEDENTE, null);
    setAnnonce(t("pages.createurTierUI.annonceRestauree"));
  }

  function ajouter() {
    const suivant = ajouterRangee(etat, `n${Date.now().toString(36)}`, t("pages.createurTierUI.nouvelleRangee"));
    setEtat(suivant);
    setEdition(suivant.rangees.at(-1)?.id ?? null);
    setAnnonce(t("pages.createurTierUI.annonceRangeeAjoutee"));
  }

  function supprimer(r: Rangee) {
    setEtat(supprimerRangee(etat, r.id));
    setEdition(null);
    setAnnonce(t("pages.createurTierUI.annonceRangeeSupprimee", { nom: nomRangee(r) }));
  }

  const titreImage = etat.titre.trim() || t("pages.createurTierUI.titreDefaut");
  const tactile = () => window.matchMedia("(pointer: coarse)").matches;

  async function telecharger() {
    setStatut(t("pages.createurTierUI.exportEnCours"));
    try {
      const date = new Intl.DateTimeFormat(LOCALE_HTML[langue], { dateStyle: "long" }).format(new Date());
      const blob = await exporterImage(etat, {
        titre: titreImage,
        pied: `${new URL(site.url).host} · ${date}`,
        heros: parSlug,
      });
      const fichier = `${cleRecherche(titreImage).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tier-list-mlbb"}.png`;
      const piece = new File([blob], fichier, { type: "image/png" });
      if (tactile() && navigator.canShare?.({ files: [piece] })) {
        try {
          await navigator.share({ files: [piece], title: titreImage });
          setStatut(t("pages.createurTierUI.exportPartage"));
          return;
        } catch (e) {
          if ((e as DOMException).name === "AbortError") {
            setStatut("");
            return;
          }
        }
      }
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = fichier;
      document.body.append(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatut(t("pages.createurTierUI.exportOk"));
    } catch {
      setStatut(t("pages.createurTierUI.exportErreur"));
    }
  }

  async function partagerLien() {
    const url = `${window.location.origin}${window.location.pathname}?l=${await encoderTier(etat)}`;
    if (tactile() && typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title: titreImage });
        setStatut(t("pages.createurTierUI.lienPartage"));
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatut(t("pages.createurTierUI.lienCopie"));
    } catch {
      setStatut(t("pages.createurTierUI.lienErreur"));
    }
  }

  const choisi = selection ? parSlug.get(selection) : undefined;
  const rangeeChoisie = selection ? rangeeDe(etat, selection) : undefined;

  function tuile(h: HerosTier, tabIndex: number, avecNom: boolean) {
    const actif = selection === h.slug;
    return (
      <button
        type="button"
        data-heros={h.slug}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", h.slug);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setSurvol(null)}
        onClick={() => basculerSelection(h.slug)}
        onKeyDown={(e) => toucheHeros(e, h.slug)}
        aria-pressed={actif}
        tabIndex={tabIndex}
        title={h.nom}
        className={cn(
          "bevel-sm flex flex-col items-center gap-0.5 p-0.5 outline-offset-1 transition-transform motion-reduce:transition-none",
          actif ? "scale-105 bg-gold-500 motion-reduce:scale-100" : "hover:bg-night-800",
        )}
      >
        {/* L'image, glissable par defaut, prendrait le geste a la place du bouton. */}
        <PortraitHeros source={h.icone} nom={h.nom} taille="icone" decoratif className="pointer-events-none" />
        {avecNom ? (
          <span className={cn("w-12 truncate text-center text-[0.6rem]", actif ? "text-night-950" : "text-chalk-400")}>
            {h.nom}
          </span>
        ) : (
          <span className="sr-only">{h.nom}</span>
        )}
      </button>
    );
  }

  return (
    <div ref={racine} className={cn("space-y-6", selection && "pb-36 sm:pb-24")}>
      {precedente && (
        <div className="bevel-sm flex flex-wrap items-center justify-between gap-3 border border-azure-500/50 bg-azure-500/10 px-4 py-3 text-sm text-chalk-200">
          <span>{t("pages.createurTierUI.partageeBandeau")}</span>
          <span className="flex gap-2">
            <button type="button" onClick={restaurer} className={bouton}>
              <Undo2 size={15} aria-hidden />
              {t("pages.createurTierUI.revenirMaListe")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPrecedente(null);
                ecrireListe(CLE_PRECEDENTE, null);
              }}
              aria-label={t("pages.createurTierUI.fermer")}
              className={petitBouton}
            >
              <X size={15} aria-hidden />
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex-1">
          <span className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.createurTierUI.titreListe")}</span>
          <input
            type="text"
            value={etat.titre}
            maxLength={TITRE_MAX}
            placeholder={t("pages.createurTierUI.titreDefaut")}
            onChange={(e) => setEtat({ ...etat, titre: e.target.value })}
            className="bevel-sm mt-1 w-full border border-night-700 bg-night-950 px-3 py-2 font-heading text-lg font-bold text-chalk-100 outline-none transition-colors placeholder:text-chalk-600 focus:border-gold-500"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={telecharger} className={bouton}>
            <Download size={15} aria-hidden />
            {t("pages.createurTierUI.exporter")}
          </button>
          <button type="button" onClick={partagerLien} className={bouton}>
            <Link2 size={15} aria-hidden />
            {t("pages.createurTierUI.partagerLien")}
          </button>
          <button type="button" onClick={vider} className={bouton}>
            <RotateCcw size={15} aria-hidden />
            {t("pages.createurTierUI.vider")}
          </button>
          <button type="button" onClick={reinitialiser} className={bouton}>
            <Trash2 size={15} aria-hidden />
            {t("pages.createurTierUI.reinitialiser")}
          </button>
        </div>
      </div>
      <p aria-live="polite" className="-mt-3 min-h-5 text-sm text-chalk-300">
        {statut}
      </p>

      <details className="bevel-sm border border-night-700/70 bg-night-900/40 px-4 py-3 text-sm text-chalk-300">
        <summary className="cursor-pointer font-semibold text-chalk-100">
          <Wand2 size={15} aria-hidden className="mr-1.5 inline text-gold-400" />
          {t("pages.createurTierUI.preremplirTitre")}
        </summary>
        <p className="mt-2 leading-relaxed">{t("pages.createurTierUI.preremplirIntro")}</p>
        <ChoixRang rangs={rangs} rang={rang} onChange={setRang} className="mt-3" />
        <button type="button" onClick={chargerMeta} className={cn(bouton, "mt-3")}>
          <Wand2 size={15} aria-hidden />
          {t("pages.createurTierUI.preremplir", { rang: t(`rangsMesure.${rang}`) })}
        </button>
      </details>

      <section aria-label={t("pages.createurTierUI.rangees")} className="space-y-1">
        {etat.rangees.map((r, i) => (
          <div key={r.id}>
            <div className="flex min-h-[3.75rem] border border-night-700/70 bg-night-900/60">
              {selection ? (
                <button
                  type="button"
                  onClick={(e) => poser(selection, r.id, null, e.detail === 0)}
                  aria-label={t("pages.createurTierUI.placerIci", { nom: nom(selection), rangee: nomRangee(r) })}
                  className="grid w-16 shrink-0 place-items-center break-all p-1 text-center font-heading text-lg font-bold ring-inset hover:ring-2 hover:ring-white/70 sm:w-24"
                  style={{ background: r.couleur, color: couleurTexte(r.couleur) }}
                >
                  {nomRangee(r)}
                </button>
              ) : (
                <div
                  className="grid w-16 shrink-0 place-items-center break-all p-1 text-center font-heading text-lg font-bold sm:w-24"
                  style={{ background: r.couleur, color: couleurTexte(r.couleur) }}
                >
                  {nomRangee(r)}
                </div>
              )}
              <ul
                aria-label={t("pages.createurTierUI.contenuRangee", { nom: nomRangee(r), n: r.heros.length, i: i + 1 })}
                onKeyDown={naviguer}
                onClick={(e) => {
                  if (selection && e.target === e.currentTarget) poser(selection, r.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (survol !== r.id) setSurvol(r.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSurvol(null);
                }}
                onDrop={(e) => deposer(e, r.id)}
                className={cn(
                  "flex min-w-0 flex-1 flex-wrap content-start gap-1 p-1 transition-colors",
                  survol === r.id && "bg-gold-500/15",
                  selection && "cursor-pointer hover:bg-night-850",
                )}
              >
                {r.heros.map((s, k) => {
                  const h = parSlug.get(s);
                  return h ? <li key={s}>{tuile(h, k === 0 ? 0 : -1, false)}</li> : null;
                })}
              </ul>
              <button
                type="button"
                onClick={() => setEdition(edition === r.id ? null : r.id)}
                aria-expanded={edition === r.id}
                aria-label={t("pages.createurTierUI.modifierRangee", { nom: nomRangee(r) })}
                className="grid w-9 shrink-0 place-items-center border-l border-night-700/70 text-chalk-500 transition-colors hover:text-gold-400"
              >
                <Settings2 size={16} aria-hidden />
              </button>
            </div>
            {edition === r.id && (
              <PanneauRangee
                rangee={r}
                premiere={i === 0}
                derniere={i === etat.rangees.length - 1}
                seule={etat.rangees.length <= 1}
                onModifier={(champs) => setEtat(modifierRangee(etat, r.id, champs))}
                onDeplacer={(delta) => setEtat(deplacerRangee(etat, r.id, delta))}
                onSupprimer={() => supprimer(r)}
                onFermer={() => setEdition(null)}
              />
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={ajouter}
          disabled={etat.rangees.length >= MAX_RANGEES}
          className={cn(bouton, "mt-2 w-full")}
        >
          <Plus size={15} aria-hidden />
          {t("pages.createurTierUI.ajouterRangee")}
        </button>
      </section>

      <section
        aria-labelledby="reserve-titre"
        onDragOver={(e) => {
          e.preventDefault();
          if (survol !== "reserve") setSurvol("reserve");
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSurvol(null);
        }}
        onDrop={(e) => deposer(e, null)}
        className={cn(
          "bevel border border-night-700/70 bg-night-900/40 p-4 transition-colors",
          survol === "reserve" && "border-gold-500/60 bg-gold-500/5",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="reserve-titre" className="font-heading text-xl font-bold text-chalk-100">
            {t("pages.createurTierUI.reserve")}
          </h2>
          <p className="text-xs text-chalk-500">
            {t("pages.createurTierUI.reserveCompte", { n: heros.length - places.size, total: heros.length })}
          </p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-chalk-500">{t("pages.createurTierUI.aide")}</p>

        <div className="mt-3 space-y-2">
          <ChampRecherche dense valeur={recherche} onChange={setRecherche} libelle={t("draftUI.rechercher")} />
          <GroupeFiltres legende={t("draftUI.filtreRole")} largeurLegende="w-16" className="gap-1.5">
            <Puce dense actif={role === null} onClick={() => setRole(null)}>
              {t("draftUI.tousRoles")}
            </Puce>
            {ROLES.map((r) => (
              <Puce dense key={r} actif={role === r} onClick={() => setRole(role === r ? null : r)}>
                {t(`roles.${r}`)}
              </Puce>
            ))}
          </GroupeFiltres>
          <GroupeFiltres legende={t("draftUI.filtreLane")} largeurLegende="w-16" className="gap-1.5">
            <Puce dense actif={lane === null} onClick={() => setLane(null)}>
              {t("draftUI.toutesLanes")}
            </Puce>
            {LANES.map((l) => (
              <Puce dense key={l} actif={lane === l} onClick={() => setLane(lane === l ? null : l)}>
                {t(`lanes.${l}`)}
              </Puce>
            ))}
          </GroupeFiltres>
        </div>

        <ul
          aria-label={t("pages.createurTierUI.reserve")}
          onKeyDown={naviguer}
          onClick={(e) => {
            if (selection && places.has(selection) && e.target === e.currentTarget) poser(selection, null);
          }}
          className="mt-4 flex min-h-16 flex-wrap gap-1"
        >
          {reserve.map((h, k) => (
            <li key={h.slug}>{tuile(h, k === 0 ? 0 : -1, true)}</li>
          ))}
          {reserve.length === 0 && (
            <li className="w-full py-4 text-center text-sm text-chalk-500">
              {places.size === heros.length ? t("pages.createurTierUI.reserveVide") : t("draftUI.aucunHeros")}
            </li>
          )}
        </ul>
      </section>

      <p aria-live="polite" className="sr-only">
        {annonce}
      </p>

      {choisi && selection && (
        <div
          role="region"
          aria-label={t("pages.createurTierUI.barreAction", { nom: choisi.nom })}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-500/40 bg-night-900/95 px-3 py-2.5 shadow-2xl shadow-black/60 backdrop-blur-sm"
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <PortraitHeros source={choisi.icone} nom={choisi.nom} taille="petite" decoratif />
            <span className="mr-1 font-semibold text-chalk-100">{choisi.nom}</span>
            <span className="text-xs text-chalk-500">{t("pages.createurTierUI.placerDans")}</span>
            <span className="flex flex-wrap gap-1">
              {etat.rangees.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={(e) => poser(selection, r.id, null, e.detail === 0)}
                  aria-current={rangeeChoisie?.id === r.id ? "true" : undefined}
                  aria-label={t("pages.createurTierUI.placerIci", { nom: choisi.nom, rangee: nomRangee(r) })}
                  className={cn(
                    "bevel-sm h-9 min-w-9 max-w-24 truncate px-2 text-sm font-bold",
                    rangeeChoisie?.id === r.id && "ring-2 ring-white",
                  )}
                  style={{ background: r.couleur, color: couleurTexte(r.couleur) }}
                >
                  {nomRangee(r)}
                </button>
              ))}
            </span>
            <span className="ml-auto flex gap-1">
              {rangeeChoisie && (
                <>
                  <button
                    type="button"
                    onClick={(e) => decalerSelection(-1, e.detail === 0)}
                    aria-label={t("pages.createurTierUI.reculer")}
                    className={petitBouton}
                  >
                    <ArrowLeft size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => decalerSelection(1, e.detail === 0)}
                    aria-label={t("pages.createurTierUI.avancer")}
                    className={petitBouton}
                  >
                    <ArrowRight size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => poser(selection, null, null, e.detail === 0)}
                    className={cn(bouton, "h-9 py-0")}
                  >
                    {t("pages.createurTierUI.versReserve")}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label={t("pages.createurTierUI.deselectionner")}
                className={petitBouton}
              >
                <X size={15} aria-hidden />
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Reglages d'une rangee : nom, couleur, place, suppression. */
function PanneauRangee({
  rangee,
  premiere,
  derniere,
  seule,
  onModifier,
  onDeplacer,
  onSupprimer,
  onFermer,
}: {
  rangee: Rangee;
  premiere: boolean;
  derniere: boolean;
  seule: boolean;
  onModifier: (champs: Partial<Pick<Rangee, "nom" | "couleur">>) => void;
  onDeplacer: (delta: number) => void;
  onSupprimer: () => void;
  onFermer: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-end gap-3 border border-t-0 border-night-700/70 bg-night-950/60 p-3">
      <label className="min-w-40 flex-1">
        <span className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.createurTierUI.nomRangee")}</span>
        <input
          type="text"
          autoFocus
          value={rangee.nom}
          maxLength={NOM_MAX}
          onChange={(e) => onModifier({ nom: e.target.value })}
          onKeyDown={(e) => e.key === "Escape" && onFermer()}
          className="bevel-sm mt-1 w-full border border-night-700 bg-night-950 px-3 py-1.5 text-chalk-100 outline-none focus:border-gold-500"
        />
      </label>
      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.createurTierUI.couleur")}</legend>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onModifier({ couleur: c })}
              aria-pressed={rangee.couleur === c}
              aria-label={t("pages.createurTierUI.couleurNom", { couleur: c })}
              className={cn("bevel-sm size-8", rangee.couleur === c && "ring-2 ring-white")}
              style={{ background: c }}
            />
          ))}
          <label className="bevel-sm grid size-8 cursor-pointer place-items-center overflow-hidden border border-night-600">
            <span className="sr-only">{t("pages.createurTierUI.couleurPerso")}</span>
            <input
              type="color"
              value={rangee.couleur}
              onChange={(e) => onModifier({ couleur: e.target.value })}
              className="size-10 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </fieldset>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onDeplacer(-1)}
          disabled={premiere}
          aria-label={t("pages.createurTierUI.monter")}
          className={petitBouton}
        >
          <ArrowUp size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDeplacer(1)}
          disabled={derniere}
          aria-label={t("pages.createurTierUI.descendre")}
          className={petitBouton}
        >
          <ArrowDown size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onSupprimer}
          disabled={seule}
          aria-label={t("pages.createurTierUI.supprimerRangee", { nom: rangee.nom || "—" })}
          className={cn(petitBouton, "hover:border-blood-500 hover:text-blood-500")}
        >
          <Trash2 size={15} aria-hidden />
        </button>
        <button type="button" onClick={onFermer} aria-label={t("pages.createurTierUI.fermer")} className={petitBouton}>
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}

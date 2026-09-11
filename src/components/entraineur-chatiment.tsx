"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { Copy, Crown, Download, Flame, Share2, Sparkles, Trophy, Turtle, Zap } from "lucide-react";
import { Puce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import { HAUTEUR_CARTE, LARGEUR_CARTE, dessinerCarte } from "@/lib/carte-chatiment";
import {
  CLES_OBJECTIFS,
  DIFFICULTES_ORDRE,
  MANCHES_PAR_SERIE,
  NIVEAU_MAX,
  NIVEAU_MIN,
  OBJECTIFS,
  RECHARGE_CHATIMENT_S,
  REGLAGES,
  apresManche,
  apresSerie,
  bilanSerie,
  cleRecord,
  coupSuivant,
  creerAlea,
  degatsChatiment,
  evaluerFrappe,
  lireRecords,
  preparerManche,
  resultatRate,
  resultatVole,
  type CleObjectif,
  type Coup,
  type Difficulte,
  type Manche,
  type Records,
  type Resultat,
} from "@/lib/chatiment";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Entraineur de Chatiment : la barre de vie d'un monstre fond sous les coups
 * de l'equipe, et le joueur frappe (gros bouton, Espace ou Entree) des que les
 * PV passent sous les degats de son Chatiment. Trop tot, le sort part dans le
 * vide ; trop tard, le jungler adverse l'emporte.
 *
 * Tout se joue dans le navigateur, sans requete : une fois la page visitee, le
 * service worker la sert hors ligne. Records et suites restent sur l'appareil.
 */
const CLE_STOCKAGE = "mlbb_chatiment";
const EVENEMENT_RECORDS = "mlbb-chatiment";
const ICONES: Record<CleObjectif, LucideIcon> = {
  tortue: Turtle,
  seigneur: Crown,
  "seigneur-12": Crown,
  "buff-violet": Sparkles,
  "buff-orange": Flame,
};
/** Attente entre l'annonce d'une manche et le premier coup, en ms : impossible a anticiper. */
const PRET_MS: [number, number] = [700, 1300];
/** Apres un verdict, les appuis sont ignores un instant : un appui de trop ne relance pas la manche. */
const BLOCAGE_MS = 500;
const ECLATS_MAX = 6;

type Phase = "attente" | "pret" | "combat" | "resultat" | "bilan";
interface Eclat {
  id: number;
  degats: number;
  source: Coup["source"];
}

// Records : le navigateur est la source, lue comme un magasin externe. Sans
// stockage (navigation privee stricte), ils vivent en memoire le temps de la visite.
let memoire: string | null = null;
function lireBrut(): string | null {
  try {
    return localStorage.getItem(CLE_STOCKAGE) ?? memoire;
  } catch {
    return memoire;
  }
}
function enregistrer(records: Records) {
  memoire = JSON.stringify(records);
  try {
    localStorage.setItem(CLE_STOCKAGE, memoire);
  } catch {
    // Stockage refuse : la copie en memoire suffit.
  }
  window.dispatchEvent(new Event(EVENEMENT_RECORDS));
}
function abonnerRecords(rappel: () => void) {
  window.addEventListener("storage", rappel);
  window.addEventListener(EVENEMENT_RECORDS, rappel);
  return () => {
    window.removeEventListener("storage", rappel);
    window.removeEventListener(EVENEMENT_RECORDS, rappel);
  };
}

const REQUETE_MOUVEMENT = "(prefers-reduced-motion: reduce)";
function abonnerMouvement(rappel: () => void) {
  const m = window.matchMedia(REQUETE_MOUVEMENT);
  m.addEventListener("change", rappel);
  return () => m.removeEventListener("change", rappel);
}
const mouvementReduit = () => window.matchMedia(REQUETE_MOUVEMENT).matches;

/** Horloge des reactions : jamais appelee pendant le rendu, seulement par les minuteries et les appuis. */
const horodatage = () => performance.now();

function graine(): number {
  const tirage = new Uint32Array(1);
  crypto.getRandomValues(tirage);
  return tirage[0];
}

/** Degats d'un coup, qui s'envolent au-dessus de la barre (immobiles si le mouvement est reduit). */
function ChiffreDegat({ eclat, texte, reduit }: { eclat: Eclat; texte: string; reduit: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reduit) return;
    ref.current?.animate?.(
      [
        { transform: "translateY(6px)", opacity: 1 },
        { transform: "translateY(-22px)", opacity: 0 },
      ],
      { duration: 800, easing: "ease-out", fill: "forwards" },
    );
  }, [reduit]);
  return (
    <span
      ref={ref}
      className={cn(
        "absolute bottom-0 font-titre font-bold tabular-nums",
        eclat.source === "competence" && "text-lg text-or-400",
        eclat.source === "adverse" && "text-lg text-sang-500",
        eclat.source === "allie" && "text-sm text-craie-200",
      )}
      style={{ left: `${6 + ((eclat.id * 37) % 78)}%` }}
    >
      −{texte}
    </span>
  );
}

export function EntraineurChatiment({ adresse }: { adresse: string }) {
  const t = useT();
  const langue = useLangue();
  const locale = LOCALE_HTML[langue];
  const nombre = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pourcent = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }), [locale]);
  const reduit = useSyncExternalStore(abonnerMouvement, mouvementReduit, () => false);
  const brut = useSyncExternalStore(abonnerRecords, lireBrut, () => null);
  const records = useMemo(() => lireRecords(brut), [brut]);
  const ids = { objectif: useId(), difficulte: useId(), niveau: useId(), aide: useId() };

  const [objectif, setObjectif] = useState<CleObjectif>("seigneur");
  const [difficulte, setDifficulte] = useState<Difficulte>("normal");
  const [niveau, setNiveau] = useState(OBJECTIFS.seigneur.niveauConseille);
  const [phase, setPhase] = useState<Phase>("attente");
  const [manche, setManche] = useState<Manche | null>(null);
  const [pv, setPv] = useState(0);
  const [eclats, setEclats] = useState<Eclat[]>([]);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [nouveauRecord, setNouveauRecord] = useState(false);
  const [annonce, setAnnonce] = useState("");
  const [partage, setPartage] = useState<"copie" | "erreur" | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);

  // Etat du combat, lu et ecrit par les minuteries : il vit hors du rendu.
  const jeu = useRef({
    phase: "attente" as Phase,
    objectif: "seigneur" as CleObjectif,
    difficulte: "normal" as Difficulte,
    niveau: OBJECTIFS.seigneur.niveauConseille,
    manche: null as Manche | null,
    pv: 0,
    franchiA: null as number | null,
    pvFranchissement: null as number | null,
    alea: Math.random,
    minuteries: [] as ReturnType<typeof setTimeout>[],
    resultats: [] as Resultat[],
    bloqueJusqua: 0,
    derniereTouche: 0,
    idEclat: 0,
    image: null as Blob | null,
    apercu: null as string | null,
  });
  const bouton = useRef<HTMLButtonElement>(null);

  const nomObjectif = (o: CleObjectif) => t(`outils.chatiment.objectif.${o}`);
  const nomDifficulte = (d: Difficulte) => t(`outils.chatiment.difficulte.${d}`);

  function changerPhase(p: Phase) {
    jeu.current.phase = p;
    setPhase(p);
  }

  function arreter() {
    jeu.current.minuteries.forEach(clearTimeout);
    jeu.current.minuteries = [];
  }

  function plusTard(action: () => void, ms: number) {
    jeu.current.minuteries.push(setTimeout(action, ms));
  }

  function verdict(r: Resultat): { titre: string; detail: string } {
    switch (r.issue) {
      case "securise":
        return {
          titre: t("outils.chatiment.issueSecurise"),
          detail: t("outils.chatiment.detailSecurise", {
            precision: pourcent.format(r.precision ?? 0),
            reaction: nombre.format(r.reaction ?? 0),
            points: nombre.format(r.points),
          }),
        };
      case "tropTot":
        return {
          titre: t("outils.chatiment.issueTropTot"),
          detail: t("outils.chatiment.detailTropTot", { reste: nombre.format(r.reste ?? 0), recharge: RECHARGE_CHATIMENT_S }),
        };
      case "vole":
        return {
          titre: t("outils.chatiment.issueVole"),
          detail: t("outils.chatiment.detailVole", { reaction: nombre.format(r.reactionAdverse ?? 0) }),
        };
      default:
        return { titre: t("outils.chatiment.issueRate"), detail: t("outils.chatiment.detailRate") };
    }
  }

  async function dessiner(serie: Resultat[], record: boolean): Promise<Blob | null> {
    const j = jeu.current;
    const b = bilanSerie(serie);
    const canvas = document.createElement("canvas");
    canvas.width = LARGEUR_CARTE;
    canvas.height = HAUTEUR_CARTE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await document.fonts?.ready;
    const style = getComputedStyle(document.documentElement);
    const police = (variable: string) => `${style.getPropertyValue(variable).trim() || "system-ui"}, system-ui, sans-serif`;
    dessinerCarte(ctx, {
      marque: site.nom,
      titre: t("outils.chatiment.carteTitre"),
      sousTitre: [nomObjectif(j.objectif), nomDifficulte(j.difficulte), t("outils.chatiment.niveauCourt", { n: j.niveau })]
        .join(" · "),
      score: nombre.format(b.total),
      libelleScore: t("outils.chatiment.points"),
      stats: [
        { libelle: t("outils.chatiment.securises"), valeur: `${b.securises}/${b.manches}` },
        {
          libelle: t("outils.chatiment.meilleureReaction"),
          valeur: b.meilleureReaction === null ? "—" : `${nombre.format(b.meilleureReaction)} ms`,
        },
        {
          libelle: t("outils.chatiment.precisionMoyenne"),
          valeur: b.precisionMoyenne === null ? "—" : pourcent.format(b.precisionMoyenne),
        },
      ],
      manches: serie.map((r) => r.issue),
      record: record ? t("outils.chatiment.nouveauRecord") : null,
      adresse: adresse.replace(/^https?:\/\//, ""),
      polices: { titre: police("--police-titre"), corps: police("--police-corps") },
    });
    return new Promise((ok) => canvas.toBlob(ok, "image/png"));
  }

  async function produireApercu(serie: Resultat[], record: boolean) {
    const image = await dessiner(serie, record);
    if (!image) return;
    const j = jeu.current;
    if (j.apercu) URL.revokeObjectURL(j.apercu);
    j.image = image;
    j.apercu = URL.createObjectURL(image);
    setApercu(j.apercu);
  }

  function terminer(r: Resultat) {
    const j = jeu.current;
    if (j.phase !== "combat") return;
    arreter();
    const serie = [...j.resultats, r];
    j.resultats = serie;
    setResultats(serie);
    let suivants = apresManche(lireRecords(lireBrut()), r.issue);
    let record = false;
    const fini = serie.length >= MANCHES_PAR_SERIE;
    if (fini) {
      const issue = apresSerie(
        suivants,
        cleRecord(j.objectif, j.difficulte),
        bilanSerie(serie),
        new Date().toISOString().slice(0, 10),
      );
      suivants = issue.records;
      record = issue.nouveau;
    }
    enregistrer(suivants);
    setNouveauRecord(record);
    j.bloqueJusqua = horodatage() + BLOCAGE_MS;
    changerPhase(fini ? "bilan" : "resultat");
    const v = verdict(r);
    const total = bilanSerie(serie).total;
    setAnnonce(`${v.titre} ${v.detail}${fini ? ` ${t("outils.chatiment.annonceBilan", { points: nombre.format(total) })}` : ""}`);
    if (fini) void produireApercu(serie, record);
  }

  function planifier() {
    const j = jeu.current;
    if (!j.manche) return;
    const coup = coupSuivant(j.pv, j.manche, j.difficulte, j.alea);
    plusTard(() => appliquer(coup), coup.intervalle);
  }

  function appliquer(coup: Coup) {
    const j = jeu.current;
    if (j.phase !== "combat" || !j.manche) return;
    j.pv = coup.pvApres;
    setPv(coup.pvApres);
    j.idEclat += 1;
    const eclat = { id: j.idEclat, degats: coup.degats, source: coup.source };
    setEclats((e) => [...e.slice(-(ECLATS_MAX - 1)), eclat]);
    if (j.franchiA === null && coup.pvApres <= j.manche.seuil) {
      j.franchiA = horodatage();
      j.pvFranchissement = coup.pvApres;
      const reaction = j.manche.reactionAdverse;
      plusTard(() => terminer(resultatVole(reaction)), reaction);
    }
    if (coup.pvApres <= 0) terminer(resultatRate());
    else planifier();
  }

  function lancer() {
    const j = jeu.current;
    arreter();
    if (j.resultats.length >= MANCHES_PAR_SERIE) {
      j.resultats = [];
      setResultats([]);
      setNouveauRecord(false);
    }
    j.alea = creerAlea(graine());
    j.objectif = objectif;
    j.difficulte = difficulte;
    j.niveau = niveau;
    const m = preparerManche(objectif, difficulte, niveau, j.alea);
    j.manche = m;
    j.pv = m.pvDepart;
    j.franchiA = null;
    j.pvFranchissement = null;
    setManche(m);
    setPv(m.pvDepart);
    setEclats([]);
    changerPhase("pret");
    setAnnonce(
      t("outils.chatiment.annonceManche", {
        n: j.resultats.length + 1,
        total: MANCHES_PAR_SERIE,
        objectif: nomObjectif(objectif),
      }),
    );
    const attente = PRET_MS[0] + (PRET_MS[1] - PRET_MS[0]) * j.alea();
    plusTard(() => {
      changerPhase("combat");
      planifier();
    }, attente);
  }

  function frapper() {
    const j = jeu.current;
    const instant = horodatage();
    if (j.phase === "combat" && j.manche) {
      terminer(
        evaluerFrappe({
          pv: j.pv,
          seuil: j.manche.seuil,
          pvFranchissement: j.pvFranchissement,
          reaction: j.franchiA === null ? null : instant - j.franchiA,
        }),
      );
    } else if (j.phase !== "pret" && instant >= j.bloqueJusqua) {
      lancer();
    }
  }

  function reinitialiser() {
    arreter();
    const j = jeu.current;
    j.resultats = [];
    j.manche = null;
    setResultats([]);
    setManche(null);
    setEclats([]);
    setNouveauRecord(false);
    setAnnonce("");
    changerPhase("attente");
  }

  // Le raccourci clavier appelle toujours la version courante de `frapper`.
  const frapperCourant = useRef(frapper);
  useEffect(() => {
    frapperCourant.current = frapper;
  });

  useEffect(() => {
    const j = jeu.current;
    const cibleIgnoree = (e: KeyboardEvent) => {
      const cible = e.target instanceof HTMLElement ? e.target : null;
      if (cible?.closest("input, select, textarea, [contenteditable='true']")) return true;
      // Hors combat, Espace garde son role sur les autres boutons et liens.
      return j.phase !== "combat" && !!cible?.closest("button, a, summary") && cible !== bouton.current;
    };
    const enfoncer = (e: KeyboardEvent) => {
      if (e.code !== "Space" || cibleIgnoree(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      j.derniereTouche = horodatage();
      frapperCourant.current();
    };
    const relacher = (e: KeyboardEvent) => {
      if (e.code === "Space") j.derniereTouche = horodatage();
    };
    window.addEventListener("keydown", enfoncer);
    window.addEventListener("keyup", relacher);
    return () => {
      window.removeEventListener("keydown", enfoncer);
      window.removeEventListener("keyup", relacher);
      j.minuteries.forEach(clearTimeout);
      if (j.apercu) URL.revokeObjectURL(j.apercu);
    };
  }, []);

  const bilan = phase === "bilan" ? bilanSerie(resultats) : null;
  const texte = bilan
    ? t("outils.chatiment.textePartage", {
        objectif: nomObjectif(objectif),
        difficulte: nomDifficulte(difficulte),
        points: nombre.format(bilan.total),
        securises: bilan.securises,
        manches: bilan.manches,
      })
    : "";

  function signaler(etat: "copie" | "erreur") {
    setPartage(etat);
    setTimeout(() => setPartage(null), 3000);
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(`${texte} ${adresse}`);
      signaler("copie");
    } catch {
      signaler("erreur");
    }
  }

  async function partager() {
    const image = jeu.current.image;
    try {
      const fichier = image ? new File([image], "mlbbdex-retribution.png", { type: "image/png" }) : null;
      if (fichier && navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: t("outils.chatiment.carteTitre"), text: `${texte} ${adresse}` });
      } else if (typeof navigator.share === "function") {
        await navigator.share({ title: t("outils.chatiment.carteTitre"), text: texte, url: adresse });
      } else {
        await copier();
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) signaler("erreur");
    }
  }

  const o = OBJECTIFS[objectif];
  const reglage = REGLAGES[difficulte];
  const seuil = degatsChatiment(niveau);
  const Icone = ICONES[objectif];
  const pvMax = manche?.pvMax ?? o.pv;
  const pvAffiche = manche ? pv : o.pv;
  const verrouille = phase === "pret" || phase === "combat";
  const dernier = phase === "resultat" || phase === "bilan" ? (resultats.at(-1) ?? null) : null;
  const record = records.series[cleRecord(objectif, difficulte)];
  const mancheCourante = Math.min(MANCHES_PAR_SERIE, resultats.length + (verrouille ? 1 : 0));
  const segment = (o.segment / pvMax) * 100;
  const libelleBouton = {
    attente: t("outils.chatiment.commencer"),
    pret: t("outils.chatiment.pret"),
    combat: t("outils.chatiment.frapper"),
    resultat: t("outils.chatiment.suivante"),
    bilan: t("outils.chatiment.nouvelleSerie"),
  }[phase];

  return (
    <div className="space-y-6">
      <Carte>
        <fieldset disabled={verrouille} className="space-y-5 disabled:opacity-60">
          <legend className="sr-only">{t("outils.chatiment.reglages")}</legend>
          <div>
            <p id={ids.objectif} className="text-xs uppercase tracking-wide text-craie-500">
              {t("outils.chatiment.objectifLabel")}
            </p>
            <div role="group" aria-labelledby={ids.objectif} className="mt-2 flex flex-wrap gap-2">
              {CLES_OBJECTIFS.map((cle) => {
                const IconeObjectif = ICONES[cle];
                return (
                  <Puce
                    key={cle}
                    actif={cle === objectif}
                    onClick={() => {
                      setObjectif(cle);
                      setNiveau(OBJECTIFS[cle].niveauConseille);
                      reinitialiser();
                    }}
                  >
                    <IconeObjectif size={14} aria-hidden className="-mt-0.5 mr-1.5 inline" />
                    {nomObjectif(cle)}
                  </Puce>
                );
              })}
            </div>
          </div>

          <div>
            <p id={ids.difficulte} className="text-xs uppercase tracking-wide text-craie-500">
              {t("outils.chatiment.difficulteLabel")}
            </p>
            <div role="group" aria-labelledby={ids.difficulte} className="mt-2 flex flex-wrap gap-2">
              {DIFFICULTES_ORDRE.map((d) => (
                <Puce
                  key={d}
                  actif={d === difficulte}
                  onClick={() => {
                    setDifficulte(d);
                    reinitialiser();
                  }}
                >
                  {nomDifficulte(d)}
                </Puce>
              ))}
            </div>
            <p className="mt-2 text-sm text-craie-400">{t(`outils.chatiment.aideDifficulte.${difficulte}`)}</p>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <label htmlFor={ids.niveau} className="text-xs uppercase tracking-wide text-craie-500">
                {t("outils.chatiment.niveauLabel")}
              </label>
              <select
                id={ids.niveau}
                value={niveau}
                onChange={(e) => {
                  setNiveau(Number(e.target.value));
                  reinitialiser();
                }}
                className="biseau-sm mt-1.5 block border border-nuit-700 bg-nuit-900 px-3 py-2 text-craie-100 outline-none focus:border-or-500"
              >
                {Array.from({ length: NIVEAU_MAX - NIVEAU_MIN + 1 }, (_, i) => NIVEAU_MIN + i).map((n) => (
                  <option key={n} value={n}>
                    {t("outils.chatiment.niveauOption", { n, degats: nombre.format(degatsChatiment(n)) })}
                  </option>
                ))}
              </select>
            </div>
            <p className="pb-2 text-sm text-craie-300">
              {t("outils.chatiment.seuilPhrase", { degats: nombre.format(seuil), conseille: o.niveauConseille })}
            </p>
          </div>
        </fieldset>
      </Carte>

      <Carte className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="biseau-sm grid size-11 place-items-center bg-nuit-800 text-or-400">
              <Icone size={24} />
            </span>
            <div>
              <h2 className="font-titre text-xl font-bold text-craie-100">{nomObjectif(objectif)}</h2>
              <p className="text-sm text-craie-500">
                {t("outils.chatiment.pvMax", { pv: nombre.format(o.pv) })} · {nomDifficulte(difficulte)}
              </p>
            </div>
          </div>
          <dl className="flex gap-5 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{t("outils.chatiment.manche")}</dt>
              <dd className="font-titre text-lg font-bold tabular-nums text-craie-100">
                {mancheCourante}/{MANCHES_PAR_SERIE}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{t("outils.chatiment.score")}</dt>
              <dd className="font-titre text-lg font-bold tabular-nums text-or-400">
                {nombre.format(resultats.reduce((s, r) => s + r.points, 0))}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{t("outils.chatiment.suite")}</dt>
              <dd className="font-titre text-lg font-bold tabular-nums text-craie-100">{nombre.format(records.enCours)}</dd>
            </div>
          </dl>
        </div>

        <div className="relative pt-9">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-9">
            {(reduit ? eclats.slice(-1) : eclats).map((e) => (
              <ChiffreDegat key={e.id} eclat={e} texte={nombre.format(e.degats)} reduit={reduit} />
            ))}
          </div>
          <div
            role="progressbar"
            aria-label={t("outils.chatiment.barre", { objectif: nomObjectif(objectif) })}
            aria-valuemin={0}
            aria-valuemax={pvMax}
            aria-valuenow={pvAffiche}
            className="relative h-8 overflow-hidden border border-nuit-600 bg-nuit-950"
          >
            <div
              className="h-full bg-gradient-to-r from-sang-500 to-[#ff8a5c] transition-[width] duration-100 ease-linear"
              style={{ width: `${Math.max(0, (pvAffiche / pvMax) * 100)}%` }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(to right, transparent 0 calc(${segment}% - 1px), rgba(6, 8, 15, 0.9) calc(${segment}% - 1px) ${segment}%)`,
              }}
            />
            {reglage.repere && (
              <div
                aria-hidden
                className="absolute inset-y-0 w-0.5 bg-or-400 shadow-[0_0_6px_#f5c451]"
                style={{ left: `${(seuil / pvMax) * 100}%` }}
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="tabular-nums text-craie-300">
              {reglage.pvChiffres
                ? t("outils.chatiment.pvRestants", { pv: nombre.format(pvAffiche), max: nombre.format(pvMax) })
                : t("outils.chatiment.pvMasques")}
            </span>
            <span className="text-craie-500">
              {reglage.repere ? t("outils.chatiment.repere", { degats: nombre.format(seuil) }) : t("outils.chatiment.sansRepere")}
            </span>
          </div>
        </div>

        <ol className="flex items-center gap-1.5" aria-label={t("outils.chatiment.manches")}>
          {Array.from({ length: MANCHES_PAR_SERIE }, (_, i) => {
            const r = resultats[i];
            return (
              <li
                key={i}
                className={cn(
                  "biseau-sm size-4 border",
                  !r && "border-nuit-600",
                  r?.issue === "securise" && "border-or-400 bg-or-400",
                  r && r.issue !== "securise" && "border-sang-500 bg-sang-500/30",
                )}
              >
                <span className="sr-only">
                  {r ? verdict(r).titre : t("outils.chatiment.aJouer")}
                </span>
              </li>
            );
          })}
        </ol>

        <button
          ref={bouton}
          type="button"
          onPointerDown={(e) => {
            if (e.button === 0) frapper();
          }}
          onClick={(e) => {
            // Clic clavier (Entree) ou d'aide technique ; le pointeur est deja traite a l'appui.
            if (e.detail === 0 && horodatage() - jeu.current.derniereTouche > BLOCAGE_MS) frapper();
          }}
          aria-keyshortcuts="Space"
          aria-describedby={ids.aide}
          className={cn(
            "biseau flex min-h-28 w-full touch-manipulation select-none flex-col items-center justify-center gap-1 font-titre text-2xl font-bold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-or-400",
            phase === "combat" && "bg-or-500 text-nuit-950 active:bg-or-400",
            phase === "pret" && "cursor-wait bg-nuit-700 text-craie-400",
            (phase === "attente" || phase === "resultat" || phase === "bilan") &&
              "bg-azur-500 text-nuit-950 hover:bg-azur-400",
          )}
        >
          <Zap size={28} aria-hidden />
          {libelleBouton}
        </button>
        <p id={ids.aide} className="text-center text-xs text-craie-500">
          {t("outils.chatiment.aide")}
        </p>

        {dernier && (
          <div
            className={cn(
              "biseau-sm border p-4",
              dernier.issue === "securise" ? "border-or-500/50 bg-or-500/10" : "border-sang-500/50 bg-sang-500/10",
            )}
          >
            <p
              className={cn(
                "font-titre text-xl font-bold",
                dernier.issue === "securise" ? "text-or-400" : "text-sang-500",
              )}
            >
              {verdict(dernier).titre}
            </p>
            <p className="mt-1 text-sm text-craie-200">{verdict(dernier).detail}</p>
          </div>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {annonce}
        </p>
      </Carte>

      {bilan && (
        <Carte className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-titre text-2xl font-bold text-craie-100">{t("outils.chatiment.bilanTitre")}</h2>
            {nouveauRecord && (
              <span className="biseau-sm bg-or-500 px-3 py-1 font-titre text-sm font-bold text-nuit-950">
                {t("outils.chatiment.nouveauRecord")}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{t("outils.chatiment.points")}</dt>
              <dd className="font-titre text-3xl font-bold tabular-nums text-or-400">{nombre.format(bilan.total)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{t("outils.chatiment.securises")}</dt>
              <dd className="font-titre text-3xl font-bold tabular-nums text-craie-100">
                {bilan.securises}/{bilan.manches}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{t("outils.chatiment.meilleureReaction")}</dt>
              <dd className="font-titre text-3xl font-bold tabular-nums text-craie-100">
                {bilan.meilleureReaction === null ? "—" : `${nombre.format(bilan.meilleureReaction)} ms`}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{t("outils.chatiment.precisionMoyenne")}</dt>
              <dd className="font-titre text-3xl font-bold tabular-nums text-craie-100">
                {bilan.precisionMoyenne === null ? "—" : pourcent.format(bilan.precisionMoyenne)}
              </dd>
            </div>
          </dl>

          {apercu && (
            // eslint-disable-next-line @next/next/no-img-element -- image generee dans le navigateur (URL blob)
            <img
              src={apercu}
              width={LARGEUR_CARTE}
              height={HAUTEUR_CARTE}
              alt={`${t("outils.chatiment.carteTitre")} — ${texte}`}
              className="biseau h-auto w-full border border-nuit-700"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={partager}
              className="biseau-sm inline-flex items-center gap-2 bg-or-500 px-4 py-2 text-sm font-semibold text-nuit-950 transition-colors hover:bg-or-400"
            >
              <Share2 size={16} aria-hidden />
              {t("outils.chatiment.partager")}
            </button>
            <button
              type="button"
              onClick={copier}
              className="biseau-sm inline-flex items-center gap-2 border border-nuit-600 px-4 py-2 text-sm font-semibold text-craie-200 transition-colors hover:border-or-500/60 hover:text-or-400"
            >
              <Copy size={16} aria-hidden />
              {t("outils.chatiment.copier")}
            </button>
            {apercu && (
              <a
                href={apercu}
                download="mlbbdex-retribution.png"
                className="biseau-sm inline-flex items-center gap-2 border border-nuit-600 px-4 py-2 text-sm font-semibold text-craie-200 transition-colors hover:border-or-500/60 hover:text-or-400"
              >
                <Download size={16} aria-hidden />
                {t("outils.chatiment.telecharger")}
              </a>
            )}
          </div>
          <p role="status" className="min-h-5 text-sm text-craie-400">
            {partage === "copie" && t("outils.chatiment.copie")}
            {partage === "erreur" && t("outils.chatiment.erreurPartage")}
          </p>
        </Carte>
      )}

      <Carte>
        <h2 className="flex items-center gap-2 font-titre text-lg font-bold text-craie-100">
          <Trophy size={18} aria-hidden className="text-or-400" />
          {t("outils.chatiment.recordsTitre")}
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-craie-500">
              {t("outils.chatiment.recordReglage", { objectif: nomObjectif(objectif), difficulte: nomDifficulte(difficulte) })}
            </dt>
            <dd className="font-titre text-xl font-bold tabular-nums text-or-400">
              {record ? nombre.format(record.total) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-craie-500">{t("outils.chatiment.suiteEnCours")}</dt>
            <dd className="font-titre text-xl font-bold tabular-nums text-craie-100">{nombre.format(records.enCours)}</dd>
          </div>
          <div>
            <dt className="text-craie-500">{t("outils.chatiment.meilleureSuite")}</dt>
            <dd className="font-titre text-xl font-bold tabular-nums text-craie-100">
              {nombre.format(records.meilleureSuite)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-craie-500">{t("outils.chatiment.recordsLocaux")}</p>
      </Carte>
    </div>
  );
}
